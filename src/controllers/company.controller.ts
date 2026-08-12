// backend/src/controllers/company.controller.ts
import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/errorHandler";
import companyService from "../services/company.service";
import { sendSuccess } from "../utils/responseFormatter";

export class CompanyController {
  createCompany = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const data = req.body;

    if (!data.name) {
      throw new AppError("Company name is required", 400);
    }

    if (!userId) {
      throw new Error("User not found");
    }

    // Check if employer already has a company
    const existingCompany = await companyService.hasCompany(userId);
    if (existingCompany) {
      throw new AppError("You already have a company registered", 400);
    }

    const company = await companyService.createCompany(userId, data);

    sendSuccess(res, company, "Company created successfully", 201);
  });

  getCompany = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw new Error("User not found");
    }

    const company = await companyService.getCompanyWithStats(userId);

    if (!company) {
      throw new AppError("Company not found", 404);
    }

    sendSuccess(res, company, "Company fetched successfully");
  });

  checkCompany = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw new Error("User not found");
    }

    const hasCompany = await companyService.hasCompany(userId);

    sendSuccess(res, { hasCompany }, "Company check completed");
  });

  updateCompany = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const data = req.body;

    if (!userId) {
      throw new Error("User not found");
    }

    const company = await companyService.getCompanyByOwnerId(userId);
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    const updated = await companyService.updateCompany(
      userId,
      company._id.toString(),
      data,
    );

    sendSuccess(res, updated, "Company updated successfully");
  });

  deleteCompany = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw new Error("User not found");
    }

    const company = await companyService.getCompanyByOwnerId(userId);
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    await companyService.deleteCompany(userId, company._id.toString());

    sendSuccess(res, null, "Company deleted successfully");
  });

  uploadLogo = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!req.file) {
      throw new AppError("No file uploaded", 400);
    }

    if (!userId) {
      throw new Error("User not found");
    }

    const logoUrl = await companyService.uploadLogo(userId, req.file);

    sendSuccess(res, { logoUrl }, "Logo uploaded successfully");
  });

  getCompanyStats = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw new Error("User not found");
    }

    const stats = await companyService.getCompanyStats(userId);

    sendSuccess(res, stats, "Company stats fetched successfully");
  });
}