// routes/dashboard.routes.ts
import { Router } from "express";
import dashboardController from "../controllers/dashboardController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

// ============================================================
// Dashboard Routes
// ============================================================

// Main Dashboard
router.get("/stats", protect, dashboardController.getDashboardStats);
router.get("/ai-screening", protect, dashboardController.getAIScreeningData);

// Analytics
router.get(
  "/export",
  protect,
  dashboardController.exportDashboard,
);

export default router;
