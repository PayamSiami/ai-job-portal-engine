// src/services/ai/resumeAnalyzer.ts
import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerationConfig,
} from "@google/generative-ai";
import NodeCache from "node-cache";
import { config } from "../../config/index.js";

// ============ Type Definitions ============

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

// ============ Service Class ============

class ResumeAnalyzerService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private cache: NodeCache;
  private readonly MAX_RESUME_LENGTH = 4000;
  private readonly MAX_JOB_DETAILS_LENGTH = 2000;
  private readonly DEFAULT_CACHE_TTL = 3600; // 1 hour

  constructor() {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required in environment variables");
    }

    this.genAI = new GoogleGenerativeAI(apiKey);

    const generationConfig: GenerationConfig = {
      temperature: 0.1,
      topK: 1,
      topP: 0.8,
      maxOutputTokens: 800,
    };

    this.model = this.genAI.getGenerativeModel({
      model: config.GEMINI_MODEL,
      generationConfig,
    });

    // Initialize cache
    this.cache = new NodeCache({
      stdTTL: this.DEFAULT_CACHE_TTL,
      checkperiod: 120,
    });
  }

  /**
   * Analyze resume against job requirements
   * Returns match score, explanation, missing skills
   */
  async analyzeResumeVsJob(
    resumeText: string,
    jobRequirements: string,
    jobDescription: string,
    options: AnalyzeResumeOptions = {},
  ): Promise<ResumeAnalysisResult> {
    const startTime = Date.now();
    const { retryCount = 2, useCache = true, industry, targetRole } = options;

    let lastError: Error | null = null;

    // Validate inputs
    this.validateResumeInput(resumeText);
    this.validateJobInput(jobRequirements, jobDescription);

    // Truncate inputs
    const truncatedResume = this.truncateText(
      resumeText,
      this.MAX_RESUME_LENGTH,
    );
    const truncatedRequirements = this.truncateText(
      jobRequirements,
      this.MAX_JOB_DETAILS_LENGTH,
    );
    const truncatedDescription = this.truncateText(
      jobDescription,
      this.MAX_JOB_DETAILS_LENGTH,
    );

    // Generate cache key
    const cacheKey = this.generateAnalysisCacheKey(
      truncatedResume,
      truncatedRequirements,
      truncatedDescription,
      industry,
      targetRole,
    );

    // Check cache
    if (useCache) {
      const cached = this.cache.get<ResumeAnalysisResult>(cacheKey);
      if (cached) {
        console.log("Analysis result retrieved from cache");
        // ✅ FIX: Ensure metadata has all required fields
        return {
          ...cached,
          metadata: {
            processingTime: Date.now() - startTime,
            modelUsed: cached.metadata?.modelUsed ?? config.GEMINI_MODEL,
            timestamp: cached.metadata?.timestamp ?? new Date().toISOString(),
            fromCache: true,
          },
        };
      }
    }

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const prompt = this.buildAnalysisPrompt(
          truncatedResume,
          truncatedRequirements,
          truncatedDescription,
          industry,
          targetRole,
        );
        const result = await this.model.generateContent(prompt);
        const cleanedText = this.cleanAIResponse(result.response.text());
        const parsed = this.parseAndValidateAnalysis(cleanedText);

        // Add metadata
        const finalResult: ResumeAnalysisResult = {
          ...parsed,
          metadata: {
            processingTime: Date.now() - startTime,
            modelUsed: config.GEMINI_MODEL,
            timestamp: new Date().toISOString(),
            fromCache: false,
          },
        };

        // Store in cache
        if (useCache) {
          this.cache.set(cacheKey, finalResult);
        }

        return finalResult;
      } catch (error) {
        lastError = error as Error;
        console.error(`Analysis attempt ${attempt + 1} failed:`, error);

        if (attempt < retryCount) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    console.error("All analysis attempts failed:", lastError);
    return this.getFallbackAnalysisResult(startTime);
  }

  /**
   * Generate career feedback for resume improvement
   */
  async generateCareerFeedback(
    resumeText: string,
    options: AnalyzeResumeOptions = {},
  ): Promise<CareerFeedbackResult> {
    const startTime = Date.now();
    const {
      retryCount = 2,
      useCache = true,
      includeDetailed = false,
      industry,
      targetRole,
    } = options;

    let lastError: Error | null = null;

    // Validate input
    this.validateResumeInput(resumeText);

    // Truncate input
    const truncatedResume = this.truncateText(
      resumeText,
      this.MAX_RESUME_LENGTH,
    );

    // Generate cache key
    const cacheKey = this.generateFeedbackCacheKey(
      truncatedResume,
      includeDetailed,
      industry,
      targetRole,
    );

    // Check cache
    if (useCache) {
      const cached = this.cache.get<CareerFeedbackResult>(cacheKey);
      if (cached) {
        console.log("Feedback result retrieved from cache");
        // ✅ FIX: Ensure metadata has all required fields
        return {
          ...cached,
          metadata: {
            processingTime: Date.now() - startTime,
            modelUsed: cached.metadata?.modelUsed ?? config.GEMINI_MODEL,
            timestamp: cached.metadata?.timestamp ?? new Date().toISOString(),
            fromCache: true,
          },
        };
      }
    }

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const prompt = this.buildFeedbackPrompt(
          truncatedResume,
          includeDetailed,
          industry,
          targetRole,
        );
        const result = await this.model.generateContent(prompt);
        const cleanedText = this.cleanAIResponse(result.response.text());
        const parsed = this.parseAndValidateFeedback(
          cleanedText,
          includeDetailed,
        );

        // Add metadata
        const finalResult: CareerFeedbackResult = {
          ...parsed,
          metadata: {
            processingTime: Date.now() - startTime,
            modelUsed: config.GEMINI_MODEL,
            timestamp: new Date().toISOString(),
            fromCache: false,
          },
        };

        // Store in cache
        if (useCache) {
          this.cache.set(cacheKey, finalResult);
        }

        return finalResult;
      } catch (error) {
        lastError = error as Error;
        console.error(`Feedback attempt ${attempt + 1} failed:`, error);

        if (attempt < retryCount) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    console.error("All feedback attempts failed:", lastError);
    return this.getFallbackFeedbackResult(startTime);
  }

  // ============ Private Helper Methods ============

  private buildAnalysisPrompt(
    resumeText: string,
    jobRequirements: string,
    jobDescription: string,
    industry?: string,
    targetRole?: string,
  ): string {
    let prompt = `
      Analyze how well this resume matches the job:
      
      RESUME:
      ${resumeText}
      
      JOB REQUIREMENTS:
      ${jobRequirements}
      
      JOB DESCRIPTION:
      ${jobDescription}
    `;

    if (industry) {
      prompt += `\nINDUSTRY: ${industry}`;
    }
    if (targetRole) {
      prompt += `\nTARGET ROLE: ${targetRole}`;
    }

    prompt += `
      
      Provide analysis in THIS EXACT JSON format:
      {
        "matchScore": number (0-100),
        "explanation": "string explaining the match",
        "matchedSkills": ["skill1", "skill2"],
        "missingSkills": ["skill3", "skill4"],
        "suggestions": ["suggestion1", "suggestion2"]
      }
      
      Be specific and helpful in your analysis.
      Return ONLY the JSON object, no other text.
    `;

    return prompt;
  }

  private buildFeedbackPrompt(
    resumeText: string,
    includeDetailed: boolean,
    industry?: string,
    targetRole?: string,
  ): string {
    let prompt = `
      Analyze this resume and provide constructive feedback:
      
      RESUME:
      ${resumeText}
    `;

    if (industry) {
      prompt += `\nINDUSTRY: ${industry}`;
    }
    if (targetRole) {
      prompt += `\nTARGET ROLE: ${targetRole}`;
    }

    prompt += `
      
      Provide feedback in THIS EXACT JSON format:
      {
        "issues": [
          {
            "type": "string (e.g., 'formatting', 'content', 'skills')",
            "description": "specific issue found",
            "location": "where in resume (e.g., 'education section', 'work experience')",
            "priority": "high | medium | low",
            "suggestion": "specific suggestion to fix this issue"
          }
        ],
        "improvements": [
          "specific actionable suggestion 1",
          "specific actionable suggestion 2"
        ],
        "missingSkills": ["skill1", "skill2", "skill3"],
        "targetRoles": ["role1", "role2", "role3"],
        "overallScore": number (0-100)
    `;

    if (includeDetailed) {
      prompt += `,
        "strengths": [
          {
            "type": "skills | experience | education | achievement | formatting",
            "description": "specific strength identified",
            "impact": "high | medium | low"
          }
        ],
        "detailedAnalysis": {
          "skillsAssessment": {
            "technical": number (0-100),
            "soft": number (0-100),
            "leadership": number (0-100)
          },
          "experienceAssessment": {
            "relevance": number (0-100),
            "depth": number (0-100),
            "progression": number (0-100)
          },
          "educationAssessment": {
            "relevance": number (0-100),
            "level": number (0-100),
            "quality": number (0-100)
          },
          "presentationAssessment": {
            "clarity": number (0-100),
            "impact": number (0-100),
            "formatting": number (0-100)
          }
        },
        "recommendations": {
          "immediate": ["action 1", "action 2"],
          "shortTerm": ["action 1", "action 2"],
          "longTerm": ["action 1", "action 2"]
        }
      `;
    }

    prompt += `
      }
      
      Focus on:
      - Future dated work experience
      - Spelling/grammar errors
      - Generic language
      - Missing technical depth
      - Missing essential developer tools (Git, GitHub, SQL, etc.)
      - Education timeline issues
      
      Return ONLY the JSON object, no other text.
    `;

    return prompt;
  }

  private cleanAIResponse(responseText: string): string {
    return responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .replace(/^[^{]*/, "")
      .replace(/[^}]*$/, "")
      .trim();
  }

  private parseAndValidateAnalysis(
    cleanedText: string,
  ): Omit<ResumeAnalysisResult, "metadata"> {
    try {
      const parsed = JSON.parse(cleanedText);

      if (typeof parsed.matchScore !== "number") {
        throw new Error("Invalid matchScore in response");
      }

      return {
        matchScore: Math.min(100, Math.max(0, parsed.matchScore)),
        explanation: parsed.explanation || "No explanation provided",
        matchedSkills: Array.isArray(parsed.matchedSkills)
          ? parsed.matchedSkills
          : [],
        missingSkills: Array.isArray(parsed.missingSkills)
          ? parsed.missingSkills
          : [],
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions
          : [],
      };
    } catch (error) {
      console.error("Failed to parse analysis result:", error);
      throw new Error("Invalid response format from AI");
    }
  }

  private parseAndValidateFeedback(
    cleanedText: string,
    includeDetailed: boolean,
  ): Omit<CareerFeedbackResult, "metadata"> {
    try {
      const parsed = JSON.parse(cleanedText);

      const result: Omit<CareerFeedbackResult, "metadata"> = {
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        improvements: Array.isArray(parsed.improvements)
          ? parsed.improvements
          : [],
        missingSkills: Array.isArray(parsed.missingSkills)
          ? parsed.missingSkills
          : [],
        targetRoles: Array.isArray(parsed.targetRoles)
          ? parsed.targetRoles
          : [],
        overallScore:
          typeof parsed.overallScore === "number"
            ? Math.min(100, Math.max(0, parsed.overallScore))
            : 0,
      };

      // Add detailed fields if available
      if (includeDetailed && parsed.strengths) {
        (result as any).strengths = parsed.strengths;
      }
      if (includeDetailed && parsed.detailedAnalysis) {
        (result as any).detailedAnalysis = parsed.detailedAnalysis;
      }
      if (includeDetailed && parsed.recommendations) {
        (result as any).recommendations = parsed.recommendations;
      }

      return result;
    } catch (error) {
      console.error("Failed to parse feedback result:", error);
      throw new Error("Invalid response format from AI");
    }
  }

  private validateResumeInput(resumeText: string): void {
    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error("Resume text must be at least 50 characters");
    }
  }

  private validateJobInput(
    jobRequirements: string,
    jobDescription: string,
  ): void {
    if (!jobRequirements || jobRequirements.trim().length === 0) {
      throw new Error("Job requirements are required");
    }
    if (!jobDescription || jobDescription.trim().length === 0) {
      throw new Error("Job description is required");
    }
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + "... (truncated)";
  }

  private generateAnalysisCacheKey(
    resumeText: string,
    requirements: string,
    description: string,
    industry?: string,
    targetRole?: string,
  ): string {
    const data = {
      resumeHash: this.hashString(resumeText.substring(0, 500)),
      requirementsHash: this.hashString(requirements.substring(0, 200)),
      descriptionHash: this.hashString(description.substring(0, 200)),
      industry: industry || "none",
      targetRole: targetRole || "none",
    };
    return `analysis:${JSON.stringify(data)}`;
  }

  private generateFeedbackCacheKey(
    resumeText: string,
    includeDetailed: boolean,
    industry?: string,
    targetRole?: string,
  ): string {
    const data = {
      resumeHash: this.hashString(resumeText.substring(0, 500)),
      includeDetailed,
      industry: industry || "none",
      targetRole: targetRole || "none",
    };
    return `feedback:${JSON.stringify(data)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  private getFallbackAnalysisResult(startTime?: number): ResumeAnalysisResult {
    const result: ResumeAnalysisResult = {
      matchScore: 0,
      explanation: "Analysis temporarily unavailable. Please try again later.",
      matchedSkills: [],
      missingSkills: [],
      suggestions: [
        "Please try again later",
        "Ensure your resume text is properly formatted",
      ],
    };

    if (startTime) {
      result.metadata = {
        processingTime: Date.now() - startTime,
        modelUsed: config.GEMINI_MODEL,
        timestamp: new Date().toISOString(),
        fromCache: false,
      };
    }

    return result;
  }

  private getFallbackFeedbackResult(startTime?: number): CareerFeedbackResult {
    const result: CareerFeedbackResult = {
      issues: [
        {
          type: "system",
          description: "Feedback service temporarily unavailable",
          location: "N/A",
          priority: "high",
          suggestion: "Please try again later",
        },
      ],
      improvements: ["Please try again later"],
      missingSkills: [],
      targetRoles: [],
      overallScore: 0,
    };

    if (startTime) {
      result.metadata = {
        processingTime: Date.now() - startTime,
        modelUsed: config.GEMINI_MODEL,
        timestamp: new Date().toISOString(),
        fromCache: false,
      };
    }

    return result;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============ Public Utility Methods ============

  /**
   * Get service status
   */
  getServiceStatus(): {
    status: string;
    model: string;
    cacheSize: number;
  } {
    return {
      status: "healthy",
      model: config.GEMINI_MODEL,
      cacheSize: this.cache.keys().length,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.flushAll();
    console.log("Resume analyzer cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    keys: string[];
    size: number;
    stats: NodeCache.Stats;
  } {
    const keys = this.cache.keys();
    return {
      keys,
      size: keys.length,
      stats: this.cache.getStats(),
    };
  }
}

export default new ResumeAnalyzerService();
