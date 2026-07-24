import { Request, Response } from "express";
import applicationService from "../services/application.service.js";
import applicationScreeningService from "../services/ai/applicationScreening.js";
import jobService from "../services/job.service.js";
import resumeService from "../services/resume.service.js";
import { getUserId, getStringParam } from "../utils/routeHelpers.js";
import { sendSuccess } from "../utils/responseFormatter.js";
import { AppError } from "../utils/errorHandler.js";
import { ApplicationStatus } from "../models/Application.model.js";
import { buildResumeContent } from "../utils/buildResumeContent.js";
import logger from "../utils/logger.js";
import { asyncHandler } from "./base.controller.js";
import mongoose from "mongoose";

/**
 * Application Controller
 * Handles all application-related operations
 */
class ApplicationController {
  // ============================================================
  // APPLY FOR JOB
  // ============================================================

  /**
   * Apply for a job with AI screening
   * POST /api/applications
   * ✅ Only authenticated job seekers can apply
   */
  applyForJob = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);
      const { jobId, resumeId, coverLetter, expectedSalary, availableFrom } =
        req.body;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      // Validate required fields
      if (!jobId) {
        throw new AppError("Job ID is required", 400);
      }
      if (!resumeId) {
        throw new AppError("Resume ID is required", 400);
      }
      if (!coverLetter || coverLetter.length < 50) {
        throw new AppError("Cover letter must be at least 50 characters", 400);
      }

      // ✅ Get the job first (validate it exists and is open)
      const job = await jobService.getJobById(jobId);
      if (!job) {
        throw new AppError("Job not found", 404);
      }

      // ✅ Check if job is still open
      if (!job.isActive) {
        throw new AppError("This job is no longer accepting applications", 400);
      }

      // ✅ Check if user already applied
      const existingApplication =
        await applicationService.findByJobAndCandidate(jobId, userId);
      if (existingApplication) {
        throw new AppError("You have already applied for this job", 400);
      }

      // ✅ Get the resume with ownership validation
      const resume = await resumeService.getResume(resumeId, userId);
      if (!resume) {
        throw new AppError("Resume not found", 404);
      }

      // ✅ Create the application
      const application = await applicationService.createApplication({
        jobId,
        userId,
        resumeId,
        coverLetter,
        expectedSalary,
        availableFrom,
      });

      if (!application || !application._id) {
        logger.error("Application creation failed - no _id returned");
        throw new AppError("Failed to create application", 500);
      }

      // ✅ Run AI screening asynchronously
      try {
        const resumeContent = buildResumeContent(resume);

        const jobDetails = {
          title: job.title || "",
          location: job.location || "",
          requirements: job.requirements || "",
          description: job.description || "",
          workMode: job.workMode || "on-site",
          employmentType: job.jobType || "full-time",
          experienceLevel: job.experienceLevel || "mid",
          minSalary: job.minSalary || 0,
          maxSalary: job.maxSalary || 0,
          skills: job.skills || [],
        };

        const screeningResult =
          await applicationScreeningService.screenApplication(
            resumeContent,
            {
              expectedSalary,
              availableFrom,
              coverLetter,
            },
            jobDetails,
          );

        const applicationId = application._id.toString();

        // ✅ Update application with AI results
        await applicationService.updateApplication(applicationId, {
          aiScore: screeningResult.score,
          aiExplanation: screeningResult.explanation,
          aiStrengths: screeningResult.strengths,
          aiWeaknesses: screeningResult.weaknesses,
          aiRecommendation: screeningResult.recommendation,
        });

        // ✅ Get updated application
        const updatedApplication =
          await applicationService.getApplicationById(applicationId);

        sendSuccess(
          res,
          updatedApplication || application,
          "Application submitted with AI screening",
          201,
        );
        return;
      } catch (aiError) {
        logger.error("AI screening failed:", aiError);
        // ✅ Return application without AI screening
        sendSuccess(
          res,
          application,
          "Application submitted successfully (AI screening unavailable)",
          201,
        );
        return;
      }
    },
  );

  // ============================================================
  // GET APPLICATIONS
  // ============================================================

  /**
   * Get current user's applications
   * GET /api/applications
   * ✅ Only authenticated job seekers can view their applications
   */
  getMyApplications = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const applications =
        await applicationService.getApplicationsByApplicant(userId);

      sendSuccess(res, applications, "Applications fetched successfully");
    },
  );

  getApplicationTimeline = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const applications =
        await applicationService.getApplicationTimeline(userId);

      sendSuccess(res, applications, "Applications fetched successfully");
    },
  );

  /**
   * Get applications for employer's jobs
   * GET /api/applications/employer
   * ✅ Only authenticated employers can view applications
   */
  getEmployerApplications = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { jobId, status, limit = "20", page = "1" } = req.query;

      const applications = await applicationService.getApplicationsByEmployer(
        userId,
        {
          jobId: jobId as string,
          status: status as string,
          limit: parseInt(limit as string),
          page: parseInt(page as string),
        },
      );

      sendSuccess(res, applications, "Applications fetched successfully");
    },
  );

  getApplicationStats = async (req: Request, res: Response) => {
    try {
      const employerId = req.user?._id; // Assuming user is attached by auth middleware

      if (!employerId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized - Employer ID not found",
        });
      }

      // Validate employer ID
      if (!mongoose.Types.ObjectId.isValid(employerId.toString())) {
        return res.status(400).json({
          success: false,
          message: "Invalid employer ID format",
        });
      }

      const stats = await applicationService.getApplicationStats(
        employerId.toString(),
      );

      res.status(200).json({
        success: true,
        data: stats,
        message: "Application stats fetched successfully",
      });
    } catch (error: any) {
      console.error("Error fetching application stats:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to fetch application stats",
        error: process.env.NODE_ENV === "development" ? error : undefined,
      });
    }
  };

  /**
   * Get application details (applicant or employer)
   * GET /api/applications/{id}
   * ✅ Both job seekers and employers can view applications they're involved with
   */
  getApplicationById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);
      const applicationId = getStringParam(req.params.id);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!applicationId) {
        throw new AppError("Invalid application ID", 400);
      }

      const application =
        await applicationService.getApplicationById(applicationId);

      if (!application) {
        throw new AppError("Application not found", 404);
      }

      // ✅ Check access: applicant or employer who posted the job
      const app = application as any;
      const isApplicant = app.user?._id?.toString() === userId;
      const isEmployer = app.job?.postedBy?.toString() === userId;

      if (!isApplicant && !isEmployer) {
        throw new AppError("Access denied", 403);
      }

      sendSuccess(res, application, "Application fetched successfully");
    },
  );

  // ============================================================
  // UPDATE APPLICATION STATUS
  // ============================================================

  /**
   * Update application status (Employer only)
   * PATCH /api/applications/{id}/status
   * ✅ Only employers can update application status
   */
  updateApplicationStatus = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);
      const applicationId = getStringParam(req.params.id);
      const { status, notes } = req.body;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!applicationId) {
        throw new AppError("Invalid application ID", 400);
      }

      if (!status) {
        throw new AppError("Status is required", 400);
      }

      // ✅ Get application
      const application =
        await applicationService.getApplicationById(applicationId);
      if (!application) {
        throw new AppError("Application not found", 404);
      }

      // ✅ Verify employer owns this application
      const app = application as any;
      if (app.jobId?.postedBy?.toString() !== userId) {
        throw new AppError("Access denied", 403);
      }

      // ✅ Validate status
      const validStatuses = Object.values(ApplicationStatus);
      if (!validStatuses.includes(status)) {
        throw new AppError(
          `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          400,
        );
      }

      // ✅ Update status
      const updated = await applicationService.updateApplicationStatus(
        applicationId,
        status,
        notes,
      );

      // ✅ Trigger Kafka event for notification (handled in service)

      sendSuccess(res, updated, `Application status updated to ${status}`);
    },
  );

  // ============================================================
  // WITHDRAW APPLICATION
  // ============================================================

  /**
   * Withdraw application (Candidate only)
   * PATCH /api/applications/{id}/withdraw
   * ✅ Only job seekers can withdraw their own applications
   */
  withdrawApplication = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);
      const applicationId = getStringParam(req.params.id);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!applicationId) {
        throw new AppError("Invalid application ID", 400);
      }

      // Get application
      const application =
        await applicationService.getApplicationById(applicationId);
      if (!application) {
        throw new AppError("Application not found", 404);
      }

      // ✅ Verify ownership
      const app = application as any;
      if (app.userId?._id?.toString() !== userId) {
        throw new AppError("Access denied", 403);
      }

      const canWithdraw = await applicationService.canWithdraw(
        applicationId,
        userId,
      );

      if (!canWithdraw) {
        throw new AppError(
          "Cannot withdraw this application. It may be hired, rejected, or already withdrawn.",
          400,
        );
      }

      const updated = await applicationService.withdrawApplication(
        applicationId,
        userId,
        "Candidate withdrew application",
      );

      sendSuccess(res, updated, "Application withdrawn successfully");
    },
  );

  // ============================================================
  // DELETE APPLICATION
  // ============================================================

  /**
   * Delete application (Admin only)
   * DELETE /api/applications/{id}
   * ✅ Only admins can delete applications
   */
  deleteApplication = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const applicationId = getStringParam(req.params.id);

      if (!applicationId) {
        throw new AppError("Invalid application ID", 400);
      }

      const application =
        await applicationService.getApplicationById(applicationId);
      if (!application) {
        throw new AppError("Application not found", 404);
      }

      await applicationService.deleteApplication(applicationId);

      sendSuccess(res, null, "Application deleted successfully");
    },
  );
}

export default new ApplicationController();
