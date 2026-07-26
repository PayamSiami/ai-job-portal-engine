import dashboardService from "../services/dashboard.service";
import { getUserId } from "../utils/routeHelpers";
import { sendSuccess } from "../utils/responseFormatter";
import { AppError } from "../utils/errorHandler";
import { asyncHandler } from "./base.controller";
class DashboardController {
    getDashboardStats = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const stats = await dashboardService.getDashboardStats(userId);
        sendSuccess(res, stats, "Dashboard stats fetched successfully");
    });
    getAIScreeningData = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const data = await dashboardService.getAIScreeningData(userId);
        sendSuccess(res, data, "AI screening data fetched successfully");
    });
    exportDashboard = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const format = req.query.format || "csv";
        const type = req.query.type || "summary";
        const validFormats = ["csv", "json", "excel"];
        if (!validFormats.includes(format)) {
            throw new AppError(`Invalid format. Must be one of: ${validFormats.join(", ")}`, 400);
        }
        const validTypes = ["summary", "applications", "candidates"];
        if (!validTypes.includes(type)) {
            throw new AppError(`Invalid export type. Must be one of: ${validTypes.join(", ")}`, 400);
        }
        const exportData = await dashboardService.exportDashboard(userId, format, type);
        const contentTypes = {
            csv: "text/csv",
            json: "application/json",
            excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
        const extensions = {
            csv: "csv",
            json: "json",
            excel: "xlsx",
        };
        res.setHeader("Content-Type", contentTypes[format]);
        res.setHeader("Content-Disposition", `attachment; filename="dashboard-export-${type}-${new Date().toISOString().split("T")[0]}.${extensions[format]}`);
        if (format === "json") {
            res.json(exportData);
            return;
        }
        res.send(JSON.stringify(exportData));
    });
}
export default new DashboardController();
