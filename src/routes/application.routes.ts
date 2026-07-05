// src/routes/application.routes.ts
import express, { Request, Response, Router } from "express";
import applicationService from "../services/applicationService.js";
import applicationScreeningService from "../services/ai/applicationScreening.js";
import jobService from "../services/jobService.js";
import resumeService from "../services/resumeService.js";
import { protect } from "../middleware/authMiddleware.js";
import logger from "../utils/logger.js";

const router: Router = express.Router();

// ✅ Helper to safely get string parameter
const getStringParam = (param: string | string[] | undefined): string => {
  if (!param) return "";
  if (Array.isArray(param)) return param[0] || "";
  return param;
};

// ✅ Helper to get user ID from request
const getUserId = (req: Request): string | null => {
  const user = (req as any).user;
  if (!user) return null;
  return user.id?.toString() || null;
};

// ✅ Helper to map job to job details
const mapJobToJobDetails = (job: any) => ({
  title: job.title || "",
  company: job.company || "",
  location: job.location || "",
  requirements: job.requirements || "",
  description: job.description || "",
  minSalary: job.minSalary,
  maxSalary: job.maxSalary,
  benefits: job.benefits,
  department: job.department,
  employmentType: job.employmentType,
  experienceLevel: job.experienceLevel,
});

/**
 * @swagger
 * /api/applications:
 *   post:
 *     summary: Apply for a job with AI screening
 *     tags: [Applications, AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateApplicationRequest'
 *     responses:
 *       201:
 *         description: Application created with AI screening
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Application'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to create application
 */
router.post(
  "/",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { jobId, resumeId, coverLetter, expectedSalary, availableFrom } =
        req.body;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const application = await applicationService.createApplication({
        jobId,
        applicantId: userId,
        resumeId,
        coverLetter,
        expectedSalary,
        availableFrom,
      });

      const job = await jobService.getJobById(jobId);
      const resume = await resumeService.getResumeById(resumeId);

      if (job && resume) {
        try {
          const jobDetails = mapJobToJobDetails(job);
          const screeningResult =
            await applicationScreeningService.screenApplication(
              resume.content,
              { expectedSalary, availableFrom, coverLetter },
              jobDetails,
            );

          await applicationService.updateApplication(application._id, {
            aiScore: screeningResult.score,
            aiExplanation: screeningResult.explanation,
            aiStrengths: screeningResult.strengths,
            aiWeaknesses: screeningResult.weaknesses,
            aiRecommendation: screeningResult.recommendation,
          });

          const updatedApplication =
            await applicationService.getApplicationById(application._id);
          res.status(201).json(updatedApplication);
          return;
        } catch (aiError) {
          console.error("AI screening failed:", aiError);
          res.status(201).json(application);
          return;
        }
      }

      res.status(201).json(application);
    } catch (error) {
      logger.error("Error creating application:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create application";
      res.status(500).json({ error: errorMessage });
    }
  },
);

/**
 * @swagger
 * /api/applications:
 *   get:
 *     summary: Get current user's applications
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's applications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Application'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const applications =
      await applicationService.getApplicationsByApplicant(userId);
    res.json(applications);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch applications";
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * @swagger
 * /api/applications/{id}:
 *   get:
 *     summary: Get application details (applicant or employer)
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Application'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
router.get(
  "/:id",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      // ✅ Safely get the application ID from params
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

      // Convert ObjectId to string for comparison
      const app = application as any;
      const isApplicant = app.applicantId?.toString() === userId;
      const isEmployer = app.job?.postedBy?.toString() === userId;

      if (!isApplicant && !isEmployer) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      res.json(application);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch application";
      res.status(500).json({ error: errorMessage });
    }
  },
);

export default router;
