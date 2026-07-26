// routes/dashboard.routes.ts
import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import activityController from "../controllers/activity.controller.js";
const router = Router();
router.get("", protect, activityController.getActivities);
router.get("/stats", protect, activityController.getActivityStats);
export default router;
