import Application, { ApplicationStatus, } from "../models/Application.model";
import Job from "../models/Job.models";
import { Interview, InterviewStatus, InterviewType, } from "../models/Interview.model";
import mongoose, { Types } from "mongoose";
import logger from "../utils/logger";
import { AppError } from "../utils/errorHandler";
import Company from "../models/Company.models";
import jobService from "./job.service";
class ApplicationService {
    async createApplication(data) {
        try {
            logger.info("Creating new application", {
                jobId: data.jobId,
                userId: data.userId,
            });
            if (!data.jobId)
                throw new Error("Job ID is required");
            if (!data.userId)
                throw new Error("Applicant ID is required");
            if (!data.resumeId)
                throw new Error("Resume ID is required");
            if (!data.coverLetter || data.coverLetter.length < 50) {
                throw new Error("Cover letter must be at least 50 characters");
            }
            const application = new Application({
                job: new Types.ObjectId(data.jobId),
                user: new Types.ObjectId(data.userId),
                resume: new Types.ObjectId(data.resumeId),
                coverLetter: data.coverLetter,
                expectedSalary: data.expectedSalary,
                availableFrom: data.availableFrom,
                status: ApplicationStatus.PENDING,
                appliedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            await application.save();
            logger.info("Application created successfully", {
                applicationId: application._id,
            });
            return application;
        }
        catch (error) {
            logger.error("Failed to create application:", error);
            throw error;
        }
    }
    async getApplicationById(applicationId, options = { populate: true }) {
        try {
            if (!applicationId) {
                throw new Error("Application ID is required");
            }
            if (!mongoose.Types.ObjectId.isValid(applicationId)) {
                throw new Error("Invalid application ID format");
            }
            let query = Application.findById(applicationId);
            if (options.populate !== false) {
                query = query
                    .populate({
                    path: "job",
                    select: "title company location description requirements minSalary maxSalary workMode jobType isActive status skills postedBy",
                })
                    .populate({
                    path: "user",
                    select: "-password -__v",
                })
                    .populate({
                    path: "resume",
                    select: "title personalInfo skills experience education projects certifications languages status template visibility",
                })
                    .populate({
                    path: "interview",
                });
            }
            const application = await query.exec();
            if (!application) {
                logger.debug("Application not found", { applicationId });
                return null;
            }
            const result = application.toObject
                ? application.toObject()
                : application;
            return result;
        }
        catch (error) {
            if (error instanceof mongoose.Error.CastError) {
                logger.error("Invalid application ID format", {
                    applicationId,
                    error: error.message,
                });
                throw new Error("Invalid application ID format");
            }
            logger.error("Failed to get application", {
                error: error instanceof Error ? error.message : "Unknown error",
                applicationId,
            });
            throw error;
        }
    }
    async getApplications(filters = {}, options = {}) {
        try {
            const { page = 1, limit = 10, sortBy = "appliedAt", sortOrder = "desc", } = options;
            const skip = (page - 1) * limit;
            const query = {};
            if (filters.status) {
                query.status = filters.status;
            }
            if (filters.jobId) {
                query.job = filters.jobId;
            }
            if (filters.userId) {
                query.user = filters.userId;
            }
            if (filters.minScore !== undefined || filters.maxScore !== undefined) {
                query.aiScore = {};
                if (filters.minScore !== undefined) {
                    query.aiScore.$gte = filters.minScore;
                }
                if (filters.maxScore !== undefined) {
                    query.aiScore.$lte = filters.maxScore;
                }
            }
            if (filters.fromDate || filters.toDate) {
                query.appliedAt = {};
                if (filters.fromDate) {
                    query.appliedAt.$gte = filters.fromDate;
                }
                if (filters.toDate) {
                    query.appliedAt.$lte = filters.toDate;
                }
            }
            const sort = {};
            sort[sortBy] = sortOrder === "asc" ? 1 : -1;
            const [applications, total] = await Promise.all([
                Application.find(query)
                    .populate("job")
                    .populate("user", "-password")
                    .populate("resume")
                    .populate("interview")
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .exec(),
                Application.countDocuments(query),
            ]);
            return {
                applications,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            };
        }
        catch (error) {
            logger.error("Failed to get applications", {
                error: error instanceof Error ? error.message : "Unknown error",
                filters,
                options,
            });
            throw error;
        }
    }
    async getApplicationsByApplicant(userId, options = {}) {
        return this.getApplications({ userId }, options);
    }
    async getApplicationsByJob(jobId, options = {}) {
        return this.getApplications({ jobId }, options);
    }
    async getApplicationsByEmployer(employerId, options = {}) {
        try {
            const jobs = await Job.find({ postedBy: employerId }).select("_id");
            const jobIds = jobs.map((job) => job._id.toString());
            if (jobIds.length === 0) {
                return {
                    applications: [],
                    pagination: {
                        page: options.page || 1,
                        limit: options.limit || 20,
                        total: 0,
                        pages: 0,
                    },
                };
            }
            const filters = {
                ...(options.status && { status: options.status }),
                ...(options.jobId && { jobId: options.jobId }),
            };
            return this.getApplications(filters, options);
        }
        catch (error) {
            logger.error("Failed to get applications by employer", {
                error: error instanceof Error ? error.message : "Unknown error",
                employerId,
            });
            throw error;
        }
    }
    async findByJobAndCandidate(jobId, userId) {
        try {
            return await Application.findOne({
                job: new Types.ObjectId(jobId),
                user: new Types.ObjectId(userId),
            }).exec();
        }
        catch (error) {
            logger.error("Failed to find application by job and candidate", {
                error: error instanceof Error ? error.message : "Unknown error",
                jobId,
                userId,
            });
            throw error;
        }
    }
    async updateApplication(applicationId, data) {
        try {
            if (!mongoose.Types.ObjectId.isValid(applicationId)) {
                throw new Error("Invalid application ID");
            }
            const application = await Application.findById(applicationId);
            if (!application) {
                throw new Error("Application not found");
            }
            Object.assign(application, data);
            application.updatedAt = new Date();
            await application.save();
            logger.info("Application updated", { applicationId, updates: data });
            return application;
        }
        catch (error) {
            logger.error("Failed to update application", {
                error: error instanceof Error ? error.message : "Unknown error",
                applicationId,
                data,
            });
            throw error;
        }
    }
    async updateApplicationStatus(applicationId, status, notes, userId, interviewData) {
        const application = await Application.findById(applicationId)
            .populate("jobId", "title companyName company")
            .populate("userId", "name email");
        if (!application) {
            throw new AppError("Application not found", 404);
        }
        this.validateStatusTransition(application.status, status);
        const historyEntry = {
            status: status,
            notes: notes || "",
            updatedAt: new Date(),
            updatedBy: userId ? new Types.ObjectId(userId) : application.user,
        };
        const updateData = {
            status: status,
            $push: { statusHistory: historyEntry },
        };
        if (status === ApplicationStatus.WITHDRAWN) {
            updateData.withdrawnAt = new Date();
            updateData.withdrawalReason = notes || "Candidate withdrew application";
        }
        if (status === ApplicationStatus.HIRED) {
            updateData.hiredAt = new Date();
        }
        if (status === ApplicationStatus.REJECTED) {
            updateData.rejectedAt = new Date();
        }
        if (notes && status !== ApplicationStatus.WITHDRAWN) {
            updateData.notes = notes;
        }
        if (status === ApplicationStatus.INTERVIEWING && interviewData) {
            if (!interviewData.scheduledDate) {
                throw new AppError("Scheduled date is required for interview", 400);
            }
            const scheduledDate = new Date(interviewData.scheduledDate);
            if (scheduledDate < new Date()) {
                throw new AppError("Interview date must be in the future", 400);
            }
            const existingInterview = await Interview.findOne({
                applicationId: applicationId,
                status: { $in: [InterviewStatus.SCHEDULED, InterviewStatus.CONFIRMED] },
            });
            if (existingInterview) {
                throw new AppError("An interview is already scheduled for this application", 400);
            }
            const job = await Job.findById(application.job);
            const company = job?.company || null;
            const interview = new Interview({
                applicationId: application._id,
                job: application.job,
                company: company,
                candidate: application.user,
                interviewerIds: interviewData.interviewerIds || [userId],
                title: interviewData.title ||
                    `Interview for ${application.job?.title || "Position"}`,
                type: interviewData.type || InterviewType.VIDEO,
                status: InterviewStatus.SCHEDULED,
                scheduledDate: scheduledDate,
                duration: interviewData.duration || 60,
                location: interviewData.location,
                meetingLink: interviewData.meetingLink,
                timezone: interviewData.timezone || "UTC",
                notes: notes || "",
            });
            await interview.save();
            updateData.interviewId = interview._id;
        }
        const updatedApplication = await Application.findByIdAndUpdate(applicationId, updateData, { new: true, runValidators: true });
        if (updatedApplication?.interview) {
            await updatedApplication.populate("interviewId");
        }
        logger.info("Application status updated", {
            applicationId,
            oldStatus: application.status,
            newStatus: status,
            userId,
        });
        return updatedApplication;
    }
    async scheduleInterview(applicationId, interviewData, userId) {
        return this.updateApplicationStatus(applicationId, ApplicationStatus.INTERVIEWING, interviewData.notes || "Interview scheduled", userId, interviewData);
    }
    async withdrawApplication(applicationId, userId, reason) {
        const application = await Application.findById(applicationId);
        if (!application) {
            throw new AppError("Application not found", 404);
        }
        if (application.user.toString() !== userId) {
            throw new AppError("You can only withdraw your own applications", 403);
        }
        if (application.status === ApplicationStatus.WITHDRAWN) {
            throw new AppError("Application already withdrawn", 400);
        }
        if (application.status === ApplicationStatus.HIRED) {
            throw new AppError("Cannot withdraw a hired application", 400);
        }
        if (application.status === ApplicationStatus.REJECTED) {
            throw new AppError("Cannot withdraw a rejected application", 400);
        }
        application.status = ApplicationStatus.WITHDRAWN;
        application.withdrawalReason = reason || "Candidate withdrew application";
        application.withdrawnAt = new Date();
        application.statusHistory.push({
            status: ApplicationStatus.WITHDRAWN,
            notes: reason || "Candidate withdrew application",
            updatedAt: new Date(),
            updatedBy: new mongoose.Types.ObjectId(userId),
        });
        await application.save();
        return application;
    }
    async canWithdraw(applicationId, userId) {
        const application = await Application.findById(applicationId);
        if (!application)
            return false;
        if (application.user.toString() !== userId)
            return false;
        const nonWithdrawableStatuses = [
            ApplicationStatus.HIRED,
            ApplicationStatus.REJECTED,
            ApplicationStatus.WITHDRAWN,
        ];
        return !nonWithdrawableStatuses.includes(application.status);
    }
    async updateWithAIScore(applicationId, aiData) {
        return this.updateApplication(applicationId, {
            aiScore: aiData.score,
            aiExplanation: aiData.explanation,
            aiStrengths: aiData.strengths,
            aiWeaknesses: aiData.weaknesses,
            aiRecommendation: aiData.recommendation,
        });
    }
    async deleteApplication(applicationId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(applicationId)) {
                throw new Error("Invalid application ID");
            }
            const result = await Application.findByIdAndDelete(applicationId);
            if (result) {
                logger.info("Application deleted", { applicationId });
                return true;
            }
            return false;
        }
        catch (error) {
            logger.error("Failed to delete application", {
                error: error instanceof Error ? error.message : "Unknown error",
                applicationId,
            });
            throw error;
        }
    }
    async getTopApplicants(jobId, limit = 10) {
        try {
            const applications = await Application.find({
                jobId,
                aiScore: { $exists: true, $ne: null },
            })
                .populate("userId", "-password")
                .populate("resumeId")
                .populate("interviewId")
                .sort({ aiScore: -1 })
                .limit(limit)
                .exec();
            return applications;
        }
        catch (error) {
            logger.error("Failed to get top applicants", {
                error: error instanceof Error ? error.message : "Unknown error",
                jobId,
                limit,
            });
            throw error;
        }
    }
    async hasUserApplied(jobId, userId) {
        try {
            const application = await Application.findOne({
                jobId: new Types.ObjectId(jobId),
                userId: new Types.ObjectId(userId),
            });
            return !!application;
        }
        catch (error) {
            logger.error("Failed to check application status", {
                error: error instanceof Error ? error.message : "Unknown error",
                jobId,
                userId,
            });
            throw error;
        }
    }
    async getApplicationsByStatus(status, options = {}) {
        return this.getApplications({ status }, options);
    }
    async bulkUpdateStatus(applicationIds, status, notes) {
        try {
            const failed = [];
            let updated = 0;
            for (const id of applicationIds) {
                try {
                    const result = await this.updateApplicationStatus(id, status, notes);
                    if (result) {
                        updated++;
                    }
                    else {
                        failed.push(id);
                    }
                }
                catch (error) {
                    failed.push(id);
                    logger.error("Failed to update application status", {
                        error: error instanceof Error ? error.message : "Unknown error",
                        applicationId: id,
                        status,
                    });
                }
            }
            return { updated, failed };
        }
        catch (error) {
            logger.error("Failed to bulk update application statuses", {
                error: error instanceof Error ? error.message : "Unknown error",
                applicationIds,
                status,
            });
            throw error;
        }
    }
    async getApplicationTimeline(employerId, days = 30, status) {
        const company = await Company.findOne({ ownerId: employerId });
        if (!company) {
            throw new AppError("Company not found", 404);
        }
        const jobs = await Job.find({ company: company._id });
        const jobIds = jobs.map((job) => job._id);
        if (jobIds.length === 0) {
            return [];
        }
        const matchStage = {
            job: { $in: jobIds },
            createdAt: {
                $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
            },
        };
        if (status) {
            matchStage.status = status;
        }
        const timeline = await Application.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                    },
                    count: { $sum: 1 },
                    applications: {
                        $push: {
                            id: "$_id",
                            status: "$status",
                            aiScore: "$aiScore",
                        },
                    },
                },
            },
            { $sort: { _id: 1 } },
        ]);
        return timeline.map((item) => ({
            date: item._id,
            count: item.count,
            applications: item.applications.slice(0, 10),
        }));
    }
    async getApplicationStats(employerId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(employerId)) {
                throw new AppError("Invalid employer ID format", 400);
            }
            const jobs = await jobService.getJobsByEmployer(employerId);
            const jobIds = jobs.map((job) => job._id);
            if (jobIds.length === 0) {
                return this.getEmptyApplicationStats();
            }
            const pipeline = [
                {
                    $match: {
                        job: { $in: jobIds },
                    },
                },
                {
                    $facet: {
                        statusCounts: [
                            {
                                $group: {
                                    _id: "$status",
                                    count: { $sum: 1 },
                                },
                            },
                        ],
                        aiStats: [
                            {
                                $match: {
                                    aiScore: { $exists: true, $ne: null },
                                },
                            },
                            {
                                $group: {
                                    _id: null,
                                    averageAIScore: { $avg: "$aiScore" },
                                    totalScreened: { $sum: 1 },
                                },
                            },
                        ],
                        applicationsByJob: [
                            {
                                $lookup: {
                                    from: "jobs",
                                    localField: "job",
                                    foreignField: "_id",
                                    as: "jobData",
                                },
                            },
                            {
                                $unwind: {
                                    path: "$jobData",
                                    preserveNullAndEmptyArrays: true,
                                },
                            },
                            {
                                $group: {
                                    _id: "$jobData.title",
                                    count: { $sum: 1 },
                                },
                            },
                            {
                                $sort: { count: -1 },
                            },
                            {
                                $limit: 10,
                            },
                        ],
                        recentActivity: [
                            {
                                $match: {
                                    createdAt: {
                                        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                                    },
                                },
                            },
                            {
                                $group: {
                                    _id: {
                                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                                    },
                                    count: { $sum: 1 },
                                },
                            },
                            {
                                $sort: { _id: 1 },
                            },
                        ],
                        hiredApplications: [
                            {
                                $match: {
                                    status: ApplicationStatus.HIRED,
                                    createdAt: { $exists: true },
                                    updatedAt: { $exists: true },
                                },
                            },
                            {
                                $project: {
                                    timeToHire: {
                                        $subtract: ["$updatedAt", "$createdAt"],
                                    },
                                },
                            },
                        ],
                    },
                },
            ];
            const result = await Application.aggregate(pipeline);
            const data = result[0] || {};
            const statusCounts = {};
            (data.statusCounts || []).forEach((item) => {
                statusCounts[item._id] = item.count;
            });
            const aiStats = data.aiStats?.[0] || {
                averageAIScore: 0,
                totalScreened: 0,
            };
            const totalApplications = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
            const screeningCoverage = totalApplications > 0
                ? (aiStats.totalScreened / totalApplications) * 100
                : 0;
            let averageTimeToHire = 0;
            if (data.hiredApplications && data.hiredApplications.length > 0) {
                const totalDays = data.hiredApplications.reduce((sum, app) => {
                    const days = app.timeToHire / (1000 * 60 * 60 * 24);
                    return sum + days;
                }, 0);
                averageTimeToHire = totalDays / data.hiredApplications.length;
            }
            return {
                total: totalApplications,
                pending: statusCounts[ApplicationStatus.PENDING] || 0,
                reviewing: statusCounts[ApplicationStatus.REVIEWING] || 0,
                shortlisted: statusCounts[ApplicationStatus.SHORTLISTED] || 0,
                interviewing: statusCounts[ApplicationStatus.INTERVIEWING] || 0,
                rejected: statusCounts[ApplicationStatus.REJECTED] || 0,
                hired: statusCounts[ApplicationStatus.HIRED] || 0,
                averageAIScore: Math.round((aiStats.averageAIScore || 0) * 100) / 100,
                screeningCoverage: Math.round(screeningCoverage * 100) / 100,
                statusBreakdown: {
                    [ApplicationStatus.PENDING]: statusCounts[ApplicationStatus.PENDING] || 0,
                    [ApplicationStatus.REVIEWING]: statusCounts[ApplicationStatus.REVIEWING] || 0,
                    [ApplicationStatus.SHORTLISTED]: statusCounts[ApplicationStatus.SHORTLISTED] || 0,
                    [ApplicationStatus.INTERVIEWING]: statusCounts[ApplicationStatus.INTERVIEWING] || 0,
                    [ApplicationStatus.HIRED]: statusCounts[ApplicationStatus.HIRED] || 0,
                    [ApplicationStatus.REJECTED]: statusCounts[ApplicationStatus.REJECTED] || 0,
                    [ApplicationStatus.WITHDRAWN]: statusCounts[ApplicationStatus.WITHDRAWN] || 0,
                },
                recentActivity: (data.recentActivity || []).map((item) => ({
                    date: item._id,
                    count: item.count,
                })),
                applicationsByJob: (data.applicationsByJob || []).map((item) => ({
                    jobTitle: item._id || "Unknown",
                    count: item.count,
                })),
                averageTimeToHire: Math.round(averageTimeToHire * 100) / 100,
            };
        }
        catch (error) {
            logger.error("Error in getApplicationStats:", error);
            throw new AppError(error instanceof Error
                ? error.message
                : "Failed to get application stats", 500);
        }
    }
    validateStatusTransition(currentStatus, newStatus) {
        const validTransitions = {
            [ApplicationStatus.PENDING]: [
                ApplicationStatus.REVIEWING,
                ApplicationStatus.REJECTED,
                ApplicationStatus.WITHDRAWN,
            ],
            [ApplicationStatus.REVIEWING]: [
                ApplicationStatus.SHORTLISTED,
                ApplicationStatus.REJECTED,
                ApplicationStatus.WITHDRAWN,
            ],
            [ApplicationStatus.SHORTLISTED]: [
                ApplicationStatus.INTERVIEWING,
                ApplicationStatus.REJECTED,
                ApplicationStatus.WITHDRAWN,
            ],
            [ApplicationStatus.INTERVIEWING]: [
                ApplicationStatus.HIRED,
                ApplicationStatus.REJECTED,
                ApplicationStatus.WITHDRAWN,
            ],
            [ApplicationStatus.HIRED]: [],
            [ApplicationStatus.REJECTED]: [],
            [ApplicationStatus.WITHDRAWN]: [],
        };
        if (currentStatus === newStatus) {
            return;
        }
        const allowedTransitions = validTransitions[currentStatus] || [];
        if (!allowedTransitions.includes(newStatus)) {
            throw new AppError(`Invalid status transition from ${currentStatus} to ${newStatus}. ` +
                `Allowed transitions: ${allowedTransitions.join(", ") || "none"}`, 400);
        }
        const terminalStatuses = [
            ApplicationStatus.HIRED,
            ApplicationStatus.REJECTED,
            ApplicationStatus.WITHDRAWN,
        ];
        if (terminalStatuses.includes(currentStatus)) {
            throw new AppError(`Cannot transition from terminal status: ${currentStatus}`, 400);
        }
        if (newStatus === ApplicationStatus.HIRED) {
            const canBeHired = [
                ApplicationStatus.INTERVIEWING,
                ApplicationStatus.SHORTLISTED,
            ];
            if (!canBeHired.includes(currentStatus)) {
                throw new AppError(`Cannot hire a candidate from ${currentStatus}. ` +
                    `Must be ${canBeHired.join(" or ")} first.`, 400);
            }
        }
        if (newStatus === ApplicationStatus.REJECTED &&
            currentStatus === ApplicationStatus.HIRED) {
            throw new AppError("Cannot reject a hired candidate", 400);
        }
        if (newStatus === ApplicationStatus.WITHDRAWN &&
            currentStatus === ApplicationStatus.HIRED) {
            throw new AppError("Cannot withdraw a hired application", 400);
        }
    }
    getEmptyApplicationStats() {
        return {
            total: 0,
            pending: 0,
            reviewing: 0,
            shortlisted: 0,
            interviewing: 0,
            rejected: 0,
            hired: 0,
            averageAIScore: 0,
            screeningCoverage: 0,
            statusBreakdown: {
                [ApplicationStatus.PENDING]: 0,
                [ApplicationStatus.REVIEWING]: 0,
                [ApplicationStatus.SHORTLISTED]: 0,
                [ApplicationStatus.INTERVIEWING]: 0,
                [ApplicationStatus.HIRED]: 0,
                [ApplicationStatus.REJECTED]: 0,
                [ApplicationStatus.WITHDRAWN]: 0,
            },
            recentActivity: [],
            applicationsByJob: [],
            averageTimeToHire: 0,
        };
    }
}
export default new ApplicationService();
