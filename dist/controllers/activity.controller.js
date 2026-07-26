// import dashboardService from "../services/dashboard.service.js";
import { getUserId } from "../utils/routeHelpers.js";
import { sendSuccess } from "../utils/responseFormatter.js";
import { AppError } from "../utils/errorHandler.js";
import { asyncHandler } from "./base.controller.js";
import activityService from "../services/activity.service.js";
/**
 * Dashboard Controller
 * Handles all dashboard, analytics, candidate, and company management
 */
class ActivityController {
    /**
     * Get activities with filters and pagination
     * GET /api/dashboard/activities
     */
    getActivities = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const filters = {
            type: req.query.type,
            status: req.query.status,
            dateFrom: req.query.dateFrom
                ? new Date(req.query.dateFrom)
                : undefined,
            dateTo: req.query.dateTo
                ? new Date(req.query.dateTo)
                : undefined,
            limit: req.query.limit ? Number(req.query.limit) : 20,
            page: req.query.page ? Number(req.query.page) : 1,
        };
        const result = await activityService.getActivities(userId, filters);
        sendSuccess(res, {
            activities: result.activities,
            pagination: result.pagination,
        }, "Activities fetched successfully");
    });
    /**
     * Get activity statistics
     * GET /api/dashboard/activities/stats
     */
    getActivityStats = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const stats = await activityService.getActivityStats(userId);
        sendSuccess(res, stats, "Activity stats fetched successfully");
    });
}
export default new ActivityController();
//# sourceMappingURL=activity.controller.js.map