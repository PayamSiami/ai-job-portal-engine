// backend/src/routes/application.routes.ts
import express, { Request, Response, Router } from "express";
import applicationService from "../services/applicationService.js";
import applicationScreeningService from "../services/ai/applicationScreening.js";
import jobService from "../services/jobService.js";
import resumeService from "../services/resumeService.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import logger from "../utils/logger.js";
import { getStringParam, getUserId } from "../utils/routeHelpers.js";
import { ApplicationStatus } from "../models/Application.model.js";
import { AppError } from "../utils/errorHandler.js";
import { buildResumeContent } from "../utils/buildResumeContent.js";

const router: Router = express.Router();
// ==================== Routes ====================

/**
 * POST /api/applications
 * Apply for a job with AI screening
 * ✅ Only authenticated job seekers can apply
 */
router.post(
  "/",
  protect,
  authorize("job-seeker"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { jobId, resumeId, coverLetter, expectedSalary, availableFrom } =
        req.body;

      // ✅ Validate user
      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      // ✅ Validate required fields
      if (!jobId) {
        res.status(400).json({ error: "Job ID is required" });
        return;
      }
      if (!resumeId) {
        res.status(400).json({ error: "Resume ID is required" });
        return;
      }
      if (!coverLetter || coverLetter.length < 50) {
        res.status(400).json({
          error: "Cover letter must be at least 50 characters",
        });
        return;
      }

      // ✅ Get the job first (validate it exists and is open)
      const job = await jobService.getJobById(jobId);
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }

      // ✅ Check if job is still open
      if (!job.isActive) {
        res.status(400).json({
          error: "This job is no longer accepting applications",
        });
        return;
      }

      // ✅ Check if user already applied
      const existingApplication =
        await applicationService.findByJobAndCandidate(jobId, userId);
      if (existingApplication) {
        res.status(400).json({
          error: "You have already applied for this job",
        });
        return;
      }

      // ✅ Get the resume with ownership validation
      const resume = await resumeService.getResume(resumeId, userId);
      if (!resume) {
        res.status(404).json({ error: "Resume not found" });
        return;
      }

      // ✅ Create the application
      const application = await applicationService.createApplication({
        jobId,
        userId: userId,
        resumeId,
        coverLetter,
        expectedSalary,
        availableFrom,
      });

      if (!application || !application._id) {
        logger.error("Application creation failed - no _id returned");
        res.status(500).json({ error: "Failed to create application" });
        return;
      }

      // ✅ Run AI screening asynchronously
      try {
        const resumeContent = buildResumeContent(resume);

        const jobDetails = {
          title: job.title || "",
          company: job.company || "",
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

        res.status(201).json({
          success: true,
          data: updatedApplication || application,
          message: "Application submitted with AI screening",
        });
        return;
      } catch (aiError) {
        logger.error("AI screening failed:", aiError);
        // ✅ Return application without AI screening
        res.status(201).json({
          success: true,
          data: application,
          message:
            "Application submitted successfully (AI screening unavailable)",
        });
        return;
      }
    } catch (error) {
      logger.error("Error creating application:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create application";
      res.status(500).json({ error: errorMessage });
    }
  },
);

/**
 * GET /api/applications
 * Get current user's applications
 * ✅ Only authenticated job seekers can view their applications
 */
router.get(
  "/",
  protect,
  authorize("job-seeker"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const applications =
        await applicationService.getApplicationsByApplicant(userId);

      res.json({
        success: true,
        data: applications,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch applications";
      res.status(500).json({ error: errorMessage });
    }
  },
);

/**
 * GET /api/applications/employer
 * Get applications for employer's jobs
 * ✅ Only authenticated employers can view applications
 */
router.get(
  "/employer",
  protect,
  authorize("employer"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
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

      res.json({
        success: true,
        data: applications,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch applications";
      res.status(500).json({ error: errorMessage });
    }
  },
);

/**
 * GET /api/applications/{id}
 * Get application details (applicant or employer)
 * ✅ Both job seekers and employers can view applications they're involved with
 */
router.get(
  "/:id",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);
      const applicationId = getStringParam(req.params.id);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!applicationId) {
        res.status(400).json({ error: "Invalid application ID" });
        return;
      }

      const application =
        await applicationService.getApplicationById(applicationId);

      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      // ✅ Check access: applicant or employer who posted the job
      const app = application as any;
      const isApplicant = app.userId?.toString() === userId;
      const isEmployer = app.jobId?.postedBy?.toString() === userId;

      if (!isApplicant && !isEmployer) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      res.json({
        success: true,
        data: application,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch application";
      res.status(500).json({ error: errorMessage });
    }
  },
);

/**
 * PATCH /api/applications/{id}/status
 * Update application status (Employer only)
 * ✅ Only employers can update application status
 */
router.patch(
  "/:id/status",
  protect,
  authorize("employer"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);
      const applicationId = getStringParam(req.params.id);
      const { status, notes } = req.body;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!applicationId) {
        res.status(400).json({ error: "Invalid application ID" });
        return;
      }

      if (!status) {
        res.status(400).json({ error: "Status is required" });
        return;
      }

      // ✅ Get application
      const application =
        await applicationService.getApplicationById(applicationId);
      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      // ✅ Verify employer owns this application
      const app = application as any;
      if (app.jobId?.postedBy?.toString() !== userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const validStatuses = Object.values(ApplicationStatus);
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        });
        return;
      }

      // ✅ Update status
      const updated = await applicationService.updateApplicationStatus(
        applicationId,
        status,
        notes,
      );

      // ✅ Trigger Kafka event for notification (handled in service)

      res.json({
        success: true,
        message: `Application status updated to ${status}`,
        data: updated,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update status";
      res.status(500).json({ error: errorMessage });
    }
  },
);

/**
 * POST /api/applications/{id}/withdraw
 * Withdraw application (Candidate only)
 * ✅ Only job seekers can withdraw their own applications
 */
router.post(
  "/:id/withdraw",
  protect,
  authorize("job-seeker"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);
      const applicationId = getStringParam(req.params.id);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!applicationId) {
        res.status(400).json({ error: "Invalid application ID" });
        return;
      }

      // Get application
      const application =
        await applicationService.getApplicationById(applicationId);
      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      // ✅ Verify ownership
      const app = application as any;
      if (app.userId?.toString() !== userId) {
        res.status(403).json({ error: "Access denied" });
        return;
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

      res.json({
        success: true,
        message: "Application withdrawn successfully",
        data: updated,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to withdraw application";
      res.status(500).json({ error: errorMessage });
    }
  },
);

/**
 * DELETE /api/applications/{id}
 * Delete application (Admin only)
 * ✅ Only admins can delete applications
 */
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const applicationId = getStringParam(req.params.id);

      if (!applicationId) {
        res.status(400).json({ error: "Invalid application ID" });
        return;
      }

      const application =
        await applicationService.getApplicationById(applicationId);
      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      await applicationService.deleteApplication(applicationId);

      res.json({
        success: true,
        message: "Application deleted successfully",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete application";
      res.status(500).json({ error: errorMessage });
    }
  },
);

export default router;
