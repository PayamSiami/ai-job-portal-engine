import { Request, Response } from "express";
/**
 * Dashboard Controller
 * Handles all dashboard, analytics, candidate, and company management
 */
declare class CandidateController {
    /**
     * Get candidates with filters and pagination
     * GET /api/dashboard/candidates
     */
    getCandidates: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get AI-powered candidate recommendations
     * GET /api/dashboard/candidates/recommendations
     */
    getCandidateRecommendations: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get candidate by ID
     * GET /api/dashboard/candidates/:id
     */
    getCandidateById: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Update candidate status
     * PUT /api/dashboard/candidates/:id/status
     */
    updateCandidateStatus: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Get candidate resume
     * GET /api/dashboard/candidates/:id/resume
     */
    getCandidateResume: (req: Request, res: Response, next: import("express").NextFunction) => void;
    bulkUpdateCandidateStatus: (req: Request, res: Response, next: import("express").NextFunction) => void;
    /**
     * Bulk delete candidates
     * DELETE /api/dashboard/candidates/bulk
     */
    bulkDeleteCandidates: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getCandidateStats: (req: Request, res: Response, next: import("express").NextFunction) => void;
}
declare const _default: CandidateController;
export default _default;
//# sourceMappingURL=candidate.controller.d.ts.map