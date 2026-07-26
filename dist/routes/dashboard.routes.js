import { Router } from "express";
import dashboardController from "../controllers/dashboardController";
import { protect } from "../middleware/authMiddleware";
const router = Router();
router.get("/stats", protect, dashboardController.getDashboardStats);
router.get("/ai-screening", protect, dashboardController.getAIScreeningData);
router.get("/analytics/export", protect, dashboardController.exportDashboard);
export default router;
