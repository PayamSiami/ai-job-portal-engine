import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerationConfig,
} from "@google/generative-ai";
import NodeCache from "node-cache";
import { config } from "../../config/index.js";

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
  company: string;
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
  recommendation:
    | "strongly recommend"
    | "recommend"
    | "consider"
    | "not recommended";
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

// ============ Service Class ============

class ApplicationScreeningService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private cache: NodeCache;
  private readonly MAX_RESUME_LENGTH = 4000;
  private readonly MAX_JOB_DETAILS_LENGTH = 3000;
  private readonly DEFAULT_WEIGHTS: ScreeningWeights = {
    skillsMatch: 0.4,
    experienceRelevance: 0.3,
    salaryAlignment: 0.15,
    availabilityTiming: 0.1,
    coverLetterQuality: 0.05,
  };

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

    // ✅ Initialize cache
    this.cache = new NodeCache({
      stdTTL: 300, // 5 minutes
      checkperiod: 600, // Check for expired entries every 10 minutes
    });
  }

  /**
   * Screen a job application and provide a score with detailed feedback
   */
  async screenApplication(
    resumeText: string,
    applicationData: ApplicationData,
    jobDetails: JobDetails,
    options: ScreeningOptions = {},
  ): Promise<ScreeningResult> {
    const startTime = Date.now();
    const {
      retryCount = 2,
      includeBreakdown = true,
      customWeights,
      useCache = true,
    } = options;

    // Validate inputs
    this.validateInputs(resumeText, applicationData, jobDetails);

    // Use custom weights if provided, otherwise use defaults
    const weights = customWeights || this.DEFAULT_WEIGHTS;
    this.validateWeights(weights);

    // Generate cache key
    const cacheKey = this.generateCacheKey(
      resumeText,
      applicationData,
      jobDetails,
      weights,
      includeBreakdown,
    );

    // Check cache
    if (useCache) {
      const cachedResult = this.cache.get<ScreeningResult>(cacheKey);
      if (cachedResult) {
        if (cachedResult.metadata) {
          cachedResult.metadata.fromCache = true;
        }
        return cachedResult;
      }
    }

    // ✅ Check if AI model is available
    if (!this.model) {
      console.warn("⚠️ AI model not available. Returning fallback result.");
      return this.getFallbackResult("AI model not initialized");
    }

    // Truncate inputs
    const truncatedResume = this.truncateText(
      resumeText,
      this.MAX_RESUME_LENGTH,
    );
    const truncatedJobDetails = this.truncateJobDetails(
      jobDetails,
      this.MAX_JOB_DETAILS_LENGTH,
    );

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const prompt = this.buildPrompt(
          truncatedResume,
          applicationData,
          truncatedJobDetails,
          weights,
          includeBreakdown,
        );

        const result = await this.model.generateContent(prompt);
        const cleanedText = this.cleanAIResponse(result.response.text());
        const parsed = this.parseScreeningResult(cleanedText, includeBreakdown);

        // Add metadata
        const metadata: ScreeningMetadata = {
          processingTime: Date.now() - startTime,
          modelUsed: config.GEMINI_MODEL,
          timestamp: new Date().toISOString(),
          fromCache: false,
        };

        // Return the complete result with all required fields
        const finalResult: ScreeningResult = {
          score: parsed.score,
          explanation: parsed.explanation,
          strengths: parsed.strengths,
          weaknesses: parsed.weaknesses,
          recommendation: parsed.recommendation,
          breakdown: parsed.breakdown,
          metadata: metadata,
        };

        // Store in cache
        if (useCache) {
          this.cache.set(cacheKey, finalResult);
        }

        return finalResult;
      } catch (error) {
        lastError = error as Error;
        console.error(`Screening attempt ${attempt + 1} failed:`, error);

        if (attempt < retryCount) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    console.error("All screening attempts failed:", lastError);
    return this.getFallbackResult(lastError?.message);
  }
  /**
   * Screen multiple applications in batch
   */
  async screenMultipleApplications(
    applications: Array<{
      resumeText: string;
      applicationData: ApplicationData;
    }>,
    jobDetails: JobDetails,
    options: ScreeningOptions = {},
  ): Promise<ScreeningResult[]> {
    const results: ScreeningResult[] = [];

    for (const app of applications) {
      try {
        const result = await this.screenApplication(
          app.resumeText,
          app.applicationData,
          jobDetails,
          options,
        );
        results.push(result);
      } catch (error) {
        console.error("Failed to screen application:", error);
        results.push(this.getFallbackResult("Batch screening failed"));
      }
    }

    return results;
  }

  /**
   * Validate if application meets minimum requirements
   */
  async validateApplication(
    resumeText: string,
    applicationData: ApplicationData,
    jobDetails: JobDetails,
  ): Promise<ValidationResult> {
    const issues: string[] = [];

    // Check resume
    if (!resumeText || resumeText.trim().length < 100) {
      issues.push("Resume is too short or missing");
    }

    // Check application data
    if (
      !applicationData.expectedSalary ||
      applicationData.expectedSalary <= 0
    ) {
      issues.push("Expected salary is missing or invalid");
    }

    if (!applicationData.availableFrom) {
      issues.push("Availability date is not specified");
    }

    // Check salary alignment
    if (jobDetails.minSalary && applicationData.expectedSalary) {
      if (applicationData.expectedSalary < jobDetails.minSalary) {
        issues.push("Expected salary is below the minimum range");
      }
      if (
        jobDetails.maxSalary &&
        applicationData.expectedSalary > jobDetails.maxSalary
      ) {
        issues.push("Expected salary exceeds the maximum range");
      }
    }

    // Check for minimum requirements in resume
    const hasRelevantKeywords = this.checkRelevantKeywords(
      resumeText,
      jobDetails.requirements,
    );
    if (!hasRelevantKeywords) {
      issues.push("Resume may not match key job requirements");
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  // ============ Cache Helper Methods ============

  /**
   * Generate cache key for screening results
   */
  private generateCacheKey(
    resumeText: string,
    applicationData: ApplicationData,
    jobDetails: JobDetails,
    weights: ScreeningWeights,
    includeBreakdown: boolean,
  ): string {
    const data = {
      resumeHash: this.hashString(resumeText.substring(0, 500)),
      applicationData: {
        expectedSalary: applicationData.expectedSalary,
        availableFrom: applicationData.availableFrom,
        coverLetter: applicationData.coverLetter?.substring(0, 100) || "",
      },
      jobDetails: {
        title: jobDetails.title,
        company: jobDetails.company,
        location: jobDetails.location,
        minSalary: jobDetails.minSalary,
        maxSalary: jobDetails.maxSalary,
      },
      weights,
      includeBreakdown,
    };
    return `screening:${JSON.stringify(data)}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.flushAll();
    console.log("Screening cache cleared");
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

  // ============ Private Helper Methods ============

  private buildPrompt(
    resumeText: string,
    applicationData: ApplicationData,
    jobDetails: JobDetails,
    weights: ScreeningWeights,
    includeBreakdown: boolean,
  ): string {
    let prompt = `
      Score this job application from 0-100 based on fit for the position.

      CANDIDATE RESUME:
      ${resumeText}
      
      APPLICATION DATA:
      Expected Salary: $${applicationData.expectedSalary || "Not specified"}
      Available From: ${applicationData.availableFrom || "Not specified"}
      Cover Letter: ${applicationData.coverLetter || "Not provided"}
      ${applicationData.currentLocation ? `Current Location: ${applicationData.currentLocation}` : ""}
      ${applicationData.workAuthorization ? `Work Authorization: ${applicationData.workAuthorization}` : ""}
      
      JOB DETAILS:
      Title: ${jobDetails.title}
      Company: ${jobDetails.company}
      Location: ${jobDetails.location}
      ${jobDetails.minSalary ? `Salary Range: $${jobDetails.minSalary} - $${jobDetails.maxSalary || "Not specified"}` : ""}
      Requirements: ${jobDetails.requirements}
      Description: ${jobDetails.description}
      ${jobDetails.department ? `Department: ${jobDetails.department}` : ""}
      ${jobDetails.employmentType ? `Employment Type: ${jobDetails.employmentType}` : ""}
      
      EVALUATION CRITERIA (with weights):
      1. Skills Match (${Math.round(weights.skillsMatch * 100)}%) - Do they have the required technical skills?
      2. Experience Relevance (${Math.round(weights.experienceRelevance * 100)}%) - Is their experience relevant?
      3. Salary Alignment (${Math.round(weights.salaryAlignment * 100)}%) - Is salary expectation within range?
      4. Availability Timing (${Math.round(weights.availabilityTiming * 100)}%) - Can they start when needed?
      5. Cover Letter Quality (${Math.round(weights.coverLetterQuality * 100)}%) - Is the cover letter compelling?
      
      Return ONLY this JSON format:
      {
        "score": number (0-100),
        "explanation": "detailed explanation of the score",
        "strengths": ["strength1", "strength2"],
        "weaknesses": ["weakness1", "weakness2"],
        "recommendation": "strongly recommend | recommend | consider | not recommended"
        ${
          includeBreakdown
            ? `,
        "breakdown": {
          "skillsMatch": number (0-100),
          "experienceRelevance": number (0-100),
          "salaryAlignment": number (0-100),
          "availabilityTiming": number (0-100),
          "coverLetterQuality": number (0-100),
          "totalScore": number (0-100)
        }`
            : ""
        }
      }
      
      Be honest, specific, and constructive in your assessment. Focus on the resume content and how well it matches the job requirements.
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

  private parseScreeningResult(
    cleanedText: string,
    includeBreakdown: boolean,
  ): ScreeningResult {
    try {
      const parsed = JSON.parse(cleanedText);

      // Validate required fields
      if (typeof parsed.score !== "number") {
        throw new Error("Invalid score in response");
      }

      const result: ScreeningResult = {
        score: Math.min(100, Math.max(0, parsed.score)),
        explanation: parsed.explanation || "No explanation provided",
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
        recommendation: this.validateRecommendation(parsed.recommendation),
      };

      // Add breakdown if present and requested
      if (includeBreakdown && parsed.breakdown) {
        result.breakdown = {
          skillsMatch: Math.min(
            100,
            Math.max(0, parsed.breakdown.skillsMatch || 0),
          ),
          experienceRelevance: Math.min(
            100,
            Math.max(0, parsed.breakdown.experienceRelevance || 0),
          ),
          salaryAlignment: Math.min(
            100,
            Math.max(0, parsed.breakdown.salaryAlignment || 0),
          ),
          availabilityTiming: Math.min(
            100,
            Math.max(0, parsed.breakdown.availabilityTiming || 0),
          ),
          coverLetterQuality: Math.min(
            100,
            Math.max(0, parsed.breakdown.coverLetterQuality || 0),
          ),
          totalScore: Math.min(
            100,
            Math.max(0, parsed.breakdown.totalScore || 0),
          ),
        };
      }

      return result;
    } catch (error) {
      console.error("Failed to parse screening result:", error);
      throw new Error("Invalid response format from AI");
    }
  }

  private validateRecommendation(
    recommendation: string,
  ): ScreeningResult["recommendation"] {
    const validRecommendations = [
      "strongly recommend",
      "recommend",
      "consider",
      "not recommended",
    ];
    if (
      recommendation &&
      validRecommendations.includes(recommendation.toLowerCase())
    ) {
      return recommendation.toLowerCase() as ScreeningResult["recommendation"];
    }
    return "consider";
  }

  private validateInputs(
    resumeText: string,
    applicationData: ApplicationData,
    jobDetails: JobDetails,
  ): void {
    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error("Resume text must be at least 50 characters");
    }

    if (!jobDetails.title || jobDetails.title.trim().length === 0) {
      throw new Error("Job title is required");
    }

    if (!jobDetails.company || jobDetails.company.trim().length === 0) {
      throw new Error("Company name is required");
    }

    if (
      !jobDetails.requirements ||
      jobDetails.requirements.trim().length === 0
    ) {
      throw new Error("Job requirements are required");
    }
  }

  private validateWeights(weights: ScreeningWeights): void {
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(total - 1) > 0.01) {
      throw new Error(`Weights must sum to 1. Current sum: ${total}`);
    }
  }

  private checkRelevantKeywords(
    resumeText: string,
    requirements: string,
  ): boolean {
    const keywords = requirements
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 20);

    const resumeLower = resumeText.toLowerCase();
    const matchedKeywords = keywords.filter((keyword) =>
      resumeLower.includes(keyword),
    );

    return matchedKeywords.length >= keywords.length * 0.3;
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + "... (truncated)";
  }

  private truncateJobDetails(
    jobDetails: JobDetails,
    maxLength: number,
  ): JobDetails {
    const combined = `${jobDetails.title} ${jobDetails.company} ${jobDetails.location} ${jobDetails.requirements} ${jobDetails.description}`;

    if (combined.length <= maxLength) {
      return jobDetails;
    }

    let truncated = { ...jobDetails };
    const fields = ["requirements", "description"] as const;

    for (const field of fields) {
      if (truncated[field] && truncated[field].length > maxLength / 2) {
        truncated[field] = this.truncateText(truncated[field], maxLength / 2);
      }
    }

    return truncated;
  }

  private getFallbackResult(error?: string): ScreeningResult {
    return {
      score: 0,
      explanation:
        error ||
        "Screening service temporarily unavailable. Please try again later.",
      strengths: [],
      weaknesses: ["Service temporarily unavailable"],
      recommendation: "consider",
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
    weights: ScreeningWeights;
    cacheSize: number;
  } {
    return {
      status: "healthy",
      model: config.GEMINI_MODEL,
      weights: this.DEFAULT_WEIGHTS,
      cacheSize: this.cache.keys().length,
    };
  }

  /**
   * Get screening statistics for a batch
   */
  getBatchStatistics(results: ScreeningResult[]): {
    averageScore: number;
    recommendations: Record<string, number>;
    scores: number[];
    highestScore: number;
    lowestScore: number;
    cachedCount: number;
  } {
    if (results.length === 0) {
      return {
        averageScore: 0,
        recommendations: {},
        scores: [],
        highestScore: 0,
        lowestScore: 0,
        cachedCount: 0,
      };
    }

    const scores = results.map((r) => r.score);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    const recommendations: Record<string, number> = {};
    let cachedCount = 0;
    results.forEach((r) => {
      recommendations[r.recommendation] =
        (recommendations[r.recommendation] || 0) + 1;
      if (r.metadata?.fromCache) {
        cachedCount++;
      }
    });

    return {
      averageScore,
      recommendations,
      scores,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      cachedCount,
    };
  }
}

export default new ApplicationScreeningService();
