import express from "express";

import { authorize, protect } from "../middleware/authMiddleware.js";
import candidateController from "../controllers/candidate.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protect);
router.use(authorize("employer"));

// Candidates
router.get("", candidateController.getCandidates);
router.get("/recommendations", candidateController.getCandidateRecommendations);

router.get(
  "/stats",
  protect,
  candidateController.getCandidateStats,
);

router.get("/:id", candidateController.getCandidateById);
router.put("/:id/status", candidateController.updateCandidateStatus);
router.get("/:id/resume", candidateController.getCandidateResume);

// Bulk Operations
router.put("/bulk/status", candidateController.bulkUpdateCandidateStatus);
router.delete("/bulk", candidateController.bulkDeleteCandidates);

export default router;
