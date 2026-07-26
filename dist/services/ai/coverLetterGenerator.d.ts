import NodeCache from "node-cache";
export interface JobDetails {
    title: string;
    company: string;
    location: string;
    requirements: string;
    description: string;
    hiringManager?: string;
    industry?: string;
    companyCulture?: string;
}
export interface CoverLetterOptions {
    maxWords?: number;
    tone?: "professional" | "enthusiastic" | "formal" | "casual" | "confident";
    includeContactInfo?: boolean;
    retryCount?: number;
    timeout?: number;
    useCache?: boolean;
    focusSkills?: string[];
    includeAchievements?: boolean;
}
export interface CoverLetterResult {
    content: string;
    wordCount: number;
    estimatedReadTime: number;
    success: boolean;
    error?: string;
    metadata?: {
        processingTime: number;
        modelUsed: string;
        timestamp: string;
        fromCache?: boolean;
        tone: string;
        wordCount: number;
    };
}
export interface CoverLetterVariation {
    tone: string;
    result: CoverLetterResult;
    score?: number;
}
declare class CoverLetterGeneratorService {
    private genAI?;
    private model?;
    private cache;
    private readonly DEFAULT_MAX_WORDS;
    private readonly MAX_RESUME_LENGTH;
    private readonly MAX_JOB_DETAILS_LENGTH;
    private readonly CACHE_TTL;
    private isAIEnabled;
    constructor();
    /**
     * Try to find an available model
     */
    private getAvailableModel;
    /**
     * Generate a tailored cover letter based on job details and resume
     */
    generateCoverLetter(jobDetails: JobDetails, resumeText: string, options?: CoverLetterOptions): Promise<CoverLetterResult>;
    /**
     * Generate fallback cover letter without AI
     */
    private generateFallbackCoverLetter;
    /**
     * Extract skills from resume text
     */
    private extractSkills;
    /**
     * Validate inputs
     */
    private validateInputs;
    /**
     * Build the AI prompt
     */
    private buildPrompt;
    /**
     * Format the result
     */
    private formatResult;
    /**
     * Count words in text
     */
    private countWords;
    /**
     * Delay helper
     */
    private delay;
    /**
     * Truncate text
     */
    private truncateText;
    /**
     * Truncate job details
     */
    private truncateJobDetails;
    /**
     * Generate cache key
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
}
declare const _default: CoverLetterGeneratorService;
export default _default;
//# sourceMappingURL=coverLetterGenerator.d.ts.map