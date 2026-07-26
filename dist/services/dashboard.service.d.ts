import { ApplicationStatus } from "../models/Application.model.js";
export interface DashboardStats {
    totalJobs: number;
    activeJobs: number;
    totalApplications: number;
    pendingApplications: number;
    reviewingApplications: number;
    shortlistedCandidates: number;
    interviewingCandidates: number;
    hiredCandidates: number;
    rejectedCandidates: number;
    aiScreenedCount: number;
    screeningCoverage: number;
    averageAIScore: number;
    recentActivities: RecentActivity[];
}
export interface RecentActivity {
    id: string;
    candidateName: string;
    jobTitle: string;
    status: string;
    timestamp: Date;
    aiScore?: number;
}
export interface AIScreeningData {
    screeningCoverage: number;
    totalCandidatesScreened: number;
    candidatesNotScreened: number;
    averageAIScore: number;
    screeningHistory: {
        jobId: string;
        jobTitle: string;
        totalApplicants: number;
        screenedCount: number;
        avgScore: number;
        postedDate: Date;
    }[];
    pendingScreening: {
        id: string;
        candidateName: string;
        jobTitle: string;
        appliedDate: Date;
    }[];
}
export interface ApplicationStats {
    total: number;
    pending: number;
    reviewing: number;
    shortlisted: number;
    interviewing: number;
    rejected: number;
    hired: number;
    averageAIScore: number;
    screeningCoverage: number;
    statusBreakdown: Record<ApplicationStatus, number>;
    recentActivity: Array<{
        date: string;
        count: number;
    }>;
    applicationsByJob: Array<{
        jobTitle: string;
        count: number;
    }>;
    averageTimeToHire: number;
}
export interface JobPerformance {
    totalJobs: number;
    activeJobs: number;
    jobsByStatus: Record<string, number>;
    applicationsPerJob: number;
    averageTimeToFill: number;
    topPerformingJobs: Array<{
        jobTitle: string;
        applicationCount: number;
        hireCount: number;
        conversionRate: number;
    }>;
}
export interface CandidateFilters {
    search?: string;
    status?: string;
    skills?: string[];
    experienceMin?: number;
    experienceMax?: number;
    location?: string;
    availability?: string;
}
export interface CandidateRecommendation {
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
export interface Activity {
    id: string;
    title: string;
    description?: string;
    score?: number | null;
    status: "pending" | "in-progress" | "completed";
    time: string;
    type: "application" | "screening" | "generation" | "analytics" | "interview" | "status_change" | "job";
    link?: string;
    user?: {
        name: string;
        avatar?: string;
    };
    timestamp: Date;
    jobTitle?: string;
    companyName?: string;
    metadata?: Record<string, any>;
}
declare class DashboardService {
    private Job;
    private Application;
    private Company;
    private Resume;
    private User;
    constructor();
    /**
     * Get comprehensive dashboard statistics
     */
    getDashboardStats(employerId: string): Promise<DashboardStats>;
    getAIScreeningData(employerId: string): Promise<AIScreeningData>;
    /**
     * Export dashboard data
     */
    exportDashboard(employerId: string, format?: string, type?: string): Promise<any>;
    private getTimeAgo;
    private mapApplicationStatus;
    private getEmptyDashboardStats;
    private getEmptyScreeningData;
}
declare const _default: DashboardService;
export default _default;
//# sourceMappingURL=dashboard.service.d.ts.map