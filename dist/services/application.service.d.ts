import { IApplication, ApplicationStatus } from "../models/Application.model.js";
import mongoose from "mongoose";
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
    statusBreakdown: Record<string, number>;
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
export interface CreateApplicationData {
    jobId: string;
    userId: string;
    resumeId: string;
    coverLetter?: string;
    expectedSalary?: number;
    availableFrom?: Date | string;
}
export interface UpdateApplicationData {
    status?: ApplicationStatus;
    aiScore?: number;
    aiExplanation?: string;
    aiStrengths?: string[];
    aiWeaknesses?: string[];
    aiRecommendation?: string;
    [key: string]: any;
}
export interface ApplicationFilters {
    status?: ApplicationStatus;
    jobId?: string;
    userId?: string;
    minScore?: number;
    maxScore?: number;
    fromDate?: Date;
    toDate?: Date;
}
export interface PaginationOptions {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}
export interface ApplicationPaginationResult {
    applications: IApplication[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
export interface ApplicationStatistics {
    total: number;
    byStatus: Record<ApplicationStatus, number>;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    recentApplications: number;
}
export interface InterviewScheduleData {
    scheduledDate: Date;
    duration?: number;
    type?: string;
    location?: string;
    meetingLink?: string;
    interviewerIds?: string[];
    title?: string;
    timezone?: string;
    notes?: string;
}
declare class ApplicationService {
    /**
     * Create a new application
     */
    createApplication(data: CreateApplicationData): Promise<IApplication>;
    /**
     * Get application by ID with full population
     */
    getApplicationById(applicationId: string | mongoose.Types.ObjectId, options?: {
        populate?: boolean;
    }): Promise<IApplication | null>;
    /**
     * Get applications with filters and pagination
     */
    getApplications(filters?: ApplicationFilters, options?: PaginationOptions): Promise<ApplicationPaginationResult>;
    /**
     * Get applications by applicant
     */
    getApplicationsByApplicant(userId: string, options?: PaginationOptions): Promise<ApplicationPaginationResult>;
    /**
     * Get applications by job
     */
    getApplicationsByJob(jobId: string, options?: PaginationOptions): Promise<ApplicationPaginationResult>;
    /**
     * Get applications by employer
     */
    getApplicationsByEmployer(employerId: string, options?: PaginationOptions & {
        jobId?: string;
        status?: string;
    }): Promise<ApplicationPaginationResult>;
    /**
     * Check if user already applied to a job
     */
    findByJobAndCandidate(jobId: string, userId: string): Promise<IApplication | null>;
    /**
     * Update application
     */
    updateApplication(applicationId: string | mongoose.Types.ObjectId, data: UpdateApplicationData): Promise<IApplication | null>;
    /**
     * Update application status with interview scheduling
     */
    updateApplicationStatus(applicationId: string, status: ApplicationStatus, notes?: string, userId?: string, interviewData?: InterviewScheduleData): Promise<IApplication | null>;
    /**
     * ✅ NEW: Schedule interview for application
     */
    scheduleInterview(applicationId: string, interviewData: InterviewScheduleData, userId: string): Promise<IApplication>;
    /**
     * Withdraw an application (candidate cancels)
     */
    withdrawApplication(applicationId: string, userId: string, reason?: string): Promise<IApplication | null>;
    /**
     * Check if a candidate can withdraw
     */
    canWithdraw(applicationId: string, userId: string): Promise<boolean>;
    /**
     * Update application with AI screening results
     */
    updateWithAIScore(applicationId: string, aiData: {
        score: number;
        explanation: string;
        strengths: string[];
        weaknesses: string[];
        recommendation: string;
    }): Promise<IApplication | null>;
    /**
     * Delete application
     */
    deleteApplication(applicationId: string): Promise<boolean>;
    /**
     * Get top applicants for a job
     */
    getTopApplicants(jobId: string, limit?: number): Promise<IApplication[]>;
    /**
     * Check if user has applied to a job
     */
    hasUserApplied(jobId: string, userId: string): Promise<boolean>;
    /**
     * Get applications by status
     */
    getApplicationsByStatus(status: ApplicationStatus, options?: PaginationOptions): Promise<ApplicationPaginationResult>;
    /**
     * Bulk update application statuses
     */
    bulkUpdateStatus(applicationIds: string[], status: ApplicationStatus, notes?: string): Promise<{
        updated: number;
        failed: string[];
    }>;
    getApplicationTimeline(employerId: string, days?: number, status?: string): Promise<any[]>;
    getApplicationStats(employerId: string): Promise<ApplicationStats>;
    /**
     * Validate status transition
     */
    private validateStatusTransition;
    private getEmptyApplicationStats;
}
declare const _default: ApplicationService;
export default _default;
//# sourceMappingURL=application.service.d.ts.map