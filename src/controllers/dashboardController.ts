// backend/src/controllers/dashboard.controller.ts
import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/errorHandler.js";
import DashboardService from "../services/dashboardService.js";

const dashboardService = new DashboardService();

export class DashboardController {
  getStats = catchAsync(async (req: Request, res: Response) => {
    const employerId = (req as any).user?.id;

    if (!employerId) {
      throw new AppError("Unauthorized - Employer ID not found", 401);
    }

    const stats = await dashboardService.getDashboardStats(employerId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  });

  getAIScreeningData = catchAsync(async (req: Request, res: Response) => {
    const employerId = (req as any).user?.id;

    if (!employerId) {
      throw new AppError("Unauthorized - Employer ID not found", 401);
    }

    const screeningData = await dashboardService.getAIScreeningData(employerId);

    res.status(200).json({
      success: true,
      data: screeningData,
    });
  });

  getRecentActivity = catchAsync(async (req: Request, res: Response) => {
    const employerId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!employerId) {
      throw new AppError("Unauthorized - Employer ID not found", 401);
    }

    const activity = await dashboardService.getRecentActivity(
      employerId,
      limit,
    );

    res.status(200).json({
      success: true,
      data: activity,
    });
  });

  getApplicationStats = catchAsync(async (req: Request, res: Response) => {
    const employerId = (req as any).user?.id;

    if (!employerId) {
      throw new AppError("Unauthorized - Employer ID not found", 401);
    }

    const stats = await dashboardService.getApplicationStats(employerId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  });

  getJobPerformance = catchAsync(async (req: Request, res: Response) => {
    const employerId = (req as any).user?.id;
    const { timeframe = "30" } = req.query;

    if (!employerId) {
      throw new AppError("Unauthorized - Employer ID not found", 401);
    }

    const performance = await dashboardService.getJobPerformance(
      employerId,
      parseInt(timeframe as string),
    );

    res.status(200).json({
      success: true,
      data: performance,
    });
  });

  getTopCandidates = catchAsync(async (req: Request, res: Response) => {
    const employerId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 5;

    if (!employerId) {
      throw new AppError("Unauthorized - Employer ID not found", 401);
    }

    const candidates = await dashboardService.getTopCandidates(
      employerId,
      limit,
    );

    res.status(200).json({
      success: true,
      data: candidates,
    });
  });

  getApplicationTimeline = catchAsync(async (req: Request, res: Response) => {
    const employerId = (req as any).user?.id;
    const { days = "30", status } = req.query;

    if (!employerId) {
      throw new AppError("Unauthorized - Employer ID not found", 401);
    }

    const timeline = await dashboardService.getApplicationTimeline(
      employerId,
      parseInt(days as string),
      status as string,
    );

    res.status(200).json({
      success: true,
      data: timeline,
    });
  });

  getSkillDistribution = catchAsync(async (req: Request, res: Response) => {
    const employerId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!employerId) {
      throw new AppError("Unauthorized - Employer ID not found", 401);
    }

    const skills = await dashboardService.getSkillDistribution(
      employerId,
      limit,
    );

    res.status(200).json({
      success: true,
      data: skills,
    });
  });

  getStatusBreakdown = catchAsync(async (req: Request, res: Response) => {
    const employerId = (req as any).user?.id;

    if (!employerId) {
      throw new AppError("Unauthorized - Employer ID not found", 401);
    }

    const breakdown = await dashboardService.getStatusBreakdown(employerId);

    res.status(200).json({
      success: true,
      data: breakdown,
    });
  });

  exportDashboard = catchAsync(async (req: Request, res: Response) => {
    const employerId = (req as any).user?.id;
    const { format = "csv", type = "summary" } = req.query;

    if (!employerId) {
      throw new AppError("Unauthorized - Employer ID not found", 401);
    }

    const exportData = await dashboardService.exportDashboard(
      employerId,
      format as string,
      type as string,
    );

    res.status(200).json({
      success: true,
      data: exportData,
    });
  });
}
