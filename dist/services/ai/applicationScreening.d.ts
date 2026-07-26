import NodeCache from "node-cache";
export interface ApplicationData {
    expectedSalary?: number;
    availableFrom?: string;
    coverLetter?: string;
    phoneNumber?: string;
    email?: string;
    currentLocation?: string;
    workAuthorization?: string;
    linkedInUrl?: string;
    portfolioUrl?: string;
}
export interface JobDetails {
    title: string;
    location: string;
    minSalary?: number;
    maxSalary?: number;
    requirements: string;
    description: string;
    benefits?: string;
    department?: string;
    employmentType?: string;
    experienceLevel?: string;
}
export interface ScreeningResult {
    score: number;
    explanation: string;
    strengths: string[];
    weaknesses: string[];
    recommendation: "strongly recommend" | "recommend" | "consider" | "not recommended";
    breakdown?: ScreeningBreakdown;
    metadata?: ScreeningMetadata;
}
export interface ScreeningBreakdown {
    skillsMatch: number;
    experienceRelevance: number;
    salaryAlignment: number;
    availabilityTiming: number;
    coverLetterQuality: number;
    totalScore: number;
}
export interface ScreeningMetadata {
    processingTime: number;
    modelUsed: string;
    timestamp: string;
    fromCache?: boolean;
}
export interface ScreeningOptions {
    retryCount?: number;
    includeBreakdown?: boolean;
    customWeights?: ScreeningWeights;
    useCache?: boolean;
}
export interface ScreeningWeights {
    skillsMatch: number;
    experienceRelevance: number;
    salaryAlignment: number;
    availabilityTiming: number;
    coverLetterQuality: number;
}
export interface ValidationResult {
    valid: boolean;
    issues: string[];
}
declare class ApplicationScreeningService {
    private genAI;
    private model;
    private cache;
    private readonly MAX_RESUME_LENGTH;
    private readonly MAX_JOB_DETAILS_LENGTH;
    private readonly DEFAULT_WEIGHTS;
    constructor();
    /**
     * Screen a job application and provide a score with detailed feedback
     */
    screenApplication(resumeText: string, applicationData: ApplicationData, jobDetails: JobDetails, options?: ScreeningOptions): Promise<ScreeningResult>;
    /**
     * Generate cache key for screening results
     */
    private generateCacheKey;
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
    private buildPrompt;
    private cleanAIResponse;
    private parseScreeningResult;
    private validateRecommendation;
    private validateInputs;
    private validateWeights;
    private truncateText;
    private truncateJobDetails;
    private getFallbackResult;
    private delay;
}
declare const _default: ApplicationScreeningService;
export default _default;
//# sourceMappingURL=applicationScreening.d.ts.map