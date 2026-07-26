interface RecommendationParams {
    jobId?: string;
    limit: number;
    minScore: number;
    skills: string[];
    experienceMin?: number;
    experienceMax?: number;
}
interface CandidateRecommendation {
    candidate: {
        _id: string;
        userId: {
            _id: string;
            name: string;
            email: string;
            phone: string;
            location?: string;
            profileImage?: string;
        };
        jobId: {
            _id: string;
            title: string;
            company: string;
        };
    };
    matchScore: number;
    matchDetails: {
        skillsMatch: {
            matched: string[];
            missing: string[];
            matchPercentage: number;
        };
        experienceMatch: {
            candidateYears: number;
            requiredYears: number;
            match: boolean;
        };
        educationMatch: {
            match: boolean;
            details: string;
        };
        aiScore: number;
        overallMatch: number;
    };
    status: string;
    appliedDate: Date;
    resume: any;
}
interface AnalyticsData {
    totalApplications: number;
    byStatus: any[];
    byJob: any[];
    dailyApplications: any[];
    averageScore: number;
    topSkills: {
        skill: string;
        count: number;
    }[];
}
export declare class CandidateService {
    private Application;
    private Job;
    private Resume;
    private User;
    constructor();
    /**
     * Get candidates with filters and pagination
     */
    getCandidates(employerId: string, filters: any, options: {
        page: number;
        limit: number;
        sortBy: string;
        sortOrder: string;
    }): Promise<{
        candidates: any[];
        total: number;
        statusSummary: any[];
    }>;
    /**
     * Get AI-powered candidate recommendations
     */
    getCandidateRecommendations(employerId: string, params: RecommendationParams): Promise<CandidateRecommendation[]>;
    /**
     * Calculate match score between a candidate and a job
     */
    private calculateMatchScore;
    /**
     * Build search filters for MongoDB aggregation
     */
    private buildSearchFilters;
    /**
     * Get candidate by ID
     */
    getCandidateById(candidateId: string, employerId: string): Promise<any | null>;
    /**
     * Update candidate status
     */
    updateCandidateStatus(candidateId: string, employerId: string, status: string, notes?: string): Promise<any | null>;
    /**
     * Get candidate resume
     */
    getCandidateResume(candidateId: string, employerId: string): Promise<any | null>;
    /**
     * Get candidate analytics for employer
     */
    getAnalytics(employerId: string): Promise<AnalyticsData>;
    /**
     * Get top skills from candidates
     */
    private getTopSkills;
    private buildSearchFilter;
    private getStatusSummary;
    /**
     * Export candidates data
     */
    exportCandidates(employerId: string): Promise<any[]>;
    /**
     * Add note to candidate
     */
    addCandidateNote(candidateId: string, employerId: string, note: string): Promise<any | null>;
    /**
     * Get candidate timeline
     */
    getCandidateTimeline(candidateId: string, employerId: string): Promise<any | null>;
    /**
     * Get candidate statistics for employer dashboard
     */
    getCandidateStats(employerId: string): Promise<any>;
    /**
     * Get shortlisted candidates for an employer
     */
    getShortlistedCandidates(employerId: string, options?: {
        page?: number;
        limit?: number;
        search?: string;
        jobId?: string;
        sortBy?: string;
        sortOrder?: "asc" | "desc";
    }): Promise<{
        candidates: any[];
        total: number;
        summary: {
            totalShortlisted: number;
            byJob: {
                jobTitle: string;
                count: number;
            }[];
            byStage: {
                stage: string;
                count: number;
            }[];
        };
    }>;
    /**
     * Get shortlisted candidates summary
     */
    private getShortlistedSummary;
    /**
     * Helper: Get user IDs by search term
     */
    private getUserIdsBySearch;
    /**
     * Get applications for shortlisted candidates
     */
    getShortlistedApplications(employerId: string, options?: {
        page?: number;
        limit?: number;
        search?: string;
        jobId?: string;
        status?: string;
        stage?: string;
        sortBy?: string;
        sortOrder?: "asc" | "desc";
        startDate?: string;
        endDate?: string;
    }): Promise<{
        applications: any[];
        total: number;
        summary: {
            totalShortlisted: number;
            byStatus: {
                status: string;
                count: number;
            }[];
            byJob: {
                jobTitle: string;
                count: number;
            }[];
            byStage: {
                stage: string;
                count: number;
            }[];
            averageScore: number;
            totalWithAI: number;
        };
    }>;
    /**
     * Get shortlisted applications summary
     */
    private getShortlistedApplicationsSummary;
    /**
     * Get resume for a shortlisted candidate
     */
    getShortlistedCandidateResume(candidateId: string, employerId: string, format?: "pdf" | "json" | "url"): Promise<{
        resume: any;
        fileName: string;
        fileType: string;
        content?: Buffer | string;
        url?: string;
        metadata: {
            candidateName: string;
            candidateEmail: string;
            jobTitle: string;
            applicationId: string;
            resumeTitle: string;
            template: string;
            createdAt: Date;
            updatedAt: Date;
        };
    } | null>;
    /**
     * Get multiple shortlisted candidate resumes
     */
    getShortlistedCandidateResumes(employerId: string, options?: {
        jobId?: string;
        candidateIds?: string[];
        format?: "pdf" | "json" | "url";
        limit?: number;
    }): Promise<{
        resumes: any[];
        total: number;
    }>;
    private getEmptyCandidateStats;
}
declare const _default: CandidateService;
export default _default;
//# sourceMappingURL=candidate.service.d.ts.map