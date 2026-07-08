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
  applicantId: string;
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
  applicantId?: string;
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
        applicantId: data.applicantId,
      });

      // Validate required fields
      if (!data.jobId) throw new Error("Job ID is required");
      if (!data.applicantId) throw new Error("Applicant ID is required");
      if (!data.resumeId) throw new Error("Resume ID is required");
      if (!data.coverLetter || data.coverLetter.length < 50) {
        throw new Error("Cover letter must be at least 50 characters");
      }

      // Create the application
      const application = new Application({
        jobId: new Types.ObjectId(data.jobId),
        applicantId: new Types.ObjectId(data.applicantId),
        resumeId: new Types.ObjectId(data.resumeId),
        coverLetter: data.coverLetter,
        expectedSalary: data.expectedSalary,
        availableFrom: data.availableFrom,
        status: "pending",
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
      // Validate ID
      if (!applicationId) {
        throw new Error("Application ID is required");
      }

      if (!mongoose.Types.ObjectId.isValid(applicationId)) {
        throw new Error("Invalid application ID format");
      }

      // Build query
      let query = Application.findById(applicationId);

      // Conditionally populate
      if (options.populate !== false) {
        query = query
          .populate({
            path: "jobId",
            select:
              "title company location description requirements minSalary maxSalary workMode jobType isActive",
          })
          .populate({
            path: "applicantId",
            select: "-password -__v",
          })
          .populate({
            path: "resumeId",
            select: "title content skills experience education summary",
          });
      }

      const application = await query.lean().exec();

      if (!application) {
        logger.debug("Application not found", { applicationId });
      }

      return application as IApplication | null;
    } catch (error) {
      // Handle specific mongoose errors
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

      // Build query
      const query: any = {};

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.jobId) {
        query.jobId = filters.jobId;
      }

      if (filters.applicantId) {
        query.applicantId = filters.applicantId;
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

      // Build sort
      const sort: any = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      // Execute query
      const [applications, total] = await Promise.all([
        Application.find(query)
          .populate("jobId")
          .populate("applicantId", "-password")
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
    applicantId: string,
    options: PaginationOptions = {},
  ): Promise<ApplicationPaginationResult> {
    return this.getApplications({ applicantId }, options);
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
  ): Promise<IApplication | null> {
    return this.updateApplication(applicationId, { status });
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

      if (filters.applicantId) {
        query.applicantId = filters.applicantId;
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
        .populate("applicantId", "-password")
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
        jobId,
        applicantId: userId,
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
  ): Promise<{ updated: number; failed: string[] }> {
    try {
      const failed: string[] = [];
      let updated = 0;

      for (const id of applicationIds) {
        try {
          const result = await this.updateApplicationStatus(id, status);
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

  private validateStatusTransition(
    currentStatus: ApplicationStatus,
    newStatus: ApplicationStatus,
  ): void {
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
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }
}

export default new ApplicationService();
