import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../../config/index.js";
import logger from "../../utils/logger.js";
class JobService {
    genAI = null;
    model = null;
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        // ✅ Don't throw error - just warn and continue
        if (apiKey) {
            try {
                this.genAI = new GoogleGenerativeAI(apiKey);
                this.model = this.genAI.getGenerativeModel({
                    model: config.GEMINI_MODEL,
                    generationConfig: {
                        temperature: 0.3,
                        topK: 1,
                        topP: 0.8,
                    },
                });
                logger.info("Gemini AI initialized successfully");
            }
            catch (error) {
                logger.warn("Failed to initialize Gemini AI", { error });
            }
        }
        else {
            logger.warn("GEMINI_API_KEY not found. AI features will be disabled.");
        }
    }
    cleanAIResponse(responseText) {
        return responseText
            .replace(/```json\s*/g, "")
            .replace(/```\s*/g, "")
            .replace(/^[^{]*/, "")
            .replace(/[^}]*$/, "")
            .trim();
    }
    /**
     * Search jobs using parsed filters
     */
    // In jobSearchService.ts
    async searchJobs(filters) {
        const whereClause = {};
        if (filters.title) {
            whereClause.title = { $regex: filters.title, $options: "i" };
        }
        if (filters.location) {
            whereClause.location = { $regex: filters.location, $options: "i" };
        }
        if (filters.minSalary !== null && filters.minSalary !== undefined) {
            whereClause.minSalary = { $gte: filters.minSalary };
        }
        if (filters.maxSalary !== null && filters.maxSalary !== undefined) {
            whereClause.maxSalary = { $lte: filters.maxSalary };
        }
        if (filters.experienceLevel) {
            whereClause.experienceLevel = filters.experienceLevel;
        }
        if (filters.workMode) {
            whereClause.workMode = filters.workMode;
        }
        if (filters.jobType) {
            whereClause.jobType = filters.jobType;
        }
        if (filters.skills && filters.skills.length > 0) {
            whereClause.skills = { $in: filters.skills };
        }
        return {
            where: whereClause,
            rawQuery: filters.rawQuery || "",
        };
    }
    /**
     * Convert natural language query to structured job search filters
     */
    async parseNaturalLanguageQuery(query) {
        if (!query || query.trim().length === 0) {
            throw new Error("Search query is required");
        }
        // Check if AI is available
        if (!this.model) {
            logger.warn("AI not available. Using fallback parsing.");
            return this.parseFallback(query);
        }
        const prompt = `
    Convert this job search query into structured filters:
    "${query}"
    
    Return ONLY a valid JSON object with these fields (use null if not specified):
    {
      "title": string or null,
      "location": string or null,
      "minSalary": number or null,
      "maxSalary": number or null,
      "experienceLevel": string or null (entry, mid, senior, lead),
      "workMode": string or null (remote, hybrid, on-site),
      "jobType": string or null (full-time, part-time, contract, internship),
      "skills": string[] or null
    }
    
    Rules:
    - Extract ALL mentioned criteria from the query
    - For job titles: extract specific roles like "React Developer", "Software Engineer", etc.
    - Extract salary numbers (e.g., "70,000" → 70000, "$80k" → 80000, "minimum 120000" → 120000)
    - For location: extract country, city, or region (e.g., "USA" → "USA", "New York" → "New York")
    - Infer experience from phrases like "junior", "senior", "lead", "5+ years", "experienced"
    - Infer work mode from phrases like "remote", "hybrid", "on-site", "in office"
    - Return empty array for skills if none mentioned
    
    IMPORTANT EXAMPLES:
    Query: "I want senior React developer job in USA with minimum 120000 salary remote"
    Response: {
      "title": "React Developer",
      "location": "USA",
      "minSalary": 120000,
      "maxSalary": null,
      "experienceLevel": "senior",
      "workMode": "remote",
      "jobType": null,
      "skills": null
    }
    
    Query: "Looking for a junior frontend developer position in New York with 80k salary"
    Response: {
      "title": "Frontend Developer",
      "location": "New York",
      "minSalary": 80000,
      "maxSalary": null,
      "experienceLevel": "entry",
      "workMode": null,
      "jobType": null,
      "skills": null
    }
    
    IMPORTANT: Return ONLY the JSON object, no other text.
  `;
        try {
            const result = await this.model.generateContent(prompt);
            const cleanedText = this.cleanAIResponse(result.response.text());
            const parsed = JSON.parse(cleanedText);
            logger.debug("AI Parsed Filters", { parsed });
            return {
                rawQuery: query,
                title: parsed.title || null,
                location: parsed.location || null,
                minSalary: parsed.minSalary ? Number(parsed.minSalary) : null,
                maxSalary: parsed.maxSalary ? Number(parsed.maxSalary) : null,
                experienceLevel: this.validateExperienceLevel(parsed.experienceLevel),
                workMode: this.validateWorkMode(parsed.workMode),
                jobType: this.validateJobType(parsed.jobType),
                skills: Array.isArray(parsed.skills) ? parsed.skills : null,
            };
        }
        catch (error) {
            logger.error("Query parsing failed", { error });
            return this.parseFallback(query);
        }
    }
    validateExperienceLevel(level) {
        const validLevels = ["entry", "mid", "senior", "lead"];
        if (level && validLevels.includes(level.toLowerCase())) {
            return level.toLowerCase();
        }
        return null;
    }
    validateWorkMode(mode) {
        const validModes = ["remote", "hybrid", "on-site"];
        if (mode && validModes.includes(mode.toLowerCase())) {
            return mode.toLowerCase();
        }
        return null;
    }
    validateJobType(type) {
        const validTypes = ["full-time", "part-time", "contract", "internship"];
        if (type && validTypes.includes(type.toLowerCase())) {
            return type.toLowerCase();
        }
        return null;
    }
    parseFallback(query) {
        const lowerQuery = query.toLowerCase();
        const filters = {
            rawQuery: query,
            title: null,
            location: null,
            minSalary: null,
            maxSalary: null,
            experienceLevel: null,
            workMode: null,
            jobType: null,
            skills: null,
        };
        // Extract job title
        const titleMatch = query.match(/(?:senior|junior|lead|mid)\s+(\w+)\s+(developer|engineer|designer|manager)/i) || query.match(/(\w+)\s+(developer|engineer|designer|manager)/i);
        if (titleMatch) {
            filters.title = titleMatch[1] + " " + titleMatch[2];
        }
        // Extract location (look for capitalized words after 'in', 'at', 'near')
        const locationMatch = query.match(/(?:in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
        if (locationMatch) {
            filters.location = locationMatch[1];
        }
        // Extract salary - simpler approach
        const salaryRegex = /(\d+(?:,\d+)?)(?:\s*[kK])?/g;
        let salaryMatch;
        const salaries = [];
        while ((salaryMatch = salaryRegex.exec(query)) !== null) {
            let num = parseInt(salaryMatch[1].replace(/,/g, ""));
            // Check if it has 'k' after it
            const fullMatch = salaryMatch[0];
            if (fullMatch.toLowerCase().includes("k") ||
                query
                    .substring(salaryMatch.index + salaryMatch[0].length, salaryMatch.index + salaryMatch[0].length + 1)
                    .toLowerCase() === "k") {
                num = num * 1000;
            }
            if (num > 1000) {
                // Only consider numbers > 1000 as salary
                salaries.push(num);
            }
        }
        if (salaries.length > 0) {
            if (lowerQuery.includes("minimum") ||
                lowerQuery.includes("min") ||
                lowerQuery.includes("at least")) {
                filters.minSalary = salaries[0];
            }
            else if (lowerQuery.includes("maximum") ||
                lowerQuery.includes("max") ||
                lowerQuery.includes("up to")) {
                filters.maxSalary = salaries[0];
            }
            else {
                filters.minSalary = salaries[0];
                if (salaries.length > 1) {
                    filters.maxSalary = salaries[1];
                }
            }
        }
        // Extract experience level
        if (/(senior|lead|5\+|5 years)/i.test(lowerQuery)) {
            filters.experienceLevel = "senior";
        }
        else if (/(junior|entry|0-2|1-2)/i.test(lowerQuery)) {
            filters.experienceLevel = "entry";
        }
        else if (/(mid|3-5|3 years)/i.test(lowerQuery)) {
            filters.experienceLevel = "mid";
        }
        // Extract work mode
        if (/(remote|work from home|wfh)/i.test(lowerQuery)) {
            filters.workMode = "remote";
        }
        else if (/(hybrid|flexible)/i.test(lowerQuery)) {
            filters.workMode = "hybrid";
        }
        else if (/(on-site|onsite|in office)/i.test(lowerQuery)) {
            filters.workMode = "on-site";
        }
        return filters;
    }
}
export default new JobService();
