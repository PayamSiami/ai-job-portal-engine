import { Request, Response } from "express";
// import dashboardService from "../services/dashboard.service.js";
import { getUserId } from "../utils/routeHelpers.js";
import { sendSuccess } from "../utils/responseFormatter.js";
import { AppError } from "../utils/errorHandler.js";
import { asyncHandler } from "./base.controller.js";
import catchAsync from "../utils/catchAsync.js";
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
  getActivities = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const filters = {
        type: req.query.type as string,
        status: req.query.status as string,
        dateFrom: req.query.dateFrom
          ? new Date(req.query.dateFrom as string)
          : undefined,
        dateTo: req.query.dateTo
          ? new Date(req.query.dateTo as string)
          : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        page: req.query.page ? Number(req.query.page) : 1,
      };

      const result = await activityService.getActivities(userId, filters);

      sendSuccess(
        res,
        {
          activities: result.activities,
          pagination: result.pagination,
        },
        "Activities fetched successfully",
      );
    },
  );

  /**
   * Get activity statistics
   * GET /api/dashboard/activities/stats
   */
  getActivityStats = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const stats = await activityService.getActivityStats(userId);

      sendSuccess(res, stats, "Activity stats fetched successfully");
    },
  );

}

export default new ActivityController();
