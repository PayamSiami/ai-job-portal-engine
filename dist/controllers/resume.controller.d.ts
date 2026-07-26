import { Request, Response, NextFunction } from "express";
/**
 * Resume Controller
 * Handles all resume CRUD operations
 */
declare class ResumeController {
    /**
     * Get all resumes for authenticated user with pagination and filtering
     */
    getUserResumes: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Get a single resume by ID
     */
    getResume: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Create a new resume
     */
    createResume: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Update an existing resume
     */
    updateResume: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Delete a resume
     */
    deleteResume: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Duplicate an existing resume
     */
    duplicateResume: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Set a resume as default
     */
    setDefaultResume: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Download resume as PDF
     */
    downloadResumePDF: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Get resume statistics
     */
    getResumeStats: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Bulk delete resumes
     */
    bulkDeleteResumes: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Export resume data
     */
    exportResume: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Analyze resume against a job description
     * GET /api/resumes/:id/analyze
     */
    analyzeResume: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Generate cover letter for a job
     * POST /api/resumes/:id/generate-cover-letter
     */
    generateCoverLetter: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Get career feedback
     * GET /api/resumes/:id/career-feedback
     */
    getCareerFeedback: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Get job match recommendations
     * GET /api/resumes/:id/job-matches
     */
    getJobMatches: (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Get resume improvement suggestions
     * GET /api/resumes/:id/improvements
     */
    getImprovementSuggestions: (req: Request, res: Response, next: NextFunction) => void;
}
declare const _default: ResumeController;
export default _default;
//# sourceMappingURL=resume.controller.d.ts.map