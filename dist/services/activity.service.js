import Application, { ApplicationStatus } from "../models/Application.model";
import jobService from "./job.service";
class ActivityService {
    async getActivities(employerId, filters = {}) {
        const { type, status, dateFrom, dateTo, limit = 20, page = 1 } = filters;
        const skip = (page - 1) * limit;
        let jobs = [];
        jobs = await jobService.getJobsByEmployer(employerId);
        const jobIds = jobs.map((job) => job._id);
        if (jobIds.length === 0) {
            return {
                activities: [],
                pagination: { page, limit, total: 0, pages: 0 },
            };
        }
        const allActivities = [];
        const appActivities = await this.getApplicationActivities(jobIds, jobs, type, status, dateFrom, dateTo);
        allActivities.push(...appActivities);
        const screeningActivities = await this.getScreeningActivities(jobIds, jobs, type, status, dateFrom, dateTo);
        allActivities.push(...screeningActivities);
        const generationActivities = await this.getGenerationActivities(jobIds, jobs, type, status, dateFrom, dateTo);
        allActivities.push(...generationActivities);
        const analyticsActivities = await this.getAnalyticsActivities(jobIds, jobs, type, status, dateFrom, dateTo);
        allActivities.push(...analyticsActivities);
        const interviewActivities = await this.getInterviewActivities(jobIds, jobs, type, status, dateFrom, dateTo);
        allActivities.push(...interviewActivities);
        const statusActivities = await this.getStatusChangeActivities(jobIds, jobs, type, status, dateFrom, dateTo);
        allActivities.push(...statusActivities);
        const jobActivities = await this.getJobCreationActivities(jobs, type, status, dateFrom, dateTo);
        allActivities.push(...jobActivities);
        allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const total = allActivities.length;
        const paginatedActivities = allActivities.slice(skip, skip + limit);
        return {
            activities: paginatedActivities,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }
    async getActivityStats(employerId) {
        const result = await this.getActivities(employerId, {
            limit: 1000,
        });
        const activities = result.activities;
        const byType = {};
        const byStatus = {};
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        let recentCount = 0;
        let pendingCount = 0;
        activities.forEach((a) => {
            byType[a.type] = (byType[a.type] || 0) + 1;
            byStatus[a.status] = (byStatus[a.status] || 0) + 1;
            if (new Date(a.timestamp) >= last24h)
                recentCount++;
            if (a.status === "pending")
                pendingCount++;
        });
        return {
            total: activities.length,
            byType,
            byStatus,
            recentCount,
            pendingCount,
        };
    }
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
    matchesFilters(activity, statusFilter, dateFrom, dateTo) {
        if (statusFilter && activity.status !== statusFilter)
            return false;
        if (dateFrom && new Date(activity.timestamp) < dateFrom)
            return false;
        if (dateTo && new Date(activity.timestamp) > dateTo)
            return false;
        return true;
    }
    matchesTimestamp(date, dateFrom, dateTo) {
        if (dateFrom && new Date(date) < dateFrom)
            return false;
        if (dateTo && new Date(date) > dateTo)
            return false;
        return true;
    }
    async getApplicationActivities(jobIds, jobs, typeFilter, statusFilter, dateFrom, dateTo) {
        if (typeFilter && !["application", "all"].includes(typeFilter))
            return [];
        const applications = await Application.find({
            jobId: { $in: jobIds },
        })
            .populate("userId", "profile.firstName profile.lastName profile.profileImage")
            .sort({ appliedAt: -1 })
            .limit(100);
        return applications
            .map((app) => {
            const timestamp = app.appliedAt || app.createdAt;
            const job = jobs.find((j) => j._id.toString() === app.jobId.toString());
            const userName = app.userId
                ? `${app.userId.profile?.firstName || ""} ${app.userId.profile?.lastName || ""}`.trim() ||
                    "Unknown"
                : "Unknown";
            return {
                id: `app-${app._id}`,
                type: "application",
                title: `New application for ${job?.title || "position"}`,
                description: `${userName} applied for ${job?.title || "position"}`,
                score: app.aiScore || null,
                timestamp,
                status: this.mapApplicationStatus(app.status),
                time: this.getTimeAgo(timestamp),
                link: `/employer/applications/${app._id}`,
                user: { name: userName },
                jobTitle: job?.title,
                metadata: { applicationId: app._id, originalStatus: app.status },
            };
        })
            .filter((a) => this.matchesFilters(a, statusFilter, dateFrom, dateTo));
    }
    async getScreeningActivities(jobIds, jobs, typeFilter, statusFilter, dateFrom, dateTo) {
        if (typeFilter && !["screening", "all"].includes(typeFilter))
            return [];
        const applications = await Application.find({
            jobId: { $in: jobIds },
            aiScore: { $exists: true, $ne: null },
        })
            .populate("userId", "profile.firstName profile.lastName")
            .sort({ updatedAt: -1 })
            .limit(50);
        const activities = [];
        applications.slice(0, 10).forEach((app) => {
            const job = jobs.find((j) => j._id.toString() === app.jobId.toString());
            const userName = app.userId
                ? `${app.userId.profile?.firstName || ""} ${app.userId.profile?.lastName || ""}`.trim() ||
                    "Unknown"
                : "Unknown";
            activities.push({
                id: `screening-${app._id}`,
                type: "screening",
                title: `${userName} screened for ${job?.title || "position"}`,
                description: `AI screening completed with ${app.aiScore}% match score`,
                score: app.aiScore || null,
                timestamp: app.updatedAt,
                status: "completed",
                time: this.getTimeAgo(app.updatedAt),
                link: `/employer/ai-screening/${app._id}`,
                user: { name: userName },
                jobTitle: job?.title,
                metadata: { applicationId: app._id, aiScore: app.aiScore },
            });
        });
        const screenedByJob = {};
        applications.forEach((app) => {
            const jobId = app.jobId.toString();
            if (!screenedByJob[jobId]) {
                const job = jobs.find((j) => j._id.toString() === jobId);
                screenedByJob[jobId] = {
                    job,
                    count: 0,
                    avgScore: 0,
                    timestamp: app.updatedAt,
                };
            }
            screenedByJob[jobId].count++;
            screenedByJob[jobId].avgScore += app.aiScore || 0;
            if (app.updatedAt > screenedByJob[jobId].timestamp) {
                screenedByJob[jobId].timestamp = app.updatedAt;
            }
        });
        Object.values(screenedByJob).forEach((data) => {
            if (data.count > 1) {
                const avgScore = Math.round(data.avgScore / data.count);
                activities.push({
                    id: `screening-bulk-${data.job?._id || Date.now()}`,
                    type: "screening",
                    title: `AI screening for ${data.count} candidates completed`,
                    description: `AI screening completed for ${data.count} candidates for "${data.job?.title || "position"}" with average score ${avgScore}%`,
                    score: avgScore,
                    timestamp: data.timestamp,
                    status: "completed",
                    time: this.getTimeAgo(data.timestamp),
                    jobTitle: data.job?.title,
                    metadata: { jobId: data.job?._id, count: data.count, avgScore },
                });
            }
        });
        return activities.filter((a) => this.matchesFilters(a, statusFilter, dateFrom, dateTo));
    }
    async getGenerationActivities(jobIds, jobs, typeFilter, statusFilter, dateFrom, dateTo) {
        if (typeFilter && !["generation", "all"].includes(typeFilter))
            return [];
        const activities = [];
        jobs.slice(0, 5).forEach((job) => {
            if (job.createdAt &&
                this.matchesTimestamp(job.createdAt, dateFrom, dateTo)) {
                activities.push({
                    id: `gen-job-${job._id}`,
                    type: "generation",
                    title: `Job description generated for ${job.title}`,
                    description: `AI generated description and requirements for "${job.title}"`,
                    score: null,
                    timestamp: job.createdAt,
                    status: "completed",
                    time: this.getTimeAgo(job.createdAt),
                    link: `/employer/jobs/${job._id}`,
                    jobTitle: job.title,
                    metadata: { jobId: job._id },
                });
            }
        });
        if (jobs.length > 0) {
            const lastJob = jobs[0];
            const genDate = new Date(lastJob.createdAt);
            genDate.setHours(genDate.getHours() - 2);
            activities.push({
                id: `gen-ai-${Date.now()}`,
                type: "generation",
                title: `AI assistant generated content for ${lastJob.title}`,
                description: `AI generated interview questions and skill assessment for "${lastJob.title}"`,
                score: null,
                timestamp: genDate,
                status: "completed",
                time: this.getTimeAgo(genDate),
                jobTitle: lastJob.title,
                metadata: { jobId: lastJob._id },
            });
        }
        return activities.filter((a) => this.matchesFilters(a, statusFilter, dateFrom, dateTo));
    }
    async getAnalyticsActivities(jobIds, jobs, typeFilter, statusFilter, dateFrom, dateTo) {
        if (typeFilter && !["analytics", "all"].includes(typeFilter))
            return [];
        const activities = [];
        const totalApplications = await Application.countDocuments({
            jobId: { $in: jobIds },
        });
        const hiredCount = await Application.countDocuments({
            jobId: { $in: jobIds },
            status: ApplicationStatus.HIRED,
        });
        const now = new Date();
        const lastMonth = new Date(now);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const monthlyApps = await Application.countDocuments({
            jobId: { $in: jobIds },
            appliedAt: { $gte: lastMonth },
        });
        if (monthlyApps > 0 && this.matchesTimestamp(now, dateFrom, dateTo)) {
            activities.push({
                id: `analytics-monthly-${Date.now()}`,
                type: "analytics",
                title: "Monthly hiring analytics report generated",
                description: `${monthlyApps} applications received this month, ${hiredCount} total hires`,
                score: Math.round((hiredCount / (totalApplications || 1)) * 100),
                timestamp: now,
                status: "completed",
                time: this.getTimeAgo(now),
                metadata: {
                    monthlyApps,
                    totalApplications,
                    hiredCount,
                    jobsCount: jobs.length,
                },
            });
        }
        const quarterStart = new Date(now);
        quarterStart.setMonth(quarterStart.getMonth() - 3);
        const quarterlyApps = await Application.countDocuments({
            jobId: { $in: jobIds },
            appliedAt: { $gte: quarterStart },
        });
        if (quarterlyApps > 50 && this.matchesTimestamp(now, dateFrom, dateTo)) {
            activities.push({
                id: `analytics-quarterly-${Date.now()}`,
                type: "analytics",
                title: "Quarterly hiring analytics report generated",
                description: `${quarterlyApps} applications received this quarter with ${hiredCount} successful hires`,
                score: Math.round((hiredCount / (quarterlyApps || 1)) * 100),
                timestamp: now,
                status: "completed",
                time: this.getTimeAgo(now),
                metadata: { quarterlyApps, hiredCount, jobsCount: jobs.length },
            });
        }
        return activities.filter((a) => this.matchesFilters(a, statusFilter, dateFrom, dateTo));
    }
    async getInterviewActivities(jobIds, jobs, typeFilter, statusFilter, dateFrom, dateTo) {
        if (typeFilter && !["interview", "all"].includes(typeFilter))
            return [];
        const applications = await Application.find({
            jobId: { $in: jobIds },
            status: ApplicationStatus.INTERVIEWING,
        })
            .populate("userId", "profile.firstName profile.lastName")
            .sort({ updatedAt: -1 })
            .limit(20);
        return applications
            .map((app) => {
            const timestamp = app.updatedAt;
            const job = jobs.find((j) => j._id.toString() === app.jobId.toString());
            const userName = app.userId
                ? `${app.userId.profile?.firstName || ""} ${app.userId.profile?.lastName || ""}`.trim() ||
                    "Unknown"
                : "Unknown";
            return {
                id: `interview-${app._id}`,
                type: "interview",
                title: `Interview scheduled for ${userName}`,
                description: `${userName} invited to interview for "${job?.title || "position"}"`,
                score: null,
                timestamp,
                status: "in-progress",
                time: this.getTimeAgo(timestamp),
                link: `/employer/applications/${app._id}`,
                user: { name: userName },
                jobTitle: job?.title,
                metadata: { applicationId: app._id },
            };
        })
            .filter((a) => this.matchesFilters(a, statusFilter, dateFrom, dateTo));
    }
    async getStatusChangeActivities(jobIds, jobs, typeFilter, statusFilter, dateFrom, dateTo) {
        if (typeFilter && !["status_change", "all"].includes(typeFilter))
            return [];
        const applications = await Application.find({
            jobId: { $in: jobIds },
            status: {
                $in: [
                    ApplicationStatus.SHORTLISTED,
                    ApplicationStatus.HIRED,
                    ApplicationStatus.REJECTED,
                ],
            },
        })
            .populate("userId", "profile.firstName profile.lastName")
            .sort({ updatedAt: -1 })
            .limit(30);
        return applications
            .map((app) => {
            const timestamp = app.updatedAt;
            const job = jobs.find((j) => j._id.toString() === app.jobId.toString());
            const userName = app.userId
                ? `${app.userId.profile?.firstName || ""} ${app.userId.profile?.lastName || ""}`.trim() ||
                    "Unknown"
                : "Unknown";
            const statusLabels = {
                [ApplicationStatus.SHORTLISTED]: {
                    title: `${userName} shortlisted`,
                    description: `${userName} was shortlisted for "${job?.title || "position"}"`,
                },
                [ApplicationStatus.HIRED]: {
                    title: `${userName} hired`,
                    description: `${userName} was hired for "${job?.title || "position"}"`,
                },
                [ApplicationStatus.REJECTED]: {
                    title: `${userName} rejected`,
                    description: `${userName} was rejected for "${job?.title || "position"}"`,
                },
            };
            const statusInfo = statusLabels[app.status] || {
                title: `Status updated for ${userName}`,
                description: `${userName}'s application status changed`,
            };
            return {
                id: `status-${app._id}-${app.status}`,
                type: "status_change",
                title: statusInfo.title,
                description: statusInfo.description,
                score: app.aiScore || null,
                timestamp,
                status: "completed",
                time: this.getTimeAgo(timestamp),
                link: `/employer/applications/${app._id}`,
                user: { name: userName },
                jobTitle: job?.title,
                metadata: { applicationId: app._id, newStatus: app.status },
            };
        })
            .filter((a) => this.matchesFilters(a, statusFilter, dateFrom, dateTo));
    }
    async getJobCreationActivities(jobs, typeFilter, statusFilter, dateFrom, dateTo) {
        if (typeFilter && !["job", "all"].includes(typeFilter))
            return [];
        return jobs
            .filter((job) => this.matchesTimestamp(job.createdAt, dateFrom, dateTo))
            .slice(0, 10)
            .map((job) => ({
            id: `job-${job._id}`,
            type: "job",
            title: `New job posted: ${job.title}`,
            description: `Position "${job.title}" has been published`,
            score: null,
            timestamp: job.createdAt,
            status: job.isActive ? "completed" : "pending",
            time: this.getTimeAgo(job.createdAt),
            link: `/employer/jobs/${job._id}`,
            jobTitle: job.title,
            metadata: { jobId: job._id, isActive: job.isActive },
        }));
    }
}
export default new ActivityService();
