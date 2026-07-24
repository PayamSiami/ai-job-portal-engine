import { Request, Response, NextFunction } from "express";
import fs from "fs";
import resumeService from "../services/resume.service.js";
import resumeAnalyzerService from "../services/ai/resumeAnalyzer.service.js";
import coverLetterGeneratorService from "../services/ai/coverLetterGenerator.js";
import jobMatchRecommenderService from "../services/ai/jobMatchRecommender.service.js";
import careerFeedbackService from "../services/ai/careerFeedback.js";
import pdfService from "../services/pdf.service.js";
import { getUserId, getStringParam } from "../utils/routeHelpers.js";
import { sendSuccess } from "../utils/responseFormatter.js";
import { AppError } from "../utils/errorHandler.js";
import logger from "../utils/logger.js";
import {
  CreateResumeDTO,
  UpdateResumeDTO,
  ResumeQueryParams,
} from "../types/resume.types.js";
import { asyncHandler } from "./base.controller.js";
import jobService from "../services/job.service.js";
import { buildResumeContent } from "../utils/buildResumeContent.js";
import { getCompanyNameFromJob } from "../utils/companyHelper.js";

/**
 * Resume Controller
 * Handles all resume CRUD operations
 */
class ResumeController {
  /**
   * Get all resumes for authenticated user with pagination and filtering
   */
  getUserResumes = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { status, page, limit } = req.query as ResumeQueryParams;

      const result = await resumeService.getResumesByUser(userId, {
        status: status || "all",
        page: Number(page) || 1,
        limit: Number(limit) || 10,
      });

      sendSuccess(
        res,
        {
          resumes: result.resumes,
          pagination: result.pagination,
        },
        "Resumes fetched successfully",
      );
    },
  );

  /**
   * Get a single resume by ID
   */
  getResume = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const resumeId = getStringParam(req.params.id);

      if (!resumeId) {
        throw new AppError("Invalid resume ID", 400);
      }

      const resume = await resumeService.getResume(resumeId, userId);

      if (!resume) {
        throw new AppError("Resume not found", 404);
      }

      sendSuccess(res, resume, "Resume fetched successfully");
    },
  );

  /**
   * Create a new resume
   */
  createResume = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const resumeData: CreateResumeDTO = req.body;

      if (!resumeData.title) {
        throw new AppError("Resume title is required", 400);
      }

      const resume = await resumeService.createResume(userId, resumeData);

      sendSuccess(res, resume, "Resume created successfully", 201);
    },
  );

  /**
   * Update an existing resume
   */
  updateResume = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const resumeId = getStringParam(req.params.id);

      if (!resumeId) {
        throw new AppError("Invalid resume ID", 400);
      }

      // Check if resume exists
      const existingResume = await resumeService.getResume(resumeId, userId);
      if (!existingResume) {
        throw new AppError("Resume not found", 404);
      }

      const updateData: UpdateResumeDTO = req.body;
      const updatedResume = await resumeService.updateResume(
        resumeId,
        userId,
        updateData,
      );

      sendSuccess(res, updatedResume, "Resume updated successfully");
    },
  );

  /**
   * Delete a resume
   */
  deleteResume = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const resumeId = getStringParam(req.params.id);

      if (!resumeId) {
        throw new AppError("Invalid resume ID", 400);
      }

      // Check if resume exists
      const existingResume = await resumeService.getResume(resumeId, userId);
      if (!existingResume) {
        throw new AppError("Resume not found", 404);
      }

      await resumeService.deleteResume(resumeId, userId);

      sendSuccess(res, null, "Resume deleted successfully");
    },
  );

  /**
   * Duplicate an existing resume
   */
  duplicateResume = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const resumeId = getStringParam(req.params.id);

      if (!resumeId) {
        throw new AppError("Invalid resume ID", 400);
      }

      // Check if source resume exists
      const sourceResume = await resumeService.getResume(resumeId, userId);
      if (!sourceResume) {
        throw new AppError("Source resume not found", 404);
      }

      const duplicatedResume = await resumeService.duplicateResume(
        resumeId,
        userId,
      );

      sendSuccess(res, duplicatedResume, "Resume duplicated successfully", 201);
    },
  );

  /**
   * Set a resume as default
   */
  setDefaultResume = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const resumeId = getStringParam(req.params.id);

      if (!resumeId) {
        throw new AppError("Invalid resume ID", 400);
      }

      // Check if resume exists
      const existingResume = await resumeService.getResume(resumeId, userId);
      if (!existingResume) {
        throw new AppError("Resume not found", 404);
      }

      const updatedResume = await resumeService.setDefaultResume(
        resumeId,
        userId,
      );

      sendSuccess(res, updatedResume, "Default resume updated successfully");
    },
  );

  /**
   * Download resume as PDF
   */
  downloadResumePDF = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const resumeId = getStringParam(req.params.id);

      if (!resumeId) {
        throw new AppError("Invalid resume ID", 400);
      }

      // Check if resume exists and user has access
      const resume = await resumeService.getResume(resumeId, userId);
      if (!resume) {
        throw new AppError("Resume not found", 404);
      }

      // Get PDF path
      const pdfPath = pdfService.getPDFPath(resumeId);
      if (!pdfPath || !fs.existsSync(pdfPath)) {
        throw new AppError("PDF file not found", 404);
      }

      // Read and send file
      const fileBuffer = fs.readFileSync(pdfPath);
      const stats = fs.statSync(pdfPath);

      // Sanitize filename
      const filename = `resume-${resume.title?.replace(/[^a-zA-Z0-9]/g, "-") || "untitled"}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.setHeader("Content-Length", stats.size);

      res.send(fileBuffer);

      logger.info("PDF downloaded successfully", { resumeId, userId });
    },
  );

  /**
   * Get resume statistics
   */
  getResumeStats = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const stats = await resumeService.getUserResumeStats(userId);

      sendSuccess(res, stats, "Resume statistics fetched successfully");
    },
  );

  /**
   * Bulk delete resumes
   */
  bulkDeleteResumes = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { resumeIds } = req.body;

      if (!resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
        throw new AppError("Please provide an array of resume IDs", 400);
      }

      if (resumeIds.length > 50) {
        throw new AppError("Cannot delete more than 50 resumes at once", 400);
      }

      // Validate each ID
      for (const id of resumeIds) {
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
          throw new AppError(`Invalid resume ID format: ${id}`, 400);
        }
      }

      const result = await resumeService.bulkDeleteResumes(resumeIds, userId);

      sendSuccess(
        res,
        {
          deletedCount: result.deletedCount,
          failedIds: result.failedIds,
        },
        `${result.deletedCount} resumes deleted successfully`,
      );
    },
  );

  /**
   * Export resume data
   */
  exportResume = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const resumeId = getStringParam(req.params.id);

      if (!resumeId) {
        throw new AppError("Invalid resume ID", 400);
      }

      const resume = await resumeService.getResume(resumeId, userId);
      if (!resume) {
        throw new AppError("Resume not found", 404);
      }

      const format = (req.query.format as string) || "json";

      if (format === "json") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="resume-${resume.title?.replace(/[^a-zA-Z0-9]/g, "-") || "export"}.json"`,
        );
        res.json(resume);
        return;
      }

      if (format === "pdf") {
        // Generate fresh PDF
        const pdfBuffer = await pdfService.generateResumePDF(resume);
        const filename = `resume-${resume.title?.replace(/[^a-zA-Z0-9]/g, "-") || "export"}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );
        res.send(pdfBuffer);
        return;
      }

      throw new AppError("Unsupported export format. Use 'json' or 'pdf'", 400);
    },
  );

  /**
   * Analyze resume against a job description
   * GET /api/resumes/:id/analyze
   */
  analyzeResume = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);
      const resumeId = getStringParam(req.params.id);
      const jobId = (req.query.jobId as string) || req.body.jobId;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!resumeId) {
        throw new AppError("Invalid resume ID", 400);
      }

      if (!jobId) {
        throw new AppError("Job ID is required", 400);
      }

      const resume = await resumeService.getResume(resumeId, userId);
      if (!resume) {
        throw new AppError("Resume not found", 404);
      }

      const job = await jobService.getJobById(jobId);
      if (!job) {
        throw new AppError("Job not found", 404);
      }

      const content = buildResumeContent(resume);

      logger.info("Resume content built for analysis", {
        resumeId: resume._id,
        jobId: job._id,
        contentLength: content.length,
        skillCount: resume.skills?.length || 0,
      });

      if (!content || content.trim().length < 50) {
        throw new AppError(
          "Resume content is too short. Please add more details. Minimum 50 characters required.",
          400,
        );
      }

      const requirements = job.requirements || job.description || "";
      const companyName = await getCompanyNameFromJob(job);

      const analysis = await resumeAnalyzerService.analyzeResumeVsJob(
        content,
        requirements,
        job.description || "",
        {
          targetRole: job.title,
          retryCount: 3,
          useCache: true,
        },
      );

      sendSuccess(
        res,
        {
          resume: {
            id: resume._id,
            title: resume.title,
            skills: resume.skills?.map((s: any) => s.name) || [],
          },
          job: {
            id: job._id,
            title: job.title,
            company: companyName,
          },
          analysis,
        },
        "Resume analysis completed successfully",
      );
    },
  );

  /**
   * Generate cover letter for a job
   * POST /api/resumes/:id/generate-cover-letter
   */
  generateCoverLetter = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);
      const { jobId } = req.body;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!jobId) {
        throw new AppError("Job ID is required", 400);
      }

      const resumeId = getStringParam(req.params.id);
      if (!resumeId) {
        throw new AppError("Invalid resume ID", 400);
      }

      const resume = await resumeService.getResume(resumeId, userId);
      if (!resume) {
        throw new AppError("Resume not found", 404);
      }

      const job = await jobService.getJobById(jobId);
      if (!job) {
        throw new AppError("Job not found", 404);
      }

      const companyName = await getCompanyNameFromJob(job);
      const content = buildResumeContent(resume);

      const coverLetter = await coverLetterGeneratorService.generateCoverLetter(
        {
          title: job.title || "",
          company: companyName,
          location: job.location || "",
          requirements: job.requirements || "",
          description: job.description || "",
        },
        content,
      );

      sendSuccess(res, { coverLetter }, "Cover letter generated successfully");
    },
  );

  /**
   * Get career feedback
   * GET /api/resumes/:id/career-feedback
   */
  getCareerFeedback = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const resumeId = getStringParam(req.params.id);
      if (!resumeId) {
        throw new AppError("Invalid resume ID", 400);
      }

      const resume = await resumeService.getResume(resumeId, userId);
      if (!resume) {
        throw new AppError("Resume not found", 404);
      }

      const content = buildResumeContent(resume);

      const feedback =
        await careerFeedbackService.generateCareerFeedback(content);

      sendSuccess(res, { feedback }, "Career feedback generated successfully");
    },
  );

  /**
   * Get job match recommendations
   * GET /api/resumes/:id/job-matches
   */
  getJobMatches = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);
      const resumeId = getStringParam(req.params.id);
      const { limit = 10, minMatchScore = 60 } = req.query;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!resumeId) {
        throw new AppError("Invalid resume ID", 400);
      }

      const resume = await resumeService.getResume(resumeId, userId);
      if (!resume) {
        throw new AppError("Resume not found", 404);
      }

      // Build content from structured resume data
      const content = buildResumeContent(resume);

      // Get all active jobs
      const jobs = await jobService.getActiveJobs();

      // Map jobs to the format expected by the recommender
      const mappedJobs = jobs.map((job: any) => ({
        id: job._id?.toString(),
        title: job.title || "",
        company: job.company || "",
        location: job.location || "",
        workMode: job.workMode || "remote",
        minSalary: job.minSalary,
        maxSalary: job.maxSalary,
        requirements: job.requirements || "",
        description: job.description || "",
        postedDate: job.createdAt?.toISOString(),
        department: job.department,
        employmentType: job.jobType || "full-time",
        benefits: job.benefits?.split(",").map((b: string) => b.trim()) || [],
        skills: job.skills || [],
        industry: job.industry,
        companySize: job.companySize,
      }));

      // Get job matches with filters
      const matches = await jobMatchRecommenderService.getJobMatches(
        content,
        mappedJobs,
      );

      // Enrich matches with additional details
      const enrichedMatches = matches.map((match: any) => ({
        ...match,
        matchDetails: {
          score: match.matchScore,
          strengths: match.strengths || [],
          gaps: match.gaps || [],
          recommendations: match.recommendations || [],
        },
        jobDetails: {
          title: match.title,
          company: match.company,
          location: match.location,
          posted: match.postedDate,
          employmentType: match.employmentType,
          salary:
            match.minSalary && match.maxSalary
              ? `${match.minSalary} - ${match.maxSalary}`
              : "Not specified",
        },
      }));

      sendSuccess(
        res,
        {
          matches: enrichedMatches,
          metadata: {
            totalMatches: enrichedMatches.length,
            minMatchScore: Number(minMatchScore),
            generatedAt: new Date().toISOString(),
            resumeId,
          },
        },
        "Job matches found successfully",
      );
    },
  );

  /**
   * Get resume improvement suggestions
   * GET /api/resumes/:id/improvements
   */
  getImprovementSuggestions = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);
      const resumeId = getStringParam(req.params.id);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!resumeId) {
        throw new AppError("Invalid resume ID", 400);
      }

      const resume = await resumeService.getResume(resumeId, userId);
      if (!resume) {
        throw new AppError("Resume not found", 404);
      }

      const content = buildResumeContent(resume);

      const suggestions = await resumeAnalyzerService.getImprovementSuggestions(
        content,
        {
          includeContentSuggestions: true,
          includeFormattingSuggestions: true,
          includeKeywordSuggestions: true,
          includeActionVerbs: true,
        },
      );

      sendSuccess(
        res,
        {
          suggestions,
          metadata: {
            generatedAt: new Date().toISOString(),
            resumeId,
          },
        },
        "Improvement suggestions generated successfully",
      );
    },
  );
}

export default new ResumeController();
