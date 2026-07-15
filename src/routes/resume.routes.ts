import express, { Request, Response, Router } from "express";
import resumeService from "../services/resumeService.js";
import resumeAnalyzerService from "../services/ai/resumeAnalyzer.service.js";
import careerFeedbackService from "../services/ai/careerFeedback.js";
import coverLetterGeneratorService from "../services/ai/coverLetterGenerator.js";
import jobMatchRecommenderService from "../services/ai/jobMatchRecommender.service..js";
import jobService from "../services/jobService.js";
import pdfService from "../services/pdfService.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { getStringParam, getUserId } from "../utils/routeHelpers.js";
import logger from "../utils/logger.js";
import { buildResumeContent } from "../utils/buildResumeContent.js";
import { AppError } from "../utils/errorHandler.js";

const router: Router = express.Router();

// ============================================
// Resume CRUD Operations
// ============================================
/**
 * @swagger
 * /api/resumes:
 *   get:
 *     summary: Get all resumes for the authenticated user
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, draft, active, archived]
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of resumes
 *       401:
 *         description: Unauthorized
 */
router.get("/", protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const { status, page = 1, limit = 10 } = req.query;

    const result = await resumeService.getResumesByUser(userId, {
      status: status as string,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({
      success: true,
      data: result.resumes,
      pagination: result.pagination,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch resumes";
    logger.error("Get resumes error:", { error: errorMessage });
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * @swagger
 * /api/resumes:
 *   post:
 *     summary: Create a new resume
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               template:
 *                 type: string
 *                 enum: [modern, classic, minimal, creative]
 *               visibility:
 *                 type: string
 *                 enum: [private, public, shared]
 *               isDefault:
 *                 type: boolean
 *               personalInfo:
 *                 type: object
 *               experience:
 *                 type: array
 *               education:
 *                 type: array
 *               skills:
 *                 type: array
 *               certifications:
 *                 type: array
 *               languages:
 *                 type: array
 *               projects:
 *                 type: array
 *     responses:
 *       201:
 *         description: Resume created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const resume = await resumeService.createResume(userId, req.body);
      res.status(201).json({
        success: true,
        data: resume,
        message: "Resume created successfully",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create resume";
      logger.error("Create resume error:", { error: errorMessage });
      res.status(400).json({ error: errorMessage });
    }
  },
);

/**
 * @swagger
 * /api/resumes:
 *   post:
 *     summary: Duplicate a new resume
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resumeId

 *     responses:
 *       201:
 *         description: Resume created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/duplicate/:id",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const resumeId = getStringParam(req.params.id);

      const resume = await resumeService.duplicateResume(resumeId, userId);
      res.status(201).json({
        success: true,
        data: resume,
        message: "Resume created successfully",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create resume";
      logger.error("Create resume error:", { error: errorMessage });
      res.status(400).json({ error: errorMessage });
    }
  },
);

/**
 * @swagger
 * /api/resumes/{id}:
 *   get:
 *     summary: Get a single resume by ID
 *     tags: [Resumes]
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
 *         description: Resume details
 *       404:
 *         description: Resume not found
 *       401:
 *         description: Unauthorized
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

      const resumeId = getStringParam(req.params.id);
      if (!resumeId) {
        res.status(400).json({ error: "Invalid resume ID" });
        return;
      }

      const resume = await resumeService.getResume(resumeId, userId);

      if (!resume) {
        res.status(404).json({ error: "Resume not found" });
        return;
      }

      res.json({
        success: true,
        data: resume,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch resume";
      logger.error("Get resume error:", { error: errorMessage });
      res.status(500).json({ error: errorMessage });
    }
  },
);

/**
 * @swagger
 * /api/resumes/{id}:
 *   put:
 *     summary: Update a resume
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Resume updated successfully
 *       404:
 *         description: Resume not found
 *       401:
 *         description: Unauthorized
 */
router.put(
  "/:id",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const resumeId = getStringParam(req.params.id);
      if (!resumeId) {
        res.status(400).json({ error: "Invalid resume ID" });
        return;
      }

      const resume = await resumeService.updateResume(
        resumeId,
        userId,
        req.body,
      );

      res.json({
        success: true,
        data: resume,
        message: "Resume updated successfully",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update resume";
      logger.error("Update resume error:", { error: errorMessage });
      res.status(400).json({ error: errorMessage });
    }
  },
);

/**
 * @swagger
 * /api/resumes/{id}:
 *   delete:
 *     summary: Delete a resume
 *     tags: [Resumes]
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
 *         description: Resume deleted successfully
 *       404:
 *         description: Resume not found
 *       401:
 *         description: Unauthorized
 */
router.delete(
  "/:id",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const resumeId = getStringParam(req.params.id);
      if (!resumeId) {
        res.status(400).json({ error: "Invalid resume ID" });
        return;
      }

      await resumeService.deleteResume(resumeId, userId);

      res.json({
        success: true,
        message: "Resume deleted successfully",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete resume";
      logger.error("Delete resume error:", { error: errorMessage });
      res.status(400).json({ error: errorMessage });
    }
  },
);

/**
 * @swagger
 * /api/resumes/{id}/default:
 *   put:
 *     summary: Set a resume as default
 *     tags: [Resumes]
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
 *         description: Default resume updated
 *       404:
 *         description: Resume not found
 *       401:
 *         description: Unauthorized
 */
router.put(
  "/:id/default",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const resumeId = getStringParam(req.params.id);
      if (!resumeId) {
        res.status(400).json({ error: "Invalid resume ID" });
        return;
      }

      const resume = await resumeService.setDefaultResume(resumeId, userId);

      res.json({
        success: true,
        data: resume,
        message: "Default resume updated successfully",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to set default resume";
      logger.error("Set default resume error:", { error: errorMessage });
      res.status(400).json({ error: errorMessage });
    }
  },
);

/**
 * @swagger
 * /api/resumes/{id}/pdf:
 *   get:
 *     summary: Download saved PDF
 *     tags: [Resumes, PDF]
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
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: PDF not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to get PDF
 */
router.get(
  "/:id/pdf",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const resumeId = getStringParam(id);
      if (!resumeId) {
        res.status(400).json({ error: "Invalid resume ID" });
        return;
      }

      const resume = await resumeService.getResume(resumeId, userId);
      if (!resume) {
        res.status(404).json({ error: "Resume not found" });
        return;
      }

      // Get PDF path
      const pdfPath = pdfService.getPDFPath(resumeId);
      if (!pdfPath) {
        res.status(404).json({ error: "PDF file not found" });
        return;
      }

      // Read and send file
      const fs = await import("fs");
      const fileBuffer = fs.readFileSync(pdfPath);
      const stats = fs.statSync(pdfPath);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="resume-${resume.title || "untitled"}.pdf"`,
      );
      res.setHeader("Content-Length", stats.size);

      res.send(fileBuffer);

      logger.info("Saved PDF downloaded successfully", { resumeId, userId });
    } catch (error) {
      logger.error("Download saved PDF error:", error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to download saved PDF",
      });
    }
  },
);

// ============================================
// AI Features
// ============================================

/**
 * @swagger
 * /api/resumes/{id}/analyze:
 *   get:
 *     summary: AI resume analyzer
 *     tags: [Resumes, AI]
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
 *         description: Resume analysis results
 *       404:
 *         description: Resume not found
 *       401:
 *         description: Unauthorized
 */
// In your resume routes
router.get(
  "/:id/analyze",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    const userId = getUserId(req);
    const resumeId = getStringParam(req.params.id);
    const jobId = (req.query.jobId as string) || req.body.jobId;

    // ✅ Validate inputs
    if (!resumeId) {
      throw new AppError("Invalid resume ID", 400);
    }

    if (!jobId) {
      throw new AppError("Job ID is required", 400);
    }

    // ✅ Get resume with ownership validation
    const resume = await resumeService.getResume(resumeId, String(userId));
    if (!resume) {
      throw new AppError("Resume not found", 404);
    }

    // ✅ Get the job
    const job = await jobService.getJobById(jobId);
    if (!job) {
      throw new AppError("Job not found", 404);
    }

    // ✅ Build resume content
    const content = buildResumeContent(resume);

    logger.info("Resume content built for analysis", {
      resumeId: resume._id,
      jobId: job._id,
      contentLength: content.length,
      skillCount: resume.skills?.length || 0,
    });

    // ✅ Validate content length
    if (!content || content.trim().length < 50) {
      throw new AppError(
        "Resume content is too short. Please add more details. Minimum 50 characters required.",
        400,
      );
    }

    // ✅ Build requirements from job
    const requirements = job.requirements || job.description || "";

    // ✅ Perform analysis
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

    // ✅ Return response
    res.status(200).json({
      success: true,
      data: {
        resume: {
          id: resume._id,
          title: resume.title,
          skills: resume.skills?.map((s: any) => s.name) || [],
        },
        job: {
          id: job._id,
          title: job.title,
          company: job.company,
        },
        analysis,
      },
    });
  },
);

/**
 * @swagger
 * /api/resumes/{id}/generate-cover-letter:
 *   post:
 *     summary: AI cover letter generator
 *     tags: [Resumes, AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobId
 *             properties:
 *               jobId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Generated cover letter
 *       404:
 *         description: Resume or job not found
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/:id/generate-cover-letter",
  authorize("job-seeker"),
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { jobId } = req.body;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      if (!jobId) {
        res.status(400).json({ error: "Job ID is required" });
        return;
      }

      const resumeId = getStringParam(req.params.id);
      if (!resumeId) {
        res.status(400).json({ error: "Invalid resume ID" });
        return;
      }

      const resume = await resumeService.getResume(resumeId, userId);
      const job = await jobService.getJobById(jobId);

      if (!resume || !job) {
        res.status(404).json({ error: "Resume or job not found" });
        return;
      }

      // Build content from structured resume data
      const content = buildResumeContent(resume);

      const coverLetter = await coverLetterGeneratorService.generateCoverLetter(
        {
          title: job.title || "",
          company: job.company || "",
          location: job.location || "",
          requirements: job.requirements || "",
          description: job.description || "",
        },
        content,
      );

      res.json({
        success: true,
        data: { coverLetter },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to generate cover letter";
      logger.error("Generate cover letter error:", { error: errorMessage });
      res.status(500).json({ error: errorMessage });
    }
  },
);

/**
 * @swagger
 * /api/resumes/{id}/career-feedback:
 *   get:
 *     summary: AI career feedback
 *     tags: [Resumes, AI]
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
 *         description: Career feedback
 *       404:
 *         description: Resume not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/:id/career-feedback",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const resumeId = getStringParam(req.params.id);
      if (!resumeId) {
        res.status(400).json({ error: "Invalid resume ID" });
        return;
      }

      const resume = await resumeService.getResume(resumeId, userId);

      if (!resume) {
        res.status(404).json({ error: "Resume not found" });
        return;
      }

      // Build content from structured resume data
      const content = buildResumeContent(resume);

      const feedback =
        await careerFeedbackService.generateCareerFeedback(content);

      res.json({
        success: true,
        data: { feedback },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to generate feedback";
      logger.error("Generate feedback error:", { error: errorMessage });
      res.status(500).json({ error: errorMessage });
    }
  },
);

/**
 * @swagger
 * /api/resumes/{id}/job-matches:
 *   get:
 *     summary: AI job match recommendations
 *     tags: [Resumes, AI]
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
 *         description: Job match recommendations
 *       404:
 *         description: Resume not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/:id/job-matches",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const resumeId = getStringParam(req.params.id);
      if (!resumeId) {
        res.status(400).json({ error: "Invalid resume ID" });
        return;
      }

      const resume = await resumeService.getResume(resumeId, userId);

      if (!resume) {
        res.status(404).json({ error: "Resume not found" });
        return;
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

      const matches = await jobMatchRecommenderService.getJobMatches(
        content,
        mappedJobs,
      );

      res.json({
        success: true,
        data: { matches },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to find job matches";
      logger.error("Job matches error:", { error: errorMessage });
      res.status(500).json({ error: errorMessage });
    }
  },
);

export default router;
