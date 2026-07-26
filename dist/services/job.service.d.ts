import { IJob } from "../models/Job.models.js";
import mongoose, { Types } from "mongoose";
import { JobPerformance } from "./dashboard.service.js";
export type ExperienceLevel = "entry" | "mid" | "senior" | "lead";
export type WorkMode = "remote" | "hybrid" | "on-site";
export type JobType = "full-time" | "part-time" | "contract" | "internship";
export interface JobFilters {
    title?: string;
    company?: string;
    location?: string;
    minSalary?: number;
    maxSalary?: number;
    experienceLevel?: ExperienceLevel;
    workMode?: WorkMode;
    jobType?: JobType;
    tags?: string[];
    [key: string]: any;
}
export interface JobPaginationOptions {
    page?: number;
    limit?: number;
}
export interface JobPaginationResult {
    jobs: IJob[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
export interface GeneratedJobContent {
    title: string;
    company: string;
    location: string;
    salary: number;
    minSalary: number;
    maxSalary: number;
    experienceLevel: ExperienceLevel;
    workMode: WorkMode;
    jobType: JobType;
    description: string;
    requirements: string;
    benefits: string;
    tags: string[];
}
declare class JobService {
    private genAI?;
    private model?;
    constructor();
    getJobs(filters?: JobFilters, options?: JobPaginationOptions): Promise<JobPaginationResult>;
    /**
     * Get jobs with MongoDB query
     */
    getJobsWithMongoQuery(where: any, options: {
        page: number;
        limit: number;
    }): Promise<any>;
    getJobById(jobId: string): Promise<(IJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    createJob(userId: string, jobData: any): Promise<any>;
    getActiveJobs(): Promise<IJob[]>;
    /**
     * Generate complete job content using AI
     */
    generateJobContent(jobTitle: string): Promise<GeneratedJobContent>;
    /**
     * Generate fallback job content when AI is unavailable
     */
    private generateFallbackJobContent;
    /**
     * Get job statistics for employer
     */
    getJobStats(employerId: string): Promise<any>;
    /**
     * Get job applications for a specific job
     */
    getJobApplications(jobId: string, employerId: string, options: {
        page: number;
        limit: number;
        status?: string;
    }): Promise<any>;
    /**
     * Get similar jobs
     */
    getSimilarJobs(jobId: string, limit?: number): Promise<any[]>;
    /**
     * Bulk create jobs
     */
    bulkCreateJobs(employerId: string, jobsData: any[]): Promise<any[]>;
    /**
     * Get job performance metrics
     */
    getJobPerformance(employerId: string, timeframe?: number): Promise<JobPerformance>;
    getJobsByEmployer(employerId: string, options?: {
        page?: number;
        limit?: number;
        status?: string;
        search?: string;
    }): Promise<any[]>;
    /**
     * Get featured jobs
     */
    getFeaturedJobs(limit?: number): Promise<any[]>;
    /**
     * Toggle job status (active/inactive)
     */
    toggleJobStatus(jobId: string, employerId: string): Promise<any>;
    /**
     * ✅ Delete a job (soft delete)
     */
    deleteJob(jobId: string, userId: string): Promise<mongoose.Document<unknown, {}, IJob, {}, mongoose.DefaultSchemaOptions> & IJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    /**
     * Update a job
     */
    updateJob(jobId: string, userId: string, data: any): Promise<mongoose.Document<unknown, {}, IJob, {}, mongoose.DefaultSchemaOptions> & IJob & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    getGlobalJobStats(): Promise<any>;
    /**
     * Get job analytics for employer
     */
    getJobAnalytics(employerId: string, timeRange?: string): Promise<any>;
    private getEmptyAnalytics;
    private getDateRange;
    private getStatusDistribution;
    private getTypeDistribution;
    private calculateGrowth;
    /**
     * Helper to get status counts
     */
    private getStatusCounts;
    /**
     * Get empty global stats when no jobs exist
     */
    private getEmptyGlobalStats;
    private calculateTimeToHire;
    private calculateViewsPerJob;
    private calculateShortlistRate;
    private getMonthlyData;
    private getTopPerformingJobs;
    private getRecentActivity;
    private getWorkModeDistribution;
    private getApplicationStatusDistribution;
    private calculateConversionRate;
}
declare const _default: JobService;
export default _default;
//# sourceMappingURL=job.service.d.ts.map