import { GoogleGenerativeAI, } from "@google/generative-ai";
import NodeCache from "node-cache";
import { config } from "../../config/index.js";
import hashString from "../../utils/hashString.js";
// ============ Service Class ============
class ApplicationScreeningService {
    genAI;
    model;
    cache;
    MAX_RESUME_LENGTH = 4000;
    MAX_JOB_DETAILS_LENGTH = 3000;
    DEFAULT_WEIGHTS = {
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
        const generationConfig = {
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
    async screenApplication(resumeText, applicationData, jobDetails, options = {}) {
        const startTime = Date.now();
        const { retryCount = 2, includeBreakdown = true, customWeights, useCache = true, } = options;
        // Validate inputs
        this.validateInputs(resumeText, applicationData, jobDetails);
        // Use custom weights if provided, otherwise use defaults
        const weights = customWeights || this.DEFAULT_WEIGHTS;
        this.validateWeights(weights);
        // Generate cache key
        const cacheKey = this.generateCacheKey(resumeText, applicationData, jobDetails, weights, includeBreakdown);
        // Check cache
        if (useCache) {
            const cachedResult = this.cache.get(cacheKey);
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
        const truncatedResume = this.truncateText(resumeText, this.MAX_RESUME_LENGTH);
        const truncatedJobDetails = this.truncateJobDetails(jobDetails, this.MAX_JOB_DETAILS_LENGTH);
        let lastError = null;
        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                const prompt = this.buildPrompt(truncatedResume, applicationData, truncatedJobDetails, weights, includeBreakdown);
                const result = await this.model.generateContent(prompt);
                const cleanedText = this.cleanAIResponse(result.response.text());
                const parsed = this.parseScreeningResult(cleanedText, includeBreakdown);
                // Add metadata
                const metadata = {
                    processingTime: Date.now() - startTime,
                    modelUsed: config.GEMINI_MODEL,
                    timestamp: new Date().toISOString(),
                    fromCache: false,
                };
                // Return the complete result with all required fields
                const finalResult = {
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
            }
            catch (error) {
                lastError = error;
                console.error(`Screening attempt ${attempt + 1} failed:`, error);
                if (attempt < retryCount) {
                    await this.delay(Math.pow(2, attempt) * 1000);
                }
            }
        }
        console.error("All screening attempts failed:", lastError);
        return this.getFallbackResult(lastError?.message);
    }
    // ============ Cache Helper Methods ============
    /**
     * Generate cache key for screening results
     */
    generateCacheKey(resumeText, applicationData, jobDetails, weights, includeBreakdown) {
        const data = {
            resumeHash: hashString(resumeText.substring(0, 500)),
            applicationData: {
                expectedSalary: applicationData.expectedSalary,
                availableFrom: applicationData.availableFrom,
                coverLetter: applicationData.coverLetter?.substring(0, 100) || "",
            },
            jobDetails: {
                title: jobDetails.title,
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
     * Clear cache
     */
    clearCache() {
        this.cache.flushAll();
        console.log("Screening cache cleared");
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
    // ============ Private Helper Methods ============
    buildPrompt(resumeText, applicationData, jobDetails, weights, includeBreakdown) {
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
        ${includeBreakdown
            ? `,
        "breakdown": {
          "skillsMatch": number (0-100),
          "experienceRelevance": number (0-100),
          "salaryAlignment": number (0-100),
          "availabilityTiming": number (0-100),
          "coverLetterQuality": number (0-100),
          "totalScore": number (0-100)
        }`
            : ""}
      }
      
      Be honest, specific, and constructive in your assessment. Focus on the resume content and how well it matches the job requirements.
    `;
        return prompt;
    }
    cleanAIResponse(responseText) {
        return responseText
            .replace(/```json\s*/g, "")
            .replace(/```\s*/g, "")
            .replace(/^[^{]*/, "")
            .replace(/[^}]*$/, "")
            .trim();
    }
    parseScreeningResult(cleanedText, includeBreakdown) {
        try {
            const parsed = JSON.parse(cleanedText);
            // Validate required fields
            if (typeof parsed.score !== "number") {
                throw new Error("Invalid score in response");
            }
            const result = {
                score: Math.min(100, Math.max(0, parsed.score)),
                explanation: parsed.explanation || "No explanation provided",
                strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
                weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
                recommendation: this.validateRecommendation(parsed.recommendation),
            };
            // Add breakdown if present and requested
            if (includeBreakdown && parsed.breakdown) {
                result.breakdown = {
                    skillsMatch: Math.min(100, Math.max(0, parsed.breakdown.skillsMatch || 0)),
                    experienceRelevance: Math.min(100, Math.max(0, parsed.breakdown.experienceRelevance || 0)),
                    salaryAlignment: Math.min(100, Math.max(0, parsed.breakdown.salaryAlignment || 0)),
                    availabilityTiming: Math.min(100, Math.max(0, parsed.breakdown.availabilityTiming || 0)),
                    coverLetterQuality: Math.min(100, Math.max(0, parsed.breakdown.coverLetterQuality || 0)),
                    totalScore: Math.min(100, Math.max(0, parsed.breakdown.totalScore || 0)),
                };
            }
            return result;
        }
        catch (error) {
            console.error("Failed to parse screening result:", error);
            throw new Error("Invalid response format from AI");
        }
    }
    validateRecommendation(recommendation) {
        const validRecommendations = [
            "strongly recommend",
            "recommend",
            "consider",
            "not recommended",
        ];
        if (recommendation &&
            validRecommendations.includes(recommendation.toLowerCase())) {
            return recommendation.toLowerCase();
        }
        return "consider";
    }
    validateInputs(resumeText, applicationData, jobDetails) {
        if (!resumeText || resumeText.trim().length < 50) {
            throw new Error("Resume text must be at least 50 characters");
        }
        if (!jobDetails.title || jobDetails.title.trim().length === 0) {
            throw new Error("Job title is required");
        }
        if (!jobDetails.requirements ||
            jobDetails.requirements.trim().length === 0) {
            throw new Error("Job requirements are required");
        }
    }
    validateWeights(weights) {
        const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
        if (Math.abs(total - 1) > 0.01) {
            throw new Error(`Weights must sum to 1. Current sum: ${total}`);
        }
    }
    truncateText(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "... (truncated)";
    }
    truncateJobDetails(jobDetails, maxLength) {
        const combined = `${jobDetails.title} ${jobDetails.location} ${jobDetails.requirements} ${jobDetails.description}`;
        if (combined.length <= maxLength) {
            return jobDetails;
        }
        let truncated = { ...jobDetails };
        const fields = ["requirements", "description"];
        for (const field of fields) {
            if (truncated[field] && truncated[field].length > maxLength / 2) {
                truncated[field] = this.truncateText(truncated[field], maxLength / 2);
            }
        }
        return truncated;
    }
    getFallbackResult(error) {
        return {
            score: 0,
            explanation: error ||
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
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
export default new ApplicationScreeningService();
