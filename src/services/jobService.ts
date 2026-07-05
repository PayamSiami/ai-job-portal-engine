import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import Job, { IJob } from "../models/Job.models.js";
import { config } from "../config/index.js";

// Define strict types that match the model
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

class JobService {
  private genAI?: GoogleGenerativeAI;
  private model?: GenerativeModel;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
          model: config.GEMINI_MODEL,
          generationConfig: {
            temperature: config.GEMINI_TEMPERATURE,
            topK: config.GEMINI_TOP_K,
            topP: config.GEMINI_TOP_P,
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

  // In jobService.ts
  async getJobsWithMongoQuery(
    mongoQuery: any,
    options: JobPaginationOptions = {},
  ): Promise<JobPaginationResult> {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    // Merge with base query (only show active jobs)
    const query = { isActive: true, ...mongoQuery };

    // Execute the query with pagination
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
   * Generate job content using AI with fallback
   */
  async generateJobContent(jobTitle: string): Promise<GeneratedJobContent> {
    if (!jobTitle || jobTitle.trim() === "") {
      throw new Error("Job title is required");
    }

    // Check if AI model is available
    if (!this.model) {
      console.warn(
        "⚠️ AI model not available. Using fallback content generation.",
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
      const cleanedText = result.response
        .text()
        .replace(/```json\s*/g, "")
        .replace(/\s*```/g, "")
        .trim();

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
      console.warn("Using fallback content generation.");
      return this.generateFallbackJobContent(jobTitle);
    }
  }

  /**
   * ✅ Generate fallback job content when AI is unavailable
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
}

export default new JobService();
