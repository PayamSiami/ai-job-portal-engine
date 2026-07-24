import { Request, Response } from "express";
import jobService from "../services/job.service.js";
import jobSearchService from "../services/ai/jobSearch.service.js";
import { sendSuccess } from "../utils/responseFormatter.js";
import { AppError } from "../utils/errorHandler.js";
import { getUserId } from "../utils/routeHelpers.js";
import { asyncHandler } from "./base.controller.js";
import catchAsync from "../utils/catchAsync.js";
import candidateService from "../services/candidate.service.js";
import dashboardService from "../services/dashboard.service.js";

/**
 * Job Controller
 * Handles all job-related operations
 */
class JobController {
  // ============================================================
  // PUBLIC ROUTES
  // ============================================================

  /**
   * Get all jobs with filtering and pagination
   * GET /api/jobs
   */
  getJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { page = 1, limit = 10, ...filters } = req.query;

    const jobs = await jobService.getJobs(filters, {
      page: Number(page),
      limit: Number(limit),
    });

    sendSuccess(res, jobs, "Jobs fetched successfully");
  });

  /**
   * Get a single job by ID
   * GET /api/jobs/:id
   */
  getJobById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const jobId = req.params.id;

      if (!jobId) {
        throw new AppError("Job ID is required", 400);
      }

      const job = await jobService.getJobById(String(jobId));

      if (!job) {
        throw new AppError("Job not found", 404);
      }

      sendSuccess(res, job, "Job fetched successfully");
    },
  );

  // ============================================================
  // PROTECTED ROUTES (Authentication required)
  // ============================================================

  /**
   * Get job analytics for employer
   * GET /api/jobs/analytics
   */
  getJobAnalytics = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { timeRange = "30d" } = req.query;

      const analytics = await jobService.getJobAnalytics(
        userId,
        timeRange as string,
      );

      sendSuccess(res, analytics, "Job analytics fetched successfully");
    },
  );

  /**
   * Get job statistics for employer
   * GET /api/jobs/stats
   */
  getJobStats = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const stats = await jobService.getJobStats(userId);

      sendSuccess(res, stats, "Job stats fetched successfully");
    },
  );

  /**
   * Get job statistics for employer
   * GET /api/jobs/stats
   */
  getGlobalJobStats = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      
      const stats = await jobService.getGlobalJobStats();

      sendSuccess(res, stats, "Job stats fetched successfully");
    },
  );

  /**
   * Create a new job (employer only)
   * POST /api/jobs
   */
  createJob = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      // Validate required fields
      const { title, description } = req.body;

      if (!title) {
        throw new AppError("Job title is required", 400);
      }

      if (!description) {
        throw new AppError("Job description is required", 400);
      }

      const job = await jobService.createJob(userId, req.body);

      sendSuccess(res, job, "Job created successfully", 201);
    },
  );

  /**
   * Update a job (employer only)
   * PUT /api/jobs/:id
   */
  updateJob = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);
      const jobId = req.params.id;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!jobId) {
        throw new AppError("Job ID is required", 400);
      }

      const updatedJob = await jobService.updateJob(
        String(jobId),
        userId,
        req.body,
      );

      sendSuccess(res, updatedJob, "Job updated successfully");
    },
  );

  /**
   * Delete a job (employer only)
   * DELETE /api/jobs/:id
   */
  deleteJob = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
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
    },
  );

  /**
   * Toggle job status (active/inactive)
   * PATCH /api/jobs/:id/toggle-status
   */
  toggleJobStatus = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);
      const jobId = req.params.id;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!jobId) {
        throw new AppError("Job ID is required", 400);
      }

      const job = await jobService.toggleJobStatus(String(jobId), userId);

      sendSuccess(
        res,
        job,
        `Job ${job.isActive ? "activated" : "deactivated"} successfully`,
      );
    },
  );

  /**
   * Get job applications (employer only)
   * GET /api/jobs/:id/applications
   */
  getJobApplications = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);
      const jobId = req.params.id;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!jobId) {
        throw new AppError("Job ID is required", 400);
      }

      const { page = 1, limit = 10, status } = req.query;

      const result = await jobService.getJobApplications(
        String(jobId),
        userId,
        {
          page: Number(page),
          limit: Number(limit),
          status: status as string,
        },
      );

      sendSuccess(res, result, "Job applications fetched successfully");
    },
  );

  /**
   * Get featured jobs
   * GET /api/jobs/featured
   */
  getFeaturedJobs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { limit = 6 } = req.query;

      const jobs = await jobService.getFeaturedJobs(Number(limit));

      sendSuccess(res, jobs, "Featured jobs fetched successfully");
    },
  );

  /**
   * Get jobs by employer
   * GET /api/jobs/employer/:employerId
   */
  getJobsByEmployer = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
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
    },
  );

  // ============================================================
  // AI ROUTES
  // ============================================================

  /**
   * AI-powered natural language job search
   * GET /api/jobs/search/ai
   */
  searchJobsAI = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { query } = req.query;

      if (!query || typeof query !== "string" || query.trim() === "") {
        throw new AppError("Search query is required", 400);
      }

      // Parse natural language query
      const parsedFilters =
        await jobSearchService.parseNaturalLanguageQuery(query);

      // Search jobs with parsed filters
      const searchResults = await jobSearchService.searchJobs(parsedFilters);

      const jobs = await jobService.getJobsWithMongoQuery(searchResults.where, {
        page: 1,
        limit: 20,
      });

      sendSuccess(
        res,
        {
          query,
          parsedFilters,
          results: jobs,
        },
        "AI search completed successfully",
      );
    },
  );

  /**
   * Generate job content using AI (employer only)
   * POST /api/jobs/generate-content
   */
  generateJobContent = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
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
    },
  );

  /**
   * Get similar jobs based on job ID
   * GET /api/jobs/:id/similar
   */
  getSimilarJobs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const jobId = req.params.id;
      const { limit = 5 } = req.query;

      if (!jobId) {
        throw new AppError("Job ID is required", 400);
      }

      const jobs = await jobService.getSimilarJobs(
        String(jobId),
        Number(limit),
      );

      sendSuccess(res, jobs, "Similar jobs fetched successfully");
    },
  );

  /**
   * Bulk create jobs (employer only)
   * POST /api/jobs/bulk
   */
  bulkCreateJobs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
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

      sendSuccess(
        res,
        {
          created: createdJobs.length,
          jobs: createdJobs,
        },
        `${createdJobs.length} jobs created successfully`,
        201,
      );
    },
  );

  /**
   * Get job performance metrics
   * GET /api/dashboard/performance
   */
  getJobPerformance = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const userId = getUserId(req);

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const timeframe = req.query.timeframe ? Number(req.query.timeframe) : 30;

      const performance = await jobService.getJobPerformance(userId, timeframe);

      sendSuccess(res, performance, "Job performance fetched successfully");
    },
  );
}

export default new JobController();
