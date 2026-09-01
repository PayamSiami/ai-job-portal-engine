// src/services/jobMatchRecommender.service.ts
import NodeCache from "node-cache";
import { config } from "../../config/index.js";
import logger from "../../utils/logger.js";
import hashString from "../../utils/hashString.js";
import { completePrompt } from "./aiClient.js";
// ============ Service Class ============
class JobMatchRecommenderService {
    cache;
    MAX_RESUME_LENGTH = 4000;
    MAX_JOBS_PER_BATCH = 10;
    DEFAULT_MIN_SCORE = 30;
    CONCURRENCY_LIMIT = 3;
    DEFAULT_CACHE_TTL = 3600; // 1 hour
    constructor() {
        if (!config.AI_MODEL || !config.AI_BASE_URL) {
            throw new Error("AI_MODEL and AI_BASE_URL are required in environment variables");
        }
        // Initialize cache
        this.cache = new NodeCache({
            stdTTL: this.DEFAULT_CACHE_TTL,
            checkperiod: 120,
        });
    }
    /**
     * Find jobs that match the user's resume with detailed scoring
     */
    async getJobMatches(resumeText, availableJobs, options = {}) {
        const startTime = Date.now();
        const { retryCount = 2, minScore = this.DEFAULT_MIN_SCORE, includeBreakdown = true, batchSize = this.MAX_JOBS_PER_BATCH, concurrency = this.CONCURRENCY_LIMIT, useCache = true, } = options;
        // Validate inputs
        this.validateInputs(resumeText, availableJobs);
        try {
            // Extract candidate profile
            const candidateProfile = await this.extractCandidateProfile(resumeText, retryCount, useCache);
            // Score jobs in batches with concurrency control
            const jobScores = await this.scoreJobsInBatches(candidateProfile, availableJobs, batchSize, concurrency, retryCount, includeBreakdown, useCache, startTime);
            // Filter and sort results
            const filteredResults = jobScores
                .filter((result) => result.matchScore >= minScore)
                .sort((a, b) => b.matchScore - a.matchScore);
            return filteredResults;
        }
        catch (error) {
            logger.error("Job matching failed", { error });
            return this.getFallbackResults(availableJobs, error);
        }
    }
    /**
     * Extract candidate profile from resume
     */
    async extractCandidateProfile(resumeText, retryCount, useCache) {
        const truncatedResume = this.truncateText(resumeText, this.MAX_RESUME_LENGTH);
        // Generate cache key
        const cacheKey = `profile:${hashString(truncatedResume)}`;
        // Check cache
        if (useCache) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                logger.info("Candidate profile retrieved from cache");
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
        let lastError = null;
        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                const result = await completePrompt("You are a career coach that extracts structured candidate profiles from resumes. Return ONLY valid JSON without markdown or extra text.", profilePrompt, { temperature: 0.1, maxTokens: 600, topP: 0.8 });
                if (!result.success) {
                    throw new Error(result.error || "AI request failed");
                }
                const cleanedText = this.cleanAIResponse(result.content);
                const profile = this.parseCandidateProfile(cleanedText);
                // Store in cache
                if (useCache) {
                    this.cache.set(cacheKey, profile);
                }
                return profile;
            }
            catch (error) {
                lastError = error;
                logger.error(`Profile extraction attempt ${attempt + 1} failed`, {
                    error,
                });
                if (attempt < retryCount) {
                    await this.delay(Math.pow(2, attempt) * 1000);
                }
            }
        }
        throw new Error(`Failed to extract candidate profile: ${lastError?.message}`);
    }
    /**
     * Score jobs in batches with concurrency control
     */
    async scoreJobsInBatches(candidateProfile, jobs, batchSize, concurrency, retryCount, includeBreakdown, useCache, startTime) {
        const results = [];
        // Process jobs in batches
        for (let i = 0; i < jobs.length; i += batchSize) {
            const batch = jobs.slice(i, i + batchSize);
            // Check cache for each job in batch
            const batchWithCache = batch.map((job) => {
                if (useCache) {
                    const cacheKey = this.generateJobMatchCacheKey(candidateProfile, job, includeBreakdown);
                    const cached = this.cache.get(cacheKey);
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
                const result = item.cachedResult;
                return {
                    ...result,
                    metadata: {
                        processingTime: result.metadata?.processingTime ?? 0,
                        modelUsed: result.metadata?.modelUsed ?? config.AI_MODEL,
                        timestamp: result.metadata?.timestamp ?? new Date().toISOString(),
                        fromCache: true,
                        matchedSkills: result.metadata?.matchedSkills ?? [],
                        missingSkills: result.metadata?.missingSkills ?? [],
                    },
                };
            });
            // Process uncached jobs with concurrency
            const batchPromises = uncachedJobs.map(({ job }, index) => this.scoreJobWithRetry(candidateProfile, job, retryCount, includeBreakdown, i + index, useCache, startTime));
            // Process with concurrency limit
            const batchResults = await this.processWithConcurrency(batchPromises, concurrency);
            // Combine cached and new results
            const validResults = batchResults.filter((r) => r !== null);
            results.push(...cachedResults, ...validResults);
        }
        return results;
    }
    /**
     * Score a single job with retry logic
     */
    async scoreJobWithRetry(candidateProfile, job, retryCount, includeBreakdown, jobIndex, useCache, startTime) {
        // Check cache first
        if (useCache) {
            const cacheKey = this.generateJobMatchCacheKey(candidateProfile, job, includeBreakdown);
            const cached = this.cache.get(cacheKey);
            if (cached) {
                logger.info(`Job ${jobIndex + 1} retrieved from cache`);
                // FIX: Ensure metadata exists when returning cached result
                return {
                    ...cached,
                    metadata: {
                        processingTime: cached.metadata?.processingTime ?? 0,
                        modelUsed: cached.metadata?.modelUsed ?? config.AI_MODEL,
                        timestamp: cached.metadata?.timestamp ?? new Date().toISOString(),
                        fromCache: true,
                        matchedSkills: cached.metadata?.matchedSkills ?? [],
                        missingSkills: cached.metadata?.missingSkills ?? [],
                    },
                };
            }
        }
        let lastError = null;
        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                const prompt = this.buildMatchPrompt(candidateProfile, job, includeBreakdown);
                const result = await completePrompt("You are an AI recruiter that scores how well a candidate matches a job. Return ONLY valid JSON without markdown or extra text.", prompt, { temperature: 0.1, maxTokens: 600, topP: 0.8 });
                if (!result.success) {
                    throw new Error(result.error || "AI request failed");
                }
                const cleanedText = this.cleanAIResponse(result.content);
                const matchData = this.parseMatchResult(cleanedText, job, includeBreakdown, startTime);
                logger.debug(`Job ${jobIndex + 1} scored: ${matchData.matchScore}%`);
                // Store in cache
                if (useCache) {
                    const cacheKey = this.generateJobMatchCacheKey(candidateProfile, job, includeBreakdown);
                    this.cache.set(cacheKey, matchData);
                }
                return matchData;
            }
            catch (error) {
                lastError = error;
                if (attempt < retryCount) {
                    await this.delay(Math.pow(2, attempt) * 500);
                }
            }
        }
        logger.error(`Failed to score job "${job.title}" after ${retryCount} retries`, { error: lastError?.message });
        return null;
    }
    /**
     * Get fallback results when matching fails
     */
    getFallbackResults(jobs, error) {
        return jobs.map((job) => ({
            job,
            matchScore: 0,
            explanation: `Matching temporarily unavailable: ${error.message}`,
            matchQuality: "low",
            metadata: {
                processingTime: 0,
                modelUsed: config.AI_MODEL,
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
    buildMatchPrompt(candidateProfile, job, includeBreakdown) {
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
        ${includeBreakdown
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
            : ""}
      }

      Be honest and specific in your assessment. Consider both the candidate's profile and job requirements.
    `;
    }
    /**
     * Parse candidate profile from AI response
     */
    parseCandidateProfile(cleanedText) {
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
    parseMatchResult(cleanedText, job, includeBreakdown, startTime) {
        const parsed = JSON.parse(cleanedText);
        if (typeof parsed.matchScore !== "number") {
            throw new Error("Invalid match score in response");
        }
        // ✅ FIX: Always include metadata with all required fields
        const metadata = {
            processingTime: Date.now() - startTime,
            modelUsed: config.AI_MODEL,
            timestamp: new Date().toISOString(),
            fromCache: false,
            matchedSkills: [],
            missingSkills: [],
        };
        const result = {
            job,
            matchScore: Math.min(100, Math.max(0, parsed.matchScore)),
            explanation: parsed.explanation || "No explanation provided",
            matchQuality: this.validateMatchQuality(parsed.matchQuality),
            metadata,
        };
        if (includeBreakdown && parsed.breakdown) {
            result.breakdown = {
                skillsMatch: Math.min(100, Math.max(0, parsed.breakdown.skillsMatch || 0)),
                experienceMatch: Math.min(100, Math.max(0, parsed.breakdown.experienceMatch || 0)),
                salaryMatch: Math.min(100, Math.max(0, parsed.breakdown.salaryMatch || 0)),
                locationMatch: Math.min(100, Math.max(0, parsed.breakdown.locationMatch || 0)),
                workModeMatch: Math.min(100, Math.max(0, parsed.breakdown.workModeMatch || 0)),
                totalScore: Math.min(100, Math.max(0, parsed.breakdown.totalScore || 0)),
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
    generateJobMatchCacheKey(candidateProfile, job, includeBreakdown) {
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
    async processWithConcurrency(promises, concurrency) {
        const results = [];
        const executing = [];
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
    validateWorkMode(mode) {
        const validModes = ["remote", "hybrid", "on-site"];
        if (mode && validModes.includes(mode.toLowerCase())) {
            return mode.toLowerCase();
        }
        return null;
    }
    /**
     * Validate match quality
     */
    validateMatchQuality(quality) {
        const validQualities = ["high", "medium", "low"];
        if (quality && validQualities.includes(quality.toLowerCase())) {
            return quality.toLowerCase();
        }
        return "medium";
    }
    /**
     * Clean AI response text
     */
    cleanAIResponse(responseText) {
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
    validateInputs(resumeText, jobs) {
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
    truncateText(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "... (truncated)";
    }
    /**
     * Delay for retry backoff
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    // ============ Public Utility Methods ============
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.flushAll();
        logger.info("Job match cache cleared");
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        const keys = this.cache.keys();
        return {
            keys,
            size: keys.length,
            stats: this.cache.getStats(),
        };
    }
}
export default new JobMatchRecommenderService();
