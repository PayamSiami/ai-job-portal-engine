import jobService from "../services/job.service";
import jobSearchService from "../services/ai/jobSearch.service";
import { sendSuccess } from "../utils/responseFormatter";
import { AppError } from "../utils/errorHandler";
import { getUserId } from "../utils/routeHelpers";
import { asyncHandler } from "./base.controller";
class JobController {
    getJobs = asyncHandler(async (req, res) => {
        const { page = 1, limit = 10, ...filters } = req.query;
        const jobs = await jobService.getJobs(filters, {
            page: Number(page),
            limit: Number(limit),
        });
        sendSuccess(res, jobs, "Jobs fetched successfully");
    });
    getJobById = asyncHandler(async (req, res) => {
        const jobId = req.params.id;
        if (!jobId) {
            throw new AppError("Job ID is required", 400);
        }
        const job = await jobService.getJobById(String(jobId));
        if (!job) {
            throw new AppError("Job not found", 404);
        }
        sendSuccess(res, job, "Job fetched successfully");
    });
    getJobAnalytics = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const { timeRange = "30d" } = req.query;
        const analytics = await jobService.getJobAnalytics(userId, timeRange);
        sendSuccess(res, analytics, "Job analytics fetched successfully");
    });
    getJobStats = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const stats = await jobService.getJobStats(userId);
        sendSuccess(res, stats, "Job stats fetched successfully");
    });
    getGlobalJobStats = asyncHandler(async (req, res) => {
        const stats = await jobService.getGlobalJobStats();
        sendSuccess(res, stats, "Job stats fetched successfully");
    });
    createJob = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const { title, description } = req.body;
        if (!title) {
            throw new AppError("Job title is required", 400);
        }
        if (!description) {
            throw new AppError("Job description is required", 400);
        }
        const job = await jobService.createJob(userId, req.body);
        sendSuccess(res, job, "Job created successfully", 201);
    });
    updateJob = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const jobId = req.params.id;
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        if (!jobId) {
            throw new AppError("Job ID is required", 400);
        }
        const updatedJob = await jobService.updateJob(String(jobId), userId, req.body);
        sendSuccess(res, updatedJob, "Job updated successfully");
    });
    deleteJob = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const jobId = req.params.id;
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        if (!jobId) {
            throw new AppError("Job ID is required", 400);
        }
        await jobService.deleteJob(String(jobId), userId);
        sendSuccess(res, null, "Job deleted successfully");
    });
    toggleJobStatus = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const jobId = req.params.id;
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        if (!jobId) {
            throw new AppError("Job ID is required", 400);
        }
        const job = await jobService.toggleJobStatus(String(jobId), userId);
        sendSuccess(res, job, `Job ${job.isActive ? "activated" : "deactivated"} successfully`);
    });
    getJobApplications = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const jobId = req.params.id;
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        if (!jobId) {
            throw new AppError("Job ID is required", 400);
        }
        const { page = 1, limit = 10, status } = req.query;
        const result = await jobService.getJobApplications(String(jobId), userId, {
            page: Number(page),
            limit: Number(limit),
            status: status,
        });
        sendSuccess(res, result, "Job applications fetched successfully");
    });
    getFeaturedJobs = asyncHandler(async (req, res) => {
        const { limit = 6 } = req.query;
        const jobs = await jobService.getFeaturedJobs(Number(limit));
        sendSuccess(res, jobs, "Featured jobs fetched successfully");
    });
    getJobsByEmployer = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const { page = 1, limit = 10 } = req.query;
        const result = await jobService.getJobsByEmployer(userId, {
            page: Number(page),
            limit: Number(limit),
        });
        sendSuccess(res, result, "Jobs by employer fetched successfully");
    });
    searchJobsAI = asyncHandler(async (req, res) => {
        const { query } = req.query;
        if (!query || typeof query !== "string" || query.trim() === "") {
            throw new AppError("Search query is required", 400);
        }
        const parsedFilters = await jobSearchService.parseNaturalLanguageQuery(query);
        const searchResults = await jobSearchService.searchJobs(parsedFilters);
        const jobs = await jobService.getJobsWithMongoQuery(searchResults.where, {
            page: 1,
            limit: 20,
        });
        sendSuccess(res, {
            query,
            parsedFilters,
            results: jobs,
        }, "AI search completed successfully");
    });
    generateJobContent = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const { jobTitle } = req.body;
        if (!jobTitle || typeof jobTitle !== "string" || jobTitle.trim() === "") {
            throw new AppError("Job title is required", 400);
        }
        const jobContent = await jobService.generateJobContent(jobTitle);
        sendSuccess(res, jobContent, "Job content generated successfully");
    });
    getSimilarJobs = asyncHandler(async (req, res) => {
        const jobId = req.params.id;
        const { limit = 5 } = req.query;
        if (!jobId) {
            throw new AppError("Job ID is required", 400);
        }
        const jobs = await jobService.getSimilarJobs(String(jobId), Number(limit));
        sendSuccess(res, jobs, "Similar jobs fetched successfully");
    });
    bulkCreateJobs = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const { jobs } = req.body;
        if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
            throw new AppError("Jobs array is required", 400);
        }
        if (jobs.length > 10) {
            throw new AppError("Cannot create more than 10 jobs at once", 400);
        }
        const createdJobs = await jobService.bulkCreateJobs(userId, jobs);
        sendSuccess(res, {
            created: createdJobs.length,
            jobs: createdJobs,
        }, `${createdJobs.length} jobs created successfully`, 201);
    });
    getJobPerformance = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const timeframe = req.query.timeframe ? Number(req.query.timeframe) : 30;
        const performance = await jobService.getJobPerformance(userId, timeframe);
        sendSuccess(res, performance, "Job performance fetched successfully");
    });
}
export default new JobController();
