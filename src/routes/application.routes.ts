import { Router } from "express";
import applicationController from "../controllers/application.controller.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = Router();

// ============================================================
// APPLICATION ROUTES
// ============================================================

/**
 * @swagger
 * /api/applications:
 *   post:
 *     summary: Apply for a job
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/",
  protect,
  authorize("job-seeker"),
  applicationController.applyForJob,
);

/**
 * @swagger
 * /api/applications:
 *   get:
 *     summary: Get current user's applications
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/",
  protect,
  authorize("job-seeker"),
  applicationController.getMyApplications,
);

/**
 * @swagger
 * /api/applications:
 *   get:
 *     summary: Get current user's application timeline
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/timeline",
  protect,
  authorize("employer"),
  applicationController.getApplicationTimeline,
);

/**
 * @swagger
 * /api/applications/employer:
 *   get:
 *     summary: Get applications for employer's jobs
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/employer",
  protect,
  authorize("employer"),
  applicationController.getEmployerApplications,
);

router.get(
  "/applications/stats",
  protect,
  applicationController.getApplicationStats,
);

/**
 * @swagger
 * /api/applications/{id}:
 *   get:
 *     summary: Get application details
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id", protect, applicationController.getApplicationById);

/**
 * @swagger
 * /api/applications/{id}/status:
 *   patch:
 *     summary: Update application status (Employer only)
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  "/:id/status",
  protect,
  authorize("employer"),
  applicationController.updateApplicationStatus,
);

/**
 * @swagger
 * /api/applications/{id}/withdraw:
 *   patch:
 *     summary: Withdraw application (Candidate only)
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  "/:id/withdraw",
  protect,
  authorize("job-seeker"),
  applicationController.withdrawApplication,
);

/**
 * @swagger
 * /api/applications/{id}:
 *   delete:
 *     summary: Delete application (Admin only)
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  applicationController.deleteApplication,
);

export default router;
