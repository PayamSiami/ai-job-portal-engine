import { Request, Response } from "express";
/**
 * Application Controller
 * Handles all application-related operations
 */
declare class ApplicationController {
    /**
     * Apply for a job with AI screening
     * POST /api/applications
     * ✅ Only authenticated job seekers can apply
     */
    applyForJob: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get current user's applications
     * GET /api/applications
     * ✅ Only authenticated job seekers can view their applications
     */
    getMyApplications: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getApplicationTimeline: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get applications for employer's jobs
     * GET /api/applications/employer
     * ✅ Only authenticated employers can view applications
     */
    getEmployerApplications: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getApplicationStats: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get application details (applicant or employer)
     * GET /api/applications/{id}
     * ✅ Both job seekers and employers can view applications they're involved with
     */
    getApplicationById: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Update application status (Employer only)
     * PATCH /api/applications/{id}/status
     * ✅ Only employers can update application status
     */
    updateApplicationStatus: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Withdraw application (Candidate only)
     * PATCH /api/applications/{id}/withdraw
     * ✅ Only job seekers can withdraw their own applications
     */
    withdrawApplication: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Delete application (Admin only)
     * DELETE /api/applications/{id}
     * ✅ Only admins can delete applications
     */
    deleteApplication: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
declare const _default: ApplicationController;
export default _default;
//# sourceMappingURL=application.controller.d.ts.map