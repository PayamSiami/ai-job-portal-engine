import Resume, { IResume } from "../models/Resume.models.js";
import logger from "../utils/logger.js";
import { Types } from "mongoose";
import pdfService from "./pdfService.js";
import fs from "fs";

export interface CreateResumeData {
  title: string;
  template?: "modern" | "classic" | "minimal" | "creative";
  visibility?: "private" | "public" | "shared";
  isDefault?: boolean;
  generatePDF?: boolean;
  status?: "draft" | "active" | "archived";
  personalInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    location?: string;
    website?: string;
    linkedin?: string;
    github?: string;
    summary?: string;
    title?: string;
  };
  experience?: Array<{
    company: string;
    position: string;
    location?: string;
    startDate: Date | string;
    endDate?: Date | string;
    current?: boolean;
    description?: string;
    achievements?: string[];
  }>;
  education?: Array<{
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    location?: string;
    startDate: Date | string;
    endDate?: Date | string;
    current?: boolean;
    description?: string;
    gpa?: number;
  }>;
  skills?: Array<{
    name: string;
    level?: "beginner" | "intermediate" | "advanced" | "expert";
    category?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer: string;
    date: Date | string;
    expiryDate?: Date | string;
    credentialId?: string;
    url?: string;
  }>;
  languages?: Array<{
    name: string;
    proficiency: "basic" | "conversational" | "professional" | "native";
  }>;
  projects?: Array<{
    name: string;
    description?: string;
    url?: string;
    technologies?: string[];
    startDate?: Date | string;
    endDate?: Date | string;
  }>;
  customSections?: Array<{
    title: string;
    content: string;
    order: number;
  }>;
}

export interface GetResumesOptions {
  status?: string;
  page?: number;
  limit?: number;
}

class ResumeService {
  /**
   * Get all resumes for a user with pagination and filtering
   */
  async getResumesByUser(
    userId: string,
    options: GetResumesOptions = {},
  ): Promise<{ resumes: IResume[]; pagination: any }> {
    try {
      const { status, page = 1, limit = 10 } = options;

      const query: any = { user: userId };
      if (status && status !== "all") {
        query.status = status;
      }

      const skip = (page - 1) * limit;

      const [resumes, total] = await Promise.all([
        Resume.find(query)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Resume.countDocuments(query),
      ]);

      return {
        resumes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to get resumes by user", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
        options,
      });
      throw error;
    }
  }

  /**
   * Get a single resume by ID with user validation
   */
  async getResume(id: string, userId?: string): Promise<IResume | null> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error("Invalid resume ID");
      }

      const query: any = { _id: id };
      if (userId) {
        query.user = userId;
      }

      return await Resume.findOne(query).lean();
    } catch (error) {
      logger.error("Failed to get resume by ID", {
        error: error instanceof Error ? error.message : "Unknown error",
        resumeId: id,
        userId,
      });
      throw error;
    }
  }

  /**
   * Create a new resume with optional PDF generation
   */
  async createResume(
    userId: string,
    data: CreateResumeData,
  ): Promise<{ resume: IResume; pdfFile?: any; pdfError?: string }> {
    try {
      logger.info("Creating new resume", { userId, title: data.title });

      if (!data.title) {
        throw new Error("Resume title is required");
      }

      // Check if PDF generation is requested
      const generatePDF =
        data.generatePDF !== undefined ? data.generatePDF : true;

      // If this is set as default, unset other defaults
      if (data.isDefault) {
        await Resume.updateMany(
          { user: userId, isDefault: true },
          { isDefault: false },
        );
      }

      // Clean subdocuments
      const cleanedData = this.cleanSubdocuments(data);

      // Remove generatePDF from data to avoid saving it to the resume
      delete cleanedData.generatePDF;

      // Build resume data with proper structure
      const resumeData = {
        user: userId,
        title: cleanedData.title,
        template: cleanedData.template || "modern",
        visibility: cleanedData.visibility || "private",
        isDefault: cleanedData.isDefault || false,
        status: cleanedData.status || "draft",
        personalInfo: {
          firstName: cleanedData.personalInfo?.firstName || "",
          lastName: cleanedData.personalInfo?.lastName || "",
          email: cleanedData.personalInfo?.email || "",
          phone: cleanedData.personalInfo?.phone || "",
          location: cleanedData.personalInfo?.location || "",
          website: cleanedData.personalInfo?.website || "",
          linkedin: cleanedData.personalInfo?.linkedin || "",
          github: cleanedData.personalInfo?.github || "",
          summary: cleanedData.personalInfo?.summary || "",
          title: cleanedData.personalInfo?.title || "",
        },
        experience:
          cleanedData.experience?.map(
            (exp: {
              company: any;
              position: any;
              location: any;
              startDate: any;
              endDate: any;
              current: any;
              description: any;
              achievements: any;
            }) => ({
              company: exp.company || "",
              position: exp.position || "",
              location: exp.location || "",
              startDate: exp.startDate || new Date(),
              endDate: exp.endDate || null,
              current: exp.current || false,
              description: exp.description || "",
              achievements: exp.achievements || [],
            }),
          ) || [],
        education:
          cleanedData.education?.map(
            (edu: {
              institution: any;
              degree: any;
              fieldOfStudy: any;
              location: any;
              startDate: any;
              endDate: any;
              current: any;
              description: any;
              gpa: any;
            }) => ({
              institution: edu.institution || "",
              degree: edu.degree || "",
              fieldOfStudy: edu.fieldOfStudy || "",
              location: edu.location || "",
              startDate: edu.startDate || new Date(),
              endDate: edu.endDate || null,
              current: edu.current || false,
              description: edu.description || "",
              gpa: edu.gpa || null,
            }),
          ) || [],
        skills:
          cleanedData.skills?.map(
            (skill: { name: any; level: any; category: any }) => ({
              name: skill.name || "",
              level: skill.level || "intermediate",
              category: skill.category || "",
            }),
          ) || [],
        certifications:
          cleanedData.certifications?.map(
            (cert: {
              name: any;
              issuer: any;
              date: any;
              expiryDate: any;
              credentialId: any;
              url: any;
            }) => ({
              name: cert.name || "",
              issuer: cert.issuer || "",
              date: cert.date || new Date(),
              expiryDate: cert.expiryDate || null,
              credentialId: cert.credentialId || "",
              url: cert.url || "",
            }),
          ) || [],
        languages:
          cleanedData.languages?.map(
            (lang: { name: any; proficiency: any }) => ({
              name: lang.name || "",
              proficiency: lang.proficiency || "professional",
            }),
          ) || [],
        projects:
          cleanedData.projects?.map(
            (project: {
              name: any;
              description: any;
              url: any;
              technologies: any;
              startDate: any;
              endDate: any;
            }) => ({
              name: project.name || "",
              description: project.description || "",
              url: project.url || "",
              technologies: project.technologies || [],
              startDate: project.startDate || null,
              endDate: project.endDate || null,
            }),
          ) || [],
        customSections:
          cleanedData.customSections?.map(
            (section: { title: any; content: any; order: any }) => ({
              title: section.title || "",
              content: section.content || "",
              order: section.order || 0,
            }),
          ) || [],
      };

      // Create and save the resume
      const resume = new Resume(resumeData);
      await resume.save();

      logger.info("Resume created successfully", { resumeId: resume._id });

      let pdfFile = null;

      // Generate PDF if requested
      if (generatePDF) {
        try {
          logger.info("Generating PDF for new resume", {
            resumeId: resume._id,
            template: resume.template || "modern",
          });

          // Generate and save PDF
          const savedFile = await pdfService.generateAndSavePDF(
            resume,
            resume.template || "modern",
          );

          // Update resume with PDF info
          await Resume.findByIdAndUpdate(resume._id, {
            pdfFile: {
              filename: savedFile.filename,
              path: savedFile.path,
              size: savedFile.size,
              mimeType: "application/pdf",
              uploadedAt: new Date(),
            },
          });

          // Refresh resume data with PDF info
          const updatedResume = await Resume.findById(resume._id);

          pdfFile = {
            filename: savedFile.filename,
            path: savedFile.path,
            size: savedFile.size,
            blob: savedFile.blob,
          };

          logger.info("PDF generated successfully for new resume", {
            resumeId: resume._id,
            pdfFile: savedFile.filename,
            size: savedFile.size,
          });

          return {
            resume: updatedResume || resume,
            pdfFile,
          };
        } catch (pdfError) {
          logger.error("PDF generation failed for new resume:", {
            resumeId: resume._id,
            error:
              pdfError instanceof Error ? pdfError.message : "Unknown error",
          });

          // Return resume without PDF
          return {
            resume,
            pdfError:
              pdfError instanceof Error
                ? pdfError.message
                : "Failed to generate PDF",
          };
        }
      }

      return { resume };
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
   * Update an existing resume with optional PDF regeneration
   */
  async updateResume(
    id: string,
    userId: string,
    data: Partial<CreateResumeData>,
  ): Promise<{ resume: IResume; pdfFile?: any; pdfError?: string }> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error("Invalid resume ID");
      }

      // Find the resume
      const resume = await Resume.findOne({ _id: id, user: userId });
      if (!resume) {
        throw new Error("Resume not found");
      }

      // Check if PDF regeneration is requested
      const regeneratePDF = data.generatePDF ?? false;

      // Remove generatePDF from data
      const { generatePDF, ...updateData } = data;

      // If setting as default, unset other defaults
      if (updateData.isDefault) {
        await Resume.updateMany(
          { user: userId, isDefault: true, _id: { $ne: id } },
          { isDefault: false },
        );
      }

      // ✅ Use the cleanSubdocuments method to clean data
      const cleanedData = this.cleanSubdocuments(updateData);

      // ✅ Remove any _id from nested arrays to let MongoDB generate new ones
      const arrayFields = [
        "experience",
        "education",
        "skills",
        "certifications",
        "languages",
        "projects",
        "customSections",
      ];
      arrayFields.forEach((field) => {
        if (cleanedData[field] && Array.isArray(cleanedData[field])) {
          cleanedData[field] = cleanedData[field].map((item: any) => {
            const { _id, ...rest } = item;
            return rest;
          });
        }
      });

      // Update the resume using findOneAndUpdate (cleaner and more reliable)
      const updatedResume = await Resume.findOneAndUpdate(
        { _id: id, user: userId },
        { $set: cleanedData },
        {
          new: true,
          runValidators: true,
        },
      );

      if (!updatedResume) {
        throw new Error("Failed to update resume");
      }

      logger.info("Resume updated successfully", { resumeId: id, userId });

      let pdfFile = null;

      // Regenerate PDF if requested
      if (regeneratePDF) {
        try {
          logger.info("Regenerating PDF for updated resume", {
            resumeId: id,
            template: updatedResume.template || "modern",
          });

          // Delete old PDF if exists
          if (updatedResume.pdfFile?.path) {
            try {
              if (fs.existsSync(updatedResume.pdfFile.path)) {
                fs.unlinkSync(updatedResume.pdfFile.path);
                logger.info("Old PDF deleted", {
                  path: updatedResume.pdfFile.path,
                });
              }
            } catch (deleteError) {
              logger.warn("Failed to delete old PDF", {
                path: updatedResume.pdfFile?.path,
                error:
                  deleteError instanceof Error
                    ? deleteError.message
                    : "Unknown error",
              });
            }
          }

          // Generate and save new PDF
          const savedFile = await pdfService.generateAndSavePDF(
            updatedResume,
            updatedResume.template || "modern",
          );

          // Update resume with new PDF info
          const finalResume = await Resume.findOneAndUpdate(
            { _id: id, user: userId },
            {
              $set: {
                pdfFile: {
                  filename: savedFile.filename,
                  path: savedFile.path,
                  size: savedFile.size,
                  mimeType: "application/pdf",
                  uploadedAt: new Date(),
                },
              },
            },
            { new: true },
          );

          pdfFile = {
            filename: savedFile.filename,
            path: savedFile.path,
            size: savedFile.size,
            blob: savedFile.blob,
          };

          logger.info("PDF regenerated successfully for updated resume", {
            resumeId: id,
            pdfFile: savedFile.filename,
            size: savedFile.size,
          });

          return {
            resume: finalResume || updatedResume,
            pdfFile,
          };
        } catch (pdfError) {
          logger.error("PDF regeneration failed for updated resume:", {
            resumeId: id,
            error:
              pdfError instanceof Error ? pdfError.message : "Unknown error",
          });

          return {
            resume: updatedResume,
            pdfError:
              pdfError instanceof Error
                ? pdfError.message
                : "Failed to regenerate PDF",
          };
        }
      }

      return { resume: updatedResume };
    } catch (error) {
      logger.error("Failed to update resume", {
        error: error instanceof Error ? error.message : "Unknown error",
        resumeId: id,
        userId,
      });
      throw error;
    }
  }

  /**
   * Delete a resume
   */
  async deleteResume(id: string, userId: string): Promise<void> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error("Invalid resume ID");
      }

      const result = await Resume.findOneAndDelete({ _id: id, user: userId });
      if (!result) {
        throw new Error("Resume not found");
      }

      logger.info("Resume deleted successfully", { resumeId: id, userId });
    } catch (error) {
      logger.error("Failed to delete resume", {
        error: error instanceof Error ? error.message : "Unknown error",
        resumeId: id,
        userId,
      });
      throw error;
    }
  }

  /**
   * Set a resume as default
   */
  async setDefaultResume(id: string, userId: string): Promise<IResume> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error("Invalid resume ID");
      }

      await Resume.updateMany(
        { user: userId, isDefault: true },
        { isDefault: false },
      );

      // ✅ Fixed: Use returnDocument instead of new (deprecated)
      const resume = await Resume.findOneAndUpdate(
        { _id: id, user: userId },
        { isDefault: true },
        {
          returnDocument: "after", // ✅ Replaces 'new: true'
        },
      );

      if (!resume) {
        throw new Error("Resume not found");
      }

      logger.info("Default resume set successfully", { resumeId: id, userId });
      return resume;
    } catch (error) {
      logger.error("Failed to set default resume", {
        error: error instanceof Error ? error.message : "Unknown error",
        resumeId: id,
        userId,
      });
      throw error;
    }
  }

  /**
   * Duplicate an existing resume
   */
  async duplicateResume(id: string, userId: string): Promise<IResume> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error("Invalid resume ID");
      }

      const original = await Resume.findOne({ _id: id, user: userId });
      if (!original) {
        throw new Error("Resume not found");
      }

      const originalObj = original.toObject();
      const { _id, createdAt, updatedAt, __v, ...copyData } = originalObj;

      const copy = new Resume({
        ...copyData,
        title: `${copyData.title} (Copy)`,
        isDefault: false,
        status: "draft",
      });

      await copy.save();

      logger.info("Resume duplicated successfully", {
        originalId: id,
        copyId: copy._id,
        userId,
      });

      return copy;
    } catch (error) {
      logger.error("Failed to duplicate resume", {
        error: error instanceof Error ? error.message : "Unknown error",
        resumeId: id,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get the default resume for a user
   */
  async getDefaultResume(userId: string): Promise<IResume | null> {
    try {
      return await Resume.findOne({ user: userId, isDefault: true }).lean();
    } catch (error) {
      logger.error("Failed to get default resume", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });
      throw error;
    }
  }

  /**
   * Clean subdocuments - remove empty or invalid items
   */
  private cleanSubdocuments(data: any): any {
    const clean = { ...data };

    // ✅ Ensure arrays are properly formatted
    const arrayFields = [
      "experience",
      "education",
      "skills",
      "certifications",
      "languages",
      "projects",
      "customSections",
    ];

    arrayFields.forEach((field) => {
      if (clean[field] && Array.isArray(clean[field])) {
        // ✅ Remove items that are completely empty
        clean[field] = clean[field]
          .filter((item: any) => {
            // Check if item has any meaningful data
            if (field === "experience") {
              return item.company?.trim() || item.position?.trim();
            }
            if (field === "education") {
              return item.institution?.trim() || item.degree?.trim();
            }
            if (field === "skills") {
              return item.name?.trim();
            }
            if (field === "certifications") {
              return item.name?.trim() || item.issuer?.trim();
            }
            if (field === "languages") {
              return item.name?.trim() && item.proficiency;
            }
            if (field === "projects") {
              return item.name?.trim();
            }
            if (field === "customSections") {
              return item.title?.trim() && item.content?.trim();
            }
            return true;
          })
          .map((item: any) => {
            // Clean the item
            const cleanedItem = { ...item };

            // Remove _id if present
            delete cleanedItem._id;

            // Convert string dates to Date objects
            const dateFields = ["startDate", "endDate", "date", "expiryDate"];
            dateFields.forEach((dateField) => {
              if (
                cleanedItem[dateField] &&
                typeof cleanedItem[dateField] === "string"
              ) {
                cleanedItem[dateField] = new Date(cleanedItem[dateField]);
              }
            });

            return cleanedItem;
          });
      }
    });

    return clean;
  }
}

export default new ResumeService();
