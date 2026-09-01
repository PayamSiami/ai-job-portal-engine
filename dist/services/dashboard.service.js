import Job from "../models/Job.models.js";
import Application, { ApplicationStatus } from "../models/Application.model.js";
import Company from "../models/Company.models.js";
import Resume from "../models/Resume.models.js";
import User from "../models/User.models.js";
import { AppError } from "../utils/errorHandler.js";
import companyService from "./company.service.js";
import jobService from "./job.service.js";
// ==================== MERGED SERVICE ====================
class DashboardService {
    Job;
    Application;
    Company;
    Resume;
    User;
    constructor() {
        this.Job = Job;
        this.Application = Application;
        this.Company = Company;
        this.Resume = Resume;
        this.User = User;
    }
    // ============================================================
    // 1. DASHBOARD STATS
    // ============================================================
    /**
     * Get comprehensive dashboard statistics
     */
    async getDashboardStats(employerId) {
        const company = await this.Company.findOne({
            ownerId: employerId,
        });
        if (!company) {
            throw new AppError("Company not found for this employer", 404);
        }
        const jobs = await this.Job.find({
            $or: [{ postedBy: employerId }, { company: company._id }],
        }).select("_id title isActive createdAt");
        const jobIds = jobs.map((job) => job._id);
        if (jobIds.length === 0) {
            return this.getEmptyDashboardStats();
        }
        const applications = await this.Application.find({
            job: { $in: jobIds },
        }).populate("user", "username email profile.firstName profile.lastName");
        const screenedApps = applications.filter((a) => a.aiScore !== null && a.aiScore !== undefined);
        const totalAIScore = screenedApps.reduce((sum, a) => sum + (a.aiScore || 0), 0);
        const stats = {
            totalJobs: jobs.length,
            activeJobs: jobs.filter((j) => j.isActive === true).length,
            totalApplications: applications.length,
            pendingApplications: applications.filter((a) => a.status === ApplicationStatus.PENDING).length,
            reviewingApplications: applications.filter((a) => a.status === ApplicationStatus.REVIEWING).length,
            shortlistedCandidates: applications.filter((a) => a.status === ApplicationStatus.SHORTLISTED).length,
            interviewingCandidates: applications.filter((a) => a.status === ApplicationStatus.INTERVIEWING).length,
            hiredCandidates: applications.filter((a) => a.status === ApplicationStatus.HIRED).length,
            rejectedCandidates: applications.filter((a) => a.status === ApplicationStatus.REJECTED).length,
            aiScreenedCount: screenedApps.length,
            screeningCoverage: applications.length > 0
                ? (screenedApps.length / applications.length) * 100
                : 0,
            averageAIScore: screenedApps.length > 0 ? totalAIScore / screenedApps.length : 0,
            recentActivities: [],
        };
        // Get recent activities
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentApps = applications
            .filter((app) => new Date(app.appliedAt || app.createdAt) >= sevenDaysAgo)
            .sort((a, b) => new Date(b.appliedAt || b.createdAt).getTime() -
            new Date(a.appliedAt || a.createdAt).getTime())
            .slice(0, 10);
        stats.recentActivities = recentApps.map((app) => ({
            id: app._id.toString(),
            candidateName: app.user?.profile?.firstName ||
                app.user?.username ||
                "Unknown",
            jobTitle: jobs.find((j) => j._id.toString() === app.job.toString())?.title ||
                "Unknown",
            status: app.status,
            timestamp: app.appliedAt || app.createdAt,
            aiScore: app.aiScore,
        }));
        return stats;
    }
    // ============================================================
    // 2. AI SCREENING DATA
    // ============================================================
    async getAIScreeningData(employerId) {
        const jobs = await jobService.getJobsByEmployer(employerId);
        const jobIds = jobs.map((job) => job._id);
        if (jobIds.length === 0) {
            return this.getEmptyScreeningData();
        }
        const applications = await this.Application.find({
            job: { $in: jobIds },
        }).populate("user", "username profile.firstName profile.lastName");
        const total = applications.length;
        const screened = applications.filter((a) => a.aiScore !== null && a.aiScore !== undefined);
        const pending = applications.filter((a) => a.aiScore === null || a.aiScore === undefined);
        const totalAIScore = screened.reduce((sum, a) => sum + (a.aiScore || 0), 0);
        const averageAIScore = screened.length > 0 ? totalAIScore / screened.length : 0;
        const screeningHistory = jobs.map((job) => {
            const jobApps = applications.filter((app) => app.job.toString() === job._id.toString());
            const jobScreened = jobApps.filter((app) => app.aiScore !== null && app.aiScore !== undefined);
            const jobTotalAIScore = jobScreened.reduce((sum, app) => sum + (app.aiScore || 0), 0);
            const avgScore = jobScreened.length > 0 ? jobTotalAIScore / jobScreened.length : 0;
            return {
                jobId: job._id.toString(),
                jobTitle: job.title,
                totalApplicants: jobApps.length,
                screenedCount: jobScreened.length,
                avgScore,
                postedDate: job.createdAt,
            };
        });
        const pendingScreening = pending.slice(0, 20).map((app) => ({
            id: app._id.toString(),
            candidateName: app.user?.profile?.firstName ||
                app.user?.username ||
                "Unknown",
            jobTitle: jobs.find((j) => j._id.toString() === app.job.toString())?.title ||
                "Unknown",
            appliedDate: app.appliedAt || app.createdAt,
        }));
        return {
            screeningCoverage: total > 0 ? (screened.length / total) * 100 : 0,
            totalCandidatesScreened: screened.length,
            candidatesNotScreened: pending.length,
            averageAIScore: Math.round(averageAIScore * 100) / 100,
            screeningHistory,
            pendingScreening,
        };
    }
    /**
     * Export dashboard data
     */
    async exportDashboard(employerId, format = "csv", type = "summary") {
        const company = await companyService.getCompanyByOwnerId(employerId);
        const jobs = await jobService.getJobsByEmployer(employerId);
        const jobIds = jobs.map((job) => job._id);
        let data = [];
        if (type === "summary") {
            const stats = await this.getDashboardStats(employerId);
            data = [
                {
                    companyName: company?.name || "-",
                    totalJobs: stats.totalJobs,
                    activeJobs: stats.activeJobs,
                    totalApplications: stats.totalApplications,
                    pendingApplications: stats.pendingApplications,
                    shortlistedCandidates: stats.shortlistedCandidates,
                    interviewingCandidates: stats.interviewingCandidates,
                    hiredCandidates: stats.hiredCandidates,
                    rejectedCandidates: stats.rejectedCandidates,
                    aiScreenedCount: stats.aiScreenedCount,
                    screeningCoverage: stats.screeningCoverage,
                    averageAIScore: stats.averageAIScore,
                    exportDate: new Date().toISOString(),
                },
            ];
        }
        else if (type === "applications") {
            const applications = await this.Application.find({
                job: { $in: jobIds },
            }).populate("user", "username email profile.firstName profile.lastName");
            data = applications.map((app) => ({
                candidateName: app.user?.profile?.firstName || app.user?.username || "Unknown",
                email: app.user?.email || "",
                jobTitle: jobs.find((j) => j._id.toString() === app.job.toString())
                    ?.title || "Unknown",
                status: app.status,
                aiScore: app.aiScore || 0,
                appliedDate: app.appliedAt || app.createdAt,
            }));
        }
        return {
            format,
            type,
            data,
            totalRecords: data.length,
            exportedAt: new Date().toISOString(),
        };
    }
    // ============================================================
    // 9. HELPER METHODS
    // ============================================================
    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now.getTime() - new Date(date).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1)
            return "Just now";
        if (diffMins < 60)
            return `${diffMins} minutes ago`;
        if (diffHours < 24)
            return `${diffHours} hours ago`;
        if (diffDays < 7)
            return `${diffDays} days ago`;
        if (diffDays < 30)
            return `${Math.floor(diffDays / 7)} weeks ago`;
        return `${Math.floor(diffDays / 30)} months ago`;
    }
    mapApplicationStatus(status) {
        switch (status) {
            case ApplicationStatus.PENDING:
            case ApplicationStatus.REVIEWING:
                return "pending";
            case ApplicationStatus.SHORTLISTED:
            case ApplicationStatus.INTERVIEWING:
                return "in-progress";
            case ApplicationStatus.HIRED:
            case ApplicationStatus.REJECTED:
                return "completed";
            default:
                return "pending";
        }
    }
    getEmptyDashboardStats() {
        return {
            totalJobs: 0,
            activeJobs: 0,
            totalApplications: 0,
            pendingApplications: 0,
            reviewingApplications: 0,
            shortlistedCandidates: 0,
            interviewingCandidates: 0,
            hiredCandidates: 0,
            rejectedCandidates: 0,
            aiScreenedCount: 0,
            screeningCoverage: 0,
            averageAIScore: 0,
            recentActivities: [],
        };
    }
    getEmptyScreeningData() {
        return {
            screeningCoverage: 0,
            totalCandidatesScreened: 0,
            candidatesNotScreened: 0,
            averageAIScore: 0,
            screeningHistory: [],
            pendingScreening: [],
        };
    }
}
export default new DashboardService();
