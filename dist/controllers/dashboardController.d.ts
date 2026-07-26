import { Request, Response } from "express";
/**
 * Dashboard Controller
 * Handles all dashboard, analytics, candidate, and company management
 */
declare class DashboardController {
    /**
     * Get comprehensive dashboard statistics
     * GET /api/dashboard/stats
     */
    getDashboardStats: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get AI screening data
     * GET /api/dashboard/ai-screening
     */
    getAIScreeningData: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Export dashboard data
     * GET /api/dashboard/analytics/export
     */
    exportDashboard: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
declare const _default: DashboardController;
export default _default;
//# sourceMappingURL=dashboardController.d.ts.map