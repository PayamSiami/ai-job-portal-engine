import applicationService from "../services/application.service";
import applicationScreeningService from "../services/ai/applicationScreening";
import jobService from "../services/job.service";
import resumeService from "../services/resume.service";
import { getUserId, getStringParam } from "../utils/routeHelpers";
import { sendSuccess } from "../utils/responseFormatter";
import { AppError } from "../utils/errorHandler";
import { ApplicationStatus } from "../models/Application.model";
import { buildResumeContent } from "../utils/buildResumeContent";
import logger from "../utils/logger";
import { asyncHandler } from "./base.controller";
import mongoose from "mongoose";
class ApplicationController {
    applyForJob = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const { jobId, resumeId, coverLetter, expectedSalary, availableFrom } = req.body;
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        if (!jobId) {
            throw new AppError("Job ID is required", 400);
        }
        if (!resumeId) {
            throw new AppError("Resume ID is required", 400);
        }
        if (!coverLetter || coverLetter.length < 50) {
            throw new AppError("Cover letter must be at least 50 characters", 400);
        }
        const job = await jobService.getJobById(jobId);
        if (!job) {
            throw new AppError("Job not found", 404);
        }
        if (!job.isActive) {
            throw new AppError("This job is no longer accepting applications", 400);
        }
        const existingApplication = await applicationService.findByJobAndCandidate(jobId, userId);
        if (existingApplication) {
            throw new AppError("You have already applied for this job", 400);
        }
        const resume = await resumeService.getResume(resumeId, userId);
        if (!resume) {
            throw new AppError("Resume not found", 404);
        }
        const application = await applicationService.createApplication({
            jobId,
            userId,
            resumeId,
            coverLetter,
            expectedSalary,
            availableFrom,
        });
        if (!application || !application._id) {
            logger.error("Application creation failed - no _id returned");
            throw new AppError("Failed to create application", 500);
        }
        try {
            const resumeContent = buildResumeContent(resume);
            const jobDetails = {
                title: job.title || "",
                location: job.location || "",
                requirements: job.requirements || "",
                description: job.description || "",
                workMode: job.workMode || "on-site",
                employmentType: job.jobType || "full-time",
                experienceLevel: job.experienceLevel || "mid",
                minSalary: job.minSalary || 0,
                maxSalary: job.maxSalary || 0,
                skills: job.skills || [],
            };
            const screeningResult = await applicationScreeningService.screenApplication(resumeContent, {
                expectedSalary,
                availableFrom,
                coverLetter,
            }, jobDetails);
            const applicationId = application._id.toString();
            await applicationService.updateApplication(applicationId, {
                aiScore: screeningResult.score,
                aiExplanation: screeningResult.explanation,
                aiStrengths: screeningResult.strengths,
                aiWeaknesses: screeningResult.weaknesses,
                aiRecommendation: screeningResult.recommendation,
            });
            const updatedApplication = await applicationService.getApplicationById(applicationId);
            sendSuccess(res, updatedApplication || application, "Application submitted with AI screening", 201);
            return;
        }
        catch (aiError) {
            logger.error("AI screening failed:", aiError);
            sendSuccess(res, application, "Application submitted successfully (AI screening unavailable)", 201);
            return;
        }
    });
    getMyApplications = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const applications = await applicationService.getApplicationsByApplicant(userId);
        sendSuccess(res, applications, "Applications fetched successfully");
    });
    getApplicationTimeline = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const applications = await applicationService.getApplicationTimeline(userId);
        sendSuccess(res, applications, "Applications fetched successfully");
    });
    getEmployerApplications = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const { jobId, status, limit = "20", page = "1" } = req.query;
        const applications = await applicationService.getApplicationsByEmployer(userId, {
            jobId: jobId,
            status: status,
            limit: parseInt(limit),
            page: parseInt(page),
        });
        sendSuccess(res, applications, "Applications fetched successfully");
    });
    getApplicationStats = asyncHandler(async (req, res) => {
        const employerId = getUserId(req);
        if (!employerId) {
            throw new AppError("User not authenticated", 401);
        }
        if (!mongoose.Types.ObjectId.isValid(employerId.toString())) {
            throw new AppError("Invalid employer ID format", 400);
        }
        const stats = await applicationService.getApplicationStats(employerId.toString());
        sendSuccess(res, stats, "Application stats fetched successfully");
    });
    getApplicationById = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const applicationId = getStringParam(req.params.id);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        if (!applicationId) {
            throw new AppError("Invalid application ID", 400);
        }
        const application = await applicationService.getApplicationById(applicationId);
        if (!application) {
            throw new AppError("Application not found", 404);
        }
        const app = application;
        const isApplicant = app.user?._id?.toString() === userId;
        const isEmployer = app.job?.postedBy?.toString() === userId;
        if (!isApplicant && !isEmployer) {
            throw new AppError("Access denied", 403);
        }
        sendSuccess(res, application, "Application fetched successfully");
    });
    updateApplicationStatus = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const applicationId = getStringParam(req.params.id);
        const { status, notes } = req.body;
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        if (!applicationId) {
            throw new AppError("Invalid application ID", 400);
        }
        if (!status) {
            throw new AppError("Status is required", 400);
        }
        const application = await applicationService.getApplicationById(applicationId);
        if (!application) {
            throw new AppError("Application not found", 404);
        }
        const app = application;
        if (app.jobId?.postedBy?.toString() !== userId) {
            throw new AppError("Access denied", 403);
        }
        const validStatuses = Object.values(ApplicationStatus);
        if (!validStatuses.includes(status)) {
            throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(", ")}`, 400);
        }
        const updated = await applicationService.updateApplicationStatus(applicationId, status, notes);
        sendSuccess(res, updated, `Application status updated to ${status}`);
    });
    withdrawApplication = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const applicationId = getStringParam(req.params.id);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        if (!applicationId) {
            throw new AppError("Invalid application ID", 400);
        }
        const application = await applicationService.getApplicationById(applicationId);
        if (!application) {
            throw new AppError("Application not found", 404);
        }
        const app = application;
        if (app.userId?._id?.toString() !== userId) {
            throw new AppError("Access denied", 403);
        }
        const canWithdraw = await applicationService.canWithdraw(applicationId, userId);
        if (!canWithdraw) {
            throw new AppError("Cannot withdraw this application. It may be hired, rejected, or already withdrawn.", 400);
        }
        const updated = await applicationService.withdrawApplication(applicationId, userId, "Candidate withdrew application");
        sendSuccess(res, updated, "Application withdrawn successfully");
    });
    deleteApplication = asyncHandler(async (req, res) => {
        const applicationId = getStringParam(req.params.id);
        if (!applicationId) {
            throw new AppError("Invalid application ID", 400);
        }
        const application = await applicationService.getApplicationById(applicationId);
        if (!application) {
            throw new AppError("Application not found", 404);
        }
        await applicationService.deleteApplication(applicationId);
        sendSuccess(res, null, "Application deleted successfully");
    });
}
export default new ApplicationController();
