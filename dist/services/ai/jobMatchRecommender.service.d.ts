import NodeCache from "node-cache";
export interface CandidateProfile {
    title: string | null;
    skills: string[];
    experienceYears: number | null;
    education: string | null;
    preferredLocation: string | null;
    preferredWorkMode: "remote" | "hybrid" | "on-site" | null;
    salaryExpectation: number | null;
    summary?: string;
    certifications?: string[];
    languages?: string[];
    industries?: string[];
}
export interface Job {
    id?: string;
    title: string;
    company: string;
    location: string;
    workMode: "remote" | "hybrid" | "on-site";
    minSalary?: number;
    maxSalary?: number;
    requirements: string;
    description: string;
    postedDate?: string;
    department?: string;
    employmentType?: "full-time" | "part-time" | "contract" | "internship";
    benefits?: string[];
    skills?: string[];
    industry?: string;
    companySize?: string;
}
export interface MatchBreakdown {
    skillsMatch: number;
    experienceMatch: number;
    salaryMatch: number;
    locationMatch: number;
    workModeMatch: number;
    totalScore: number;
}
export interface MatchMetadata {
    processingTime: number;
    modelUsed: string;
    timestamp: string;
    matchedSkills?: string[];
    missingSkills?: string[];
    fromCache?: boolean;
}
export interface JobMatchResult {
    job: Job;
    matchScore: number;
    explanation: string;
    matchQuality: "high" | "medium" | "low";
    breakdown?: MatchBreakdown;
    metadata: MatchMetadata;
}
export interface MatchOptions {
    retryCount?: number;
    minScore?: number;
    includeBreakdown?: boolean;
    batchSize?: number;
    concurrency?: number;
    useCache?: boolean;
    cacheTTL?: number;
    prioritizeSkills?: string[];
    industries?: string[];
}
export interface MatchStatistics {
    totalJobsMatched: number;
    averageScore: number;
    distribution: {
        high: number;
        medium: number;
        low: number;
    };
    topMatches: JobMatchResult[];
    recommendations: string[];
    industryInsights?: {
        topIndustries: string[];
        inDemandSkills: string[];
        salaryRange: {
            min: number;
            max: number;
            average: number;
        };
    };
}
export interface BatchMatchResult {
    results: JobMatchResult[];
    stats: MatchStatistics;
    processingTime: number;
    totalJobsProcessed: number;
    cachedResults: number;
}
declare class JobMatchRecommenderService {
    private genAI;
    private model;
    private cache;
    private readonly MAX_RESUME_LENGTH;
    private readonly MAX_JOBS_PER_BATCH;
    private readonly DEFAULT_MIN_SCORE;
    private readonly CONCURRENCY_LIMIT;
    private readonly DEFAULT_CACHE_TTL;
    constructor();
    /**
     * Find jobs that match the user's resume with detailed scoring
     */
    getJobMatches(resumeText: string, availableJobs: Job[], options?: MatchOptions): Promise<JobMatchResult[]>;
    /**
     * Extract candidate profile from resume
     */
    private extractCandidateProfile;
    /**
     * Score jobs in batches with concurrency control
     */
    private scoreJobsInBatches;
    /**
     * Score a single job with retry logic
     */
    private scoreJobWithRetry;
    /**
     * Get fallback results when matching fails
     */
    private getFallbackResults;
    /**
     * Build the match scoring prompt
     */
    private buildMatchPrompt;
    /**
     * Parse candidate profile from AI response
     */
    private parseCandidateProfile;
    /**
     * Parse match result from AI response
     */
    private parseMatchResult;
    /**
     * Generate job match cache key
     */
    private generateJobMatchCacheKey;
    /**
     * Process promises with concurrency limit
     */
    private processWithConcurrency;
    /**
     * Validate work mode
     */
    private validateWorkMode;
    /**
     * Validate match quality
     */
    private validateMatchQuality;
    /**
     * Clean AI response text
     */
    private cleanAIResponse;
    /**
     * Validate inputs
     */
    private validateInputs;
    /**
     * Truncate text to max length
     */
    private truncateText;
    /**
     * Delay for retry backoff
     */
    private delay;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        keys: string[];
        size: number;
        stats: NodeCache.Stats;
    };
}
declare const _default: JobMatchRecommenderService;
export default _default;
//# sourceMappingURL=jobMatchRecommender.service.d.ts.map