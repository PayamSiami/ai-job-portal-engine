import { Request, Response } from "express";
import dashboardService from "../services/dashboard.service.js";
import { getUserId } from "../utils/routeHelpers.js";
import { sendSuccess } from "../utils/responseFormatter.js";
import { AppError } from "../utils/errorHandler.js";
import { asyncHandler } from "./base.controller.js";
import mongoose from "mongoose";

/**
 * Dashboard Controller
 * Handles all dashboard, analytics, candidate, and company management
 */
class DashboardController {
  /**
   * Get comprehensive dashboard statistics
   * GET /api/dashboard/stats
   */
  getDashboardStats = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const stats = await dashboardService.getDashboardStats(userId);

      sendSuccess(res, stats, "Dashboard stats fetched successfully");
    },
  );

  /**
   * Get AI screening data
   * GET /api/dashboard/ai-screening
   */
  getAIScreeningData = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const data = await dashboardService.getAIScreeningData(userId);

      sendSuccess(res, data, "AI screening data fetched successfully");
    },
  );

  /**
   * Export dashboard data
   * GET /api/dashboard/analytics/export
   */
  exportDashboard = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const format = (req.query.format as string) || "csv";
      const type = (req.query.type as string) || "summary";

      // Validate format
      const validFormats = ["csv", "json", "excel"];
      if (!validFormats.includes(format)) {
        throw new AppError(
          `Invalid format. Must be one of: ${validFormats.join(", ")}`,
          400,
        );
      }

      // Validate type
      const validTypes = ["summary", "applications", "candidates"];
      if (!validTypes.includes(type)) {
        throw new AppError(
          `Invalid export type. Must be one of: ${validTypes.join(", ")}`,
          400,
        );
      }

      const exportData = await dashboardService.exportDashboard(
        userId,
        format,
        type,
      );

      // Set headers based on format
      const contentTypes = {
        csv: "text/csv",
        json: "application/json",
        excel:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };

      const extensions = {
        csv: "csv",
        json: "json",
        excel: "xlsx",
      };

      res.setHeader(
        "Content-Type",
        contentTypes[format as keyof typeof contentTypes],
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="dashboard-export-${type}-${new Date().toISOString().split("T")[0]}.${extensions[format as keyof typeof extensions]}`,
      );

      // Send based on format
      if (format === "json") {
        res.json(exportData);
        return;
      }

      // For CSV and Excel, convert to appropriate format
      // You might want to use a library like `json2csv` or `exceljs`
      res.send(JSON.stringify(exportData));
    },
  );
}

export default new DashboardController();
