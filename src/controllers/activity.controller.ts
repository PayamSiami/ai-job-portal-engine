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
   * Get recent activities
   * GET /api/dashboard/activities/recent
   */
  getRecentActivities = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const limit = req.query.limit ? Number(req.query.limit) : 10;

      const activities = await activityService.getRecentActivities(
        userId,
        limit,
      );

      sendSuccess(res, activities, "Recent activities fetched successfully");
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

  getEmployerActivities = catchAsync(async (req: Request, res: Response) => {
    const employerId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const days = parseInt(req.query.days as string) || 30;
    const type = req.query.type as string;
    const status = req.query.status as string;

    if (!employerId) {
      throw new AppError("Unauthorized - Employer ID not found", 401);
    }

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const result = await activityService.getEmployerActivities(employerId, {
      limit,
      type,
      status,
      dateFrom,
      dateTo: new Date(),
    });

    res.status(200).json({
      success: true,
      data: result.activities,
      meta: {
        count: result.activities.length,
        limit,
        days,
        filters: { type, status },
      },
      pagination: result.pagination,
    });
  });
}

export default new ActivityController();
