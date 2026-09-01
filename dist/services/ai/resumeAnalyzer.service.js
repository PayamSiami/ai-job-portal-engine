// src/services/ai/resumeAnalyzer.ts
import NodeCache from "node-cache";
import { config } from "../../config/index.js";
import logger from "../../utils/logger.js";
import hashString from "../../utils/hashString.js";
import { completePrompt } from "./aiClient.js";
// ============ Service Class ============
class ResumeAnalyzerService {
    cache;
    MAX_RESUME_LENGTH = 4000;
    MAX_JOB_DETAILS_LENGTH = 2000;
    DEFAULT_CACHE_TTL = 3600; // 1 hour
    isAIEnabled = false;
    constructor() {
        // AI is enabled when an AI model + endpoint is configured.
        this.isAIEnabled = !!config.AI_MODEL && !!config.AI_BASE_URL;
        if (!this.isAIEnabled) {
            logger.warn("AI_MODEL/AI_BASE_URL not configured. AI features will use fallbacks.");
        }
        else {
            logger.info(`AI client ready (provider=${config.AI_PROVIDER}, endpoint=${config.AI_BASE_URL}, model=${config.AI_MODEL})`);
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
    async analyzeResumeVsJob(resumeText, jobRequirements, jobDescription, options = {}) {
        const startTime = Date.now();
        const { retryCount = 2, useCache = true, industry, targetRole } = options;
        // ✅ If AI is disabled, use fallback
        if (!this.isAIEnabled) {
            logger.warn("AI not available, using fallback analysis");
            return this.getFallbackAnalysisResult(startTime);
        }
        let lastError = null;
        // Validate inputs
        this.validateResumeInput(resumeText);
        this.validateJobInput(jobRequirements, jobDescription);
        // Truncate inputs
        const truncatedResume = this.truncateText(resumeText, this.MAX_RESUME_LENGTH);
        const truncatedRequirements = this.truncateText(jobRequirements, this.MAX_JOB_DETAILS_LENGTH);
        const truncatedDescription = this.truncateText(jobDescription, this.MAX_JOB_DETAILS_LENGTH);
        // Generate cache key
        const cacheKey = this.generateAnalysisCacheKey(truncatedResume, truncatedRequirements, truncatedDescription, industry, targetRole);
        // Check cache
        if (useCache) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                logger.info("Analysis result retrieved from cache");
                return {
                    ...cached,
                    metadata: {
                        processingTime: Date.now() - startTime,
                        modelUsed: cached.metadata?.modelUsed ?? config.AI_MODEL,
                        timestamp: cached.metadata?.timestamp ?? new Date().toISOString(),
                        fromCache: true,
                    },
                };
            }
        }
        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                const prompt = this.buildAnalysisPrompt(truncatedResume, truncatedRequirements, truncatedDescription, industry, targetRole);
                logger.info(`Sending analysis request to AI (attempt ${attempt + 1})`);
                const result = await completePrompt("You are a professional resume screener and career coach. Return ONLY valid JSON without markdown or extra text.", prompt, { temperature: 0.1, maxTokens: 800, topP: 0.8 });
                if (!result.success) {
                    throw new Error(result.error || "AI request failed");
                }
                const responseText = result.content;
                logger.info("AI response received", {
                    length: responseText.length,
                    preview: responseText.substring(0, 200),
                });
                const cleanedText = this.cleanAIResponse(responseText);
                const parsed = this.parseAndValidateAnalysis(cleanedText);
                // Add metadata
                const finalResult = {
                    ...parsed,
                    metadata: {
                        processingTime: Date.now() - startTime,
                        modelUsed: config.AI_MODEL,
                        timestamp: new Date().toISOString(),
                        fromCache: false,
                    },
                };
                // Store in cache
                if (useCache) {
                    this.cache.set(cacheKey, finalResult);
                }
                return finalResult;
            }
            catch (error) {
                lastError = error;
                logger.error(`Analysis attempt ${attempt + 1} failed:`, {
                    error: error instanceof Error ? error.message : "Unknown error",
                    stack: error instanceof Error ? error.stack : undefined,
                });
                // ✅ If it's a 403 error, don't retry (API key issue)
                if (error instanceof Error && error.message.includes("403")) {
                    logger.error("API key issue detected. Using fallback.");
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
    buildAnalysisPrompt(resumeText, jobRequirements, jobDescription, industry, targetRole) {
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
    cleanAIResponse(text) {
        text = text.replace(/```json\s*/g, "");
        text = text.replace(/```\s*/g, "");
        text = text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return jsonMatch[0];
        }
        return text;
    }
    parseAndValidateAnalysis(text) {
        try {
            let parsed = JSON.parse(text);
            if (parsed.analysis) {
                parsed = parsed.analysis;
            }
            const result = {
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
            if (result.matchedSkills.length === 0 &&
                result.missingSkills.length === 0) {
                const skillMatches = result.explanation.match(/(?:skill|experience|knowledge)\s*[:\-]\s*([^.,\n]+)/gi);
                if (skillMatches) {
                    result.matchedSkills = skillMatches.slice(0, 5);
                }
            }
            return result;
        }
        catch (error) {
            logger.error("Failed to parse AI response:", {
                text: text.substring(0, 500),
            });
            return this.extractDataFromText(text);
        }
    }
    extractDataFromText(text) {
        const result = {
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
        const suggestionsMatch = text.match(/(?:suggestion|recommend|improve)[:\-\s]*([^.\n]+)/gi);
        if (suggestionsMatch) {
            result.suggestions = suggestionsMatch.map((s) => s.replace(/^(suggestion|recommend|improve)[:\-\s]*/i, "").trim());
        }
        return result;
    }
    validateResumeInput(resumeText) {
        if (!resumeText || resumeText.trim().length < 50) {
            throw new Error("Resume text must be at least 50 characters");
        }
    }
    validateJobInput(requirements, description) {
        if (!requirements && !description) {
            throw new Error("Job requirements or description is required.");
        }
        if (requirements && requirements.trim().length < 10) {
            throw new Error("Job requirements are too short.");
        }
    }
    truncateText(text, maxLength) {
        if (!text)
            return "";
        if (text.length <= maxLength)
            return text;
        return text.substring(0, maxLength) + "...";
    }
    generateAnalysisCacheKey(resume, requirements, description, industry, targetRole) {
        const data = `${resume}|${requirements}|${description}|${industry || ""}|${targetRole || ""}`;
        return `analysis_${hashString(data)}`;
    }
    getFallbackAnalysisResult(startTime) {
        return {
            matchScore: 60,
            explanation: "Analysis completed with some limitations. Please review the job requirements and resume content for a more accurate assessment.",
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
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    // ============ Public Utility Methods ============
    clearCache() {
        this.cache.flushAll();
        logger.info("Resume analyzer cache cleared");
    }
    getCacheStats() {
        const keys = this.cache.keys();
        return {
            keys,
            size: keys.length,
            stats: this.cache.getStats(),
        };
    }
    /**
     * ✅ Get improvement suggestions for a resume
     */
    async getImprovementSuggestions(resumeContent, options = {}) {
        try {
            const { includeContentSuggestions = true, includeFormattingSuggestions = true, includeKeywordSuggestions = true, includeActionVerbs = true, } = options;
            // Check cache
            const cacheKey = `improvements_${resumeContent.substring(0, 100)}`;
            const cachedResult = this.cache.get(cacheKey); // ✅ Use get with type
            if (cachedResult) {
                logger.info(`✅ Returning cached improvements for ${cacheKey}`);
                return cachedResult;
            }
            // If AI model is not available, return fallback suggestions
            if (!this.isAIEnabled) {
                return this.getFallbackImprovements(resumeContent);
            }
            // Build prompt for improvement suggestions
            const prompt = this.buildImprovementPrompt(resumeContent, includeContentSuggestions, includeFormattingSuggestions, includeKeywordSuggestions, includeActionVerbs);
            const result = await completePrompt("You are a professional resume advisor. Return ONLY valid JSON without markdown or extra text.", prompt, { temperature: 0.3, maxTokens: 800 });
            if (!result.success) {
                throw new Error(result.error || "AI request failed");
            }
            const response = result.content;
            const suggestions = this.parseImprovementSuggestions(response);
            // Cache results
            this.cache.set(cacheKey, suggestions);
            return suggestions;
        }
        catch (error) {
            logger.error("Error getting improvement suggestions:", error);
            return this.getFallbackImprovements(resumeContent);
        }
    }
    /**
     * Build improvement suggestion prompt
     */
    buildImprovementPrompt(resumeContent, includeContent, includeFormatting, includeKeywords, includeActionVerbs) {
        let prompt = `
      You are an expert resume reviewer. Analyze the following resume and provide detailed improvement suggestions.

      Resume:
      ${resumeContent}

      Please provide improvement suggestions in the following categories:
    `;
        if (includeContent) {
            prompt += `
        - Content Suggestions: What content is missing or could be improved?
        - Experience Descriptions: How can work experience be described better?
        - Achievements: Are achievements properly highlighted?
      `;
        }
        if (includeFormatting) {
            prompt += `
        - Formatting: How can the resume be better formatted?
        - Structure: Is the information organized effectively?
        - Readability: How can readability be improved?
      `;
        }
        if (includeKeywords) {
            prompt += `
        - Keywords: What industry keywords are missing?
        - Skills: Are relevant skills properly listed?
        - Industry Terms: Are appropriate industry terms used?
      `;
        }
        if (includeActionVerbs) {
            prompt += `
        - Action Verbs: Are strong action verbs used?
        - Impact Statements: Are impact statements clear?
        - Quantification: Are achievements quantified?
      `;
        }
        prompt += `
      For each suggestion, provide:
      1. Category (Content, Formatting, Keywords, or Action Verbs)
      2. Priority (high, medium, or low)
      3. Specific suggestion
      4. Current text (if applicable)
      5. Suggested improvement
      6. Reason for the suggestion

      Format the response as a JSON array of objects with these fields:
      {
        "category": string,
        "priority": "high" | "medium" | "low",
        "suggestion": string,
        "currentText": string (optional),
        "suggestedText": string (optional),
        "reason": string
      }

      Return only the JSON array, no other text.
    `;
        return prompt;
    }
    /**
     * Parse improvement suggestions from AI response
     */
    parseImprovementSuggestions(response) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error("No JSON array found in response");
            }
            const suggestions = JSON.parse(jsonMatch[0]);
            // Validate and format suggestions
            return suggestions.map((s) => ({
                category: s.category || "General",
                priority: s.priority || "medium",
                suggestion: s.suggestion || "",
                currentText: s.currentText || "",
                suggestedText: s.suggestedText || "",
                reason: s.reason || "",
            }));
        }
        catch (error) {
            logger.error("Error parsing improvement suggestions:", error);
            return this.getFallbackImprovements("");
        }
    }
    /**
     * Get fallback improvements when AI is unavailable
     */
    getFallbackImprovements(resumeContent) {
        const suggestions = [];
        // Check for common issues
        if (!resumeContent || resumeContent.length < 100) {
            suggestions.push({
                category: "Content",
                priority: "high",
                suggestion: "Add more content to your resume",
                currentText: "Resume is too short",
                suggestedText: "Expand on your experience and skills",
                reason: "Recruiters expect detailed resumes",
            });
        }
        // Check for missing sections
        if (!resumeContent.includes("experience") &&
            !resumeContent.includes("Experience")) {
            suggestions.push({
                category: "Content",
                priority: "high",
                suggestion: "Add work experience section",
                currentText: "No experience section found",
                suggestedText: "Include a detailed work experience section",
                reason: "Work experience is the most important section",
            });
        }
        if (!resumeContent.includes("skill") && !resumeContent.includes("Skill")) {
            suggestions.push({
                category: "Keywords",
                priority: "high",
                suggestion: "Add skills section",
                currentText: "No skills section found",
                suggestedText: "Include a skills section with relevant keywords",
                reason: "Skills are crucial for ATS screening",
            });
        }
        // Check for quantified achievements
        const hasNumbers = /\d+/.test(resumeContent);
        if (!hasNumbers) {
            suggestions.push({
                category: "Action Verbs",
                priority: "medium",
                suggestion: "Add quantified achievements",
                currentText: "No numbers or metrics found",
                suggestedText: "Add numbers, percentages, and metrics to achievements",
                reason: "Quantified achievements are more impactful",
            });
        }
        // Add general suggestions
        suggestions.push({
            category: "Formatting",
            priority: "medium",
            suggestion: "Use consistent formatting",
            currentText: "Inconsistent formatting detected",
            suggestedText: "Use consistent font, size, and spacing",
            reason: "Consistent formatting improves readability",
        });
        suggestions.push({
            category: "Keywords",
            priority: "medium",
            suggestion: "Include industry keywords",
            currentText: "Limited industry keywords found",
            suggestedText: "Research and include relevant industry keywords",
            reason: "Keywords help with ATS filtering",
        });
        suggestions.push({
            category: "Content",
            priority: "low",
            suggestion: "Add a professional summary",
            currentText: "No professional summary found",
            suggestedText: "Include a 2-3 sentence professional summary",
            reason: "A good summary grabs attention",
        });
        return suggestions;
    }
}
export default new ResumeAnalyzerService();
