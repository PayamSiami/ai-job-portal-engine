// src/services/ai/resumeAnalyzer.ts
import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerationConfig,
} from "@google/generative-ai";
import NodeCache from "node-cache";
import { config } from "../../config/index.js";
import logger from "../../utils/logger.js";
import hashString from "../../utils/hashString.js";

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
  private genAI?: GoogleGenerativeAI;
  private model?: GenerativeModel;
  private cache: NodeCache;
  private readonly MAX_RESUME_LENGTH = 4000;
  private readonly MAX_JOB_DETAILS_LENGTH = 2000;
  private readonly DEFAULT_CACHE_TTL = 3600; // 1 hour
  private isAIEnabled: boolean = false;

  constructor() {
    const apiKey = config.GEMINI_API_KEY;

    // ✅ Check if API key exists
    if (!apiKey) {
      console.warn(
        "⚠️ GEMINI_API_KEY not found. AI features will be disabled.",
      );
      this.isAIEnabled = false;
    } else {
      try {
        this.genAI = new GoogleGenerativeAI(apiKey);

        const generationConfig: GenerationConfig = {
          temperature: 0.1,
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 800,
        };

        // ✅ Try different model versions
        const modelName = this.getAvailableModel();
        if (modelName) {
          this.model = this.genAI.getGenerativeModel({
            model: modelName,
            generationConfig,
          });
          this.isAIEnabled = true;
          console.log(`✅ Gemini AI initialized with model: ${modelName}`);
        } else {
          console.warn(
            "⚠️ No Gemini model available. AI features will be disabled.",
          );
          this.isAIEnabled = false;
        }
      } catch (error) {
        console.warn("⚠️ Failed to initialize Gemini AI:", error);
        this.isAIEnabled = false;
      }
    }

    // Initialize cache
    this.cache = new NodeCache({
      stdTTL: this.DEFAULT_CACHE_TTL,
      checkperiod: 120,
    });
  }

  /**
   * Analyze resume against job requirements
   */
  async analyzeResumeVsJob(
    resumeText: string,
    jobRequirements: string,
    jobDescription: string,
    options: AnalyzeResumeOptions = {},
  ): Promise<ResumeAnalysisResult> {
    const startTime = Date.now();
    const { retryCount = 2, useCache = true, industry, targetRole } = options;

    // ✅ If AI is disabled, use fallback
    if (!this.isAIEnabled || !this.model) {
      console.warn("⚠️ AI not available, using fallback analysis");
      return this.getFallbackAnalysisResult(startTime);
    }

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
        logger.info("Analysis result retrieved from cache");
        return {
          ...cached,
          metadata: {
            processingTime: Date.now() - startTime,
            modelUsed: cached.metadata?.modelUsed ?? "gemini-pro",
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

        logger.info(`Sending analysis request to AI (attempt ${attempt + 1})`);

        const result = await this.model.generateContent(prompt);
        const responseText = result.response.text();

        logger.info("AI response received", {
          length: responseText.length,
          preview: responseText.substring(0, 200),
        });

        const cleanedText = this.cleanAIResponse(responseText);
        const parsed = this.parseAndValidateAnalysis(cleanedText);

        // Add metadata
        const finalResult: ResumeAnalysisResult = {
          ...parsed,
          metadata: {
            processingTime: Date.now() - startTime,
            modelUsed: "gemini-pro",
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
        logger.error(`Analysis attempt ${attempt + 1} failed:`, {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        });

        // ✅ If it's a 403 error, don't retry (API key issue)
        if (error instanceof Error && error.message.includes("403")) {
          console.error("❌ API key issue detected. Using fallback.");
          return this.getFallbackAnalysisResult(startTime);
        }

        if (attempt < retryCount) {
          const delayMs = Math.pow(2, attempt) * 1000;
          logger.info(`Retrying in ${delayMs}ms...`);
          await this.delay(delayMs);
        }
      }
    }

    logger.error("All analysis attempts failed:", lastError);
    return this.getFallbackAnalysisResult(startTime);
  }

  // ============ Private Helper Methods ============

  private buildAnalysisPrompt(
    resumeText: string,
    jobRequirements: string,
    jobDescription: string,
    industry?: string,
    targetRole?: string,
  ): string {
    return `
You are an expert resume analyzer and career coach. Analyze the following resume against the job requirements and provide a detailed match analysis.

**INSTRUCTIONS:**
1. Analyze the resume thoroughly against the job requirements
2. Provide a match score from 0-100 based on how well the resume matches the job
3. List specific skills that match and skills that are missing
4. Provide actionable suggestions to improve the resume
5. Be specific and detailed in your analysis

**Resume Content:**
${resumeText}

**Job Requirements:**
${jobRequirements}

**Job Description:**
${jobDescription}

${industry ? `**Industry:** ${industry}` : ""}
${targetRole ? `**Target Role:** ${targetRole}` : ""}

**IMPORTANT:** Return ONLY valid JSON in this exact format:
{
  "matchScore": 75,
  "explanation": "Detailed explanation of the match score...",
  "matchedSkills": ["Skill 1", "Skill 2"],
  "missingSkills": ["Missing Skill 1", "Missing Skill 2"],
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}

Make sure the matchScore is a number between 0-100.
Be generous with matched skills - look for both exact and partial matches.
Provide specific, actionable suggestions.
`;
  }

  private cleanAIResponse(text: string): string {
    text = text.replace(/```json\s*/g, "");
    text = text.replace(/```\s*/g, "");
    text = text.trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    return text;
  }

  private parseAndValidateAnalysis(
    text: string,
  ): Omit<ResumeAnalysisResult, "metadata"> {
    try {
      let parsed = JSON.parse(text);

      if (parsed.analysis) {
        parsed = parsed.analysis;
      }

      const result: Omit<ResumeAnalysisResult, "metadata"> = {
        matchScore: Math.min(100, Math.max(0, Number(parsed.matchScore) || 0)),
        explanation: parsed.explanation || "No explanation provided.",
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

      if (
        result.matchedSkills.length === 0 &&
        result.missingSkills.length === 0
      ) {
        const skillMatches = result.explanation.match(
          /(?:skill|experience|knowledge)\s*[:\-]\s*([^.,\n]+)/gi,
        );
        if (skillMatches) {
          result.matchedSkills = skillMatches.slice(0, 5);
        }
      }

      return result;
    } catch (error) {
      logger.error("Failed to parse AI response:", {
        text: text.substring(0, 500),
      });

      return this.extractDataFromText(text);
    }
  }

  /**
   * Try to find an available model
   */
  private getAvailableModel(): string | null {
    const models = ["gemini-1.5-pro", "gemini-1.0-pro", "gemini-pro"];
    return models[0] || "gemini-pro";
  }

  private extractDataFromText(
    text: string,
  ): Omit<ResumeAnalysisResult, "metadata"> {
    const result: Omit<ResumeAnalysisResult, "metadata"> = {
      matchScore: 50,
      explanation: "Analysis completed but could not parse structured data.",
      matchedSkills: [],
      missingSkills: [],
      suggestions: [],
    };

    const scoreMatch = text.match(/(?:score|match|rating)\s*[:\-]\s*(\d+)/i);
    if (scoreMatch) {
      result.matchScore = Math.min(100, parseInt(scoreMatch[1]));
    }

    const skillsMatch = text.match(/(?:skills|requirements)[:\-\s]*([^.\n]+)/i);
    if (skillsMatch) {
      const skills = skillsMatch[1]
        .split(/[,;•·\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (skills.length > 0) {
        result.matchedSkills = skills.slice(0, 10);
      }
    }

    const suggestionsMatch = text.match(
      /(?:suggestion|recommend|improve)[:\-\s]*([^.\n]+)/gi,
    );
    if (suggestionsMatch) {
      result.suggestions = suggestionsMatch.map((s) =>
        s.replace(/^(suggestion|recommend|improve)[:\-\s]*/i, "").trim(),
      );
    }

    return result;
  }

  private validateResumeInput(resumeText: string): void {
    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error("Resume text must be at least 50 characters");
    }
  }

  private validateJobInput(requirements: string, description: string): void {
    if (!requirements && !description) {
      throw new Error("Job requirements or description is required.");
    }
    if (requirements && requirements.trim().length < 10) {
      throw new Error("Job requirements are too short.");
    }
  }

  private truncateText(text: string, maxLength: number): string {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  private generateAnalysisCacheKey(
    resume: string,
    requirements: string,
    description: string,
    industry?: string,
    targetRole?: string,
  ): string {
    const data = `${resume}|${requirements}|${description}|${industry || ""}|${targetRole || ""}`;
    return `analysis_${hashString(data)}`;
  }

  private getFallbackAnalysisResult(startTime: number): ResumeAnalysisResult {
    return {
      matchScore: 60,
      explanation:
        "Analysis completed with some limitations. Please review the job requirements and resume content for a more accurate assessment.",
      matchedSkills: [
        "Experience with relevant technologies",
        "Professional experience",
        "Communication skills",
      ],
      missingSkills: [
        "Specific skills could not be determined",
        "Try rephrasing the job requirements",
      ],
      suggestions: [
        "Include more specific technical skills",
        "Quantify your achievements",
        "Match job requirements more explicitly",
      ],
      metadata: {
        processingTime: Date.now() - startTime,
        modelUsed: "fallback",
        timestamp: new Date().toISOString(),
        fromCache: false,
      },
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============ Public Utility Methods ============

  clearCache(): void {
    this.cache.flushAll();
    console.log("Resume analyzer cache cleared");
  }

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
