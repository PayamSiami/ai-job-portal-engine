import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import Job, { IJob } from "../models/Job.models.js";
import { config } from "../config/index.js";
import Company from "../models/Company.models.js";
import { AppError } from "../utils/errorHandler.js";
import Application from "../models/Application.model.js";

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
      company: company.name,
      companyId: company._id,
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
   * Get job analytics for employer
   */
  async getJobAnalytics(
    employerId: string,
    timeRange: string = "30d",
  ): Promise<any> {
    try {
      console.log(`📊 Fetching job analytics for employer: ${employerId}`);

      // 1. Get all jobs for this employer
      const jobs = await Job.find({
        $or: [
          { postedBy: employerId },
          { employerId: employerId },
          { ownerId: employerId },
        ],
        isDeleted: { $ne: true },
      });

      const jobIds = jobs.map((job: any) => job._id);

      if (jobIds.length === 0) {
        return this.getEmptyAnalytics();
      }

      // 2. Get applications for these jobs
      const applications = await Application.find({
        jobId: { $in: jobIds },
      });

      // 3. Calculate date range
      const dateRange = this.getDateRange(timeRange);

      // 4. Calculate statistics
      const stats = {
        total: jobs.length,
        byStatus: this.getStatusDistribution(jobs),
        byType: this.getTypeDistribution(jobs),
        applications: {
          total: applications.length,
          avgPerJob:
            jobs.length > 0
              ? Number((applications.length / jobs.length).toFixed(1))
              : 0,
          growth: this.calculateGrowth(applications, dateRange),
        },
        performance: {
          conversionRate: this.calculateConversionRate(jobs, applications),
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
      console.error("❌ Error in JobService.getJobAnalytics:", error);
      throw error;
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

  private calculateConversionRate(jobs: any[], applications: any[]) {
    const totalViews = jobs.reduce(
      (sum: number, job: any) => sum + (job.views || 0),
      0,
    );
    if (totalViews === 0) return 0;
    return Number(((applications.length / totalViews) * 100).toFixed(1));
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
}

export default new JobService();
