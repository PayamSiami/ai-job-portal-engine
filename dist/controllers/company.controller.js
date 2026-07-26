import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/errorHandler.js";
import companyService from "../services/company.service.js";
export class CompanyController {
    createCompany = catchAsync(async (req, res) => {
        const userId = req.user?.id;
        const data = req.body;
        if (!data.name) {
            throw new AppError("Company name is required", 400);
        }
        // Check if employer already has a company
        const existingCompany = await companyService.hasCompany(userId);
        if (existingCompany) {
            throw new AppError("You already have a company registered", 400);
        }
        const company = await companyService.createCompany(userId, data);
        res.status(201).json({
            success: true,
            message: "Company created successfully",
            data: company,
        });
    });
    getCompany = catchAsync(async (req, res) => {
        const userId = req.user?.id;
        const company = await companyService.getCompanyWithStats(userId);
        if (!company) {
            throw new AppError("Company not found", 404);
        }
        res.status(200).json({
            success: true,
            data: company,
        });
    });
    checkCompany = catchAsync(async (req, res) => {
        const userId = req.user?.id;
        const hasCompany = await companyService.hasCompany(userId);
        res.status(200).json({
            success: true,
            data: { hasCompany },
        });
    });
    updateCompany = catchAsync(async (req, res) => {
        const userId = req.user?.id;
        const data = req.body;
        const company = await companyService.getCompanyByOwnerId(userId);
        if (!company) {
            throw new AppError("Company not found", 404);
        }
        const updated = await companyService.updateCompany(userId, company._id.toString(), data);
        res.status(200).json({
            success: true,
            message: "Company updated successfully",
            data: updated,
        });
    });
    deleteCompany = catchAsync(async (req, res) => {
        const userId = req.user?.id;
        const company = await companyService.getCompanyByOwnerId(userId);
        if (!company) {
            throw new AppError("Company not found", 404);
        }
        await companyService.deleteCompany(userId, company._id.toString());
        res.status(200).json({
            success: true,
            message: "Company deleted successfully",
        });
    });
    uploadLogo = catchAsync(async (req, res) => {
        const userId = req.user?.id;
        if (!req.file) {
            throw new AppError("No file uploaded", 400);
        }
        const logoUrl = await companyService.uploadLogo(userId, req.file);
        res.status(200).json({
            success: true,
            message: "Logo uploaded successfully",
            data: { logoUrl },
        });
    });
    getCompanyStats = catchAsync(async (req, res) => {
        const userId = req.user?.id;
        const stats = await companyService.getCompanyStats(userId);
        res.status(200).json({
            success: true,
            data: stats,
        });
    });
}
//# sourceMappingURL=company.controller.js.map