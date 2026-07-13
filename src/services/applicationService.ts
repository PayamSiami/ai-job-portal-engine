// src/services/applicationService.ts
import Application, {
  IApplication,
  ApplicationStatus,
} from "../models/Application.model.js";
import Job from "../models/Job.models.js";
import Resume from "../models/Resume.models.js";
import mongoose, { Types } from "mongoose";
import logger from "../utils/logger.js";
import User from "../models/User.models.js";

// ============ Type Definitions ============

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
        jobId: new Types.ObjectId(data.jobId),
        userId: new Types.ObjectId(data.userId),
        resumeId: new Types.ObjectId(data.resumeId),
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

  // src/services/applicationService.ts

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
            path: "jobId",
            select:
              "title company location description requirements minSalary maxSalary workMode jobType isActive status skills postedBy",
          })
          .populate({
            path: "userId",
            select: "-password -__v",
          })
          .populate({
            path: "resumeId",
            select:
              "title personalInfo skills experience education projects certifications languages status template visibility",
          });
      }

      // ✅ Remove .lean() to keep Mongoose document methods
      const application = await query.exec();

      if (!application) {
        logger.debug("Application not found", { applicationId });
        return null;
      }

      // ✅ Convert to object and handle nested population
      const result = application.toObject
        ? application.toObject()
        : application;

      console.log(result);
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
        query.jobId = filters.jobId;
      }

      if (filters.userId) {
        query.userId = filters.userId;
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
          .populate("jobId")
          .populate("userId", "-password")
          .populate("resumeId")
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
        jobId: new Types.ObjectId(jobId),
        userId: new Types.ObjectId(userId),
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

      // Check if status update is allowed
      if (data.status) {
        this.validateStatusTransition(application.status, data.status);
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

  /**
   * Update application status
   */
  async updateApplicationStatus(
    applicationId: string,
    status: ApplicationStatus,
    notes?: string,
    userId?: string,
  ): Promise<IApplication | null> {
    const updateData: UpdateApplicationData = { status };

    // Add status history entry
    if (notes || userId) {
      const historyEntry = {
        status,
        notes: notes || "",
        changedBy: userId ? new Types.ObjectId(userId) : undefined,
        timestamp: new Date(),
      };

      // We need to handle this in the model - for now just update status
      // The model will handle status history automatically
    }

    return this.updateApplication(applicationId, updateData);
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
   * Get application statistics
   */
  async getApplicationStatistics(
    filters: ApplicationFilters = {},
  ): Promise<ApplicationStatistics> {
    try {
      const query: any = {};

      if (filters.jobId) {
        query.jobId = filters.jobId;
      }

      if (filters.userId) {
        query.userId = filters.userId;
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

      // Get statistics
      const [total, byStatusAgg, scoreStats, recentCount] = await Promise.all([
        Application.countDocuments(query),
        Application.aggregate([
          { $match: query },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),
        Application.aggregate([
          { $match: { ...query, aiScore: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: null,
              average: { $avg: "$aiScore" },
              max: { $max: "$aiScore" },
              min: { $min: "$aiScore" },
            },
          },
        ]),
        Application.countDocuments({
          ...query,
          appliedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        }),
      ]);

      // ✅ Initialize byStatus with all enum values
      const byStatus: Record<ApplicationStatus, number> = {
        [ApplicationStatus.PENDING]: 0,
        [ApplicationStatus.REVIEWING]: 0,
        [ApplicationStatus.SHORTLISTED]: 0,
        [ApplicationStatus.INTERVIEWING]: 0,
        [ApplicationStatus.HIRED]: 0,
        [ApplicationStatus.REJECTED]: 0,
      };

      // ✅ Type-safe iteration
      byStatusAgg.forEach((item: any) => {
        const status = item._id as ApplicationStatus;
        // ✅ Check if the status is a valid ApplicationStatus
        if (Object.values(ApplicationStatus).includes(status)) {
          byStatus[status] = item.count;
        }
      });

      return {
        total,
        byStatus,
        averageScore: scoreStats[0]?.average || 0,
        highestScore: scoreStats[0]?.max || 0,
        lowestScore: scoreStats[0]?.min || 0,
        recentApplications: recentCount,
      };
    } catch (error) {
      logger.error("Failed to get application statistics", {
        error: error instanceof Error ? error.message : "Unknown error",
        filters,
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

  // ============ Private Helper Methods ============

  /**
   * ✅ Fixed Status Transition Validation
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
      ],
      [ApplicationStatus.REVIEWING]: [
        ApplicationStatus.SHORTLISTED,
        ApplicationStatus.REJECTED,
      ],
      [ApplicationStatus.SHORTLISTED]: [
        ApplicationStatus.INTERVIEWING,
        ApplicationStatus.REJECTED,
      ],
      [ApplicationStatus.INTERVIEWING]: [
        ApplicationStatus.HIRED,
        ApplicationStatus.REJECTED,
      ],
      [ApplicationStatus.HIRED]: [],
      [ApplicationStatus.REJECTED]: [],
    };

    const allowed = validTransitions[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowed.join(", ") || "none"}`,
      );
    }
  }
}

export default new ApplicationService();
