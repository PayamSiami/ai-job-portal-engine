import { Router } from "express";
import jobController from "../controllers/job.controller.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = Router();

// ============================================================
// 🟢 PUBLIC ROUTES (No authentication required)
// ============================================================

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     summary: Get all jobs with filtering and pagination
 *     tags: [Jobs]
 */
router.get("/", jobController.getJobs);

/**
 * @swagger
 * /api/jobs/featured:
 *   get:
 *     summary: Get featured jobs
 *     tags: [Jobs]
 */
router.get("/featured", jobController.getFeaturedJobs);

/**
 * @swagger
 * /api/jobs/stats:
 *   get:
 *     summary: Get stats jobs
 *     tags: [Jobs]
 */
router.get("/stats", protect, jobController.getJobStats);

// routes/job.routes.ts

/**
 * @swagger
 * /api/jobs/stats/global:
 *   get:
 *     summary: Get global job statistics
 *     tags: [Jobs, Statistics]
 *     security:
 *       - bearerAuth: []
 */
router.get("/stats/global", jobController.getGlobalJobStats);

/**
 * @swagger
 * /api/jobs/performance:
 *   get:
 *     summary: Get performance jobs
 *     tags: [Jobs]
 */
router.get("/performance", protect, jobController.getJobPerformance);

/**
 * @swagger
 * /api/jobs/employer:
 *   get:
 *     summary: Get jobs by employer
 *     tags: [Jobs]
 */
router.get("/employer", protect, jobController.getJobsByEmployer);

/**
 * @swagger
 * /api/jobs/analytics:
 *   get:
 *     summary: Get job analytics (employer only)
 *     tags: [Jobs, Analytics]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/analytics",
  protect,
  authorize("employer"),
  jobController.getJobAnalytics,
);

/**
 * @swagger
 * /api/jobs/:id:
 *   get:
 *     summary: Get a single job by ID
 *     tags: [Jobs]
 */
router.get("/:id", jobController.getJobById);

/**
 * @swagger
 * /api/jobs/:id/similar:
 *   get:
 *     summary: Get similar jobs
 *     tags: [Jobs]
 */
router.get("/:id/similar", jobController.getSimilarJobs);

// ============================================================
// 🔵 PROTECTED ROUTES (Authentication required)
// ============================================================

/**
 * @swagger
 * /api/jobs:
 *   post:
 *     summary: Create a new job (employer only)
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.post("/", protect, authorize("employer"), jobController.createJob);

/**
 * @swagger
 * /api/jobs/bulk:
 *   post:
 *     summary: Bulk create jobs (employer only)
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/bulk",
  protect,
  authorize("employer"),
  jobController.bulkCreateJobs,
);

/**
 * @swagger
 * /api/jobs/:id:
 *   put:
 *     summary: Update a job (employer only)
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.put("/:id", protect, authorize("employer"), jobController.updateJob);

/**
 * @swagger
 * /api/jobs/:id:
 *   delete:
 *     summary: Delete a job (employer only)
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.delete("/:id", protect, authorize("employer"), jobController.deleteJob);

/**
 * @swagger
 * /api/jobs/:id/toggle-status:
 *   patch:
 *     summary: Toggle job status (employer only)
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  "/:id/toggle-status",
  protect,
  authorize("employer"),
  jobController.toggleJobStatus,
);

/**
 * @swagger
 * /api/jobs/:id/applications:
 *   get:
 *     summary: Get job applications (employer only)
 *     tags: [Jobs, Applications]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/:id/applications",
  protect,
  authorize("employer"),
  jobController.getJobApplications,
);

// ============================================================
// 🤖 AI ROUTES
// ============================================================

/**
 * @swagger
 * /api/jobs/search/ai:
 *   get:
 *     summary: AI-powered natural language job search
 *     tags: [AI, Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.get("/search/ai", protect, jobController.searchJobsAI);

/**
 * @swagger
 * /api/jobs/generate-content:
 *   post:
 *     summary: Generate job content using AI (employer only)
 *     tags: [AI, Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/generate-content",
  protect,

  authorize("employer"),
  jobController.generateJobContent,
);

export default router;
