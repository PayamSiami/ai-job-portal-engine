import NodeCache from "node-cache";
export interface ResumeAnalysisResult {
    matchScore: number;
    explanation: string;
    matchedSkills: string[];
    missingSkills: string[];
    suggestions: string[];
    metadata?: {
        processingTime: number;
        modelUsed: string;
        timestamp: string;
        fromCache?: boolean;
    };
}
export interface CareerFeedbackResult {
    issues: CareerIssue[];
    improvements: string[];
    missingSkills: string[];
    targetRoles: string[];
    overallScore: number;
    metadata?: {
        processingTime: number;
        modelUsed: string;
        timestamp: string;
        fromCache?: boolean;
    };
}
export interface CareerIssue {
    type: string;
    description: string;
    location: string;
    priority?: "high" | "medium" | "low";
    suggestion?: string;
}
export interface AnalyzeResumeOptions {
    retryCount?: number;
    timeout?: number;
    useCache?: boolean;
    includeDetailed?: boolean;
    industry?: string;
    targetRole?: string;
}
declare class ResumeAnalyzerService {
    private genAI?;
    private model?;
    private cache;
    private readonly MAX_RESUME_LENGTH;
    private readonly MAX_JOB_DETAILS_LENGTH;
    private readonly DEFAULT_CACHE_TTL;
    private isAIEnabled;
    constructor();
    /**
     * Analyze resume against job requirements
     */
    analyzeResumeVsJob(resumeText: string, jobRequirements: string, jobDescription: string, options?: AnalyzeResumeOptions): Promise<ResumeAnalysisResult>;
    private buildAnalysisPrompt;
    private cleanAIResponse;
    private parseAndValidateAnalysis;
    /**
     * Try to find an available model
     */
    private getAvailableModel;
    private extractDataFromText;
    private validateResumeInput;
    private validateJobInput;
    private truncateText;
    private generateAnalysisCacheKey;
    private getFallbackAnalysisResult;
    private delay;
    clearCache(): void;
    getCacheStats(): {
        keys: string[];
        size: number;
        stats: NodeCache.Stats;
    };
    /**
     * ✅ Get improvement suggestions for a resume
     */
    getImprovementSuggestions(resumeContent: string, options?: any): Promise<any[]>;
    /**
     * Build improvement suggestion prompt
     */
    private buildImprovementPrompt;
    /**
     * Parse improvement suggestions from AI response
     */
    private parseImprovementSuggestions;
    /**
     * Get fallback improvements when AI is unavailable
     */
    private getFallbackImprovements;
}
declare const _default: ResumeAnalyzerService;
export default _default;
//# sourceMappingURL=resumeAnalyzer.service.d.ts.map