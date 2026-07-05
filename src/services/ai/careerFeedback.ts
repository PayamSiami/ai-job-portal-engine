// src/services/ai/careerFeedback.ts
import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerationConfig,
} from "@google/generative-ai";
import NodeCache from "node-cache";
import { config } from "../../config/index.js";

// ============ Type Definitions ============

export interface CareerFeedbackOptions {
  retryCount?: number;
  useCache?: boolean;
  includeDetailed?: boolean;
  industry?: string;
  targetRole?: string;
}

export interface CareerIssue {
  type:
    | "formatting"
    | "content"
    | "skills"
    | "experience"
    | "education"
    | "grammar"
    | "structure"
    | "impact";
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

// ============ Service Class ============

class CareerFeedbackService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private cache: NodeCache;
  private readonly MAX_RESUME_LENGTH = 5000;

  constructor() {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required in environment variables");
    }

    this.genAI = new GoogleGenerativeAI(apiKey);

    const generationConfig: GenerationConfig = {
      temperature: 0.3,
      topK: 1,
      topP: 0.9,
      maxOutputTokens: 1500,
    };

    this.model = this.genAI.getGenerativeModel({
      model: config.GEMINI_MODEL,
      generationConfig,
    });

    // Initialize cache with 10 minute TTL
    this.cache = new NodeCache({
      stdTTL: 600,
      checkperiod: 120,
    });
  }

  /**
   * Generate comprehensive career feedback from a resume
   */
  async generateCareerFeedback(
    resumeText: string,
    options: CareerFeedbackOptions = {},
  ): Promise<CareerFeedbackResult> {
    const startTime = Date.now();
    const {
      retryCount = 2,
      useCache = true,
      includeDetailed = true,
      industry,
      targetRole,
    } = options;

    // Validate input
    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error("Resume text must be at least 50 characters");
    }

    // Truncate if too long
    const truncatedResume = this.truncateText(
      resumeText,
      this.MAX_RESUME_LENGTH,
    );

    // Generate cache key
    const cacheKey = this.generateCacheKey(
      truncatedResume,
      industry,
      targetRole,
    );

    // Check cache
    if (useCache) {
      const cachedResult = this.cache.get<CareerFeedbackResult>(cacheKey);
      if (cachedResult) {
        if (cachedResult.metadata) {
          cachedResult.metadata.fromCache = true;
        }
        return cachedResult;
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const prompt = this.buildFeedbackPrompt(
          truncatedResume,
          industry,
          targetRole,
          includeDetailed,
        );

        const result = await this.model.generateContent(prompt);
        const cleanedText = this.cleanAIResponse(result.response.text());
        const parsed = this.parseFeedbackResult(cleanedText, includeDetailed);

        // Add metadata
        const metadata: CareerFeedbackResult["metadata"] = {
          processingTime: Date.now() - startTime,
          modelUsed: config.GEMINI_MODEL,
          timestamp: new Date().toISOString(),
          fromCache: false,
        };

        const finalResult = {
          ...parsed,
          metadata,
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
    return this.getFallbackResult(lastError?.message);
  }

  /**
   * Get quick career feedback summary
   */
  async getQuickFeedback(
    resumeText: string,
    industry?: string,
  ): Promise<{
    overallScore: number;
    topIssues: string[];
    topStrengths: string[];
    recommendations: string[];
  }> {
    const fullFeedback = await this.generateCareerFeedback(resumeText, {
      includeDetailed: false,
      industry,
    });

    return {
      overallScore: fullFeedback.overallScore,
      topIssues: fullFeedback.issues
        .sort((a, b) => {
          const priority = { high: 3, medium: 2, low: 1 };
          return priority[b.priority] - priority[a.priority];
        })
        .slice(0, 3)
        .map((i) => i.description),
      topStrengths: fullFeedback.strengths
        .slice(0, 3)
        .map((s) => s.description),
      recommendations: fullFeedback.recommendations.immediate.slice(0, 3),
    };
  }

  /**
   * Compare two resumes and provide improvement analysis
   */
  async compareResumes(
    originalResume: string,
    improvedResume: string,
  ): Promise<{
    scoreImprovement: number;
    improvements: string[];
    remainingIssues: string[];
    overallAssessment: string;
  }> {
    const prompt = `
      Compare these two resumes and analyze the improvements:

      ORIGINAL RESUME:
      ${this.truncateText(originalResume, 3000)}

      IMPROVED RESUME:
      ${this.truncateText(improvedResume, 3000)}

      Return ONLY this JSON format:
      {
        "scoreImprovement": number (0-100 improvement),
        "improvements": ["list of specific improvements made"],
        "remainingIssues": ["issues that still need to be addressed"],
        "overallAssessment": "brief overall assessment of the improvement"
      }
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const cleanedText = this.cleanAIResponse(result.response.text());
      return JSON.parse(cleanedText);
    } catch (error) {
      console.error("Resume comparison failed:", error);
      return {
        scoreImprovement: 0,
        improvements: ["Unable to compare resumes at this time"],
        remainingIssues: ["Please try again later"],
        overallAssessment: "Comparison temporarily unavailable",
      };
    }
  }

  // ============ Private Helper Methods ============

  private buildFeedbackPrompt(
    resumeText: string,
    industry?: string,
    targetRole?: string,
    includeDetailed: boolean = true,
  ): string {
    let prompt = `
      Analyze this resume and provide comprehensive career feedback:

      RESUME:
      ${resumeText}

      ${industry ? `INDUSTRY: ${industry}` : ""}
      ${targetRole ? `TARGET ROLE: ${targetRole}` : ""}

      Provide a detailed analysis with constructive feedback.
    `;

    if (includeDetailed) {
      prompt += `
        Return ONLY this JSON format:
        {
          "issues": [
            {
              "type": "formatting | content | skills | experience | education | grammar | structure | impact",
              "description": "specific issue found",
              "location": "where in resume (e.g., 'education section', 'work experience')",
              "priority": "high | medium | low",
              "suggestion": "specific suggestion to fix this issue"
            }
          ],
          "strengths": [
            {
              "type": "skills | experience | education | achievement | formatting",
              "description": "specific strength identified",
              "impact": "high | medium | low"
            }
          ],
          "improvements": [
            "specific actionable suggestion 1",
            "specific actionable suggestion 2"
          ],
          "missingSkills": ["skill1", "skill2", "skill3"],
          "targetRoles": ["role1", "role2", "role3"],
          "overallScore": number (0-100),
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
        }

        Focus on:
        - Content quality and relevance
        - Skills alignment with industry standards
        - Experience presentation and impact
        - Education and certifications
        - Grammar and formatting issues
        - Missing essential skills
        - Career progression and growth potential
        - Actionable recommendations for improvement
      `;
    } else {
      prompt += `
        Return ONLY this JSON format:
        {
          "issues": [
            {
              "type": "formatting | content | skills | experience | education | grammar | structure | impact",
              "description": "specific issue found",
              "location": "where in resume",
              "priority": "high | medium | low"
            }
          ],
          "strengths": [
            {
              "type": "skills | experience | education | achievement | formatting",
              "description": "specific strength identified",
              "impact": "high | medium | low"
            }
          ],
          "improvements": ["suggestion 1", "suggestion 2"],
          "missingSkills": ["skill1", "skill2"],
          "targetRoles": ["role1", "role2"],
          "overallScore": number (0-100),
          "recommendations": {
            "immediate": ["action 1", "action 2"],
            "shortTerm": ["action 1", "action 2"],
            "longTerm": ["action 1", "action 2"]
          }
        }
      `;
    }

    prompt += `
      Be specific, honest, and constructive in your feedback.
      Focus on actionable improvements that will help the candidate.
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

  private parseFeedbackResult(
    cleanedText: string,
    includeDetailed: boolean,
  ): CareerFeedbackResult {
    try {
      const parsed = JSON.parse(cleanedText);

      // Validate required fields
      if (typeof parsed.overallScore !== "number") {
        throw new Error("Invalid overall score in response");
      }

      const result: CareerFeedbackResult = {
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        improvements: Array.isArray(parsed.improvements)
          ? parsed.improvements
          : [],
        missingSkills: Array.isArray(parsed.missingSkills)
          ? parsed.missingSkills
          : [],
        targetRoles: Array.isArray(parsed.targetRoles)
          ? parsed.targetRoles
          : [],
        overallScore: Math.min(100, Math.max(0, parsed.overallScore)),
        recommendations: parsed.recommendations || {
          immediate: [],
          shortTerm: [],
          longTerm: [],
        },
      };

      // Add detailed analysis if available
      if (includeDetailed && parsed.detailedAnalysis) {
        result.detailedAnalysis = {
          skillsAssessment: {
            technical: Math.min(
              100,
              Math.max(
                0,
                parsed.detailedAnalysis.skillsAssessment?.technical || 0,
              ),
            ),
            soft: Math.min(
              100,
              Math.max(0, parsed.detailedAnalysis.skillsAssessment?.soft || 0),
            ),
            leadership: Math.min(
              100,
              Math.max(
                0,
                parsed.detailedAnalysis.skillsAssessment?.leadership || 0,
              ),
            ),
          },
          experienceAssessment: {
            relevance: Math.min(
              100,
              Math.max(
                0,
                parsed.detailedAnalysis.experienceAssessment?.relevance || 0,
              ),
            ),
            depth: Math.min(
              100,
              Math.max(
                0,
                parsed.detailedAnalysis.experienceAssessment?.depth || 0,
              ),
            ),
            progression: Math.min(
              100,
              Math.max(
                0,
                parsed.detailedAnalysis.experienceAssessment?.progression || 0,
              ),
            ),
          },
          educationAssessment: {
            relevance: Math.min(
              100,
              Math.max(
                0,
                parsed.detailedAnalysis.educationAssessment?.relevance || 0,
              ),
            ),
            level: Math.min(
              100,
              Math.max(
                0,
                parsed.detailedAnalysis.educationAssessment?.level || 0,
              ),
            ),
            quality: Math.min(
              100,
              Math.max(
                0,
                parsed.detailedAnalysis.educationAssessment?.quality || 0,
              ),
            ),
          },
          presentationAssessment: {
            clarity: Math.min(
              100,
              Math.max(
                0,
                parsed.detailedAnalysis.presentationAssessment?.clarity || 0,
              ),
            ),
            impact: Math.min(
              100,
              Math.max(
                0,
                parsed.detailedAnalysis.presentationAssessment?.impact || 0,
              ),
            ),
            formatting: Math.min(
              100,
              Math.max(
                0,
                parsed.detailedAnalysis.presentationAssessment?.formatting || 0,
              ),
            ),
          },
        };
      }

      return result;
    } catch (error) {
      console.error("Failed to parse feedback result:", error);
      throw new Error("Invalid response format from AI");
    }
  }

  private generateCacheKey(
    resumeText: string,
    industry?: string,
    targetRole?: string,
  ): string {
    const data = {
      resumeHash: this.hashString(resumeText.substring(0, 500)),
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

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + "... (truncated)";
  }

  private getFallbackResult(error?: string): CareerFeedbackResult {
    return {
      issues: [
        {
          type: "content",
          description: error || "Feedback service temporarily unavailable",
          location: "N/A",
          priority: "high",
          suggestion: "Please try again later",
        },
      ],
      strengths: [],
      improvements: ["Please try again later"],
      missingSkills: [],
      targetRoles: [],
      overallScore: 0,
      recommendations: {
        immediate: ["Try again later"],
        shortTerm: [],
        longTerm: [],
      },
      metadata: {
        processingTime: 0,
        modelUsed: config.GEMINI_MODEL,
        timestamp: new Date().toISOString(),
        fromCache: false,
      },
    };
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
    console.log("Career feedback cache cleared");
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

// Export singleton instance
export default new CareerFeedbackService();
