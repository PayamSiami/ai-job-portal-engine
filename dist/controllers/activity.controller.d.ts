import { Request, Response } from "express";
/**
 * Dashboard Controller
 * Handles all dashboard, analytics, candidate, and company management
 */
declare class ActivityController {
    /**
     * Get activities with filters and pagination
     * GET /api/dashboard/activities
     */
    getActivities: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get activity statistics
     * GET /api/dashboard/activities/stats
     */
    getActivityStats: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
declare const _default: ActivityController;
export default _default;
//# sourceMappingURL=activity.controller.d.ts.map