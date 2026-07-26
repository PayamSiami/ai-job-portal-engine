import NodeCache from "node-cache";
export interface CareerFeedbackOptions {
    retryCount?: number;
    useCache?: boolean;
    includeDetailed?: boolean;
    industry?: string;
    targetRole?: string;
}
export interface CareerIssue {
    type: "formatting" | "content" | "skills" | "experience" | "education" | "grammar" | "structure" | "impact";
    description: string;
    location: string;
    priority: "high" | "medium" | "low";
    suggestion?: string;
}
export interface CareerStrength {
    type: "skills" | "experience" | "education" | "achievement" | "formatting";
    description: string;
    impact: "high" | "medium" | "low";
}
export interface CareerFeedbackResult {
    issues: CareerIssue[];
    strengths: CareerStrength[];
    improvements: string[];
    missingSkills: string[];
    targetRoles: string[];
    overallScore: number;
    detailedAnalysis?: {
        skillsAssessment: {
            technical: number;
            soft: number;
            leadership: number;
        };
        experienceAssessment: {
            relevance: number;
            depth: number;
            progression: number;
        };
        educationAssessment: {
            relevance: number;
            level: number;
            quality: number;
        };
        presentationAssessment: {
            clarity: number;
            impact: number;
            formatting: number;
        };
    };
    recommendations: {
        immediate: string[];
        shortTerm: string[];
        longTerm: string[];
    };
    metadata?: {
        processingTime: number;
        modelUsed: string;
        timestamp: string;
        fromCache?: boolean;
    };
}
export interface ResumeAnalysis {
    content: string;
    skills: string[];
    experience: string[];
    education: string[];
    achievements: string[];
}
declare class CareerFeedbackService {
    private genAI;
    private model;
    private cache;
    private readonly MAX_RESUME_LENGTH;
    constructor();
    /**
     * Generate comprehensive career feedback from a resume
     */
    generateCareerFeedback(resumeText: string, options?: CareerFeedbackOptions): Promise<CareerFeedbackResult>;
    private buildFeedbackPrompt;
    /**
     * Parse and validate feedback result with better error handling
     */
    private parseFeedbackResult;
    /**
     * Fallback: Extract feedback from unstructured text
     */
    private extractFeedbackFromText;
    /**
     * Get default feedback result when all parsing fails
     */
    private getDefaultFeedbackResult;
    private cleanAIResponse;
    private generateCacheKey;
    private truncateText;
    private getFallbackResult;
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
declare const _default: CareerFeedbackService;
export default _default;
//# sourceMappingURL=careerFeedback.d.ts.map