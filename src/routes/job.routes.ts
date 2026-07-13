import express, { Request, Response, Router } from "express";
import jobService from "../services/jobService.js";
import jobSearchService from "../services/ai/jobSearchService.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { EmployerController } from "../controllers/employer.controller.js";

const router: Router = express.Router();

// ============================================
// 🟢 PUBLIC ROUTES (No authentication required)
// ============================================

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     summary: Get all jobs with filtering and pagination
 *     tags: [Jobs]
 *     parameters:
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
 *       - in: query
 *         name: title
 *         schema:
 *           type: string
 *       - in: query
 *         name: company
 *         schema:
 *           type: string
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *       - in: query
 *         name: workMode
 *         schema:
 *           type: string
 *           enum: [remote, hybrid, on-site]
 *       - in: query
 *         name: employmentType
 *         schema:
 *           type: string
 *           enum: [full-time, part-time, contract, internship]
 *       - in: query
 *         name: minSalary
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxSalary
 *         schema:
 *           type: number
 *       - in: query
 *         name: experienceLevel
 *         schema:
 *           type: string
 *           enum: [entry, mid, senior, lead, executive]
 *       - in: query
 *         name: skills
 *         schema:
 *           type: string
 *           description: Comma-separated skills
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *           default: true
 *       - in: query
 *         name: isFeatured
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: postedBy
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of jobs with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Job'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       500:
 *         description: Server error
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, ...filters } = req.query;
    const jobs = await jobService.getJobs(filters, {
      page: Number(page),
      limit: Number(limit),
    });
    res.json(jobs);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch jobs";
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * @swagger
 * /api/jobs/{id}:
 *   get:
 *     summary: Get a single job by ID
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 *       404:
 *         description: Job not found
 *       500:
 *         description: Server error
 */
router.get(
  "/:id",
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    try {
      const job = await jobService.getJobById(req.params.id);
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }
      res.json(job);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch job";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// ============================================
// 🔵 PROTECTED ROUTES (Authentication required)
// ============================================

/**
 * @swagger
 * /api/jobs/search/ai:
 *   get:
 *     summary: AI-powered natural language job search
 *     tags: [AI, Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: AI search results
 *       400:
 *         description: Search query is required
 *       500:
 *         description: AI search failed
 */
router.get(
  "/search/ai",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { query } = req.query;

      if (!query || typeof query !== "string" || query.trim() === "") {
        res.status(400).json({ error: "Search query is required" });
        return;
      }

      const parsedFilters =
        await jobSearchService.parseNaturalLanguageQuery(query);
      const searchResults = await jobSearchService.searchJobs(parsedFilters);
      const jobs = await jobService.getJobsWithMongoQuery(searchResults.where, {
        page: 1,
        limit: 20,
      });

      res.json({
        query,
        parsedFilters,
        results: jobs,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "AI search failed";
      res.status(500).json({ error: errorMessage });
    }
  },
);

/**
 * @swagger
 * /api/jobs:
 *   post:
 *     summary: Create a new job (employer only)
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateJobRequest'
 *     responses:
 *       201:
 *         description: Job created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - employer role required
 */
router.post(
  "/",
  protect,
  authorize("employer"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }
      const job = await jobService.createJob(userId, req.body);
      res.status(201).json(job);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create job";
      res.status(400).json({ error: errorMessage });
    }
  },
);

/**
 * @swagger
 * /api/jobs/generate-content:
 *   post:
 *     summary: Generate job content using AI (employer only)
 *     tags: [AI, Jobs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GenerateJobContentRequest'
 *     responses:
 *       200:
 *         description: Generated job content
 *       400:
 *         description: Job title is required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - employer role required
 */
router.post(
  "/generate-content",
  protect,
  authorize("employer"),
  async (
    req: Request<{}, {}, { jobTitle: string }>,
    res: Response,
  ): Promise<void> => {
    try {
      const { jobTitle } = req.body;

      if (!jobTitle || typeof jobTitle !== "string" || jobTitle.trim() === "") {
        res.status(400).json({ error: "Job title is required" });
        return;
      }

      const jobContent = await jobService.generateJobContent(jobTitle);

      res.json({
        success: true,
        data: jobContent,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to generate job content";
      res.status(500).json({ error: errorMessage });
    }
  },
);

router.get(
  "/employer/analytics",
  protect,
  authorize("employer"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const employerId = (req as any).user?.id;
      const { timeRange = "30d" } = req.query;

      // ✅ Call the service
      const analytics = await jobService.getJobAnalytics(
        employerId,
        timeRange as string,
      );

      res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error("❌ Error in getJobAnalytics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch job analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);
export default router;
