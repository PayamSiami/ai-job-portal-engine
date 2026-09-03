// src/services/ai/coverLetterGenerator.ts
import NodeCache from "node-cache";
import { config } from "../../config/index";
import logger from "../../utils/logger";
import hashString from "../../utils/hashString";
import {
  completePrompt,
  isAIConfigured,
  aiLanguageName,
  truncateForPrompt,
  aiDelay,
} from "./aiClient";

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
  /** Output language, e.g. "fa" (Farsi/Persian). Defaults to "fa" (Farsi). */
  language?: string;
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

// ============ Service Class ============

class CoverLetterGeneratorService {
  private cache: NodeCache;
  private readonly DEFAULT_MAX_WORDS = 250;
  private readonly MAX_RESUME_LENGTH = 4000;
  private readonly MAX_JOB_DETAILS_LENGTH = 3000;
  private readonly CACHE_TTL = 3600; // 1 hour
  private isAIEnabled: boolean = false;

  constructor() {
    // AI is enabled when an AI model + endpoint is configured.
    this.isAIEnabled = isAIConfigured();
    if (!this.isAIEnabled) {
      logger.warn(
        "AI_MODEL/AI_BASE_URL not configured. AI features will use fallbacks.",
      );
    }

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
      language = "fa",
      retryCount = 2,
      useCache = true,
      focusSkills,
      includeAchievements = true,
    } = options;

    // If AI is disabled, use fallback
    if (!this.isAIEnabled) {
      logger.warn("AI not available, using fallback cover letter generation");
      return this.generateFallbackCoverLetter(
        jobDetails,
        resumeText,
        tone,
        startTime,
      );
    }

    let lastError: Error | null = null;

    try {
      // Validate inputs
      this.validateInputs(jobDetails, resumeText);

      // Truncate inputs if they're too long
      const truncatedResume = truncateForPrompt(
        resumeText,
        this.MAX_RESUME_LENGTH,
        "... (truncated)",
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
        language,
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
            language,
          );

          const result = await completePrompt(
            `You are an expert cover letter writer. Write the cover letter in ${aiLanguageName(language)}. Output ONLY the finished letter body — never include planning, reasoning, or explanations.`,
            prompt,
            { temperature: 0.7, maxTokens: 800, topP: 0.9 },
          );
          if (!result.success) {
            throw new Error(result.error || "AI request failed");
          }
          const coverLetter = result.content.trim();

          // Validate the generated cover letter
          if (!coverLetter || coverLetter.length < 50) {
            throw new Error("Generated cover letter is too short or empty");
          }

          // Some reasoning models occasionally spill their planning/thinking
          // into the response instead of writing the letter. Detect and retry.
          if (this.looksLikeReasoningSpill(coverLetter)) {
            throw new Error(
              "Model returned planning text instead of a letter; retrying",
            );
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
          logger.error(`Cover letter generation attempt ${attempt + 1} failed`, {
            error,
          });

          // If it's a 403 error, don't retry (API key issue)
          if (error instanceof Error && error.message.includes("403")) {
            logger.error("API key issue detected. Using fallback.");
            return this.generateFallbackCoverLetter(
              jobDetails,
              resumeText,
              tone,
              startTime,
            );
          }

          if (attempt < retryCount) {
            await aiDelay(Math.pow(2, attempt) * 1000);
          }
        }
      }

      logger.error("All cover letter generation attempts failed", {
        error: lastError?.message,
      });
      return this.generateFallbackCoverLetter(
        jobDetails,
        resumeText,
        tone,
        startTime,
      );
    } catch (error) {
      logger.error("Error generating cover letter", { error });
      return this.generateFallbackCoverLetter(
        jobDetails,
        resumeText,
        tone,
        startTime,
      );
    }
  }

  /**
   * Generate fallback cover letter without AI
   */
  private generateFallbackCoverLetter(
    jobDetails: JobDetails,
    resumeText: string,
    tone: string,
    startTime: number,
  ): CoverLetterResult {
    // Extract name from resume (simple heuristic)
    const nameMatch = resumeText.match(/[A-Z][a-z]+ [A-Z][a-z]+/);
    const name = nameMatch ? nameMatch[0] : "Candidate";

    // Extract skills from resume
    const skills = this.extractSkills(resumeText);

    // Build a template-based cover letter
    const templates: Record<string, string> = {
      professional: `
Dear Hiring Manager,

I am writing to express my interest in the ${jobDetails.title} position at ${jobDetails.company}. With my background in ${skills.slice(0, 3).join(", ") || "this field"}, I am confident in my ability to contribute to your team.

Throughout my career, I have developed strong skills in ${skills.join(", ") || "various aspects of this profession"}. I am particularly drawn to this role because of ${jobDetails.company}'s reputation for excellence and innovation.

I would welcome the opportunity to discuss how my qualifications align with the needs of ${jobDetails.company}. Thank you for your time and consideration.

Sincerely,
${name}
      `.trim(),

      enthusiastic: `
Dear Hiring Manager,

I am thrilled to apply for the ${jobDetails.title} position at ${jobDetails.company}! As someone who is passionate about ${skills.slice(0, 2).join(" and ") || "this field"}, I have been following ${jobDetails.company}'s work with great interest.

I bring ${skills.join(", ") || "relevant experience"} that I believe would make me a valuable addition to your team. I am excited about the opportunity to contribute to ${jobDetails.company}'s continued success.

I would love to discuss how my energy and expertise can benefit your organization. Thank you for considering my application.

Best regards,
${name}
      `.trim(),
    };

    const content =
      templates[tone as keyof typeof templates] || templates.professional;

    return this.formatResult(content, true, undefined, tone, startTime);
  }

  /**
   * Extract skills from resume text
   */
  private extractSkills(resumeText: string): string[] {
    const commonSkills = [
      "JavaScript",
      "TypeScript",
      "Python",
      "React",
      "Node.js",
      "HTML",
      "CSS",
      "Git",
      "Docker",
      "AWS",
      "MongoDB",
      "PostgreSQL",
      "Leadership",
      "Communication",
      "Problem Solving",
      "Team Management",
      "Project Management",
      "Agile",
      "Scrum",
      "Jira",
      "CI/CD",
      "REST API",
      "GraphQL",
      "Express.js",
      "Next.js",
      "Vue.js",
    ];

    const foundSkills: string[] = [];
    for (const skill of commonSkills) {
      if (resumeText.toLowerCase().includes(skill.toLowerCase())) {
        foundSkills.push(skill);
      }
    }

    return foundSkills.length > 0
      ? foundSkills.slice(0, 5)
      : ["professional experience", "dedication", "team collaboration"];
  }

  /**
   * Validate inputs
   */
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

  /**
   * Build the AI prompt
   */
  private buildPrompt(
    jobDetails: JobDetails,
    resumeText: string,
    maxWords: number,
    tone: string,
    focusSkills?: string[],
    includeAchievements: boolean = true,
    language: string = "fa",
  ): string {
    const langLabel = aiLanguageName(language);

    // Keep the prompt short and directive. A verbose prompt makes reasoning
    // models plan out loud instead of writing the letter, which pollutes the
    // output. Explicitly tell the model to output ONLY the finished letter.
    let prompt = `
Write the finished cover letter now, directly in ${langLabel} (${language}) — no planning, no commentary, no meta-text. Output ONLY the letter body.

ROLE: ${jobDetails.title} at ${jobDetails.company}, ${jobDetails.location}
REQUIREMENTS: ${jobDetails.requirements}
DESCRIPTION: ${jobDetails.description}

CANDIDATE: ${resumeText}

RULES:
- Entire letter in ${langLabel}. Keep the candidate's skills and technical terms as-is.
- ~${maxWords} words, 3-4 paragraphs, formal "${tone}" tone.
- Use a proper ${langLabel} salutation and closing. Highlight 2-3 relevant skills${includeAchievements ? " and one real achievement" : ""}. End with a call to action. First person.
- No placeholders like [Your Name].
`;

    if (focusSkills && focusSkills.length > 0) {
      prompt += `\nFocus on these skills: ${focusSkills.join(", ")}`;
    }

    return prompt;
  }

  /**
   * Format the result
   */
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
        modelUsed: this.isAIEnabled ? config.AI_MODEL : "fallback",
        timestamp: new Date().toISOString(),
        fromCache: false,
        tone: tone || "professional",
        wordCount,
      };
    }

    return result;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  /**
   * Heuristic to detect when a reasoning model spilled its internal planning
   * into the output instead of writing the actual letter. These texts contain
   * meta-instructions / outlines rather than a finished letter.
   */
  private looksLikeReasoningSpill(text: string): boolean {
    const reasoningMarkers = [
      "I need to",
      "Let me",
      "let me",
      "I should",
      "I will write",
      "Now, write",
      "Structure the letter",
      "Outline:",
      "Outline of",
      "First paragraph",
      "First, the",
      "The rules say",
      "the rules say",
      "As per the instruction",
      "Word count:",
      "Count words",
      "paragraph structure",
      "I'll start with",
      "I will start with",
      "In terms of structure",
      "Let's begin",
      "Finally, close",
      "Declare the position",
    ];

    // If no salutation-like opening is present and reasoning markers are
    // abundant, treat it as a spill.
    const markerHits = reasoningMarkers.filter((m) =>
      text.toLowerCase().includes(m.toLowerCase()),
    ).length;

    return markerHits >= 2 || (text.length > 400 && text.length < 3000 && markerHits >= 1);
  }

  /**
   * Truncate job details
   */
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
        truncated[field] = truncateForPrompt(
          truncated[field],
          maxLength / 2,
          "... (truncated)",
        );
      }
    }

    return truncated;
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(
    jobDetails: JobDetails,
    resumeText: string,
    maxWords: number,
    tone: string,
    focusSkills?: string[],
    language?: string,
  ): string {
    const data = {
      jobHash: hashString(
        `${jobDetails.title}|${jobDetails.company}|${jobDetails.requirements.substring(0, 100)}`,
      ),
      resumeHash: hashString(resumeText.substring(0, 500)),
      maxWords,
      tone,
      language: language || "fa",
      focusSkills: focusSkills || [],
    };
    return `coverletter:${JSON.stringify(data)}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.flushAll();
    logger.info("Cover letter cache cleared");
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
