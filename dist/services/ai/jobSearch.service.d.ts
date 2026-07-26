import { IJob } from "../../models/Job.models.js";
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
export interface SearchResult {
    where: Record<string, any>;
    rawQuery?: string;
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
interface ParsedJobFilters {
    rawQuery?: string;
    title: string | null;
    location: string | null;
    minSalary: number | null;
    maxSalary: number | null;
    experienceLevel: string | null;
    workMode: string | null;
    jobType: string | null;
    skills: string[] | null;
}
declare class JobService {
    private genAI;
    private model;
    constructor();
    private cleanAIResponse;
    /**
     * Search jobs using parsed filters
     */
    searchJobs(filters: ParsedJobFilters): Promise<SearchResult>;
    /**
     * Convert natural language query to structured job search filters
     */
    parseNaturalLanguageQuery(query: string): Promise<ParsedJobFilters>;
    private validateExperienceLevel;
    private validateWorkMode;
    private validateJobType;
    private parseFallback;
}
declare const _default: JobService;
export default _default;
//# sourceMappingURL=jobSearch.service.d.ts.map