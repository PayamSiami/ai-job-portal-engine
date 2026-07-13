// backend/src/routes/dashboardRoutes.ts
import express from "express";
import { DashboardController } from "../controllers/dashboardController.js";
import { authorize, protect } from "../middleware/authMiddleware.js";

const router = express.Router();
const dashboardController = new DashboardController();

// All dashboard routes require authentication and employer status
router.use(protect);
router.use(authorize("employer"));

router.get("/stats", dashboardController.getStats);

// AI screening data
router.get("/ai-screening", dashboardController.getAIScreeningData);

export default router;
