// src/services/resumeService.ts
import Resume, { IResume } from "../models/Resume.models.js";
import mongoose from "mongoose";
import logger from "../utils/logger.js";

// ============ Type Definitions ============

export interface CreateResumeData {
  title: string;
  content: string;
  skills?: string[];
  experience?: {
    years?: number;
    level?: "entry" | "mid" | "senior" | "lead";
  };
  education?: {
    degree?: string;
    field?: string;
    institution?: string;
  };
  summary?: string;
  isDefault?: boolean;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
}

export interface UpdateResumeData {
  title?: string;
  content?: string;
  skills?: string[];
  experience?: {
    years?: number;
    level?: "entry" | "mid" | "senior" | "lead";
  };
  education?: {
    degree?: string;
    field?: string;
    institution?: string;
  };
  summary?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface ResumeFilters {
  userId?: string;
  isActive?: boolean;
  isDefault?: boolean;
  skills?: string[];
  experienceLevel?: "entry" | "mid" | "senior" | "lead";
  search?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ResumePaginationResult {
  resumes: IResume[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ============ Service Class ============

class ResumeService {
  /**
   * Create a new resume
   */
  async createResume(userId: string, data: CreateResumeData): Promise<IResume> {
    try {
      logger.info("Creating new resume", { userId, title: data.title });

      // Validate input
      if (!data.title) {
        throw new Error("Resume title is required");
      }
      if (!data.content || data.content.length < 50) {
        throw new Error("Resume content must be at least 50 characters");
      }

      // If this is set as default, unset other defaults
      if (data.isDefault) {
        await Resume.updateMany(
          { userId, isDefault: true },
          { isDefault: false },
        );
      }

      const resume = new Resume({
        ...data,
        userId,
        isActive: true,
        version: 1,
      });

      await resume.save();

      logger.info("Resume created successfully", { resumeId: resume._id });
      return resume;
    } catch (error) {
      logger.error("Failed to create resume", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
        data,
      });
      throw error;
    }
  }

  /**
   * Get resume by ID
   */
  async getResumeById(resumeId: string): Promise<IResume | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(resumeId)) {
        throw new Error("Invalid resume ID");
      }

      const resume = await Resume.findById(resumeId)
        .populate("userId", "username email")
        .exec();

      return resume;
    } catch (error) {
      logger.error("Failed to get resume", {
        error: error instanceof Error ? error.message : "Unknown error",
        resumeId,
      });
      throw error;
    }
  }

  /**
   * Get resumes by user
   */
  async getResumesByUser(
    userId: string,
    options: PaginationOptions = {},
  ): Promise<ResumePaginationResult> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;
      const skip = (page - 1) * limit;

      const query = { userId, isActive: true };
      const sort: any = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      const [resumes, total] = await Promise.all([
        Resume.find(query).sort(sort).skip(skip).limit(limit).exec(),
        Resume.countDocuments(query),
      ]);

      return {
        resumes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to get resumes by user", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });
      throw error;
    }
  }

  /**
   * Get default resume for user
   */
  async getDefaultResume(userId: string): Promise<IResume | null> {
    try {
      return Resume.findOne({ userId, isDefault: true, isActive: true }).exec();
    } catch (error) {
      logger.error("Failed to get default resume", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });
      throw error;
    }
  }

  /**
   * Get resumes with filters
   */
  async getResumes(
    filters: ResumeFilters = {},
    options: PaginationOptions = {},
  ): Promise<ResumePaginationResult> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;
      const skip = (page - 1) * limit;

      // Build query
      const query: any = {};

      if (filters.userId) {
        query.userId = filters.userId;
      }

      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }

      if (filters.isDefault !== undefined) {
        query.isDefault = filters.isDefault;
      }

      if (filters.skills && filters.skills.length > 0) {
        query.skills = { $in: filters.skills };
      }

      if (filters.experienceLevel) {
        query["experience.level"] = filters.experienceLevel;
      }

      if (filters.search) {
        query.$text = { $search: filters.search };
      }

      const sort: any = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      const [resumes, total] = await Promise.all([
        Resume.find(query)
          .populate("userId", "username email")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        Resume.countDocuments(query),
      ]);

      return {
        resumes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to get resumes", {
        error: error instanceof Error ? error.message : "Unknown error",
        filters,
        options,
      });
      throw error;
    }
  }

  /**
   * Update resume
   */
  async updateResume(
    resumeId: string,
    userId: string,
    data: UpdateResumeData,
  ): Promise<IResume | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(resumeId)) {
        throw new Error("Invalid resume ID");
      }

      // Check if resume exists and belongs to user
      const existingResume = await Resume.findOne({ _id: resumeId, userId });
      if (!existingResume) {
        throw new Error("Resume not found or does not belong to user");
      }

      // If setting as default, unset other defaults
      if (data.isDefault) {
        await Resume.updateMany(
          { userId, isDefault: true, _id: { $ne: resumeId } },
          { isDefault: false },
        );
      }

      const resume = await Resume.findByIdAndUpdate(
        resumeId,
        { ...data, updatedAt: new Date() },
        { new: true, runValidators: true },
      );

      logger.info("Resume updated", { resumeId, userId });
      return resume;
    } catch (error) {
      logger.error("Failed to update resume", {
        error: error instanceof Error ? error.message : "Unknown error",
        resumeId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Set resume as default
   */
  async setDefaultResume(
    userId: string,
    resumeId: string,
  ): Promise<IResume | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(resumeId)) {
        throw new Error("Invalid resume ID");
      }

      // Check if resume exists and belongs to user
      const resume = await Resume.findOne({
        _id: resumeId,
        userId,
        isActive: true,
      });
      if (!resume) {
        throw new Error("Resume not found or does not belong to user");
      }

      // Unset all defaults for this user
      await Resume.updateMany(
        { userId, isDefault: true },
        { isDefault: false },
      );

      // Set the new default
      const updated = await Resume.findByIdAndUpdate(
        resumeId,
        { isDefault: true },
        { new: true },
      );

      logger.info("Default resume set", { userId, resumeId });
      return updated;
    } catch (error) {
      logger.error("Failed to set default resume", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
        resumeId,
      });
      throw error;
    }
  }

  /**
   * Delete resume (soft delete)
   */
  async deleteResume(resumeId: string, userId: string): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(resumeId)) {
        throw new Error("Invalid resume ID");
      }

      const resume = await Resume.findOne({ _id: resumeId, userId });
      if (!resume) {
        throw new Error("Resume not found or does not belong to user");
      }

      const result = await Resume.findByIdAndUpdate(
        resumeId,
        { isActive: false },
        { new: true },
      );

      logger.info("Resume deleted", { resumeId, userId });
      return !!result;
    } catch (error) {
      logger.error("Failed to delete resume", {
        error: error instanceof Error ? error.message : "Unknown error",
        resumeId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Permanently delete resume
   */
  async permanentDeleteResume(
    resumeId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(resumeId)) {
        throw new Error("Invalid resume ID");
      }

      const result = await Resume.findOneAndDelete({ _id: resumeId, userId });

      if (result) {
        logger.info("Resume permanently deleted", { resumeId, userId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error("Failed to permanently delete resume", {
        error: error instanceof Error ? error.message : "Unknown error",
        resumeId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update resume analysis
   */
  async updateAnalysis(
    resumeId: string,
    userId: string,
    analysisData: {
      score: number;
      strengths: string[];
      weaknesses: string[];
      suggestions: string[];
    },
  ): Promise<IResume | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(resumeId)) {
        throw new Error("Invalid resume ID");
      }

      const resume = await Resume.findOne({ _id: resumeId, userId });
      if (!resume) {
        throw new Error("Resume not found or does not belong to user");
      }

      const updated = await Resume.findByIdAndUpdate(
        resumeId,
        {
          analysis: {
            ...analysisData,
            lastAnalyzedAt: new Date(),
          },
        },
        { new: true },
      );

      logger.info("Resume analysis updated", { resumeId, userId });
      return updated;
    } catch (error) {
      logger.error("Failed to update resume analysis", {
        error: error instanceof Error ? error.message : "Unknown error",
        resumeId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Search resumes by skills
   */
  async searchBySkills(skills: string[]): Promise<IResume[]> {
    try {
      if (!skills || skills.length === 0) {
        throw new Error("Skills array is required");
      }

      return Resume.find({
        isActive: true,
        skills: { $in: skills },
      })
        .populate("userId", "username email")
        .sort({ "experience.years": -1 })
        .exec();
    } catch (error) {
      logger.error("Failed to search resumes by skills", {
        error: error instanceof Error ? error.message : "Unknown error",
        skills,
      });
      throw error;
    }
  }

  /**
   * Search resumes by text
   */
  async searchByText(searchTerm: string): Promise<IResume[]> {
    try {
      if (!searchTerm || searchTerm.trim().length === 0) {
        throw new Error("Search term is required");
      }

      return Resume.find(
        { $text: { $search: searchTerm }, isActive: true },
        { score: { $meta: "textScore" } },
      )
        .sort({ score: { $meta: "textScore" } })
        .populate("userId", "username email")
        .exec();
    } catch (error) {
      logger.error("Failed to search resumes by text", {
        error: error instanceof Error ? error.message : "Unknown error",
        searchTerm,
      });
      throw error;
    }
  }

  /**
   * Clone a resume
   */
  async cloneResume(
    resumeId: string,
    userId: string,
    newTitle?: string,
  ): Promise<IResume> {
    try {
      if (!mongoose.Types.ObjectId.isValid(resumeId)) {
        throw new Error("Invalid resume ID");
      }

      const original = await Resume.findOne({ _id: resumeId, userId });
      if (!original) {
        throw new Error("Resume not found or does not belong to user");
      }

      const clonedData = original.toObject();

      // ✅ Use type assertion to bypass TypeScript checking
      const { _id, createdAt, updatedAt, analysis, ...rest } =
        clonedData as any;

      const resume = new Resume({
        ...rest,
        title: newTitle || `${original.title} (Copy)`,
        version: 1,
        isDefault: false,
        isActive: true,
      });

      await resume.save();

      logger.info("Resume cloned", { originalId: resumeId, newId: resume._id });
      return resume;
    } catch (error) {
      logger.error("Failed to clone resume", {
        error: error instanceof Error ? error.message : "Unknown error",
        resumeId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get user resume statistics
   */
  async getUserStats(userId: string): Promise<{
    total: number;
    active: number;
    hasDefault: boolean;
    defaultResume: IResume | null;
    latestResume: IResume | null;
    byLevel: Record<string, number>;
  }> {
    try {
      const [total, active, defaultResume, latestResume, byLevel] =
        await Promise.all([
          Resume.countDocuments({ userId }),
          Resume.countDocuments({ userId, isActive: true }),
          Resume.findOne({ userId, isDefault: true, isActive: true }),
          Resume.findOne({ userId, isActive: true }).sort({ createdAt: -1 }),
          Resume.aggregate([
            {
              $match: {
                userId: new mongoose.Types.ObjectId(userId),
                isActive: true,
              },
            },
            { $group: { _id: "$experience.level", count: { $sum: 1 } } },
          ]),
        ]);

      const levelMap: Record<string, number> = {
        entry: 0,
        mid: 0,
        senior: 0,
        lead: 0,
      };

      byLevel.forEach((item: any) => {
        levelMap[item._id] = item.count;
      });

      return {
        total,
        active,
        hasDefault: !!defaultResume,
        defaultResume,
        latestResume,
        byLevel: levelMap,
      };
    } catch (error) {
      logger.error("Failed to get user resume stats", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });
      throw error;
    }
  }

  /**
   * Bulk delete resumes
   */
  async bulkDeleteResumes(
    resumeIds: string[],
    userId: string,
  ): Promise<{
    deleted: number;
    failed: string[];
  }> {
    try {
      const failed: string[] = [];
      let deleted = 0;

      for (const id of resumeIds) {
        try {
          const result = await this.deleteResume(id, userId);
          if (result) {
            deleted++;
          } else {
            failed.push(id);
          }
        } catch (error) {
          failed.push(id);
          logger.error("Failed to delete resume in bulk", {
            error: error instanceof Error ? error.message : "Unknown error",
            resumeId: id,
            userId,
          });
        }
      }

      return { deleted, failed };
    } catch (error) {
      logger.error("Failed to bulk delete resumes", {
        error: error instanceof Error ? error.message : "Unknown error",
        resumeIds,
        userId,
      });
      throw error;
    }
  }

  /**
   * Validate resume ownership
   */
  async validateOwnership(resumeId: string, userId: string): Promise<boolean> {
    try {
      const resume = await Resume.findOne({ _id: resumeId, userId });
      return !!resume;
    } catch (error) {
      logger.error("Failed to validate resume ownership", {
        error: error instanceof Error ? error.message : "Unknown error",
        resumeId,
        userId,
      });
      return false;
    }
  }
}

export default new ResumeService();
