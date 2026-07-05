// src/services/ai/coverLetterGenerator.ts
import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerationConfig,
} from "@google/generative-ai";
import NodeCache from "node-cache";
import { config } from "../../config/index.js";

// ============ Type Definitions ============

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
  estimatedReadTime: number; // in seconds
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

// ============ Service Class ============

class CoverLetterGeneratorService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private cache: NodeCache;
  private readonly DEFAULT_MAX_WORDS = 250;
  private readonly MAX_RESUME_LENGTH = 4000;
  private readonly MAX_JOB_DETAILS_LENGTH = 3000;
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor() {
    const apiKey = config.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required in environment variables");
    }

    this.genAI = new GoogleGenerativeAI(apiKey);

    const generationConfig: GenerationConfig = {
      temperature: 0.7,
      topK: 1,
      topP: 0.9,
      maxOutputTokens: 600,
    };

    this.model = this.genAI.getGenerativeModel({
      model: config.GEMINI_MODEL,
      generationConfig,
    });

    // Initialize cache
    this.cache = new NodeCache({
      stdTTL: this.CACHE_TTL,
      checkperiod: 120,
    });
  }

  /**
   * Generate a tailored cover letter based on job details and resume
   */
  async generateCoverLetter(
    jobDetails: JobDetails,
    resumeText: string,
    options: CoverLetterOptions = {},
  ): Promise<CoverLetterResult> {
    const startTime = Date.now();
    const {
      maxWords = this.DEFAULT_MAX_WORDS,
      tone = "professional",
      retryCount = 2,
      useCache = true,
      focusSkills,
      includeAchievements = true,
    } = options;

    let lastError: Error | null = null;

    // Validate inputs
    this.validateInputs(jobDetails, resumeText);

    // Truncate inputs if they're too long
    const truncatedResume = this.truncateText(
      resumeText,
      this.MAX_RESUME_LENGTH,
    );
    const truncatedJobDetails = this.truncateJobDetails(
      jobDetails,
      this.MAX_JOB_DETAILS_LENGTH,
    );

    // Generate cache key
    const cacheKey = this.generateCacheKey(
      truncatedJobDetails,
      truncatedResume,
      maxWords,
      tone,
      focusSkills,
    );

    // Check cache
    if (useCache) {
      const cachedResult = this.cache.get<CoverLetterResult>(cacheKey);
      if (cachedResult) {
        if (cachedResult.metadata) {
          cachedResult.metadata.fromCache = true;
        }
        return cachedResult;
      }
    }

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const prompt = this.buildPrompt(
          truncatedJobDetails,
          truncatedResume,
          maxWords,
          tone,
          focusSkills,
          includeAchievements,
        );

        const result = await this.model.generateContent(prompt);
        const coverLetter = result.response.text().trim();

        // Validate the generated cover letter
        if (!coverLetter || coverLetter.length < 50) {
          throw new Error("Generated cover letter is too short or empty");
        }

        // Format result
        const formattedResult = this.formatResult(
          coverLetter,
          true,
          undefined,
          tone,
          startTime,
        );

        // Store in cache
        if (useCache) {
          this.cache.set(cacheKey, formattedResult);
        }

        return formattedResult;
      } catch (error) {
        lastError = error as Error;
        console.error(
          `Cover letter generation attempt ${attempt + 1} failed:`,
          error,
        );

        if (attempt < retryCount) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    console.error("All cover letter generation attempts failed:", lastError);
    return this.formatResult(
      "Unable to generate cover letter at this time. Please try again later.",
      false,
      lastError?.message,
      tone,
      startTime,
    );
  }

  /**
   * Generate multiple cover letter variations with different tones
   */
  async generateCoverLetterVariations(
    jobDetails: JobDetails,
    resumeText: string,
    count: number = 3,
  ): Promise<CoverLetterVariation[]> {
    const tones: Array<
      "professional" | "enthusiastic" | "formal" | "casual" | "confident"
    > = ["professional", "enthusiastic", "confident", "formal", "casual"];

    const results: CoverLetterVariation[] = [];
    const selectedTones = tones.slice(0, Math.min(count, tones.length));

    for (const tone of selectedTones) {
      try {
        const result = await this.generateCoverLetter(jobDetails, resumeText, {
          tone,
        });

        // Score the variation (simple scoring based on length and content quality)
        const score = this.scoreCoverLetter(result.content);

        results.push({
          tone,
          result,
          score,
        });
      } catch (error) {
        console.error(`Failed to generate ${tone} variation:`, error);
      }
    }

    // Sort by score descending
    return results.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * Generate a cover letter in multiple languages
   */
  async generateMultilingualCoverLetter(
    jobDetails: JobDetails,
    resumeText: string,
    languages: string[],
  ): Promise<Record<string, CoverLetterResult>> {
    const results: Record<string, CoverLetterResult> = {};

    for (const language of languages) {
      try {
        const prompt = this.buildMultilingualPrompt(
          jobDetails,
          resumeText,
          language,
        );

        const result = await this.model.generateContent(prompt);
        const coverLetter = result.response.text().trim();

        results[language] = this.formatResult(
          coverLetter,
          true,
          undefined,
          "professional",
        );
      } catch (error) {
        console.error(`Failed to generate ${language} cover letter:`, error);
        results[language] = this.formatResult(
          `Unable to generate cover letter in ${language}`,
          false,
          error instanceof Error ? error.message : "Unknown error",
          "professional",
        );
      }
    }

    return results;
  }

  // ============ Private Helper Methods ============

  private buildPrompt(
    jobDetails: JobDetails,
    resumeText: string,
    maxWords: number,
    tone: string,
    focusSkills?: string[],
    includeAchievements: boolean = true,
  ): string {
    const toneDescriptions = {
      professional:
        "formal and business-like, highlighting qualifications professionally",
      enthusiastic:
        "energetic and passionate, showing genuine excitement for the role",
      formal: "traditional and respectful, using formal business language",
      casual:
        "friendly and approachable, while still maintaining professionalism",
      confident:
        "assertive and self-assured, demonstrating strong belief in your abilities",
    };

    let prompt = `
      Write a ${tone} cover letter for the following position.

      JOB DETAILS:
      Title: ${jobDetails.title}
      Company: ${jobDetails.company}
      Location: ${jobDetails.location}
      ${jobDetails.hiringManager ? `Hiring Manager: ${jobDetails.hiringManager}` : ""}
      ${jobDetails.industry ? `Industry: ${jobDetails.industry}` : ""}
      ${jobDetails.companyCulture ? `Company Culture: ${jobDetails.companyCulture}` : ""}
      
      Key Requirements:
      ${jobDetails.requirements}
      
      Job Description:
      ${jobDetails.description}
      
      CANDIDATE RESUME:
      ${resumeText}
      
      COVER LETTER REQUIREMENTS:
      - Maximum ${maxWords} words
      - Use "${toneDescriptions[tone as keyof typeof toneDescriptions] || "professional"}" tone
      - Address hiring manager professionally (use "Dear Hiring Manager" if name unknown)
    `;

    if (focusSkills && focusSkills.length > 0) {
      prompt += `\n- Focus on these specific skills: ${focusSkills.join(", ")}`;
    }

    prompt += `
      - Highlight 2-3 most relevant skills from the resume
      ${includeAchievements ? "- Include at least one specific achievement or example from the resume" : ""}
      - Show enthusiasm for both the role and company
      - End with a professional call to action
      - Write in first person
      - Use proper paragraph structure (3-4 paragraphs)
      
      IMPORTANT: 
      - Do NOT include placeholders like [Your Name] or [Your Contact Info]
      - Write as if you are the candidate applying for this specific role
      - Make it unique and tailored, not generic
      - Use specific details from the job description to show you've done your research
      
      Return ONLY the cover letter text, no additional commentary.
    `;

    return prompt;
  }

  private buildMultilingualPrompt(
    jobDetails: JobDetails,
    resumeText: string,
    language: string,
  ): string {
    return `
      Write a professional cover letter in ${language} for the following position.

      JOB DETAILS:
      Title: ${jobDetails.title}
      Company: ${jobDetails.company}
      Location: ${jobDetails.location}
      
      Key Requirements:
      ${jobDetails.requirements}
      
      Job Description:
      ${jobDetails.description}
      
      CANDIDATE RESUME:
      ${resumeText}
      
      Requirements:
      - Write in ${language}
      - Professional tone
      - 3-4 paragraphs
      - Highlight relevant skills and experience
      - End with a call to action
      
      Return ONLY the cover letter text in ${language}.
    `;
  }

  private validateInputs(jobDetails: JobDetails, resumeText: string): void {
    if (!jobDetails.title || jobDetails.title.trim().length === 0) {
      throw new Error("Job title is required");
    }

    if (!jobDetails.company || jobDetails.company.trim().length === 0) {
      throw new Error("Company name is required");
    }

    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error("Resume text must be at least 50 characters");
    }
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

  private formatResult(
    content: string,
    success: boolean,
    error?: string,
    tone?: string,
    startTime?: number,
  ): CoverLetterResult {
    const wordCount = this.countWords(content);

    const result: CoverLetterResult = {
      content,
      wordCount,
      estimatedReadTime: Math.ceil(wordCount / 200),
      success,
      error,
    };

    if (startTime) {
      result.metadata = {
        processingTime: Date.now() - startTime,
        modelUsed: config.GEMINI_MODEL,
        timestamp: new Date().toISOString(),
        fromCache: false,
        tone: tone || "professional",
        wordCount,
      };
    }

    return result;
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateCacheKey(
    jobDetails: JobDetails,
    resumeText: string,
    maxWords: number,
    tone: string,
    focusSkills?: string[],
  ): string {
    const data = {
      jobHash: this.hashString(
        `${jobDetails.title}|${jobDetails.company}|${jobDetails.requirements.substring(0, 100)}`,
      ),
      resumeHash: this.hashString(resumeText.substring(0, 500)),
      maxWords,
      tone,
      focusSkills: focusSkills || [],
    };
    return `coverletter:${JSON.stringify(data)}`;
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

  private scoreCoverLetter(content: string): number {
    let score = 0;
    const wordCount = this.countWords(content);

    // Score based on word count (ideal: 200-250 words)
    if (wordCount >= 200 && wordCount <= 250) {
      score += 30;
    } else if (wordCount >= 150 && wordCount <= 300) {
      score += 20;
    } else {
      score += 10;
    }

    // Score based on structure (presence of paragraphs)
    const paragraphs = content
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length > 0);
    if (paragraphs.length >= 3 && paragraphs.length <= 4) {
      score += 30;
    } else if (paragraphs.length >= 2) {
      score += 20;
    }

    // Score based on professional language (simple heuristic)
    const professionalWords = [
      "experience",
      "skills",
      "achievement",
      "passionate",
      "excited",
      "opportunity",
      "contribute",
      "team",
      "collaborate",
      "results",
    ];
    const matches = professionalWords.filter((word) =>
      content.toLowerCase().includes(word),
    );
    score += Math.min(matches.length * 5, 30);

    // Score based on personalization (presence of job-specific terms)
    if (content.includes("position") || content.includes("role")) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  // ============ Public Utility Methods ============

  /**
   * Get the current service status
   */
  getServiceStatus(): { status: string; model: string; cacheSize: number } {
    return {
      status: "healthy",
      model: config.GEMINI_MODEL,
      cacheSize: this.cache.keys().length,
    };
  }

  /**
   * Check if the cover letter meets quality standards
   */
  validateCoverLetterQuality(coverLetter: string): {
    valid: boolean;
    issues: string[];
    score: number;
  } {
    const issues: string[] = [];
    let score = 0;

    if (coverLetter.length < 100) {
      issues.push("Cover letter is too short (minimum 100 characters)");
    } else {
      score += 20;
    }

    const wordCount = this.countWords(coverLetter);
    if (wordCount < 50) {
      issues.push("Cover letter has too few words (minimum 50)");
    } else if (wordCount >= 50 && wordCount < 150) {
      issues.push("Cover letter could be longer (aim for 200-250 words)");
      score += 10;
    } else if (wordCount >= 150 && wordCount <= 300) {
      score += 30;
    } else if (wordCount > 500) {
      issues.push("Cover letter is too long (maximum 500 words)");
    }

    // Check for common placeholders
    const placeholders = [
      "[Your Name]",
      "[Your Contact]",
      "[Company Name]",
      "[Job Title]",
      "[Your Email]",
      "[Your Phone]",
    ];
    const foundPlaceholders = placeholders.filter((p) =>
      coverLetter.includes(p),
    );
    if (foundPlaceholders.length > 0) {
      issues.push(`Contains placeholders: ${foundPlaceholders.join(", ")}`);
    } else {
      score += 20;
    }

    // Check for proper greeting
    if (coverLetter.includes("Dear") || coverLetter.includes("Hello")) {
      score += 15;
    } else {
      issues.push("Missing proper greeting (e.g., 'Dear Hiring Manager')");
    }

    // Check for proper closing
    if (
      coverLetter.includes("Sincerely") ||
      coverLetter.includes("Best regards") ||
      coverLetter.includes("Thank you")
    ) {
      score += 15;
    } else {
      issues.push("Missing proper closing (e.g., 'Sincerely')");
    }

    return {
      valid: issues.length === 0,
      issues,
      score: Math.min(score, 100),
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.flushAll();
    console.log("Cover letter cache cleared");
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

export default new CoverLetterGeneratorService();
