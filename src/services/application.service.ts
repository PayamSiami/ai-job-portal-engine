// src/services/applicationService.ts
import Application, {
  IApplication,
  ApplicationStatus,
} from "../models/Application.model.js";
import Job from "../models/Job.models.js";
import Resume from "../models/Resume.models.js";
import {
  Interview,
  InterviewStatus,
  InterviewType,
} from "../models/Interview.model.js";
import mongoose, { Types } from "mongoose";
import logger from "../utils/logger.js";
import { AppError } from "../utils/errorHandler.js";
import Company from "../models/Company.models.js";
import jobService from "./job.service.js";

// ============ Type Definitions ============

export interface ApplicationStats {
  total: number;
  pending: number;
  reviewing: number;
  shortlisted: number;
  interviewing: number;
  rejected: number;
  hired: number;
  averageAIScore: number;
  screeningCoverage: number;
  statusBreakdown: Record<string, number>;
  recentActivity: Array<{ date: string; count: number }>;
  applicationsByJob: Array<{ jobTitle: string; count: number }>;
  averageTimeToHire: number;
}

export interface CreateApplicationData {
  jobId: string;
  userId: string;
  resumeId: string;
  coverLetter?: string;
  expectedSalary?: number;
  availableFrom?: Date | string;
}

export interface UpdateApplicationData {
  status?: ApplicationStatus;
  aiScore?: number;
  aiExplanation?: string;
  aiStrengths?: string[];
  aiWeaknesses?: string[];
  aiRecommendation?: string;
  [key: string]: any;
}

export interface ApplicationFilters {
  status?: ApplicationStatus;
  jobId?: string;
  userId?: string;
  minScore?: number;
  maxScore?: number;
  fromDate?: Date;
  toDate?: Date;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ApplicationPaginationResult {
  applications: IApplication[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApplicationStatistics {
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  recentApplications: number;
}

export interface InterviewScheduleData {
  scheduledDate: Date;
  duration?: number;
  type?: string;
  location?: string;
  meetingLink?: string;
  interviewerIds?: string[];
  title?: string;
  timezone?: string;
  notes?: string;
}

// ============ Service Class ============

class ApplicationService {
  /**
   * Create a new application
   */
  async createApplication(data: CreateApplicationData): Promise<IApplication> {
    try {
      logger.info("Creating new application", {
        jobId: data.jobId,
        userId: data.userId,
      });

      // Validate required fields
      if (!data.jobId) throw new Error("Job ID is required");
      if (!data.userId) throw new Error("Applicant ID is required");
      if (!data.resumeId) throw new Error("Resume ID is required");
      if (!data.coverLetter || data.coverLetter.length < 50) {
        throw new Error("Cover letter must be at least 50 characters");
      }

      // Create the application
      const application = new Application({
        job: new Types.ObjectId(data.jobId),
        user: new Types.ObjectId(data.userId),
        resume: new Types.ObjectId(data.resumeId),
        coverLetter: data.coverLetter,
        expectedSalary: data.expectedSalary,
        availableFrom: data.availableFrom,
        status: ApplicationStatus.PENDING,
        appliedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await application.save();

      logger.info("Application created successfully", {
        applicationId: application._id,
      });

      return application;
    } catch (error) {
      logger.error("Failed to create application:", error);
      throw error;
    }
  }

  /**
   * Get application by ID with full population
   */
  async getApplicationById(
    applicationId: string | mongoose.Types.ObjectId,
    options: { populate?: boolean } = { populate: true },
  ): Promise<IApplication | null> {
    try {
      if (!applicationId) {
        throw new Error("Application ID is required");
      }

      if (!mongoose.Types.ObjectId.isValid(applicationId)) {
        throw new Error("Invalid application ID format");
      }

      // ✅ Build query
      let query = Application.findById(applicationId);

      if (options.populate !== false) {
        query = query
          .populate({
            path: "job",
            select:
              "title company location description requirements minSalary maxSalary workMode jobType isActive status skills postedBy",
          })
          .populate({
            path: "user",
            select: "-password -__v",
          })
          .populate({
            path: "resume",
            select:
              "title personalInfo skills experience education projects certifications languages status template visibility",
          })
          .populate({
            path: "interview",
          });
      }

      const application = await query.exec();

      if (!application) {
        logger.debug("Application not found", { applicationId });
        return null;
      }

      const result = application.toObject
        ? application.toObject()
        : application;
      return result as IApplication;
    } catch (error) {
      if (error instanceof mongoose.Error.CastError) {
        logger.error("Invalid application ID format", {
          applicationId,
          error: error.message,
        });
        throw new Error("Invalid application ID format");
      }

      logger.error("Failed to get application", {
        error: error instanceof Error ? error.message : "Unknown error",
        applicationId,
      });
      throw error;
    }
  }

  /**
   * Get applications with filters and pagination
   */
  async getApplications(
    filters: ApplicationFilters = {},
    options: PaginationOptions = {},
  ): Promise<ApplicationPaginationResult> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "appliedAt",
        sortOrder = "desc",
      } = options;
      const skip = (page - 1) * limit;

      const query: any = {};

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.jobId) {
        query.job = filters.jobId;
      }

      if (filters.userId) {
        query.user = filters.userId;
      }

      if (filters.minScore !== undefined || filters.maxScore !== undefined) {
        query.aiScore = {};
        if (filters.minScore !== undefined) {
          query.aiScore.$gte = filters.minScore;
        }
        if (filters.maxScore !== undefined) {
          query.aiScore.$lte = filters.maxScore;
        }
      }

      if (filters.fromDate || filters.toDate) {
        query.appliedAt = {};
        if (filters.fromDate) {
          query.appliedAt.$gte = filters.fromDate;
        }
        if (filters.toDate) {
          query.appliedAt.$lte = filters.toDate;
        }
      }

      const sort: any = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      const [applications, total] = await Promise.all([
        Application.find(query)
          .populate("job")
          .populate("user", "-password")
          .populate("resume")
          .populate("interview")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        Application.countDocuments(query),
      ]);

      return {
        applications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to get applications", {
        error: error instanceof Error ? error.message : "Unknown error",
        filters,
        options,
      });
      throw error;
    }
  }

  /**
   * Get applications by applicant
   */
  async getApplicationsByApplicant(
    userId: string,
    options: PaginationOptions = {},
  ): Promise<ApplicationPaginationResult> {
    return this.getApplications({ userId }, options);
  }

  /**
   * Get applications by job
   */
  async getApplicationsByJob(
    jobId: string,
    options: PaginationOptions = {},
  ): Promise<ApplicationPaginationResult> {
    return this.getApplications({ jobId }, options);
  }

  /**
   * Get applications by employer
   */
  async getApplicationsByEmployer(
    employerId: string,
    options: PaginationOptions & { jobId?: string; status?: string } = {},
  ): Promise<ApplicationPaginationResult> {
    try {
      // Get all jobs for this employer
      const jobs = await Job.find({ postedBy: employerId }).select("_id");
      const jobIds = jobs.map((job) => job._id.toString());

      if (jobIds.length === 0) {
        return {
          applications: [],
          pagination: {
            page: options.page || 1,
            limit: options.limit || 20,
            total: 0,
            pages: 0,
          },
        };
      }

      // Build query
      const filters: ApplicationFilters = {
        ...(options.status && { status: options.status as ApplicationStatus }),
        ...(options.jobId && { jobId: options.jobId }),
      };

      // Get applications
      return this.getApplications(filters, options);
    } catch (error) {
      logger.error("Failed to get applications by employer", {
        error: error instanceof Error ? error.message : "Unknown error",
        employerId,
      });
      throw error;
    }
  }

  /**
   * Check if user already applied to a job
   */
  async findByJobAndCandidate(
    jobId: string,
    userId: string,
  ): Promise<IApplication | null> {
    try {
      return await Application.findOne({
        job: new Types.ObjectId(jobId),
        user: new Types.ObjectId(userId),
      }).exec();
    } catch (error) {
      logger.error("Failed to find application by job and candidate", {
        error: error instanceof Error ? error.message : "Unknown error",
        jobId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update application
   */
  async updateApplication(
    applicationId: string | mongoose.Types.ObjectId,
    data: UpdateApplicationData,
  ): Promise<IApplication | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(applicationId)) {
        throw new Error("Invalid application ID");
      }

      const application = await Application.findById(applicationId);
      if (!application) {
        throw new Error("Application not found");
      }

      // Update fields
      Object.assign(application, data);
      application.updatedAt = new Date();

      await application.save();

      logger.info("Application updated", { applicationId, updates: data });
      return application;
    } catch (error) {
      logger.error("Failed to update application", {
        error: error instanceof Error ? error.message : "Unknown error",
        applicationId,
        data,
      });
      throw error;
    }
  }

  // src/services/applicationService.ts

  /**
   * Update application status with interview scheduling
   */
  async updateApplicationStatus(
    applicationId: string,
    status: ApplicationStatus,
    notes?: string,
    userId?: string,
    interviewData?: InterviewScheduleData,
  ): Promise<IApplication | null> {
    // ✅ Find the application with populated fields
    const application = await Application.findById(applicationId)
      .populate("jobId", "title companyName company")
      .populate("userId", "name email");

    if (!application) {
      throw new AppError("Application not found", 404);
    }

    // ✅ Check if status transition is valid
    this.validateStatusTransition(application.status, status);

    // ✅ Create status history entry
    const historyEntry = {
      status: status,
      notes: notes || "",
      updatedAt: new Date(),
      updatedBy: userId ? new Types.ObjectId(userId) : application.user,
    };

    // ✅ Update application
    const updateData: any = {
      status: status,
      $push: { statusHistory: historyEntry },
    };

    // ✅ Add withdrawal reason if withdrawing
    if (status === ApplicationStatus.WITHDRAWN) {
      updateData.withdrawnAt = new Date();
      updateData.withdrawalReason = notes || "Candidate withdrew application";
    }

    // ✅ Add hired date if hired
    if (status === ApplicationStatus.HIRED) {
      updateData.hiredAt = new Date();
    }

    // ✅ Add rejected date if rejected
    if (status === ApplicationStatus.REJECTED) {
      updateData.rejectedAt = new Date();
    }

    // ✅ Add notes if provided
    if (notes && status !== ApplicationStatus.WITHDRAWN) {
      updateData.notes = notes;
    }

    // ✅ Create interview if status is INTERVIEWING
    if (status === ApplicationStatus.INTERVIEWING && interviewData) {
      // Validate interview data
      if (!interviewData.scheduledDate) {
        throw new AppError("Scheduled date is required for interview", 400);
      }

      // Validate that scheduled date is in the future
      const scheduledDate = new Date(interviewData.scheduledDate);
      if (scheduledDate < new Date()) {
        throw new AppError("Interview date must be in the future", 400);
      }

      // Check if interview already exists for this application
      const existingInterview = await Interview.findOne({
        applicationId: applicationId,
        status: { $in: [InterviewStatus.SCHEDULED, InterviewStatus.CONFIRMED] },
      });

      if (existingInterview) {
        throw new AppError(
          "An interview is already scheduled for this application",
          400,
        );
      }

      // Get company ID from job
      const job = await Job.findById(application.job);
      const company = job?.company || null;

      // Create interview
      const interview = new Interview({
        applicationId: application._id,
        job: application.job,
        company: company,
        candidate: application.user,
        interviewerIds: interviewData.interviewerIds || [userId],
        title:
          interviewData.title ||
          `Interview for ${(application.job as any)?.title || "Position"}`,
        type: interviewData.type || InterviewType.VIDEO,
        status: InterviewStatus.SCHEDULED,
        scheduledDate: scheduledDate,
        duration: interviewData.duration || 60,
        location: interviewData.location,
        meetingLink: interviewData.meetingLink,
        timezone: interviewData.timezone || "UTC",
        notes: notes || "",
      });

      await interview.save();

      // ✅ Add interview reference to updateData
      updateData.interviewId = interview._id;
    }

    // ✅ Update the application
    const updatedApplication = await Application.findByIdAndUpdate(
      applicationId,
      updateData,
      { new: true, runValidators: true },
    );

    // ✅ Populate interview if exists
    if (updatedApplication?.interview) {
      await updatedApplication.populate("interviewId");
    }

    // ✅ Log status change
    logger.info("Application status updated", {
      applicationId,
      oldStatus: application.status,
      newStatus: status,
      userId,
    });

    return updatedApplication;
  }

  /**
   * ✅ NEW: Schedule interview for application
   */
  async scheduleInterview(
    applicationId: string,
    interviewData: InterviewScheduleData,
    userId: string,
  ): Promise<IApplication> {
    return this.updateApplicationStatus(
      applicationId,
      ApplicationStatus.INTERVIEWING,
      interviewData.notes || "Interview scheduled",
      userId,
      interviewData,
    ) as Promise<IApplication>;
  }

  /**
   * Withdraw an application (candidate cancels)
   */
  async withdrawApplication(
    applicationId: string,
    userId: string,
    reason?: string,
  ): Promise<IApplication | null> {
    const application = await Application.findById(applicationId);

    if (!application) {
      throw new AppError("Application not found", 404);
    }

    // ✅ Verify ownership
    if (application.user.toString() !== userId) {
      throw new AppError("You can only withdraw your own applications", 403);
    }

    // ✅ Check if already withdrawn or rejected
    if (application.status === ApplicationStatus.WITHDRAWN) {
      throw new AppError("Application already withdrawn", 400);
    }

    if (application.status === ApplicationStatus.HIRED) {
      throw new AppError("Cannot withdraw a hired application", 400);
    }

    if (application.status === ApplicationStatus.REJECTED) {
      throw new AppError("Cannot withdraw a rejected application", 400);
    }

    // ✅ Update application
    application.status = ApplicationStatus.WITHDRAWN;
    application.withdrawalReason = reason || "Candidate withdrew application";
    application.withdrawnAt = new Date();

    // ✅ Add to status history
    application.statusHistory.push({
      status: ApplicationStatus.WITHDRAWN,
      notes: reason || "Candidate withdrew application",
      updatedAt: new Date(),
      updatedBy: new mongoose.Types.ObjectId(userId),
    });

    await application.save();
    return application;
  }

  /**
   * Check if a candidate can withdraw
   */
  async canWithdraw(applicationId: string, userId: string): Promise<boolean> {
    const application = await Application.findById(applicationId);

    if (!application) return false;
    if (application.user.toString() !== userId) return false;

    const nonWithdrawableStatuses = [
      ApplicationStatus.HIRED,
      ApplicationStatus.REJECTED,
      ApplicationStatus.WITHDRAWN,
    ];

    return !nonWithdrawableStatuses.includes(application.status);
  }

  /**
   * Update application with AI screening results
   */
  async updateWithAIScore(
    applicationId: string,
    aiData: {
      score: number;
      explanation: string;
      strengths: string[];
      weaknesses: string[];
      recommendation: string;
    },
  ): Promise<IApplication | null> {
    return this.updateApplication(applicationId, {
      aiScore: aiData.score,
      aiExplanation: aiData.explanation,
      aiStrengths: aiData.strengths,
      aiWeaknesses: aiData.weaknesses,
      aiRecommendation: aiData.recommendation,
    });
  }

  /**
   * Delete application
   */
  async deleteApplication(applicationId: string): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(applicationId)) {
        throw new Error("Invalid application ID");
      }

      const result = await Application.findByIdAndDelete(applicationId);

      if (result) {
        logger.info("Application deleted", { applicationId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error("Failed to delete application", {
        error: error instanceof Error ? error.message : "Unknown error",
        applicationId,
      });
      throw error;
    }
  }

  /**
   * Get top applicants for a job
   */
  async getTopApplicants(
    jobId: string,
    limit: number = 10,
  ): Promise<IApplication[]> {
    try {
      const applications = await Application.find({
        jobId,
        aiScore: { $exists: true, $ne: null },
      })
        .populate("userId", "-password")
        .populate("resumeId")
        .populate("interviewId")
        .sort({ aiScore: -1 })
        .limit(limit)
        .exec();

      return applications;
    } catch (error) {
      logger.error("Failed to get top applicants", {
        error: error instanceof Error ? error.message : "Unknown error",
        jobId,
        limit,
      });
      throw error;
    }
  }

  /**
   * Check if user has applied to a job
   */
  async hasUserApplied(jobId: string, userId: string): Promise<boolean> {
    try {
      const application = await Application.findOne({
        jobId: new Types.ObjectId(jobId),
        userId: new Types.ObjectId(userId),
      });
      return !!application;
    } catch (error) {
      logger.error("Failed to check application status", {
        error: error instanceof Error ? error.message : "Unknown error",
        jobId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get applications by status
   */
  async getApplicationsByStatus(
    status: ApplicationStatus,
    options: PaginationOptions = {},
  ): Promise<ApplicationPaginationResult> {
    return this.getApplications({ status }, options);
  }

  /**
   * Bulk update application statuses
   */
  async bulkUpdateStatus(
    applicationIds: string[],
    status: ApplicationStatus,
    notes?: string,
  ): Promise<{ updated: number; failed: string[] }> {
    try {
      const failed: string[] = [];
      let updated = 0;

      for (const id of applicationIds) {
        try {
          const result = await this.updateApplicationStatus(id, status, notes);
          if (result) {
            updated++;
          } else {
            failed.push(id);
          }
        } catch (error) {
          failed.push(id);
          logger.error("Failed to update application status", {
            error: error instanceof Error ? error.message : "Unknown error",
            applicationId: id,
            status,
          });
        }
      }

      return { updated, failed };
    } catch (error) {
      logger.error("Failed to bulk update application statuses", {
        error: error instanceof Error ? error.message : "Unknown error",
        applicationIds,
        status,
      });
      throw error;
    }
  }

  async getApplicationTimeline(
    employerId: string,
    days: number = 30,
    status?: string,
  ): Promise<any[]> {
    const company = await Company.findOne({ ownerId: employerId });
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    const jobs = await Job.find({ company: company._id });
    const jobIds = jobs.map((job: any) => job._id);

    if (jobIds.length === 0) {
      return [];
    }

    const matchStage: any = {
      jobId: { $in: jobIds },
      createdAt: {
        $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      },
    };

    if (status) {
      matchStage.status = status;
    }

    const timeline = await Application.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
          applications: {
            $push: {
              id: "$_id",
              status: "$status",
              aiScore: "$aiScore",
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ] as any);

    return timeline.map((item: any) => ({
      date: item._id,
      count: item.count,
      applications: item.applications.slice(0, 10), // Limit details
    }));
  }

  async getApplicationStats(employerId: string): Promise<ApplicationStats> {
    // Validate employer ID
    if (!mongoose.Types.ObjectId.isValid(employerId)) {
      throw new Error("Invalid employer ID format");
    }

    // Get all jobs for this employer
    const jobs = await jobService.getJobsByEmployer(employerId, {
      page: 0,
      limit: 10,
    });
    const jobIds = jobs.map((job: any) => job._id);

    if (jobIds.length === 0) {
      return this.getEmptyApplicationStats();
    }

    // Type the pipeline as any[] to avoid TypeScript issues
    const pipeline: any[] = [
      {
        $match: {
          job: { $in: jobIds },
        },
      },
      {
        $facet: {
          statusCounts: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ],
          aiStats: [
            {
              $match: {
                aiScore: { $exists: true, $ne: null },
              },
            },
            {
              $group: {
                _id: null,
                averageAIScore: { $avg: "$aiScore" },
                totalScreened: { $sum: 1 },
              },
            },
          ],
          applicationsByJob: [
            {
              $lookup: {
                from: "jobs",
                localField: "job",
                foreignField: "_id",
                as: "jobData",
              },
            },
            {
              $unwind: {
                path: "$jobData",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $group: {
                _id: "$jobData.title",
                count: { $sum: 1 },
              },
            },
            {
              $sort: { count: -1 },
            },
            {
              $limit: 10,
            },
          ],
          recentActivity: [
            {
              $match: {
                createdAt: {
                  $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                count: { $sum: 1 },
              },
            },
            {
              $sort: { _id: 1 },
            },
          ],
          hiredApplications: [
            {
              $match: {
                status: ApplicationStatus.HIRED,
                createdAt: { $exists: true },
                updatedAt: { $exists: true },
              },
            },
            {
              $project: {
                timeToHire: {
                  $subtract: ["$updatedAt", "$createdAt"],
                },
              },
            },
          ],
        },
      },
    ];

    const result = await Application.aggregate(pipeline);
    const data = result[0] || {};

    // Process status counts
    const statusCounts: Record<string, number> = {};
    (data.statusCounts || []).forEach((item: any) => {
      statusCounts[item._id] = item.count;
    });

    // Process AI stats
    const aiStats = data.aiStats?.[0] || {
      averageAIScore: 0,
      totalScreened: 0,
    };

    // Calculate total applications
    const totalApplications = Object.values(statusCounts).reduce(
      (sum: number, count: number) => sum + count,
      0,
    );

    // Calculate screening coverage
    const screeningCoverage =
      totalApplications > 0
        ? (aiStats.totalScreened / totalApplications) * 100
        : 0;

    // Calculate average time to hire
    let averageTimeToHire = 0;
    if (data.hiredApplications && data.hiredApplications.length > 0) {
      const totalDays = data.hiredApplications.reduce(
        (sum: number, app: any) => {
          const days = app.timeToHire / (1000 * 60 * 60 * 24);
          return sum + days;
        },
        0,
      );
      averageTimeToHire = totalDays / data.hiredApplications.length;
    }

    return {
      total: totalApplications,
      pending: statusCounts[ApplicationStatus.PENDING] || 0,
      reviewing: statusCounts[ApplicationStatus.REVIEWING] || 0,
      shortlisted: statusCounts[ApplicationStatus.SHORTLISTED] || 0,
      interviewing: statusCounts[ApplicationStatus.INTERVIEWING] || 0,
      rejected: statusCounts[ApplicationStatus.REJECTED] || 0,
      hired: statusCounts[ApplicationStatus.HIRED] || 0,
      averageAIScore: Math.round((aiStats.averageAIScore || 0) * 100) / 100,
      screeningCoverage: Math.round(screeningCoverage * 100) / 100,
      statusBreakdown: {
        [ApplicationStatus.PENDING]:
          statusCounts[ApplicationStatus.PENDING] || 0,
        [ApplicationStatus.REVIEWING]:
          statusCounts[ApplicationStatus.REVIEWING] || 0,
        [ApplicationStatus.SHORTLISTED]:
          statusCounts[ApplicationStatus.SHORTLISTED] || 0,
        [ApplicationStatus.INTERVIEWING]:
          statusCounts[ApplicationStatus.INTERVIEWING] || 0,
        [ApplicationStatus.HIRED]: statusCounts[ApplicationStatus.HIRED] || 0,
        [ApplicationStatus.REJECTED]:
          statusCounts[ApplicationStatus.REJECTED] || 0,
        [ApplicationStatus.WITHDRAWN]:
          statusCounts[ApplicationStatus.WITHDRAWN] || 0,
      },
      recentActivity: (data.recentActivity || []).map((item: any) => ({
        date: item._id,
        count: item.count,
      })),
      applicationsByJob: (data.applicationsByJob || []).map((item: any) => ({
        jobTitle: item._id || "Unknown",
        count: item.count,
      })),
      averageTimeToHire: Math.round(averageTimeToHire * 100) / 100,
    };
  }

  // ============ Private Helper Methods ============
  /**
   * Validate status transition
   */
  private validateStatusTransition(
    currentStatus: ApplicationStatus,
    newStatus: ApplicationStatus,
  ): void {
    // ✅ Define valid transitions
    const validTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
      [ApplicationStatus.PENDING]: [
        ApplicationStatus.REVIEWING,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
      ],
      [ApplicationStatus.REVIEWING]: [
        ApplicationStatus.SHORTLISTED,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
      ],
      [ApplicationStatus.SHORTLISTED]: [
        ApplicationStatus.INTERVIEWING,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
      ],
      [ApplicationStatus.INTERVIEWING]: [
        ApplicationStatus.HIRED,
        ApplicationStatus.REJECTED,
        ApplicationStatus.WITHDRAWN,
      ],
      [ApplicationStatus.HIRED]: [], // Terminal state - no transitions
      [ApplicationStatus.REJECTED]: [], // Terminal state - no transitions
      [ApplicationStatus.WITHDRAWN]: [], // Terminal state - no transitions
    };

    // ✅ If status is the same, it's valid (no change)
    if (currentStatus === newStatus) {
      return;
    }

    // ✅ Check if the transition is allowed
    const allowedTransitions = validTransitions[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new AppError(
        `Invalid status transition from ${currentStatus} to ${newStatus}. ` +
          `Allowed transitions: ${allowedTransitions.join(", ") || "none"}`,
        400,
      );
    }

    // ✅ Terminal states cannot transition to anything
    const terminalStatuses = [
      ApplicationStatus.HIRED,
      ApplicationStatus.REJECTED,
      ApplicationStatus.WITHDRAWN,
    ];

    if (terminalStatuses.includes(currentStatus)) {
      throw new AppError(
        `Cannot transition from terminal status: ${currentStatus}`,
        400,
      );
    }

    // ✅ Prevent hiring without interviewing (unless already shortlisted)
    if (newStatus === ApplicationStatus.HIRED) {
      const canBeHired = [
        ApplicationStatus.INTERVIEWING,
        ApplicationStatus.SHORTLISTED,
      ];
      if (!canBeHired.includes(currentStatus)) {
        throw new AppError(
          `Cannot hire a candidate from ${currentStatus}. ` +
            `Must be ${canBeHired.join(" or ")} first.`,
          400,
        );
      }
    }

    // ✅ Prevent rejecting already hired candidates
    if (
      newStatus === ApplicationStatus.REJECTED &&
      currentStatus === ApplicationStatus.HIRED
    ) {
      throw new AppError("Cannot reject a hired candidate", 400);
    }

    // ✅ Prevent withdrawing after hiring
    if (
      newStatus === ApplicationStatus.WITHDRAWN &&
      currentStatus === ApplicationStatus.HIRED
    ) {
      throw new AppError("Cannot withdraw a hired application", 400);
    }
  }

  private getEmptyApplicationStats(): ApplicationStats {
    return {
      total: 0,
      pending: 0,
      reviewing: 0,
      shortlisted: 0,
      interviewing: 0,
      rejected: 0,
      hired: 0,
      averageAIScore: 0,
      screeningCoverage: 0,
      statusBreakdown: {
        [ApplicationStatus.PENDING]: 0,
        [ApplicationStatus.REVIEWING]: 0,
        [ApplicationStatus.SHORTLISTED]: 0,
        [ApplicationStatus.INTERVIEWING]: 0,
        [ApplicationStatus.HIRED]: 0,
        [ApplicationStatus.REJECTED]: 0,
        [ApplicationStatus.WITHDRAWN]: 0,
      },
      recentActivity: [],
      applicationsByJob: [],
      averageTimeToHire: 0,
    };
  }
}

export default new ApplicationService();
