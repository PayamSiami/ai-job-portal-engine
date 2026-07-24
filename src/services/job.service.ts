import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import Job, { IJob } from "../models/Job.models.js";
import { config } from "../config/index.js";
import Company from "../models/Company.models.js";
import { AppError } from "../utils/errorHandler.js";
import Application, { ApplicationStatus } from "../models/Application.model.js";
import logger from "../utils/logger.js";
import mongoose, { Types } from "mongoose";
import { JobPerformance } from "./dashboard.service.js";

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
          model: config.GEMINI_MODEL || "gemini-pro",
          generationConfig: {
            temperature: config.GEMINI_TEMPERATURE || 0.7,
            topK: config.GEMINI_TOP_K || 40,
            topP: config.GEMINI_TOP_P || 0.95,
            maxOutputTokens: 2048,
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
      .populate("company", "name logo industry location")
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

  /**
   * Get jobs with MongoDB query
   */
  async getJobsWithMongoQuery(
    where: any,
    options: { page: number; limit: number },
  ): Promise<any> {
    try {
      const { page, limit } = options;
      const skip = (page - 1) * limit;

      const [jobs, total] = await Promise.all([
        Job.find(where)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("company", "name logo"),
        Job.countDocuments(where),
      ]);

      return {
        jobs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("❌ Error in getJobsWithMongoQuery:", error);
      throw new AppError("Failed to get jobs", 500);
    }
  }

  // services/job.service.ts

  async getJobById(jobId: string) {
    try {
      const job = await Job.findOne({
        _id: jobId,
        isDeleted: { $ne: true },
      })
        .populate("company", "name logo industry location") // ✅ Populate company
        .populate("postedBy", "name email")
        .lean();

      return job;
    } catch (error) {
      logger.error("❌ Error in getJobById:", error);
      throw new AppError("Failed to fetch job", 500);
    }
  }

  async createJob(userId: string, jobData: any): Promise<any> {
    const company = await Company.findOne({ ownerId: userId });

    if (!company) {
      throw new AppError(
        "Company not found. Please create a company first.",
        404,
      );
    }

    const job = new Job({
      ...jobData,
      company: company._id,
      postedBy: userId,
      isActive: true,
    });

    await job.save();
    return job;
  }

  async getActiveJobs(): Promise<IJob[]> {
    return Job.find({ isActive: true }).sort({ createdAt: -1 }).exec();
  }

  /**
   * Generate complete job content using AI
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
      
      Return ONLY this JSON format (no markdown, no code blocks):
      {
        "title": "${jobTitle}",
        "company": "Generate a realistic company name (e.g., TechCorp, Innovate Inc, FutureWorks)",
        "location": "Generate a realistic location (e.g., San Francisco, CA, New York, NY, Remote)",
        "salary": Generate a realistic annual salary number for this role,
        "minSalary": Generate a realistic minimum annual salary number,
        "maxSalary": Generate a realistic maximum annual salary number,
        "experienceLevel": "One of: entry, mid, senior, lead",
        "workMode": "One of: remote, hybrid, on-site",
        "jobType": "One of: full-time, part-time, contract, internship",
        "description": "Write a 2-3 paragraph detailed job description. Include: role overview, key responsibilities, team culture, and why this role matters.",
        "requirements": "List requirements as bullet points separated by newlines. Example: • 5+ years of experience\\n• Strong problem-solving skills\\n• Excellent communication",
        "benefits": "List benefits as bullet points separated by newlines. Example: • Competitive salary\\n• Health insurance\\n• 401(k) matching",
        "tags": ["Generate", "5-10", "relevant", "tags", "for", "this", "job"]
      }
      
      Make it realistic, professional, and tailored to the specific job title. Use appropriate salary ranges for the role and location.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      let text = response.text();

      // Clean the response - remove markdown code blocks
      text = text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      // Parse JSON
      const parsed = JSON.parse(text);

      // Ensure all required fields exist
      const requiredFields = [
        "title",
        "company",
        "location",
        "salary",
        "minSalary",
        "maxSalary",
        "experienceLevel",
        "workMode",
        "jobType",
        "description",
        "requirements",
        "benefits",
        "tags",
      ];

      for (const field of requiredFields) {
        if (!parsed[field]) {
          throw new Error(`Generated content missing required field: ${field}`);
        }
      }

      // Ensure arrays are properly formatted
      if (typeof parsed.tags === "string") {
        parsed.tags = parsed.tags
          .split(",")
          .map((tag: string) => tag.trim())
          .filter(Boolean);
      }

      // Validate enums
      const validLevels: ExperienceLevel[] = ["entry", "mid", "senior", "lead"];
      const validModes: WorkMode[] = ["remote", "hybrid", "on-site"];
      const validTypes: JobType[] = [
        "full-time",
        "part-time",
        "contract",
        "internship",
      ];

      if (!validLevels.includes(parsed.experienceLevel)) {
        parsed.experienceLevel = "mid";
      }
      if (!validModes.includes(parsed.workMode)) {
        parsed.workMode = "hybrid";
      }
      if (!validTypes.includes(parsed.jobType)) {
        parsed.jobType = "full-time";
      }

      return parsed as GeneratedJobContent;
    } catch (error) {
      console.error("❌ Job content generation failed:", error);
      console.warn("⚠️ Using fallback content generation.");
      return this.generateFallbackJobContent(jobTitle);
    }
  }

  /**
   * Generate fallback job content when AI is unavailable
   */
  private generateFallbackJobContent(jobTitle: string): GeneratedJobContent {
    const companies = [
      "TechCorp Innovations",
      "InnoSoft Solutions",
      "FutureWorks",
      "Digital Dynamics",
      "CloudNine Systems",
      "CodeMasters Inc",
      "DataFlow Technologies",
      "TechVentures Group",
    ];
    const locations = [
      "San Francisco, CA",
      "New York, NY",
      "Austin, TX",
      "Remote",
      "Seattle, WA",
      "Boston, MA",
      "Chicago, IL",
      "Los Angeles, CA",
    ];
    const salaryRanges = {
      entry: { min: 45000, max: 65000, avg: 55000 },
      mid: { min: 65000, max: 95000, avg: 80000 },
      senior: { min: 95000, max: 150000, avg: 120000 },
      lead: { min: 130000, max: 200000, avg: 165000 },
    };

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
    const randomLevel = randomItem(levels);
    const salaryRange = salaryRanges[randomLevel];
    const randomSalary = Math.floor(
      salaryRange.min + Math.random() * (salaryRange.max - salaryRange.min),
    );

    const descriptions = [
      `We are looking for a talented ${jobTitle} to join our dynamic team. This role involves working on cutting-edge projects and collaborating with cross-functional teams to deliver innovative solutions. The ideal candidate will have a passion for technology and a track record of delivering high-quality work.

      In this role, you will be responsible for designing, developing, and maintaining our core products. You'll work closely with product managers, designers, and other engineers to create features that delight our users and drive business growth.

      Our team culture is built on collaboration, continuous learning, and innovation. We believe in empowering our engineers to take ownership of their work and make a real impact.`,

      `Join our team as a ${jobTitle} and help us build the next generation of products. You'll work with modern technologies and have the opportunity to make a significant impact on our platform. We're looking for someone who is creative, collaborative, and committed to excellence.

      As a ${jobTitle}, you'll be responsible for architecting and implementing solutions, mentoring junior developers, and contributing to our technical strategy. You'll have the freedom to experiment with new technologies and drive innovation across the organization.

      We offer a collaborative environment where your ideas are valued and your contributions matter. If you're passionate about technology and want to work with a great team, we'd love to hear from you.`,

      `We're seeking a skilled ${jobTitle} to contribute to our growing engineering team. In this role, you'll be responsible for designing and implementing new features, improving system performance, and mentoring junior developers. If you're passionate about technology and want to work with a great team, we'd love to hear from you.

      This is an exciting opportunity to work on challenging problems and deliver solutions that make a difference. You'll collaborate with stakeholders across the organization and have the chance to shape the future of our products.

      We value work-life balance, professional growth, and a positive team culture. Join us and be part of a team that's building something great.`,
    ];

    const requirementsList = [
      `• ${Math.floor(Math.random() * 5) + 3}+ years of experience as a ${jobTitle}
• Strong problem-solving and analytical skills
• Excellent written and verbal communication skills
• Proven ability to work in cross-functional teams
• Experience with modern development practices and tools
• Bachelor's degree in Computer Science or related field (or equivalent experience)`,

      `• ${Math.floor(Math.random() * 7) + 5}+ years of experience in ${jobTitle}
• Strong technical leadership and mentoring skills
• Experience with agile development methodologies
• Ability to drive technical decisions and influence product strategy
• Passion for learning and staying current with industry trends
• Master's degree in Computer Science or related field (preferred)`,

      `• ${Math.floor(Math.random() * 4) + 2}+ years of experience as a ${jobTitle}
• Strong analytical and problem-solving abilities
• Excellent collaboration and communication skills
• Experience with version control systems (Git)
• Knowledge of software development best practices
• Bachelor's degree in Computer Science or related field`,
    ];

    const benefitsList = [
      `• Competitive salary and equity package
• Comprehensive health, dental, and vision insurance
• 401(k) retirement plan with company match
• Flexible working hours and remote work options
• Generous paid time off and holidays
• Professional development budget and learning opportunities
• Team events and social activities`,

      `• Competitive compensation package
• Health, dental, and vision insurance
• 401(k) with company matching
• Remote-first work culture
• Flexible schedule and work-life balance
• Career growth and advancement opportunities
• Wellness programs and mental health support
• Company-sponsored conferences and training`,
    ];

    const tagOptions = [
      jobTitle.toLowerCase(),
      "technology",
      "innovation",
      "teamwork",
      "leadership",
      "development",
      "software engineering",
      "cloud computing",
      "artificial intelligence",
      "machine learning",
      "data science",
      "frontend",
      "backend",
      "fullstack",
      "devops",
      "agile",
      "scrum",
      "remote work",
      "digital transformation",
    ];

    // Generate random tags (5-10)
    const numTags = Math.floor(Math.random() * 6) + 5;
    const tags: string[] = [];
    const shuffled = [...tagOptions].sort(() => 0.5 - Math.random());
    for (let i = 0; i < Math.min(numTags, shuffled.length); i++) {
      if (shuffled[i] && !tags.includes(shuffled[i])) {
        tags.push(shuffled[i]);
      }
    }

    return {
      title: jobTitle,
      company: randomItem(companies),
      location: randomItem(locations),
      salary: randomSalary,
      minSalary: Math.round(randomSalary * 0.7),
      maxSalary: Math.round(randomSalary * 1.3),
      experienceLevel: randomLevel,
      workMode: randomItem(modes),
      jobType: randomItem(types),
      description: randomItem(descriptions),
      requirements: randomItem(requirementsList),
      benefits: randomItem(benefitsList),
      tags: tags,
    };
  }

  /**
   * Get job statistics for employer
   */
  async getJobStats(employerId: string): Promise<any> {
    try {
      logger.info(`📊 Fetching job stats for employer: ${employerId}`);

      // Get all jobs for this employer
      const jobs = await Job.find({
        postedBy: employerId,
        isDeleted: { $ne: true },
      });

      const jobIds = jobs.map((job: any) => job._id);

      // Get applications for these jobs
      const applications = await Application.find({
        jobId: { $in: jobIds },
      });

      // Calculate statistics
      const totalJobs = jobs.length;
      const activeJobs = jobs.filter((j: any) => j.isActive === true).length;
      const totalApplications = applications.length;

      const pendingApplications = applications.filter(
        (a: any) => a.status === "pending" || a.status === "PENDING",
      ).length;

      const reviewingApplications = applications.filter(
        (a: any) => a.status === "reviewing" || a.status === "REVIEWING",
      ).length;

      const shortlistedApplications = applications.filter(
        (a: any) => a.status === "shortlisted" || a.status === "SHORTLISTED",
      ).length;

      const interviewingApplications = applications.filter(
        (a: any) => a.status === "interviewing" || a.status === "INTERVIEWING",
      ).length;

      const hiredApplications = applications.filter(
        (a: any) => a.status === "hired" || a.status === "HIRED",
      ).length;

      const rejectedApplications = applications.filter(
        (a: any) => a.status === "rejected" || a.status === "REJECTED",
      ).length;

      // Get applications by job
      const applicationsByJob = await Promise.all(
        jobs.map(async (job: any) => {
          const count = await Application.countDocuments({
            jobId: job._id,
          });
          return {
            jobId: job._id,
            title: job.title,
            applications: count,
          };
        }),
      );

      return {
        totalJobs,
        activeJobs,
        inactiveJobs: totalJobs - activeJobs,
        totalApplications,
        pendingApplications,
        reviewingApplications,
        shortlistedApplications,
        interviewingApplications,
        hiredApplications,
        rejectedApplications,
        applicationsByJob: applicationsByJob.sort(
          (a, b) => b.applications - a.applications,
        ),
        conversionRate:
          totalApplications > 0
            ? Number(((hiredApplications / totalApplications) * 100).toFixed(1))
            : 0,
        shortlistRate:
          totalApplications > 0
            ? Number(
                ((shortlistedApplications / totalApplications) * 100).toFixed(
                  1,
                ),
              )
            : 0,
        rejectionRate:
          totalApplications > 0
            ? Number(
                ((rejectedApplications / totalApplications) * 100).toFixed(1),
              )
            : 0,
      };
    } catch (error) {
      logger.error("❌ Error in getJobStats:", error);
      throw new AppError("Failed to get job statistics", 500);
    }
  }

  /**
   * Get job applications for a specific job
   */
  async getJobApplications(
    jobId: string,
    employerId: string,
    options: {
      page: number;
      limit: number;
      status?: string;
    },
  ): Promise<any> {
    try {
      const { page, limit, status } = options;
      const skip = (page - 1) * limit;

      // ✅ Validate jobId
      if (!Types.ObjectId.isValid(jobId)) {
        throw new AppError("Invalid job ID format", 400);
      }

      // ✅ Validate employerId
      if (!Types.ObjectId.isValid(employerId)) {
        throw new AppError("Invalid employer ID format", 400);
      }

      // ✅ Verify job belongs to employer
      const job = await Job.findOne({
        _id: new Types.ObjectId(jobId),
        postedBy: new Types.ObjectId(employerId),
        isDeleted: { $ne: true },
      });

      if (!job) {
        throw new AppError("Job not found or access denied", 404);
      }

      // ✅ Build query
      const query: any = {
        jobId: new Types.ObjectId(jobId), // ✅ Use ObjectId
      };

      if (status) {
        query.status = status;
      }

      // ✅ Log query for debugging
      logger.debug(
        `Fetching applications for job ${jobId} with status: ${status || "all"}`,
      );

      // ✅ Get applications with pagination
      const [applications, total] = await Promise.all([
        Application.find(query)
          .populate("userId", "name email profileImage phone location")
          .populate("resumeId", "title template skills")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(), // ✅ Use lean() for better performance
        Application.countDocuments(query),
      ]);

      // ✅ Get application statistics
      const statusCounts = await Application.aggregate([
        { $match: { jobId: new Types.ObjectId(jobId) } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);

      const statusSummary = statusCounts.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      return {
        applications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        summary: {
          total,
          byStatus: statusSummary,
        },
      };
    } catch (error) {
      logger.error("❌ Error in getJobApplications:", {
        error: error instanceof Error ? error.message : "Unknown error",
        jobId,
        employerId,
        options,
      });

      // ✅ Check for specific errors
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error && error.name === "CastError") {
        throw new AppError("Invalid ID format", 400);
      }

      throw new AppError("Failed to get job applications", 500);
    }
  }

  /**
   * Get similar jobs
   */
  async getSimilarJobs(jobId: string, limit: number = 5): Promise<any[]> {
    try {
      const job = await Job.findById(jobId);

      if (!job) {
        throw new AppError("Job not found", 404);
      }

      // Find similar jobs based on title, skills, or category
      const similarJobs = await Job.find({
        _id: { $ne: jobId },
        isActive: true,
        isDeleted: { $ne: true },
        $or: [
          {
            title: {
              $regex: job.title.split(" ").slice(0, 3).join("|"),
              $options: "i",
            },
          },
          { skills: { $in: job.skills || [] } },
          // { category: job.category },
          // { industry: job.industry },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("company", "name logo");

      return similarJobs;
    } catch (error) {
      logger.error("❌ Error in getSimilarJobs:", error);
      throw new AppError("Failed to get similar jobs", 500);
    }
  }

  /**
   * Bulk create jobs
   */
  async bulkCreateJobs(employerId: string, jobsData: any[]): Promise<any[]> {
    try {
      const createdJobs = [];

      for (const jobData of jobsData) {
        const job = await Job.create({
          ...jobData,
          postedBy: employerId,
          isActive: true,
          isDeleted: false,
        });
        createdJobs.push(job);
      }

      return createdJobs;
    } catch (error) {
      logger.error("❌ Error in bulkCreateJobs:", error);
      throw new AppError("Failed to bulk create jobs", 500);
    }
  }

  /**
   * Get job performance metrics
   */
  async getJobPerformance(
    employerId: string,
    timeframe: number = 30,
  ): Promise<JobPerformance> {
    const company = await Company.findOne({ ownerId: employerId });
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    const jobs = await Job.find({
      postedBy: employerId,
      createdAt: {
        $gte: new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000),
      },
    });

    const jobIds = jobs.map((job: any) => job._id);

    if (jobIds.length === 0) {
      return {
        totalJobs: 0,
        activeJobs: 0,
        jobsByStatus: {},
        applicationsPerJob: 0,
        averageTimeToFill: 0,
        topPerformingJobs: [],
      };
    }

    const applications = await Application.find({
      jobId: { $in: jobIds },
    });

    const jobsByStatus: Record<string, number> = {};
    jobs.forEach((job: any) => {
      jobsByStatus[job.status || "active"] =
        (jobsByStatus[job.status || "active"] || 0) + 1;
    });

    // Calculate top performing jobs
    const jobPerformance = jobs.map((job: any) => {
      const jobApps = applications.filter(
        (app: any) => app.jobId.toString() === job._id.toString(),
      );
      const hires = jobApps.filter(
        (app: any) => app.status === ApplicationStatus.HIRED,
      );
      return {
        jobTitle: job.title,
        applicationCount: jobApps.length,
        hireCount: hires.length,
        conversionRate:
          jobApps.length > 0 ? (hires.length / jobApps.length) * 100 : 0,
      };
    });

    const topPerformingJobs = jobPerformance
      .sort(
        (a: { conversionRate: number }, b: { conversionRate: number }) =>
          b.conversionRate - a.conversionRate,
      )
      .slice(0, 5);

    return {
      totalJobs: jobs.length,
      activeJobs: jobs.filter((j: any) => j.isActive).length,
      jobsByStatus,
      applicationsPerJob:
        jobs.length > 0 ? applications.length / jobs.length : 0,
      averageTimeToFill: 0, // Calculate based on job posting to hire date
      topPerformingJobs,
    };
  }

  async getJobsByEmployer(
    employerId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
    } = {},
  ): Promise<any[]> {
    try {
      // Validate employer ID
      if (!mongoose.Types.ObjectId.isValid(employerId)) {
        throw new Error("Invalid employer ID format");
      }

      const { page = 0, limit = 10, status, search } = options;

      // Build query
      const query: any = {
        postedBy: new mongoose.Types.ObjectId(employerId),
        isDeleted: false,
      };

      // Add status filter if provided
      if (status) {
        if (status === "active") {
          query.isActive = true;
        } else if (status === "inactive") {
          query.isActive = false;
        }
      }

      // Add search filter
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { location: { $regex: search, $options: "i" } },
          { skills: { $in: [search] } },
        ];
      }

      // Execute query with pagination
      const jobs = await Job.find(query)
        .populate("company", "name logo location")
        .populate("postedBy", "username email")
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .lean();

      return jobs;
    } catch (error: any) {
      console.error("Error in getJobsByEmployer:", error);
      throw new Error(`Failed to get jobs by employer: ${error.message}`);
    }
  }

  /**
   * Get featured jobs
   */
  async getFeaturedJobs(limit: number = 6): Promise<any[]> {
    try {
      return await Job.find({
        isActive: true,
        isFeatured: true,
        isDeleted: { $ne: true },
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("company", "name logo");
    } catch (error) {
      logger.error("❌ Error in getFeaturedJobs:", error);
      throw new AppError("Failed to get featured jobs", 500);
    }
  }

  /**
   * Toggle job status (active/inactive)
   */
  async toggleJobStatus(jobId: string, employerId: string): Promise<any> {
    try {
      const job = await Job.findOne({
        _id: jobId,
        postedBy: employerId,
        isDeleted: { $ne: true },
      });

      if (!job) {
        throw new AppError("Job not found or access denied", 404);
      }

      job.isActive = !job.isActive;
      await job.save();

      return job;
    } catch (error) {
      logger.error("❌ Error in toggleJobStatus:", error);
      throw new AppError("Failed to toggle job status", 500);
    }
  }

  /**
   * ✅ Delete a job (soft delete)
   */
  async deleteJob(jobId: string, userId: string) {
    try {
      const job = await Job.findOne({
        _id: jobId,
        postedBy: userId,
        isDeleted: { $ne: true },
      });

      if (!job) {
        throw new AppError("Job not found or access denied", 404);
      }

      // Soft delete
      job.isDeleted = true;
      // job.deletedAt = new Date();
      job.isActive = false;
      await job.save();

      return job;
    } catch (error) {
      logger.error("❌ Error in deleteJob:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("Failed to delete job", 500);
    }
  }

  /**
   * Update a job
   */

  async updateJob(jobId: string, userId: string, data: any) {
    try {
      // ✅ Validate jobId
      if (!Types.ObjectId.isValid(jobId)) {
        throw new AppError("Invalid job ID format", 400);
      }

      // Find job and verify ownership
      const job = await Job.findOne({
        _id: new Types.ObjectId(jobId),
        postedBy: new Types.ObjectId(userId),
        isDeleted: { $ne: true },
      });

      if (!job) {
        throw new AppError("Job not found or access denied", 404);
      }

      // ✅ Create a clean update object
      const updateData: any = {};

      // ✅ Define allowed fields and their types
      const allowedFields = [
        "title",
        "description",
        "location",
        "jobType",
        "workMode",
        "experienceLevel",
        "requirements",
        "responsibilities",
        "benefits",
        "minSalary",
        "maxSalary",
        "isActive",
        "isFeatured",
        "status",
      ];

      if (data.minSalary !== undefined || data.maxSalary !== undefined) {
        updateData.salary = {
          min: data.minSalary || 0,
          max: data.maxSalary || 0,
          currency: data.currency || "USD",
        };
      }

      if (data.tags) {
        updateData.skills = Array.isArray(data.tags)
          ? data.tags
          : data.tags.split(",").map((t: string) => t.trim());
      }

      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          // Handle arrays
          if (Array.isArray(data[field])) {
            updateData[field] = data[field];
          }
          // Handle strings
          else if (typeof data[field] === "string") {
            updateData[field] = data[field].trim();
          }
          // Handle other types
          else {
            updateData[field] = data[field];
          }
        }
      }

      // ✅ Don't allow updating protected fields
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.postedBy;
      delete updateData.isDeleted;
      delete updateData.deletedAt;
      delete updateData.views;
      delete updateData.applicationsCount;

      // Validate we have something to update
      if (Object.keys(updateData).length === 0) {
        throw new AppError("No valid fields to update", 400);
      }

      // ✅ Update the job with the new option syntax
      const updatedJob = await Job.findByIdAndUpdate(
        jobId,
        { $set: updateData },
        {
          new: true,
          runValidators: true,
          context: "query",
          returnDocument: "after", // ✅ Fix the deprecation warning
        },
      )
        .populate("company", "name logo")
        .populate("postedBy", "name email");

      if (!updatedJob) {
        throw new AppError("Failed to update job", 500);
      }

      return updatedJob;
    } catch (error) {
      if (error instanceof AppError) throw error;

      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }

      throw new AppError("Failed to update job. Please check your input.", 400);
    }
  }

  // services/job.service.ts

  async getGlobalJobStats(): Promise<any> {
    try {
      // Get all jobs
      const jobs = await Job.find({
        isDeleted: { $ne: true },
      }).lean();

      const jobIds = jobs.map((job: any) => job._id);

      if (jobIds.length === 0) {
        return this.getEmptyGlobalStats();
      }

      // Get applications for all jobs
      const applications = await Application.find({
        job: { $in: jobIds },
      }).lean();

      // Calculate statistics
      const totalJobs = jobs.length;
      const activeJobs = jobs.filter((j: any) => j.isActive === true).length;
      const featuredJobs = jobs.filter(
        (j: any) => j.isFeatured === true,
      ).length;
      const totalApplications = applications.length;

      // Status counts
      const statusCounts = this.getStatusCounts(applications);

      // Job distribution
      const jobsByType = jobs.reduce(
        (acc: Record<string, number>, job: any) => {
          const type = job.jobType || job.type || "full-time";
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {},
      );

      const jobsByWorkMode = jobs.reduce(
        (acc: Record<string, number>, job: any) => {
          const mode = job.workMode || job.workType || "on-site";
          acc[mode] = (acc[mode] || 0) + 1;
          return acc;
        },
        {},
      );

      const jobsByExperience = jobs.reduce(
        (acc: Record<string, number>, job: any) => {
          const level = job.experienceLevel || "mid";
          acc[level] = (acc[level] || 0) + 1;
          return acc;
        },
        {},
      );

      // Top performing jobs
      const applicationsByJob = jobIds.map((jobId) => {
        const count = applications.filter(
          (app) => app.job.toString() === jobId.toString(),
        ).length;
        const job = jobs.find((j) => j._id.toString() === jobId.toString());
        return {
          jobId: jobId,
          title: job?.title || "Unknown",
          company: job?.company || "Unknown",
          applications: count,
        };
      });

      // Calculate rates
      const hired = statusCounts.hired || 0;
      const shortlisted = statusCounts.shortlisted || 0;
      const rejected = statusCounts.rejected || 0;

      const avgApplicationsPerJob =
        totalJobs > 0 ? Number((totalApplications / totalJobs).toFixed(1)) : 0;

      const conversionRate =
        totalApplications > 0
          ? Number(((hired / totalApplications) * 100).toFixed(1))
          : 0;

      const shortlistRate =
        totalApplications > 0
          ? Number(((shortlisted / totalApplications) * 100).toFixed(1))
          : 0;

      const rejectionRate =
        totalApplications > 0
          ? Number(((rejected / totalApplications) * 100).toFixed(1))
          : 0;

      // Monthly trends
      const monthlyTrends = jobs.reduce(
        (acc: Record<string, number>, job: any) => {
          const date = job.createdAt || job.createdAt;
          const month = new Date(date).toISOString().slice(0, 7);
          acc[month] = (acc[month] || 0) + 1;
          return acc;
        },
        {},
      );

      const monthlyJobs = Object.entries(monthlyTrends)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12);

      const monthlyApps = applications.reduce(
        (acc: Record<string, number>, app: any) => {
          const date = app.appliedAt || app.createdAt;
          const month = new Date(date).toISOString().slice(0, 7);
          acc[month] = (acc[month] || 0) + 1;
          return acc;
        },
        {},
      );

      const monthlyApplications = Object.entries(monthlyApps)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month))
        .slice(-12);

      // Return result
      return {
        summary: {
          totalJobs,
          activeJobs,
          inactiveJobs: totalJobs - activeJobs,
          featuredJobs,
          totalApplications,
          avgApplicationsPerJob,
        },
        jobDistribution: {
          byType: jobsByType,
          byWorkMode: jobsByWorkMode,
          byExperience: jobsByExperience,
        },
        applicationStatus: {
          pending: statusCounts.pending || 0,
          reviewing: statusCounts.reviewing || 0,
          shortlisted,
          interviewing: statusCounts.interviewing || 0,
          hired,
          rejected,
          withdrawn: statusCounts.withdrawn || 0,
        },
        rates: {
          conversionRate,
          shortlistRate,
          rejectionRate,
        },
        topPerformingJobs: applicationsByJob
          .sort((a, b) => b.applications - a.applications)
          .slice(0, 10),
        trends: {
          monthlyJobs,
          monthlyApplications,
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("❌ Error in getGlobalJobStats:", error);
      throw new AppError(
        error instanceof Error
          ? error.message
          : "Failed to get global job statistics",
        500,
      );
    }
  }

  /**
   * Get job analytics for employer
   */
  async getJobAnalytics(
    employerId: string,
    timeRange: string = "30d",
  ): Promise<any> {
    try {
      logger.info(`📊 Fetching job analytics for employer: ${employerId}`);

      // Get all jobs for this employer
      const jobs = await Job.find({
        postedBy: employerId,
        isDeleted: { $ne: true },
      });

      const jobIds = jobs.map((job: any) => job._id);

      if (jobIds.length === 0) {
        return this.getEmptyAnalytics();
      }

      // Get applications for these jobs
      const applications = await Application.find({
        jobId: { $in: jobIds },
      });

      // Calculate date range
      const dateRange = this.getDateRange(timeRange);

      // Calculate statistics
      const stats = {
        total: jobs.length,
        activeJobs: jobs.filter((j: any) => j.isActive === true).length,
        byStatus: this.getStatusDistribution(jobs),
        byType: this.getTypeDistribution(jobs),
        byWorkMode: this.getWorkModeDistribution(jobs),
        applications: {
          total: applications.length,
          avgPerJob:
            jobs.length > 0
              ? Number((applications.length / jobs.length).toFixed(1))
              : 0,
          growth: this.calculateGrowth(applications, dateRange),
          byStatus: this.getApplicationStatusDistribution(applications),
        },
        performance: {
          conversionRate: this.calculateConversionRate(applications),
          timeToHire: this.calculateTimeToHire(applications),
          viewsPerJob: this.calculateViewsPerJob(jobs),
          shortlistRate: this.calculateShortlistRate(applications),
        },
        monthlyData: this.getMonthlyData(jobs, applications, dateRange),
        topPerformingJobs: this.getTopPerformingJobs(jobs, applications),
        recentActivity: this.getRecentActivity(applications),
      };

      return stats;
    } catch (error) {
      logger.error("❌ Error in getJobAnalytics:", error);
      throw new AppError("Failed to get job analytics", 500);
    }
  }

  private getEmptyAnalytics() {
    return {
      total: 0,
      byStatus: {
        draft: 0,
        open: 0,
        closed: 0,
        expired: 0,
        filled: 0,
      },
      byType: {
        fullTime: 0,
        partTime: 0,
        contract: 0,
        internship: 0,
        freelance: 0,
        remote: 0,
      },
      applications: {
        total: 0,
        avgPerJob: 0,
        growth: 0,
      },
      performance: {
        conversionRate: 0,
        timeToHire: 0,
        viewsPerJob: 0,
        shortlistRate: 0,
      },
      monthlyData: [],
      topPerformingJobs: [],
      recentActivity: [],
    };
  }

  private getDateRange(timeRange: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(startDate.getDate() - 90);
        break;
      case "1y":
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    return { startDate, endDate };
  }

  private getStatusDistribution(jobs: any[]) {
    const distribution = {
      draft: 0,
      open: 0,
      closed: 0,
      expired: 0,
      filled: 0,
    };

    jobs.forEach((job: any) => {
      const status = job.status?.toLowerCase() || "draft";
      if (status in distribution) {
        distribution[status as keyof typeof distribution]++;
      }
    });

    return distribution;
  }

  private getTypeDistribution(jobs: any[]) {
    const distribution = {
      fullTime: 0,
      partTime: 0,
      contract: 0,
      internship: 0,
      freelance: 0,
      remote: 0,
    };

    jobs.forEach((job: any) => {
      const type = job.jobType?.toLowerCase() || "fullTime";
      if (type in distribution) {
        distribution[type as keyof typeof distribution]++;
      }
    });

    return distribution;
  }

  private calculateGrowth(
    applications: any[],
    dateRange: { startDate: Date; endDate: Date },
  ) {
    const currentPeriod = applications.filter(
      (app: any) => app.createdAt >= dateRange.startDate,
    ).length;

    const previousPeriodStart = new Date(dateRange.startDate);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - 30);

    const previousPeriod = applications.filter(
      (app: any) =>
        app.createdAt >= previousPeriodStart &&
        app.createdAt < dateRange.startDate,
    ).length;

    if (previousPeriod === 0) return currentPeriod > 0 ? 100 : 0;
    return Number(
      (((currentPeriod - previousPeriod) / previousPeriod) * 100).toFixed(1),
    );
  }

  /**
   * Helper to get status counts
   */
  private getStatusCounts(applications: any[]): Record<string, number> {
    const counts: Record<string, number> = {};

    applications.forEach((app) => {
      const status = app.status?.toLowerCase() || "pending";
      counts[status] = (counts[status] || 0) + 1;
    });

    return counts;
  }

  /**
   * Get empty global stats when no jobs exist
   */
  private getEmptyGlobalStats() {
    return {
      summary: {
        totalJobs: 0,
        activeJobs: 0,
        inactiveJobs: 0,
        featuredJobs: 0,
        totalApplications: 0,
        avgApplicationsPerJob: 0,
      },
      jobDistribution: {
        byType: {},
        byWorkMode: {},
        byExperience: {},
      },
      applicationStatus: {
        pending: 0,
        reviewing: 0,
        shortlisted: 0,
        interviewing: 0,
        hired: 0,
        rejected: 0,
        withdrawn: 0,
      },
      rates: {
        conversionRate: 0,
        shortlistRate: 0,
        rejectionRate: 0,
      },
      topPerformingJobs: [],
      trends: {
        monthlyJobs: [],
        monthlyApplications: [],
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private calculateTimeToHire(applications: any[]) {
    const hiredApplications = applications.filter(
      (app: any) => app.status === "hired",
    );
    if (hiredApplications.length === 0) return 0;

    const totalDays = hiredApplications.reduce((sum: number, app: any) => {
      const hiredDate = app.hiredAt || app.updatedAt;
      const appliedDate = app.appliedAt || app.createdAt;
      const days = Math.ceil(
        (new Date(hiredDate).getTime() - new Date(appliedDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return sum + days;
    }, 0);

    return Number((totalDays / hiredApplications.length).toFixed(1));
  }

  private calculateViewsPerJob(jobs: any[]) {
    const totalViews = jobs.reduce(
      (sum: number, job: any) => sum + (job.views || 0),
      0,
    );
    return jobs.length > 0 ? Number((totalViews / jobs.length).toFixed(1)) : 0;
  }

  private calculateShortlistRate(applications: any[]) {
    const shortlisted = applications.filter((app: any) =>
      ["shortlisted", "interview_scheduled", "hired"].includes(app.status),
    ).length;

    return applications.length > 0
      ? Number(((shortlisted / applications.length) * 100).toFixed(1))
      : 0;
  }

  private getMonthlyData(
    jobs: any[],
    applications: any[],
    dateRange: { startDate: Date; endDate: Date },
  ) {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthlyData: Record<
      string,
      { jobs: number; applications: number; hires: number }
    > = {};

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      monthlyData[key] = { jobs: 0, applications: 0, hires: 0 };
    }

    // Count jobs
    jobs.forEach((job: any) => {
      const date = new Date(job.createdAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (monthlyData[key]) {
        monthlyData[key].jobs++;
      }
    });

    // Count applications and hires
    applications.forEach((app: any) => {
      const date = new Date(app.createdAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (monthlyData[key]) {
        monthlyData[key].applications++;
        if (app.status === "hired") {
          monthlyData[key].hires++;
        }
      }
    });

    return Object.entries(monthlyData).map(([key, data]) => ({
      month: months[new Date(key).getMonth()],
      jobs: data.jobs,
      applications: data.applications,
      hires: data.hires,
    }));
  }

  private getTopPerformingJobs(jobs: any[], applications: any[]) {
    return jobs
      .map((job: any) => {
        const jobApplications = applications.filter(
          (app: any) => app.jobId.toString() === job._id.toString(),
        );
        const views = job.views || 0;
        return {
          id: job._id,
          title: job.title,
          applications: jobApplications.length,
          views: views,
          conversionRate:
            views > 0
              ? Number(((jobApplications.length / views) * 100).toFixed(1))
              : 0,
        };
      })
      .sort((a, b) => b.applications - a.applications)
      .slice(0, 5);
  }

  private getRecentActivity(applications: any[]) {
    return applications
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .slice(0, 10)
      .map((app: any) => ({
        id: app._id,
        candidateName: app.userId?.name || "Unknown",
        jobTitle: app.jobId?.title || "N/A",
        status: app.status,
        timestamp: app.updatedAt,
      }));
  }

  private getWorkModeDistribution(jobs: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    jobs.forEach((job) => {
      const mode = job.workMode || job.workType || "onsite";
      distribution[mode] = (distribution[mode] || 0) + 1;
    });

    return distribution;
  }

  private getApplicationStatusDistribution(
    applications: any[],
  ): Record<string, number> {
    const distribution: Record<string, number> = {};

    applications.forEach((app) => {
      const status = app.status || "pending";
      distribution[status] = (distribution[status] || 0) + 1;
    });

    return distribution;
  }

  private calculateConversionRate(applications: any[]): number {
    const totalApplications = applications.length;
    if (totalApplications === 0) return 0;

    const hired = applications.filter(
      (app) => app.status === "hired" || app.status === "HIRED",
    ).length;

    return Number(((hired / totalApplications) * 100).toFixed(1));
  }
}

export default new JobService();
