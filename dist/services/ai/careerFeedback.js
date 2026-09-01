import NodeCache from "node-cache";
import { config } from "../../config/index.js";
import logger from "../../utils/logger.js";
import hashString from "../../utils/hashString.js";
import { completePrompt } from "./aiClient.js";
// ============ Service Class ============
class CareerFeedbackService {
    cache;
    MAX_RESUME_LENGTH = 5000;
    constructor() {
        if (!config.AI_MODEL || !config.AI_BASE_URL) {
            throw new Error("AI_MODEL and AI_BASE_URL are required in environment variables");
        }
        // Initialize cache with 10 minute TTL
        this.cache = new NodeCache({
            stdTTL: 600,
            checkperiod: 120,
        });
    }
    /**
     * Generate comprehensive career feedback from a resume
     */
    async generateCareerFeedback(resumeText, options = {}) {
        const startTime = Date.now();
        const { retryCount = 2, useCache = true, includeDetailed = true, industry, targetRole, } = options;
        // Validate input
        if (!resumeText || resumeText.trim().length < 50) {
            throw new Error("Resume text must be at least 50 characters");
        }
        // Truncate if too long
        const truncatedResume = this.truncateText(resumeText, this.MAX_RESUME_LENGTH);
        // Generate cache key
        const cacheKey = this.generateCacheKey(truncatedResume, industry, targetRole);
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
        let lastError = null;
        // ✅ Try the unified AI provider with retries
        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                logger.info(`Attempt ${attempt + 1}: Generating feedback with ${config.AI_MODEL}`);
                const prompt = this.buildFeedbackPrompt(truncatedResume, industry, targetRole, includeDetailed);
                const result = await completePrompt("You are an expert career coach. Return ONLY valid JSON without markdown or extra text.", prompt, { temperature: 0.3, maxTokens: 1500, topP: 0.9 });
                if (result.success && result.content) {
                    const cleanedText = this.cleanAIResponse(result.content);
                    const parsed = this.parseFeedbackResult(cleanedText, includeDetailed);
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
                    logger.info("Successfully generated career feedback");
                    return finalResult;
                }
                else {
                    throw new Error(result.error || "AI returned empty response");
                }
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error("Unknown error");
                const message = lastError.message;
                logger.error(`AI attempt ${attempt + 1} failed`, { error: message });
                if (attempt < retryCount) {
                    const delayMs = Math.pow(2, attempt) * 1000;
                    logger.info(`Retrying in ${delayMs}ms`);
                    await this.delay(delayMs);
                }
            }
        }
        // ✅ If all attempts fail, use fallback
        logger.error("All AI attempts failed, using fallback", {
            error: lastError?.message,
        });
        return this.getFallbackResult(lastError?.message);
    }
    // ============ Private Helper Methods ============
    buildFeedbackPrompt(resumeText, industry, targetRole, includeDetailed = true) {
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
        }
        else {
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
    // backend/src/services/ai/careerFeedback.ts
    /**
     * Parse and validate feedback result with better error handling
     */
    parseFeedbackResult(text, includeDetailed) {
        try {
            // ✅ Try to extract JSON from the response
            let jsonStr = text.trim();
            // Remove markdown code blocks
            jsonStr = jsonStr.replace(/```json\s*/g, "");
            jsonStr = jsonStr.replace(/```\s*/g, "");
            // Find JSON object in the text (in case there's extra text)
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No JSON object found in response");
            }
            // Parse the JSON
            let parsed = JSON.parse(jsonMatch[0]);
            // If it's nested, dig deeper
            if (parsed.feedback) {
                parsed = parsed.feedback;
            }
            // ✅ Ensure all required fields exist with defaults
            const result = {
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
                overallScore: typeof parsed.overallScore === "number"
                    ? Math.min(100, Math.max(0, parsed.overallScore))
                    : 0,
                // ✅ Always include strengths and recommendations with defaults
                strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
                recommendations: Array.isArray(parsed.recommendations)
                    ? parsed.recommendations
                    : [],
            };
            // ✅ Include detailed analysis if available and requested
            if (includeDetailed && parsed.detailedAnalysis) {
                result.detailedAnalysis = parsed.detailedAnalysis;
            }
            return result;
        }
        catch (error) {
            logger.error("Failed to parse feedback result", {
                error,
                rawText: text.substring(0, 500) + "...",
            });
            // ✅ Try to extract data using regex as fallback
            return this.extractFeedbackFromText(text);
        }
    }
    /**
     * Fallback: Extract feedback from unstructured text
     */
    extractFeedbackFromText(text) {
        const result = {
            issues: [],
            improvements: [],
            missingSkills: [],
            targetRoles: [],
            overallScore: 50,
            // ✅ Add these required fields
            strengths: [],
            recommendations: {
                immediate: [],
                shortTerm: [],
                longTerm: [],
            },
        };
        // Try to find score
        const scoreMatch = text.match(/(?:score|overallScore|rating)[:\s]*(\d+)/i);
        if (scoreMatch) {
            result.overallScore = Math.min(100, Math.max(0, parseInt(scoreMatch[1])));
        }
        // Try to extract issues
        const issueMatches = text.match(/(?:issue|problem|concern)[:\s]*([^.\n]+)/gi);
        if (issueMatches) {
            result.issues = issueMatches.slice(0, 5).map((item, index) => ({
                type: "content",
                description: item
                    .replace(/^(?:issue|problem|concern)[:\s]*/i, "")
                    .trim(),
                location: "General",
                priority: index < 2 ? "high" : "medium",
                suggestion: "Review and improve this area",
            }));
        }
        // Try to extract improvements
        const improvementMatches = text.match(/(?:improvement|suggestion|recommend)[:\s]*([^.\n]+)/gi);
        if (improvementMatches) {
            result.improvements = improvementMatches
                .slice(0, 5)
                .map((item) => item
                .replace(/^(?:improvement|suggestion|recommend)[:\s]*/i, "")
                .trim());
        }
        // ✅ Try to extract strengths
        const strengthMatches = text.match(/(?:strength|strong point|good)[:\s]*([^.\n]+)/gi);
        if (strengthMatches) {
            result.strengths = strengthMatches.slice(0, 5).map((item) => ({
                type: "skills",
                description: item
                    .replace(/^(?:strength|strong point|good)[:\s]*/i, "")
                    .trim(),
                impact: "medium",
            }));
        }
        // ✅ Try to extract missing skills
        const skillMatches = text.match(/(?:missing skill|skill gap|need.*skill)[:\s]*([^.\n]+)/gi);
        if (skillMatches) {
            result.missingSkills = skillMatches
                .slice(0, 5)
                .map((item) => item
                .replace(/^(?:missing skill|skill gap|need.*skill)[:\s]*/i, "")
                .trim());
        }
        // ✅ Build recommendations if not found
        if (result.improvements.length > 0) {
            result.recommendations = {
                immediate: result.improvements.slice(0, 3),
                shortTerm: result.improvements.slice(3, 5),
                longTerm: [
                    "Continue developing skills",
                    "Build your professional network",
                ],
            };
        }
        // If no data extracted, create default feedback
        if (result.issues.length === 0 && result.improvements.length === 0) {
            return this.getDefaultFeedbackResult();
        }
        return result;
    }
    /**
     * Get default feedback result when all parsing fails
     */
    getDefaultFeedbackResult() {
        return {
            issues: [
                {
                    type: "content",
                    description: "Your resume could benefit from more specific achievements and quantifiable results.",
                    location: "General",
                    priority: "high",
                    suggestion: "Add numbers and metrics to your achievements.",
                },
                {
                    type: "content",
                    description: "Consider adding more relevant keywords from job descriptions.",
                    location: "Skills Section",
                    priority: "medium",
                    suggestion: "Review job descriptions and include matching keywords.",
                },
                {
                    type: "formatting",
                    description: "Ensure consistent formatting throughout your resume.",
                    location: "General",
                    priority: "low",
                    suggestion: "Use consistent fonts, bullet points, and spacing.",
                },
            ],
            improvements: [
                'Add quantifiable achievements (e.g., "Increased sales by 30%")',
                "Tailor your resume to each job application",
                "Include relevant keywords from job descriptions",
                "Keep your resume to 1-2 pages",
                "Use action verbs to describe your experience",
            ],
            missingSkills: [
                "Consider adding more technical skills relevant to your field",
                "Highlight leadership and management experience",
                "Include any relevant certifications",
            ],
            targetRoles: [
                "Career advancement in your current field",
                "Skills development for next role",
            ],
            overallScore: 65,
            strengths: [
                {
                    type: "experience",
                    description: "Professional experience in your field",
                    impact: "high",
                },
                {
                    type: "skills",
                    description: "Relevant technical and soft skills",
                    impact: "medium",
                },
            ],
            recommendations: {
                immediate: [
                    "Add quantifiable achievements with numbers",
                    "Include keywords from job descriptions",
                    "Ensure consistent formatting",
                ],
                shortTerm: [
                    "Get additional certifications",
                    "Update your LinkedIn profile",
                ],
                longTerm: ["Develop leadership skills", "Build a portfolio of work"],
            },
        };
    }
    cleanAIResponse(responseText) {
        return responseText
            .replace(/```json\s*/g, "")
            .replace(/```\s*/g, "")
            .replace(/^[^{]*/, "")
            .replace(/[^}]*$/, "")
            .trim();
    }
    generateCacheKey(resumeText, industry, targetRole) {
        const data = {
            resumeHash: hashString(resumeText.substring(0, 500)),
            industry: industry || "none",
            targetRole: targetRole || "none",
        };
        return `feedback:${JSON.stringify(data)}`;
    }
    truncateText(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "... (truncated)";
    }
    getFallbackResult(error) {
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
                modelUsed: config.AI_MODEL,
                timestamp: new Date().toISOString(),
                fromCache: false,
            },
        };
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    // ============ Public Utility Methods ============
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.flushAll();
        logger.info("Career feedback cache cleared");
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
// Export singleton instance
export default new CareerFeedbackService();
