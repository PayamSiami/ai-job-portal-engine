import { GoogleGenerativeAI, } from "@google/generative-ai";
import NodeCache from "node-cache";
import { config } from "../../config/index";
import hashString from "../../utils/hashString";
class CoverLetterGeneratorService {
    genAI;
    model;
    cache;
    DEFAULT_MAX_WORDS = 250;
    MAX_RESUME_LENGTH = 4000;
    MAX_JOB_DETAILS_LENGTH = 3000;
    CACHE_TTL = 3600;
    isAIEnabled = false;
    constructor() {
        const apiKey = config.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn("⚠️ GEMINI_API_KEY not found. AI features will be disabled.");
            this.isAIEnabled = false;
        }
        else {
            try {
                this.genAI = new GoogleGenerativeAI(apiKey);
                const generationConfig = {
                    temperature: 0.7,
                    topK: 1,
                    topP: 0.9,
                    maxOutputTokens: 600,
                };
                const modelName = this.getAvailableModel();
                if (modelName) {
                    this.model = this.genAI.getGenerativeModel({
                        model: modelName,
                        generationConfig,
                    });
                    this.isAIEnabled = true;
                    console.log(`✅ Gemini AI initialized with model: ${modelName}`);
                }
                else {
                    console.warn("⚠️ No Gemini model available. AI features will be disabled.");
                    this.isAIEnabled = false;
                }
            }
            catch (error) {
                console.warn("⚠️ Failed to initialize Gemini AI:", error);
                this.isAIEnabled = false;
            }
        }
        this.cache = new NodeCache({
            stdTTL: this.CACHE_TTL,
            checkperiod: 120,
        });
    }
    getAvailableModel() {
        const models = ["gemini-1.5-pro", "gemini-1.0-pro", "gemini-pro"];
        return models[0] || "gemini-pro";
    }
    async generateCoverLetter(jobDetails, resumeText, options = {}) {
        const startTime = Date.now();
        const { maxWords = this.DEFAULT_MAX_WORDS, tone = "professional", retryCount = 2, useCache = true, focusSkills, includeAchievements = true, } = options;
        if (!this.isAIEnabled || !this.model) {
            console.warn("⚠️ AI not available, using fallback cover letter generation");
            return this.generateFallbackCoverLetter(jobDetails, resumeText, tone, startTime);
        }
        let lastError = null;
        try {
            this.validateInputs(jobDetails, resumeText);
            const truncatedResume = this.truncateText(resumeText, this.MAX_RESUME_LENGTH);
            const truncatedJobDetails = this.truncateJobDetails(jobDetails, this.MAX_JOB_DETAILS_LENGTH);
            const cacheKey = this.generateCacheKey(truncatedJobDetails, truncatedResume, maxWords, tone, focusSkills);
            if (useCache) {
                const cachedResult = this.cache.get(cacheKey);
                if (cachedResult) {
                    if (cachedResult.metadata) {
                        cachedResult.metadata.fromCache = true;
                    }
                    return cachedResult;
                }
            }
            for (let attempt = 0; attempt <= retryCount; attempt++) {
                try {
                    const prompt = this.buildPrompt(truncatedJobDetails, truncatedResume, maxWords, tone, focusSkills, includeAchievements);
                    const result = await this.model.generateContent(prompt);
                    const coverLetter = result.response.text().trim();
                    if (!coverLetter || coverLetter.length < 50) {
                        throw new Error("Generated cover letter is too short or empty");
                    }
                    const formattedResult = this.formatResult(coverLetter, true, undefined, tone, startTime);
                    if (useCache) {
                        this.cache.set(cacheKey, formattedResult);
                    }
                    return formattedResult;
                }
                catch (error) {
                    lastError = error;
                    console.error(`Cover letter generation attempt ${attempt + 1} failed:`, error);
                    if (error instanceof Error && error.message.includes("403")) {
                        console.error("❌ API key issue detected. Using fallback.");
                        return this.generateFallbackCoverLetter(jobDetails, resumeText, tone, startTime);
                    }
                    if (attempt < retryCount) {
                        await this.delay(Math.pow(2, attempt) * 1000);
                    }
                }
            }
            console.error("All cover letter generation attempts failed:", lastError);
            return this.generateFallbackCoverLetter(jobDetails, resumeText, tone, startTime);
        }
        catch (error) {
            console.error("Error generating cover letter:", error);
            return this.generateFallbackCoverLetter(jobDetails, resumeText, tone, startTime);
        }
    }
    generateFallbackCoverLetter(jobDetails, resumeText, tone, startTime) {
        const nameMatch = resumeText.match(/[A-Z][a-z]+ [A-Z][a-z]+/);
        const name = nameMatch ? nameMatch[0] : "Candidate";
        const skills = this.extractSkills(resumeText);
        const templates = {
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
        const content = templates[tone] || templates.professional;
        return this.formatResult(content, true, undefined, tone, startTime);
    }
    extractSkills(resumeText) {
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
        const foundSkills = [];
        for (const skill of commonSkills) {
            if (resumeText.toLowerCase().includes(skill.toLowerCase())) {
                foundSkills.push(skill);
            }
        }
        return foundSkills.length > 0
            ? foundSkills.slice(0, 5)
            : ["professional experience", "dedication", "team collaboration"];
    }
    validateInputs(jobDetails, resumeText) {
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
    buildPrompt(jobDetails, resumeText, maxWords, tone, focusSkills, includeAchievements = true) {
        const toneDescriptions = {
            professional: "formal and business-like, highlighting qualifications professionally",
            enthusiastic: "energetic and passionate, showing genuine excitement for the role",
            formal: "traditional and respectful, using formal business language",
            casual: "friendly and approachable, while still maintaining professionalism",
            confident: "assertive and self-assured, demonstrating strong belief in your abilities",
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
      - Use "${toneDescriptions[tone] || "professional"}" tone
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
    formatResult(content, success, error, tone, startTime) {
        const wordCount = this.countWords(content);
        const result = {
            content,
            wordCount,
            estimatedReadTime: Math.ceil(wordCount / 200),
            success,
            error,
        };
        if (startTime) {
            result.metadata = {
                processingTime: Date.now() - startTime,
                modelUsed: this.isAIEnabled ? "gemini-pro" : "fallback",
                timestamp: new Date().toISOString(),
                fromCache: false,
                tone: tone || "professional",
                wordCount,
            };
        }
        return result;
    }
    countWords(text) {
        return text.trim().split(/\s+/).length;
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    truncateText(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "... (truncated)";
    }
    truncateJobDetails(jobDetails, maxLength) {
        const combined = `${jobDetails.title} ${jobDetails.company} ${jobDetails.location} ${jobDetails.requirements} ${jobDetails.description}`;
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
    generateCacheKey(jobDetails, resumeText, maxWords, tone, focusSkills) {
        const data = {
            jobHash: hashString(`${jobDetails.title}|${jobDetails.company}|${jobDetails.requirements.substring(0, 100)}`),
            resumeHash: hashString(resumeText.substring(0, 500)),
            maxWords,
            tone,
            focusSkills: focusSkills || [],
        };
        return `coverletter:${JSON.stringify(data)}`;
    }
    clearCache() {
        this.cache.flushAll();
        console.log("Cover letter cache cleared");
    }
    getCacheStats() {
        const keys = this.cache.keys();
        return {
            keys,
            size: keys.length,
            stats: this.cache.getStats(),
        };
    }
}
export default new CoverLetterGeneratorService();
