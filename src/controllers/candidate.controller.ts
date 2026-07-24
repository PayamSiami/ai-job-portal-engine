import { Request, Response } from "express";
import { getUserId } from "../utils/routeHelpers.js";
import { sendSuccess } from "../utils/responseFormatter.js";
import { AppError } from "../utils/errorHandler.js";
import { asyncHandler } from "./base.controller.js";
import candidateService from "../services/candidate.service.js";
import { Company } from "../models/Company.models.js";
import Job from "../models/Job.models.js";
import Application from "../models/Application.model.js";

/**
 * Dashboard Controller
 * Handles all dashboard, analytics, candidate, and company management
 */
class CandidateController {
  /**
   * Get candidates with filters and pagination
   * GET /api/dashboard/candidates
   */
  getCandidates = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      // Extract filters from query
      const filters = {
        search: req.query.search as string,
        status: req.query.status as string,
        skills: req.query.skills
          ? (req.query.skills as string).split(",")
          : undefined,
        experienceMin: req.query.experienceMin
          ? Number(req.query.experienceMin)
          : undefined,
        experienceMax: req.query.experienceMax
          ? Number(req.query.experienceMax)
          : undefined,
        location: req.query.location as string,
        availability: req.query.availability as string,
      };

      // Extract pagination options
      const options = {
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 10,
        sortBy: (req.query.sortBy as string) || "createdAt",
        sortOrder: (req.query.sortOrder as string) || "desc",
      };

      // Remove undefined filters
      Object.keys(filters).forEach(
        (key) =>
          filters[key as keyof typeof filters] === undefined &&
          delete filters[key as keyof typeof filters],
      );

      const result = await candidateService.getCandidates(
        userId,
        filters,
        options,
      );

      sendSuccess(
        res,
        {
          candidates: result.candidates,
          total: result.total,
          statusSummary: result.statusSummary,
          pagination: {
            page: options.page,
            limit: options.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / options.limit),
          },
        },
        "Candidates fetched successfully",
      );
    },
  );

  /**
   * Get AI-powered candidate recommendations
   * GET /api/dashboard/candidates/recommendations
   */
  getCandidateRecommendations = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const params = {
        jobId: req.query.jobId as string,
        limit: req.query.limit ? Number(req.query.limit) : 10,
        minScore: req.query.minScore ? Number(req.query.minScore) : 60,
        skills: req.query.skills ? (req.query.skills as string).split(",") : [],
        experienceMin: req.query.experienceMin
          ? Number(req.query.experienceMin)
          : undefined,
        experienceMax: req.query.experienceMax
          ? Number(req.query.experienceMax)
          : undefined,
      };

      const recommendations =
        await candidateService.getCandidateRecommendations(userId, params);

      sendSuccess(
        res,
        {
          recommendations,
          count: recommendations.length,
          params,
        },
        "Candidate recommendations fetched successfully",
      );
    },
  );

  /**
   * Get candidate by ID
   * GET /api/dashboard/candidates/:id
   */
  getCandidateById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);
      const candidateId = req.params.id;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!candidateId) {
        throw new AppError("Candidate ID is required", 400);
      }

      const candidate = await candidateService.getCandidateById(
        String(candidateId),
        userId,
      );

      if (!candidate) {
        throw new AppError("Candidate not found or access denied", 404);
      }

      sendSuccess(res, candidate, "Candidate fetched successfully");
    },
  );

  /**
   * Update candidate status
   * PUT /api/dashboard/candidates/:id/status
   */
  updateCandidateStatus = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);
      const candidateId = req.params.id;
      const { status, notes } = req.body;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!candidateId) {
        throw new AppError("Candidate ID is required", 400);
      }

      if (!status) {
        throw new AppError("Status is required", 400);
      }

      // Validate status
      const validStatuses = [
        "pending",
        "reviewing",
        "shortlisted",
        "interviewing",
        "hired",
        "rejected",
      ];
      if (!validStatuses.includes(status)) {
        throw new AppError(
          `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          400,
        );
      }

      const updated = await candidateService.updateCandidateStatus(
        String(candidateId),
        userId,
        status,
        notes,
      );

      if (!updated) {
        throw new AppError("Candidate not found or access denied", 404);
      }

      sendSuccess(res, updated, "Candidate status updated successfully");
    },
  );

  /**
   * Get candidate resume
   * GET /api/dashboard/candidates/:id/resume
   */
  getCandidateResume = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);
      const candidateId = req.params.id;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!candidateId) {
        throw new AppError("Candidate ID is required", 400);
      }

      const resume = await candidateService.getCandidateResume(
        String(candidateId),
        userId,
      );

      if (!resume) {
        throw new AppError("Resume not found or access denied", 404);
      }

      // If resume is a Buffer or file path, send it
      if (Buffer.isBuffer(resume)) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="candidate-resume-${candidateId}.pdf"`,
        );
        res.send(resume);
        return;
      }

      // If resume is a URL, redirect or send JSON response
      if (typeof resume === "string" && resume.startsWith("http")) {
        sendSuccess(
          res,
          { resumeUrl: resume },
          "Resume URL fetched successfully",
        );
        return;
      }

      // If resume is an object with file data
      if (typeof resume === "object" && resume !== null) {
        sendSuccess(res, resume, "Resume fetched successfully");
        return;
      }

      // Default: send the resume data
      sendSuccess(res, { resume }, "Resume fetched successfully");
    },
  );

  bulkUpdateCandidateStatus = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { candidateIds, status, notes } = req.body;

      if (
        !candidateIds ||
        !Array.isArray(candidateIds) ||
        candidateIds.length === 0
      ) {
        throw new AppError("candidateIds must be a non-empty array", 400);
      }

      if (candidateIds.length > 50) {
        throw new AppError(
          "Cannot update more than 50 candidates at once",
          400,
        );
      }

      if (!status) {
        throw new AppError("Status is required", 400);
      }

      const results = await Promise.all(
        candidateIds.map(async (candidateId) => {
          try {
            const updated = await candidateService.updateCandidateStatus(
              candidateId,
              userId,
              status,
              notes,
            );
            return { candidateId, success: true, data: updated };
          } catch (error) {
            return {
              candidateId,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        }),
      );

      const succeeded = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      sendSuccess(
        res,
        {
          total: results.length,
          succeeded: succeeded.length,
          failed: failed.length,
          results,
          failedDetails: failed,
        },
        `Updated ${succeeded.length} candidates`,
      );
    },
  );

  /**
   * Bulk delete candidates
   * DELETE /api/dashboard/candidates/bulk
   */
  bulkDeleteCandidates = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { candidateIds } = req.body;

      if (
        !candidateIds ||
        !Array.isArray(candidateIds) ||
        candidateIds.length === 0
      ) {
        throw new AppError("candidateIds must be a non-empty array", 400);
      }

      if (candidateIds.length > 50) {
        throw new AppError(
          "Cannot delete more than 50 candidates at once",
          400,
        );
      }

      // Confirm deletion
      const { confirm } = req.query;
      if (confirm !== "true") {
        throw new AppError("Please confirm deletion with ?confirm=true", 400);
      }

      // Delete each candidate
      const results = await Promise.all(
        candidateIds.map(async (candidateId) => {
          try {
            // Update status to "rejected" instead of hard delete
            const updated = await candidateService.updateCandidateStatus(
              candidateId,
              userId,
              "rejected",
              "Bulk deleted",
            );
            return { candidateId, success: true };
          } catch (error) {
            return {
              candidateId,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        }),
      );

      const succeeded = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      sendSuccess(
        res,
        {
          total: results.length,
          deleted: succeeded.length,
          failed: failed.length,
          results,
        },
        `Deleted ${succeeded.length} candidates`,
      );
    },
  );

  getCandidateStats = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const stats = await candidateService.getCandidateStats(userId);

      sendSuccess(res, stats, "Candidate stats fetched successfully");
    },
  );
}

export default new CandidateController();
