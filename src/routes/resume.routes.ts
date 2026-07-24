import { Router } from "express";
import resumeController from "../controllers/resume.controller.js";
import resumeAIController from "../controllers/resume.controller.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { validate } from "../middleware/validation.middleware.js";
import {
  createResumeValidation,
  updateResumeValidation,
  getResumeValidation,
  deleteResumeValidation,
  duplicateResumeValidation,
  setDefaultResumeValidation,
  downloadPDFValidation,
  exportResumeValidation,
  analyzeResumeValidation,
  generateCoverLetterValidation,
  careerFeedbackValidation,
  jobMatchesValidation,
  improvementSuggestionsValidation,
  bulkDeleteValidation,
} from "../validations/resume.validator.js";

const router = Router();

// ============================================================
// RESUME CRUD OPERATIONS
// ============================================================

/**
 * @swagger
 * /api/resumes:
 *   get:
 *     summary: Get all resumes for the authenticated user
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 */
router.get("/", protect, resumeController.getUserResumes);

/**
 * @swagger
 * /api/resumes:
 *   post:
 *     summary: Create a new resume
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/",
  protect,
  validate(createResumeValidation),
  resumeController.createResume,
);

/**
 * @swagger
 * /api/resumes/stats:
 *   get:
 *     summary: Get resume statistics
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 */
router.get("/stats", protect, resumeController.getResumeStats);

/**
 * @swagger
 * /api/resumes/bulk-delete:
 *   post:
 *     summary: Delete multiple resumes
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/bulk-delete",
  protect,
  validate(bulkDeleteValidation),
  resumeController.bulkDeleteResumes,
);

/**
 * @swagger
 * /api/resumes/:id:
 *   get:
 *     summary: Get a single resume by ID
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/:id",
  protect,
  validate(getResumeValidation),
  resumeController.getResume,
);

/**
 * @swagger
 * /api/resumes/:id:
 *   put:
 *     summary: Update a resume
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/:id",
  protect,
  validate(updateResumeValidation),
  resumeController.updateResume,
);

/**
 * @swagger
 * /api/resumes/:id:
 *   delete:
 *     summary: Delete a resume
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/:id",
  protect,
  validate(deleteResumeValidation),
  resumeController.deleteResume,
);

/**
 * @swagger
 * /api/resumes/:id/duplicate:
 *   post:
 *     summary: Duplicate an existing resume
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/:id/duplicate",
  protect,
  validate(duplicateResumeValidation),
  resumeController.duplicateResume,
);

/**
 * @swagger
 * /api/resumes/:id/default:
 *   put:
 *     summary: Set a resume as default
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  "/:id/default",
  protect,
  validate(setDefaultResumeValidation),
  resumeController.setDefaultResume,
);

/**
 * @swagger
 * /api/resumes/:id/pdf:
 *   get:
 *     summary: Download saved PDF
 *     tags: [Resumes, PDF]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/:id/pdf",
  protect,
  validate(downloadPDFValidation),
  resumeController.downloadResumePDF,
);

/**
 * @swagger
 * /api/resumes/:id/export:
 *   get:
 *     summary: Export resume data
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/:id/export",
  protect,
  validate(exportResumeValidation),
  resumeController.exportResume,
);

// ============================================================
// AI FEATURES
// ============================================================

/**
 * @swagger
 * /api/resumes/:id/analyze:
 *   get:
 *     summary: AI resume analyzer
 *     tags: [Resumes, AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 */
router.get(
  "/:id/analyze",
  protect,
  validate(analyzeResumeValidation),
  resumeAIController.analyzeResume,
);

/**
 * @swagger
 * /api/resumes/:id/generate-cover-letter:
 *   post:
 *     summary: AI cover letter generator
 *     tags: [Resumes, AI]
 *     security:
 *       - bearerAuth: []
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
 */
router.post(
  "/:id/generate-cover-letter",
  protect,
  authorize("job-seeker"),
  validate(generateCoverLetterValidation),
  resumeAIController.generateCoverLetter,
);

/**
 * @swagger
 * /api/resumes/:id/career-feedback:
 *   get:
 *     summary: AI career feedback
 *     tags: [Resumes, AI]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/:id/career-feedback",
  protect,
  validate(careerFeedbackValidation),
  resumeAIController.getCareerFeedback,
);

/**
 * @swagger
 * /api/resumes/:id/job-matches:
 *   get:
 *     summary: AI job match recommendations
 *     tags: [Resumes, AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: minMatchScore
 *         schema:
 *           type: integer
 *           default: 60
 */
router.get(
  "/:id/job-matches",
  protect,
  validate(jobMatchesValidation),
  resumeAIController.getJobMatches,
);

/**
 * @swagger
 * /api/resumes/:id/improvements:
 *   get:
 *     summary: Get resume improvement suggestions
 *     tags: [Resumes, AI]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/:id/improvements",
  protect,
  validate(improvementSuggestionsValidation),
  resumeAIController.getImprovementSuggestions,
);

export default router;
