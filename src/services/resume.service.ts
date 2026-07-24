// services/resume.service.ts
import { Types } from "mongoose";
import Resume from "../models/Resume.models.js";
import { AppError } from "../utils/errorHandler.js";
import logger from "../utils/logger.js";
import { CreateResumeDTO, UpdateResumeDTO } from "../types/resume.types.js";

class ResumeService {
  /**
   * Get all resumes for a user with pagination and filtering
   */
  async getResumesByUser(
    userId: string,
    options: {
      status?: string;
      page: number;
      limit: number;
      search?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    }
  ) {
    try {
      const { status, page, limit, search, sortBy = "createdAt", sortOrder = "desc" } = options;
      
      // Build filter
      const filter: any = { user: new Types.ObjectId(userId) };
      
      if (status && status !== "all") {
        filter.status = status;
      }
      
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: "i" } },
          { "personalInfo.firstName": { $regex: search, $options: "i" } },
          { "personalInfo.lastName": { $regex: search, $options: "i" } },
        ];
      }
      
      // Pagination
      const skip = (page - 1) * limit;
      const sortOptions: any = {};
      sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;
      
      // Execute query
      const [resumes, total] = await Promise.all([
        Resume.find(filter)
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Resume.countDocuments(filter),
      ]);
      
      const pages = Math.ceil(total / limit);
      
      return {
        resumes,
        pagination: {
          total,
          page,
          limit,
          pages,
        },
      };
    } catch (error) {
      logger.error("Get resumes by user error:", error);
      throw new AppError("Failed to fetch resumes", 500);
    }
  }

  /**
   * Get a single resume by ID
   */
  async getResume(resumeId: string, userId: string) {
    try {
      const resume = await Resume.findOne({
        _id: new Types.ObjectId(resumeId),
        user: new Types.ObjectId(userId),
      }).lean();
      
      return resume;
    } catch (error) {
      logger.error("Get resume error:", error);
      throw new AppError("Failed to fetch resume", 500);
    }
  }

  /**
   * Create a new resume
   */
  async createResume(userId: string, data: CreateResumeDTO) {
    try {
      // If this is the first resume or isDefault is true, set other resumes as not default
      if (data.isDefault) {
        await Resume.updateMany(
          { user: new Types.ObjectId(userId) },
          { isDefault: false }
        );
      }
      
      const resume = await Resume.create({
        user: new Types.ObjectId(userId),
        ...data,
        status: data.status || "draft",
      });
      
      return resume;
    } catch (error) {
      logger.error("Create resume error:", error);
      throw new AppError("Failed to create resume", 400);
    }
  }

  /**
   * Update an existing resume
   */
  async updateResume(resumeId: string, userId: string, data: UpdateResumeDTO) {
    try {
      // If setting as default, unset other defaults
      if (data.isDefault) {
        await Resume.updateMany(
          { user: new Types.ObjectId(userId) },
          { isDefault: false }
        );
      }
      
      const resume = await Resume.findOneAndUpdate(
        {
          _id: new Types.ObjectId(resumeId),
          user: new Types.ObjectId(userId),
        },
        {
          ...data,
          updatedAt: new Date(),
        },
        {
          new: true,
          runValidators: true,
        }
      ).lean();
      
      if (!resume) {
        throw new AppError("Resume not found", 404);
      }
      
      return resume;
    } catch (error) {
      logger.error("Update resume error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to update resume", 400);
    }
  }

  /**
   * Delete a resume
   */
  async deleteResume(resumeId: string, userId: string) {
    try {
      const result = await Resume.findOneAndDelete({
        _id: new Types.ObjectId(resumeId),
        user: new Types.ObjectId(userId),
      });
      
      if (!result) {
        throw new AppError("Resume not found", 404);
      }
      
      return result;
    } catch (error) {
      logger.error("Delete resume error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to delete resume", 500);
    }
  }

  /**
   * Duplicate an existing resume
   */
  async duplicateResume(resumeId: string, userId: string) {
    try {
      const sourceResume = await Resume.findOne({
        _id: new Types.ObjectId(resumeId),
        user: new Types.ObjectId(userId),
      });
      
      if (!sourceResume) {
        throw new AppError("Source resume not found", 404);
      }
      
      // Create new resume from source
      const newResume = await Resume.create({
        user: new Types.ObjectId(userId),
        title: `${sourceResume.title} (Copy)`,
        template: sourceResume.template,
        visibility: sourceResume.visibility || "private",
        status: "draft",
        isDefault: false,
        personalInfo: sourceResume.personalInfo,
        experience: sourceResume.experience,
        education: sourceResume.education,
        skills: sourceResume.skills,
        certifications: sourceResume.certifications,
        languages: sourceResume.languages,
        projects: sourceResume.projects,
        customSections: sourceResume.customSections,
      });
      
      return newResume;
    } catch (error) {
      logger.error("Duplicate resume error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to duplicate resume", 500);
    }
  }

  /**
   * Set a resume as default
   */
  async setDefaultResume(resumeId: string, userId: string) {
    try {
      // First, unset all defaults for this user
      await Resume.updateMany(
        { user: new Types.ObjectId(userId) },
        { isDefault: false }
      );
      
      // Then set the specific resume as default
      const resume = await Resume.findOneAndUpdate(
        {
          _id: new Types.ObjectId(resumeId),
          user: new Types.ObjectId(userId),
        },
        {
          isDefault: true,
          updatedAt: new Date(),
        },
        {
          new: true,
          runValidators: true,
        }
      ).lean();
      
      if (!resume) {
        throw new AppError("Resume not found", 404);
      }
      
      return resume;
    } catch (error) {
      logger.error("Set default resume error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to set default resume", 500);
    }
  }

  /**
   * Get resume statistics for a user
   */
  async getUserResumeStats(userId: string) {
    try {
      const stats = await Resume.aggregate([
        {
          $match: {
            user: new Types.ObjectId(userId),
          },
        },
        {
          $facet: {
            total: [{ $count: "count" }],
            byStatus: [
              {
                $group: {
                  _id: "$status",
                  count: { $sum: 1 },
                },
              },
            ],
            byTemplate: [
              {
                $group: {
                  _id: "$template",
                  count: { $sum: 1 },
                },
              },
            ],
            byVisibility: [
              {
                $group: {
                  _id: "$visibility",
                  count: { $sum: 1 },
                },
              },
            ],
            default: [
              {
                $match: { isDefault: true },
              },
              { $count: "count" },
            ],
            latest: [
              {
                $sort: { createdAt: -1 },
              },
              { $limit: 5 },
              {
                $project: {
                  _id: 1,
                  title: 1,
                  template: 1,
                  status: 1,
                  createdAt: 1,
                },
              },
            ],
          },
        },
      ]);
      
      const result = stats[0] || {};
      
      return {
        total: result.total?.[0]?.count || 0,
        byStatus: result.byStatus || [],
        byTemplate: result.byTemplate || [],
        byVisibility: result.byVisibility || [],
        hasDefault: (result.default?.[0]?.count || 0) > 0,
        latestResumes: result.latest || [],
      };
    } catch (error) {
      logger.error("Get resume stats error:", error);
      throw new AppError("Failed to get resume statistics", 500);
    }
  }

  /**
   * Bulk delete resumes
   */
  async bulkDeleteResumes(resumeIds: string[], userId: string) {
    try {
      const objectIds = resumeIds.map(id => new Types.ObjectId(id));
      
      const result = await Resume.deleteMany({
        _id: { $in: objectIds },
        user: new Types.ObjectId(userId),
      });
      
      return {
        deletedCount: result.deletedCount || 0,
        failedIds: result.deletedCount < resumeIds.length ? 
          resumeIds.filter((_, index) => result.deletedCount < resumeIds.length) : 
          [],
      };
    } catch (error) {
      logger.error("Bulk delete resumes error:", error);
      throw new AppError("Failed to delete resumes", 500);
    }
  }

  /**
   * Get default resume for a user
   */
  async getDefaultResume(userId: string) {
    try {
      const resume = await Resume.findOne({
        user: new Types.ObjectId(userId),
        isDefault: true,
      }).lean();
      
      return resume;
    } catch (error) {
      logger.error("Get default resume error:", error);
      throw new AppError("Failed to get default resume", 500);
    }
  }

  /**
   * Search resumes by keyword
   */
  async searchResumes(userId: string, query: string) {
    try {
      const resumes = await Resume.find({
        user: new Types.ObjectId(userId),
        $or: [
          { title: { $regex: query, $options: "i" } },
          { "personalInfo.firstName": { $regex: query, $options: "i" } },
          { "personalInfo.lastName": { $regex: query, $options: "i" } },
          { "personalInfo.summary": { $regex: query, $options: "i" } },
          { "skills.name": { $regex: query, $options: "i" } },
        ],
      }).lean();
      
      return resumes;
    } catch (error) {
      logger.error("Search resumes error:", error);
      throw new AppError("Failed to search resumes", 500);
    }
  }

  /**
   * Update resume status
   */
  async updateResumeStatus(resumeId: string, userId: string, status: string) {
    try {
      const resume = await Resume.findOneAndUpdate(
        {
          _id: new Types.ObjectId(resumeId),
          user: new Types.ObjectId(userId),
        },
        {
          status,
          updatedAt: new Date(),
        },
        {
          new: true,
          runValidators: true,
        }
      ).lean();
      
      if (!resume) {
        throw new AppError("Resume not found", 404);
      }
      
      return resume;
    } catch (error) {
      logger.error("Update resume status error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to update resume status", 500);
    }
  }

  /**
   * Get resumes by template type - FIXED VERSION
   */
  async getResumesByTemplate(userId: string, template: "modern" | "classic" | "minimal" | "creative") {
    try {
      const resumes = await Resume.find({
        user: new Types.ObjectId(userId),
        template: template, // Now properly typed
      }).lean();
      
      return resumes;
    } catch (error) {
      logger.error("Get resumes by template error:", error);
      throw new AppError("Failed to fetch resumes", 500);
    }
  }

  /**
   * Get recent resumes (last 30 days)
   */
  async getRecentResumes(userId: string, days: number = 30) {
    try {
      const date = new Date();
      date.setDate(date.getDate() - days);
      
      const resumes = await Resume.find({
        user: new Types.ObjectId(userId),
        createdAt: { $gte: date },
      })
      .sort({ createdAt: -1 })
      .lean();
      
      return resumes;
    } catch (error) {
      logger.error("Get recent resumes error:", error);
      throw new AppError("Failed to fetch recent resumes", 500);
    }
  }

  /**
   * Check if user has resumes
   */
  async hasResumes(userId: string): Promise<boolean> {
    try {
      const count = await Resume.countDocuments({
        user: new Types.ObjectId(userId),
      });
      
      return count > 0;
    } catch (error) {
      logger.error("Check resumes error:", error);
      return false;
    }
  }

  /**
   * Get resumes by user ID (alias for getResumesByUser)
   */
  async getResumesByUserId(userId: string, options: any) {
    return this.getResumesByUser(userId, options);
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(userId: string) {
    try {
      const stats = await Resume.aggregate([
        {
          $match: {
            user: new Types.ObjectId(userId),
          },
        },
        {
          $group: {
            _id: "$template",
            count: { $sum: 1 },
            resumes: { 
              $push: {
                _id: "$_id",
                title: "$title",
                status: "$status",
                createdAt: "$createdAt",
              }
            },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);
      
      return stats;
    } catch (error) {
      logger.error("Get template stats error:", error);
      throw new AppError("Failed to get template statistics", 500);
    }
  }

  /**
   * Get status statistics
   */
  async getStatusStats(userId: string) {
    try {
      const stats = await Resume.aggregate([
        {
          $match: {
            user: new Types.ObjectId(userId),
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);
      
      return stats;
    } catch (error) {
      logger.error("Get status stats error:", error);
      throw new AppError("Failed to get status statistics", 500);
    }
  }

  /**
   * Get resume count by user
   */
  async getResumeCount(userId: string): Promise<number> {
    try {
      return await Resume.countDocuments({
        user: new Types.ObjectId(userId),
      });
    } catch (error) {
      logger.error("Get resume count error:", error);
      return 0;
    }
  }
}

export default new ResumeService();