// src/services/jobMatchRecommender.service.ts
import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerationConfig,
} from "@google/generative-ai";
import NodeCache from "node-cache";
import { config } from "../../config/index.js";
import hashString from "../../utils/hashString.js";

// ============ Type Definitions ============

export interface CandidateProfile {
  title: string | null;
  skills: string[];
  experienceYears: number | null;
  education: string | null;
  preferredLocation: string | null;
  preferredWorkMode: "remote" | "hybrid" | "on-site" | null;
  salaryExpectation: number | null;
  summary?: string;
  certifications?: string[];
  languages?: string[];
  industries?: string[];
}

export interface Job {
  id?: string;
  title: string;
  company: string;
  location: string;
  workMode: "remote" | "hybrid" | "on-site";
  minSalary?: number;
  maxSalary?: number;
  requirements: string;
  description: string;
  postedDate?: string;
  department?: string;
  employmentType?: "full-time" | "part-time" | "contract" | "internship";
  benefits?: string[];
  skills?: string[];
  industry?: string;
  companySize?: string;
}

export interface MatchBreakdown {
  skillsMatch: number;
  experienceMatch: number;
  salaryMatch: number;
  locationMatch: number;
  workModeMatch: number;
  totalScore: number;
}

export interface MatchMetadata {
  processingTime: number;
  modelUsed: string;
  timestamp: string;
  matchedSkills?: string[];
  missingSkills?: string[];
  fromCache?: boolean;
}

export interface JobMatchResult {
  job: Job;
  matchScore: number;
  explanation: string;
  matchQuality: "high" | "medium" | "low";
  breakdown?: MatchBreakdown;
  metadata: MatchMetadata;
}

export interface MatchOptions {
  retryCount?: number;
  minScore?: number;
  includeBreakdown?: boolean;
  batchSize?: number;
  concurrency?: number;
  useCache?: boolean;
  cacheTTL?: number;
  prioritizeSkills?: string[];
  industries?: string[];
}

export interface MatchStatistics {
  totalJobsMatched: number;
  averageScore: number;
  distribution: {
    high: number;
    medium: number;
    low: number;
  };
  topMatches: JobMatchResult[];
  recommendations: string[];
  industryInsights?: {
    topIndustries: string[];
    inDemandSkills: string[];
    salaryRange: { min: number; max: number; average: number };
  };
}

export interface BatchMatchResult {
  results: JobMatchResult[];
  stats: MatchStatistics;
  processingTime: number;
  totalJobsProcessed: number;
  cachedResults: number;
}

// ============ Service Class ============

class JobMatchRecommenderService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private cache: NodeCache;
  private readonly MAX_RESUME_LENGTH = 4000;
  private readonly MAX_JOBS_PER_BATCH = 10;
  private readonly DEFAULT_MIN_SCORE = 30;
  private readonly CONCURRENCY_LIMIT = 3;
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
      maxOutputTokens: 600,
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
   * Find jobs that match the user's resume with detailed scoring
   */
  async getJobMatches(
    resumeText: string,
    availableJobs: Job[],
    options: MatchOptions = {},
  ): Promise<JobMatchResult[]> {
    const startTime = Date.now();
    const {
      retryCount = 2,
      minScore = this.DEFAULT_MIN_SCORE,
      includeBreakdown = true,
      batchSize = this.MAX_JOBS_PER_BATCH,
      concurrency = this.CONCURRENCY_LIMIT,
      useCache = true,
    } = options;

    // Validate inputs
    this.validateInputs(resumeText, availableJobs);

    try {
      // Extract candidate profile
      const candidateProfile = await this.extractCandidateProfile(
        resumeText,
        retryCount,
        useCache,
      );

      // Score jobs in batches with concurrency control
      const jobScores = await this.scoreJobsInBatches(
        candidateProfile,
        availableJobs,
        batchSize,
        concurrency,
        retryCount,
        includeBreakdown,
        useCache,
        startTime,
      );

      // Filter and sort results
      const filteredResults = jobScores
        .filter((result) => result.matchScore >= minScore)
        .sort((a, b) => b.matchScore - a.matchScore);

      return filteredResults;
    } catch (error) {
      console.error("Job matching failed:", error);
      return this.getFallbackResults(availableJobs, error as Error);
    }
  }


  /**
   * Extract candidate profile from resume
   */
  private async extractCandidateProfile(
    resumeText: string,
    retryCount: number,
    useCache: boolean,
  ): Promise<CandidateProfile> {
    const truncatedResume = this.truncateText(
      resumeText,
      this.MAX_RESUME_LENGTH,
    );

    // Generate cache key
    const cacheKey = `profile:${hashString(truncatedResume)}`;

    // Check cache
    if (useCache) {
      const cached = this.cache.get<CandidateProfile>(cacheKey);
      if (cached) {
        console.log("Candidate profile retrieved from cache");
        return cached;
      }
    }

    const profilePrompt = `
      Extract candidate profile from this resume:
      ${truncatedResume}
      
      Return ONLY this JSON format:
      {
        "title": string or null (current/most recent job title),
        "skills": string[],
        "experienceYears": number or null,
        "education": string or null,
        "preferredLocation": string or null,
        "preferredWorkMode": string or null (remote, hybrid, on-site),
        "salaryExpectation": number or null,
        "certifications": string[],
        "languages": string[],
        "industries": string[]
      }
      
      Be thorough and extract all relevant information.
    `;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const result = await this.model.generateContent(profilePrompt);
        const cleanedText = this.cleanAIResponse(result.response.text());
        const profile = this.parseCandidateProfile(cleanedText);

        // Store in cache
        if (useCache) {
          this.cache.set(cacheKey, profile);
        }

        return profile;
      } catch (error) {
        lastError = error as Error;
        console.error(
          `Profile extraction attempt ${attempt + 1} failed:`,
          error,
        );

        if (attempt < retryCount) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new Error(
      `Failed to extract candidate profile: ${lastError?.message}`,
    );
  }

  /**
   * Score jobs in batches with concurrency control
   */
  private async scoreJobsInBatches(
    candidateProfile: CandidateProfile,
    jobs: Job[],
    batchSize: number,
    concurrency: number,
    retryCount: number,
    includeBreakdown: boolean,
    useCache: boolean,
    startTime: number,
  ): Promise<JobMatchResult[]> {
    const results: JobMatchResult[] = [];

    // Process jobs in batches
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);

      // Check cache for each job in batch
      const batchWithCache = batch.map((job) => {
        if (useCache) {
          const cacheKey = this.generateJobMatchCacheKey(
            candidateProfile,
            job,
            includeBreakdown,
          );
          const cached = this.cache.get<JobMatchResult>(cacheKey);
          if (cached) {
            return { job, cachedResult: cached };
          }
        }
        return { job, cachedResult: null };
      });

      // Process uncached jobs
      const uncachedJobs = batchWithCache.filter((item) => !item.cachedResult);

      // ✅ FIX: Properly handle cached results with complete metadata
      const cachedResults = batchWithCache
        .filter((item) => item.cachedResult)
        .map((item) => {
          const result = item.cachedResult!;
          return {
            ...result,
            metadata: {
              processingTime: result.metadata?.processingTime ?? 0,
              modelUsed: result.metadata?.modelUsed ?? config.GEMINI_MODEL,
              timestamp: result.metadata?.timestamp ?? new Date().toISOString(),
              fromCache: true,
              matchedSkills: result.metadata?.matchedSkills ?? [],
              missingSkills: result.metadata?.missingSkills ?? [],
            },
          } as JobMatchResult;
        });

      // Process uncached jobs with concurrency
      const batchPromises = uncachedJobs.map(({ job }, index) =>
        this.scoreJobWithRetry(
          candidateProfile,
          job,
          retryCount,
          includeBreakdown,
          i + index,
          useCache,
          startTime,
        ),
      );

      // Process with concurrency limit
      const batchResults = await this.processWithConcurrency(
        batchPromises,
        concurrency,
      );

      // Combine cached and new results
      const validResults = batchResults.filter(
        (r): r is JobMatchResult => r !== null,
      );
      results.push(...cachedResults, ...validResults);
    }

    return results;
  }

  /**
   * Score a single job with retry logic
   */
  private async scoreJobWithRetry(
    candidateProfile: CandidateProfile,
    job: Job,
    retryCount: number,
    includeBreakdown: boolean,
    jobIndex: number,
    useCache: boolean,
    startTime: number,
  ): Promise<JobMatchResult | null> {
    // Check cache first
    if (useCache) {
      const cacheKey = this.generateJobMatchCacheKey(
        candidateProfile,
        job,
        includeBreakdown,
      );
      const cached = this.cache.get<JobMatchResult>(cacheKey);
      if (cached) {
        console.log(`Job ${jobIndex + 1} retrieved from cache`);
        // ✅ FIX: Ensure metadata exists when returning cached result
        return {
          ...cached,
          metadata: {
            processingTime: cached.metadata?.processingTime ?? 0,
            modelUsed: cached.metadata?.modelUsed ?? config.GEMINI_MODEL,
            timestamp: cached.metadata?.timestamp ?? new Date().toISOString(),
            fromCache: true,
            matchedSkills: cached.metadata?.matchedSkills ?? [],
            missingSkills: cached.metadata?.missingSkills ?? [],
          },
        };
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const prompt = this.buildMatchPrompt(
          candidateProfile,
          job,
          includeBreakdown,
        );
        const result = await this.model.generateContent(prompt);
        const cleanedText = this.cleanAIResponse(result.response.text());

        const matchData = this.parseMatchResult(
          cleanedText,
          job,
          includeBreakdown,
          startTime,
        );

        console.log(`Job ${jobIndex + 1} scored: ${matchData.matchScore}%`);

        // Store in cache
        if (useCache) {
          const cacheKey = this.generateJobMatchCacheKey(
            candidateProfile,
            job,
            includeBreakdown,
          );
          this.cache.set(cacheKey, matchData);
        }

        return matchData;
      } catch (error) {
        lastError = error as Error;
        if (attempt < retryCount) {
          await this.delay(Math.pow(2, attempt) * 500);
        }
      }
    }

    console.error(
      `Failed to score job "${job.title}" after ${retryCount} retries:`,
      lastError,
    );
    return null;
  }

  /**
   * Get fallback results when matching fails
   */
  private getFallbackResults(jobs: Job[], error: Error): JobMatchResult[] {
    return jobs.map((job) => ({
      job,
      matchScore: 0,
      explanation: `Matching temporarily unavailable: ${error.message}`,
      matchQuality: "low",
      metadata: {
        processingTime: 0,
        modelUsed: config.GEMINI_MODEL,
        timestamp: new Date().toISOString(),
        fromCache: false,
        matchedSkills: [],
        missingSkills: [],
      },
    }));
  }

  /**
   * Build the match scoring prompt
   */
  private buildMatchPrompt(
    candidateProfile: CandidateProfile,
    job: Job,
    includeBreakdown: boolean,
  ): string {
    return `
      Score how well this candidate matches the job opening.

      CANDIDATE PROFILE:
      Title: ${candidateProfile.title || "Not specified"}
      Skills: ${JSON.stringify(candidateProfile.skills)}
      Experience: ${candidateProfile.experienceYears || "Not specified"} years
      Education: ${candidateProfile.education || "Not specified"}
      Location Preference: ${candidateProfile.preferredLocation || "Not specified"}
      Work Mode Preference: ${candidateProfile.preferredWorkMode || "Not specified"}
      Salary Expectation: $${candidateProfile.salaryExpectation || "Not specified"}
      ${candidateProfile.certifications ? `Certifications: ${JSON.stringify(candidateProfile.certifications)}` : ""}
      ${candidateProfile.languages ? `Languages: ${JSON.stringify(candidateProfile.languages)}` : ""}
      ${candidateProfile.industries ? `Industries: ${JSON.stringify(candidateProfile.industries)}` : ""}

      JOB DETAILS:
      Title: ${job.title}
      Company: ${job.company}
      Location: ${job.location}
      Work Mode: ${job.workMode}
      Salary: $${job.minSalary || "Not specified"} - $${job.maxSalary || "Not specified"}
      Requirements: ${job.requirements}
      Description: ${job.description}
      ${job.department ? `Department: ${job.department}` : ""}
      ${job.employmentType ? `Employment Type: ${job.employmentType}` : ""}
      ${job.industry ? `Industry: ${job.industry}` : ""}
      ${job.companySize ? `Company Size: ${job.companySize}` : ""}

      EVALUATION CRITERIA:
      1. Skills Match (40% weight) - Does the candidate have the required skills?
      2. Experience Match (30% weight) - Is their experience level appropriate?
      3. Salary Match (15% weight) - Is salary expectation within range?
      4. Location Match (10% weight) - Does location preference match?
      5. Work Mode Match (5% weight) - Does work mode preference match?

      Return ONLY this JSON format:
      {
        "matchScore": number (0-100),
        "explanation": "brief explanation of the match score",
        "matchQuality": "high | medium | low"
        ${
          includeBreakdown
            ? `,
        "breakdown": {
          "skillsMatch": number (0-100),
          "experienceMatch": number (0-100),
          "salaryMatch": number (0-100),
          "locationMatch": number (0-100),
          "workModeMatch": number (0-100),
          "totalScore": number (0-100)
        },
        "matchedSkills": ["skill1", "skill2"],
        "missingSkills": ["skill3", "skill4"]`
            : ""
        }
      }

      Be honest and specific in your assessment. Consider both the candidate's profile and job requirements.
    `;
  }

  /**
   * Parse candidate profile from AI response
   */
  private parseCandidateProfile(cleanedText: string): CandidateProfile {
    const parsed = JSON.parse(cleanedText);

    return {
      title: parsed.title || null,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      experienceYears: parsed.experienceYears
        ? Number(parsed.experienceYears)
        : null,
      education: parsed.education || null,
      preferredLocation: parsed.preferredLocation || null,
      preferredWorkMode: this.validateWorkMode(parsed.preferredWorkMode),
      salaryExpectation: parsed.salaryExpectation
        ? Number(parsed.salaryExpectation)
        : null,
      certifications: Array.isArray(parsed.certifications)
        ? parsed.certifications
        : [],
      languages: Array.isArray(parsed.languages) ? parsed.languages : [],
      industries: Array.isArray(parsed.industries) ? parsed.industries : [],
    };
  }

  /**
   * Parse match result from AI response
   */
  private parseMatchResult(
    cleanedText: string,
    job: Job,
    includeBreakdown: boolean,
    startTime: number,
  ): JobMatchResult {
    const parsed = JSON.parse(cleanedText);

    if (typeof parsed.matchScore !== "number") {
      throw new Error("Invalid match score in response");
    }

    // ✅ FIX: Always include metadata with all required fields
    const metadata: MatchMetadata = {
      processingTime: Date.now() - startTime,
      modelUsed: config.GEMINI_MODEL,
      timestamp: new Date().toISOString(),
      fromCache: false,
      matchedSkills: [],
      missingSkills: [],
    };

    const result: JobMatchResult = {
      job,
      matchScore: Math.min(100, Math.max(0, parsed.matchScore)),
      explanation: parsed.explanation || "No explanation provided",
      matchQuality: this.validateMatchQuality(parsed.matchQuality),
      metadata,
    };

    if (includeBreakdown && parsed.breakdown) {
      result.breakdown = {
        skillsMatch: Math.min(
          100,
          Math.max(0, parsed.breakdown.skillsMatch || 0),
        ),
        experienceMatch: Math.min(
          100,
          Math.max(0, parsed.breakdown.experienceMatch || 0),
        ),
        salaryMatch: Math.min(
          100,
          Math.max(0, parsed.breakdown.salaryMatch || 0),
        ),
        locationMatch: Math.min(
          100,
          Math.max(0, parsed.breakdown.locationMatch || 0),
        ),
        workModeMatch: Math.min(
          100,
          Math.max(0, parsed.breakdown.workModeMatch || 0),
        ),
        totalScore: Math.min(
          100,
          Math.max(0, parsed.breakdown.totalScore || 0),
        ),
      };
    }

    if (parsed.matchedSkills && Array.isArray(parsed.matchedSkills)) {
      result.metadata.matchedSkills = parsed.matchedSkills;
    }
    if (parsed.missingSkills && Array.isArray(parsed.missingSkills)) {
      result.metadata.missingSkills = parsed.missingSkills;
    }

    return result;
  }

  /**
   * Generate job match cache key
   */
  private generateJobMatchCacheKey(
    candidateProfile: CandidateProfile,
    job: Job,
    includeBreakdown: boolean,
  ): string {
    const data = {
      skills: candidateProfile.skills.slice(0, 10),
      experience: candidateProfile.experienceYears,
      jobTitle: job.title,
      jobCompany: job.company,
      jobLocation: job.location,
      jobWorkMode: job.workMode,
      includeBreakdown,
    };
    return `match:${hashString(JSON.stringify(data))}`;
  }

  /**
   * Process promises with concurrency limit
   */
  private async processWithConcurrency<T>(
    promises: Promise<T>[],
    concurrency: number,
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const promise of promises) {
      const p = promise.then((result) => {
        results.push(result);
      });

      executing.push(p);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        const index = executing.findIndex((e) => e === p);
        if (index !== -1) {
          executing.splice(index, 1);
        }
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Validate work mode
   */
  private validateWorkMode(
    mode: string | null,
  ): CandidateProfile["preferredWorkMode"] {
    const validModes = ["remote", "hybrid", "on-site"];
    if (mode && validModes.includes(mode.toLowerCase())) {
      return mode.toLowerCase() as CandidateProfile["preferredWorkMode"];
    }
    return null;
  }

  /**
   * Validate match quality
   */
  private validateMatchQuality(
    quality: string,
  ): JobMatchResult["matchQuality"] {
    const validQualities = ["high", "medium", "low"];
    if (quality && validQualities.includes(quality.toLowerCase())) {
      return quality.toLowerCase() as JobMatchResult["matchQuality"];
    }
    return "medium";
  }

  /**
   * Clean AI response text
   */
  private cleanAIResponse(responseText: string): string {
    return responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .replace(/^[^{]*/, "")
      .replace(/[^}]*$/, "")
      .trim();
  }

  /**
   * Validate inputs
   */
  private validateInputs(resumeText: string, jobs: Job[]): void {
    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error("Resume text must be at least 50 characters");
    }

    if (!jobs || jobs.length === 0) {
      throw new Error("At least one job is required for matching");
    }

    jobs.forEach((job, index) => {
      if (!job.title || job.title.trim().length === 0) {
        throw new Error(`Job at index ${index} is missing a title`);
      }
      if (!job.company || job.company.trim().length === 0) {
        throw new Error(`Job "${job.title}" is missing a company name`);
      }
    });
  }

  /**
   * Truncate text to max length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + "... (truncated)";
  }

  /**
   * Delay for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============ Public Utility Methods ============

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.flushAll();
    console.log("Job match cache cleared");
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

export default new JobMatchRecommenderService();
