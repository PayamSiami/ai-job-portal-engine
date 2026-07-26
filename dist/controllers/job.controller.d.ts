import { Request, Response } from "express";
/**
 * Job Controller
 * Handles all job-related operations
 */
declare class JobController {
    /**
     * Get all jobs with filtering and pagination
     * GET /api/jobs
     */
    getJobs: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get a single job by ID
     * GET /api/jobs/:id
     */
    getJobById: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get job analytics for employer
     * GET /api/jobs/analytics
     */
    getJobAnalytics: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get job statistics for employer
     * GET /api/jobs/stats
     */
    getJobStats: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get job statistics for employer
     * GET /api/jobs/stats
     */
    getGlobalJobStats: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Create a new job (employer only)
     * POST /api/jobs
     */
    createJob: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Update a job (employer only)
     * PUT /api/jobs/:id
     */
    updateJob: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Delete a job (employer only)
     * DELETE /api/jobs/:id
     */
    deleteJob: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Toggle job status (active/inactive)
     * PATCH /api/jobs/:id/toggle-status
     */
    toggleJobStatus: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get job applications (employer only)
     * GET /api/jobs/:id/applications
     */
    getJobApplications: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get featured jobs
     * GET /api/jobs/featured
     */
    getFeaturedJobs: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get jobs by employer
     * GET /api/jobs/employer/:employerId
     */
    getJobsByEmployer: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * AI-powered natural language job search
     * GET /api/jobs/search/ai
     */
    searchJobsAI: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Generate job content using AI (employer only)
     * POST /api/jobs/generate-content
     */
    generateJobContent: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get similar jobs based on job ID
     * GET /api/jobs/:id/similar
     */
    getSimilarJobs: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Bulk create jobs (employer only)
     * POST /api/jobs/bulk
     */
    bulkCreateJobs: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get job performance metrics
     * GET /api/dashboard/performance
     */
    getJobPerformance: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
declare const _default: JobController;
export default _default;
//# sourceMappingURL=job.controller.d.ts.map