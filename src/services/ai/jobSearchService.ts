import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import Job, { IJob } from "../../models/Job.models.js";
import { config } from "../../config/index.js";

export type ExperienceLevel = "entry" | "mid" | "senior" | "lead";
export type WorkMode = "remote" | "hybrid" | "on-site";
export type JobType = "full-time" | "part-time" | "contract" | "internship";

export interface JobFilters {
  title?: string;
  company?: string;
  location?: string;
  minSalary?: number;
  maxSalary?: number;
  experienceLevel?: ExperienceLevel;
  workMode?: WorkMode;
  jobType?: JobType;
  tags?: string[];
  [key: string]: any;
}

export interface JobPaginationOptions {
  page?: number;
  limit?: number;
}

export interface SearchResult {
  where: Record<string, any>;
  rawQuery?: string;
}

export interface JobPaginationResult {
  jobs: IJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface GeneratedJobContent {
  title: string;
  company: string;
  location: string;
  salary: number;
  minSalary: number;
  maxSalary: number;
  experienceLevel: ExperienceLevel;
  workMode: WorkMode;
  jobType: JobType;
  description: string;
  requirements: string;
  benefits: string;
  tags: string[];
}

interface ParsedJobFilters {
  rawQuery?: string;
  title: string | null;
  location: string | null;
  minSalary: number | null;
  maxSalary: number | null;
  experienceLevel: string | null;
  workMode: string | null;
  jobType: string | null;
  skills: string[] | null;
}

class JobService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;

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
        console.log("✅ Gemini AI initialized successfully");
      } catch (error) {
        console.warn("⚠️ Failed to initialize Gemini AI:", error);
      }
    } else {
      console.warn(
        "⚠️ GEMINI_API_KEY not found. AI features will be disabled.",
      );
    }
  }

  async getJobs(
    filters: JobFilters = {},
    options: JobPaginationOptions = {},
  ): Promise<JobPaginationResult> {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    // Build query with proper typing
    const query: any = { isActive: true };

    // Add filters with proper type checking
    if (filters.title) {
      query.title = { $regex: filters.title, $options: "i" };
    }
    if (filters.company) {
      query.company = { $regex: filters.company, $options: "i" };
    }
    if (filters.location) {
      query.location = { $regex: filters.location, $options: "i" };
    }
    if (filters.minSalary !== undefined) {
      query.minSalary = { $gte: filters.minSalary };
    }
    if (filters.maxSalary !== undefined) {
      query.maxSalary = { $lte: filters.maxSalary };
    }
    if (filters.experienceLevel) {
      query.experienceLevel = filters.experienceLevel;
    }
    if (filters.workMode) {
      query.workMode = filters.workMode;
    }
    if (filters.jobType) {
      query.jobType = filters.jobType;
    }
    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    const dbQuery = Job.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const [jobs, total] = await Promise.all([
      dbQuery.exec(),
      Job.countDocuments(query),
    ]);

    return {
      jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getJobById(id: string): Promise<IJob | null> {
    if (!id) {
      throw new Error("Job ID is required");
    }
    return Job.findById(id).exec();
  }

  async createJob(jobData: any, postedById: string): Promise<IJob> {
    if (!postedById) {
      throw new Error("User ID is required");
    }

    const job = new Job({
      ...jobData,
      postedBy: postedById,
      isActive: true,
    });
    return job.save();
  }

  async updateJob(id: string, jobData: any): Promise<IJob | null> {
    if (!id) {
      throw new Error("Job ID is required");
    }
    return Job.findByIdAndUpdate(id, jobData, { new: true }).exec();
  }

  async deleteJob(id: string): Promise<IJob | null> {
    if (!id) {
      throw new Error("Job ID is required");
    }
    return Job.findByIdAndUpdate(id, { isActive: false }, { new: true }).exec();
  }

  async getSampleJob(): Promise<IJob | null> {
    return Job.findOne({ isActive: true }).sort({ createdAt: -1 }).exec();
  }

  async getActiveJobs(): Promise<IJob[]> {
    return Job.find({ isActive: true }).sort({ createdAt: -1 }).exec();
  }

  async getJobsByEmployer(employerId: string): Promise<IJob[]> {
    if (!employerId) {
      throw new Error("Employer ID is required");
    }
    return Job.find({ postedBy: employerId, isActive: true })
      .sort({ createdAt: -1 })
      .exec();
  }

  async searchJobsByTitle(searchTerm: string): Promise<IJob[]> {
    if (!searchTerm) {
      throw new Error("Search term is required");
    }
    return Job.find({
      isActive: true,
      title: { $regex: searchTerm, $options: "i" },
    }).exec();
  }

  async getJobsByTag(tag: string): Promise<IJob[]> {
    if (!tag) {
      throw new Error("Tag is required");
    }
    return Job.find({
      isActive: true,
      tags: { $in: [tag] },
    }).exec();
  }

  /**
   * AI-powered job content generation with fallback
   */
  async generateJobContent(jobTitle: string): Promise<GeneratedJobContent> {
    if (!jobTitle || jobTitle.trim() === "") {
      throw new Error("Job title is required");
    }

    // ✅ Check if AI is available
    if (!this.model) {
      console.warn(
        "⚠️ AI not available. Using fallback job content generation.",
      );
      return this.generateFallbackJobContent(jobTitle);
    }

    const prompt = `
      Generate complete job content for: "${jobTitle}"
      
      Return ONLY this JSON format:
      {
        "title": string,
        "company": string (generate plausible company name),
        "location": string (generate plausible location),
        "salary": number (generate realistic salary for role),
        "minSalary": number,
        "maxSalary": number,
        "experienceLevel": string (entry, mid, senior, lead),
        "workMode": string (remote, hybrid, on-site),
        "jobType": string (full-time, part-time, contract, internship),
        "description": string (2-3 paragraphs describing role),
        "requirements": string (bullet-point list of requirements),
        "benefits": string (bullet-point list of benefits),
        "tags": string[] (5-10 relevant tags)
      }
      
      Make it realistic and professional.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const cleanedText = this.cleanAIResponse(result.response.text());

      const parsed = JSON.parse(cleanedText);

      // Validate required fields
      const requiredFields = [
        "title",
        "company",
        "location",
        "description",
        "requirements",
      ];
      for (const field of requiredFields) {
        if (!parsed[field]) {
          throw new Error(`Generated content missing required field: ${field}`);
        }
      }

      return parsed;
    } catch (error) {
      console.error("Job content generation failed:", error);
      console.warn("Using fallback job content.");
      return this.generateFallbackJobContent(jobTitle);
    }
  }

  /**
   * Generate fallback job content when AI is unavailable
   */
  private generateFallbackJobContent(jobTitle: string): GeneratedJobContent {
    const companies = [
      "TechCorp",
      "Innovate Inc",
      "FutureWorks",
      "Digital Solutions",
      "CloudNine",
      "CodeMasters",
      "DataFlow",
      "TechVentures",
    ];
    const locations = [
      "San Francisco, CA",
      "New York, NY",
      "Austin, TX",
      "Remote",
      "Seattle, WA",
      "Boston, MA",
      "Chicago, IL",
    ];
    const salaries = [70000, 85000, 100000, 120000, 150000, 180000];
    const levels: ExperienceLevel[] = ["entry", "mid", "senior", "lead"];
    const modes: WorkMode[] = ["remote", "hybrid", "on-site"];
    const types: JobType[] = [
      "full-time",
      "part-time",
      "contract",
      "internship",
    ];

    const randomItem = <T>(arr: T[]): T =>
      arr[Math.floor(Math.random() * arr.length)];
    const randomSalary = randomItem(salaries);

    const descriptions = [
      `We are looking for a talented ${jobTitle} to join our dynamic team. This role involves working on cutting-edge projects and collaborating with cross-functional teams to deliver innovative solutions. The ideal candidate will have a passion for technology and a track record of delivering high-quality work.`,
      `Join our team as a ${jobTitle} and help us build the next generation of products. You'll work with modern technologies and have the opportunity to make a significant impact on our platform. We're looking for someone who is creative, collaborative, and committed to excellence.`,
      `We're seeking a skilled ${jobTitle} to contribute to our growing engineering team. In this role, you'll be responsible for designing and implementing new features, improving system performance, and mentoring junior developers. If you're passionate about technology and want to work with a great team, we'd love to hear from you.`,
    ];

    const requirementsList = [
      `• ${jobTitle} experience\n• Strong problem-solving skills\n• Excellent communication abilities\n• Team collaboration experience\n• Relevant technical skills`,
      `• ${jobTitle} experience\n• Strong analytical skills\n• Experience with modern development practices\n• Good communication skills`,
    ];

    const benefitsList = [
      "• Competitive salary\n• Health insurance\n• 401(k) matching\n• Flexible work hours\n• Professional development opportunities",
      "• Competitive compensation\n• Health, dental, and vision insurance\n• Remote work options\n• Flexible schedule\n• Career growth opportunities",
    ];

    return {
      title: jobTitle,
      company: randomItem(companies),
      location: randomItem(locations),
      salary: randomSalary,
      minSalary: Math.round(randomSalary * 0.7),
      maxSalary: Math.round(randomSalary * 1.3),
      experienceLevel: randomItem(levels),
      workMode: randomItem(modes),
      jobType: randomItem(types),
      description: randomItem(descriptions),
      requirements: randomItem(requirementsList),
      benefits: randomItem(benefitsList),
      tags: [
        jobTitle.toLowerCase(),
        "technology",
        "innovation",
        "teamwork",
        "leadership",
        "development",
      ],
    };
  }

  private cleanAIResponse(responseText: string): string {
    return responseText
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .replace(/^[^{]*/, "")
      .replace(/[^}]*$/, "")
      .trim();
  }

  async getJobStatistics(): Promise<any> {
    const stats = await Job.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalJobs: { $sum: 1 },
          averageSalary: { $avg: "$salary" },
          minSalary: { $min: "$minSalary" },
          maxSalary: { $max: "$maxSalary" },
          byType: { $addToSet: "$jobType" },
          byMode: { $addToSet: "$workMode" },
          byLevel: { $addToSet: "$experienceLevel" },
        },
      },
    ]);

    return stats[0] || { totalJobs: 0 };
  }

  /**
   * Search jobs using parsed filters
   */
  // In jobSearchService.ts
  async searchJobs(filters: ParsedJobFilters): Promise<SearchResult> {
    const whereClause: Record<string, any> = {};

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
  async parseNaturalLanguageQuery(query: string): Promise<ParsedJobFilters> {
    if (!query || query.trim().length === 0) {
      throw new Error("Search query is required");
    }

    // Check if AI is available
    if (!this.model) {
      console.warn("⚠️ AI not available. Using fallback parsing.");
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

      // Log what was parsed for debugging
      console.log("AI Parsed Filters:", parsed);

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
    } catch (error) {
      console.error("Query parsing failed:", error);
      return this.parseFallback(query);
    }
  }

  private validateExperienceLevel(
    level: string | null,
  ): ParsedJobFilters["experienceLevel"] {
    const validLevels = ["entry", "mid", "senior", "lead"];
    if (level && validLevels.includes(level.toLowerCase())) {
      return level.toLowerCase() as ParsedJobFilters["experienceLevel"];
    }
    return null;
  }

  private validateWorkMode(mode: string | null): ParsedJobFilters["workMode"] {
    const validModes = ["remote", "hybrid", "on-site"];
    if (mode && validModes.includes(mode.toLowerCase())) {
      return mode.toLowerCase() as ParsedJobFilters["workMode"];
    }
    return null;
  }

  private validateJobType(type: string | null): ParsedJobFilters["jobType"] {
    const validTypes = ["full-time", "part-time", "contract", "internship"];
    if (type && validTypes.includes(type.toLowerCase())) {
      return type.toLowerCase() as ParsedJobFilters["jobType"];
    }
    return null;
  }

  private parseFallback(query: string): ParsedJobFilters {
    const lowerQuery = query.toLowerCase();
    const filters: ParsedJobFilters = {
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
    const titleMatch =
      query.match(
        /(?:senior|junior|lead|mid)\s+(\w+)\s+(developer|engineer|designer|manager)/i,
      ) || query.match(/(\w+)\s+(developer|engineer|designer|manager)/i);
    if (titleMatch) {
      filters.title = titleMatch[1] + " " + titleMatch[2];
    }

    // Extract location (look for capitalized words after 'in', 'at', 'near')
    const locationMatch = query.match(
      /(?:in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
    );
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
      if (
        fullMatch.toLowerCase().includes("k") ||
        query
          .substring(
            salaryMatch.index + salaryMatch[0].length,
            salaryMatch.index + salaryMatch[0].length + 1,
          )
          .toLowerCase() === "k"
      ) {
        num = num * 1000;
      }
      if (num > 1000) {
        // Only consider numbers > 1000 as salary
        salaries.push(num);
      }
    }

    if (salaries.length > 0) {
      if (
        lowerQuery.includes("minimum") ||
        lowerQuery.includes("min") ||
        lowerQuery.includes("at least")
      ) {
        filters.minSalary = salaries[0];
      } else if (
        lowerQuery.includes("maximum") ||
        lowerQuery.includes("max") ||
        lowerQuery.includes("up to")
      ) {
        filters.maxSalary = salaries[0];
      } else {
        filters.minSalary = salaries[0];
        if (salaries.length > 1) {
          filters.maxSalary = salaries[1];
        }
      }
    }

    // Extract experience level
    if (/(senior|lead|5\+|5 years)/i.test(lowerQuery)) {
      filters.experienceLevel = "senior";
    } else if (/(junior|entry|0-2|1-2)/i.test(lowerQuery)) {
      filters.experienceLevel = "entry";
    } else if (/(mid|3-5|3 years)/i.test(lowerQuery)) {
      filters.experienceLevel = "mid";
    }

    // Extract work mode
    if (/(remote|work from home|wfh)/i.test(lowerQuery)) {
      filters.workMode = "remote";
    } else if (/(hybrid|flexible)/i.test(lowerQuery)) {
      filters.workMode = "hybrid";
    } else if (/(on-site|onsite|in office)/i.test(lowerQuery)) {
      filters.workMode = "on-site";
    }

    return filters;
  }
}

export default new JobService();
