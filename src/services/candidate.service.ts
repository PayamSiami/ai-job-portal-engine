// backend/src/services/candidate.service.ts
import { Model, PipelineStage, Types } from "mongoose";
import Job from "../models/Job.models.js";
import Application from "../models/Application.model.js";
import Resume from "../models/Resume.models.js";
import { AppError } from "../utils/errorHandler.js";
import User from "../models/User.models.js";

// Types
interface FilterOptions {
  search?: string;
  status?: string;
  skills?: string[];
  experienceMin?: number;
  experienceMax?: number;
  location?: string;
  availability?: string;
}

interface RecommendationParams {
  jobId?: string;
  limit: number;
  minScore: number;
  skills: string[];
  experienceMin?: number;
  experienceMax?: number;
}

interface CandidateRecommendation {
  candidate: {
    _id: string;
    userId: {
      _id: string;
      name: string;
      email: string;
      phone: string;
      location?: string;
      profileImage?: string;
    };
    jobId: {
      _id: string;
      title: string;
      company: string;
    };
  };
  matchScore: number;
  matchDetails: {
    skillsMatch: {
      matched: string[];
      missing: string[];
      matchPercentage: number;
    };
    experienceMatch: {
      candidateYears: number;
      requiredYears: number;
      match: boolean;
    };
    educationMatch: {
      match: boolean;
      details: string;
    };
    aiScore: number;
    overallMatch: number;
  };
  status: string;
  appliedDate: Date;
  resume: any;
}

interface PaginationOptions {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: string;
}

interface Candidate {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  position: string;
  status: string;
  experience: number;
  skills: any[];
  location: string;
  appliedDate: Date;
  resume: any;
  score: number;
  notes: string;
}

interface AnalyticsData {
  totalApplications: number;
  byStatus: any[];
  byJob: any[];
  dailyApplications: any[];
  averageScore: number;
  topSkills: { skill: string; count: number }[];
}

export class CandidateService {
  private Application: Model<any>;
  private Job: Model<any>;
  private Resume: Model<any>;
  private User: Model<any>;

  constructor() {
    this.Application = Application;
    this.Job = Job;
    this.Resume = Resume;
    this.User = User;
  }

  /**
   * Get candidates with filters and pagination
   */
  async getCandidates(
    employerId: string,
    filters: FilterOptions,
    options: PaginationOptions,
  ): Promise<{
    candidates: Candidate[];
    total: number;
    statusSummary: any[];
  }> {
    const { page, limit, sortBy, sortOrder } = options;
    const skip = (page - 1) * limit;

    // ***************

    // Debug: Check jobs and applications
    const jobs = await this.Job.find({ postedBy: employerId });
    console.log("📊 Jobs found:", jobs.length);
    console.log(
      "Job IDs:",
      jobs.map((j) => j._id),
    );

    const jobId = jobs.map((j) => j._id);
    const applications = await Application.find({
      jobId: { $in: jobId },
    });
    console.log("📊 Applications found:", applications.length);
    console.log("Sample application:", applications[0]);

    // ******************

    // First, get all jobs posted by this employer
    const employerJobs = await this.Job.find({
      postedBy: employerId,
      isDeleted: { $ne: true },
    }).select("_id");

    const jobIds = employerJobs.map((job: any) => job._id);

    // If no jobs, return empty result
    if (jobIds.length === 0) {
      return {
        candidates: [],
        total: 0,
        statusSummary: [],
      };
    }

    // Build match stage for applications
    const matchStage: any = {
      jobId: { $in: jobIds },
    };

    // Add filters to match stage
    if (filters.status) {
      matchStage.status = filters.status;
    }

    // Get applications with filters
    const pipeline: PipelineStage[] = [
      {
        $match: matchStage,
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $lookup: {
          from: "resumes",
          localField: "userId",
          foreignField: "userId",
          as: "resume",
        },
      },
      {
        $unwind: {
          path: "$resume",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: this.buildSearchFilters(filters, "user", "resume"),
      },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: skip },
            { $limit: limit },
            { $sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 } },
            {
              $project: {
                _id: 1,
                userId: "$user._id",
                name: "$user.name",
                email: "$user.email",
                phone: "$user.phone",
                position: "$resume.desiredPosition",
                status: 1,
                experience: "$resume.experience",
                skills: "$resume.skills",
                location: "$user.location",
                appliedDate: "$createdAt",
                resume: {
                  _id: "$resume._id",
                  title: "$resume.title",
                  template: "$resume.template",
                  education: "$resume.education",
                  certifications: "$resume.certifications",
                  languages: "$resume.languages",
                  projects: "$resume.projects",
                },
                score: 1,
                notes: 1,
              },
            },
          ],
        },
      },
    ];

    const result = await this.Application.aggregate(pipeline as any);

    const candidates = result[0]?.data || [];
    const total = result[0]?.metadata[0]?.total || 0;

    // Add candidate status summary
    const statusSummary = await this.getStatusSummary(jobIds, filters);

    return {
      candidates,
      total,
      statusSummary,
    };
  }

  /**
   * Get AI-powered candidate recommendations
   */
  async getCandidateRecommendations(
    employerId: string,
    params: RecommendationParams,
  ): Promise<CandidateRecommendation[]> {
    try {
      // 1. Get all jobs for this employer
      const jobs = await this.Job.find({
        postedBy: employerId,
        isDeleted: { $ne: true },
        isActive: true,
      });

      if (jobs.length === 0) {
        console.log("⚠️ No active jobs found for employer");
        return [];
      }

      // 2. If jobId is provided, use that job, otherwise use all jobs
      let targetJobs = jobs;
      if (params.jobId) {
        const specificJob = jobs.find(
          (j: any) => j._id.toString() === params.jobId,
        );
        if (specificJob) {
          targetJobs = [specificJob];
        } else {
          console.log(
            `⚠️ Job ${params.jobId} not found or not owned by employer`,
          );
          return [];
        }
      }

      console.log(`📊 Target jobs: ${targetJobs.length}`);

      // 3. Get job IDs
      const jobIds = targetJobs.map((job: any) => job._id);

      // 4. Get all applications for these jobs
      const applications = await this.Application.find({
        jobId: { $in: jobIds },
      })
        .populate("userId", "name email phone location profileImage")
        .populate("jobId", "title company")
        .populate("resumeId");

      if (applications.length === 0) {
        console.log("⚠️ No applications found for target jobs");
        return [];
      }

      console.log(`📊 Found ${applications.length} applications`);

      // 5. Calculate match scores for each application
      const recommendations: CandidateRecommendation[] = [];

      for (const application of applications) {
        const resume = application.resumeId;
        const job = targetJobs.find(
          (j: any) => j._id.toString() === application.jobId.toString(),
        );

        if (!resume || !job) continue;

        // Calculate match details
        const matchDetails = await this.calculateMatchScore(
          resume,
          job,
          params,
        );

        // Filter by minimum score
        if (matchDetails.overallMatch < params.minScore) continue;

        // Filter by skills if provided
        if (params.skills && params.skills.length > 0) {
          const hasRequiredSkill = params.skills.some((skill: string) =>
            resume.skills?.some((s: any) =>
              s.name?.toLowerCase().includes(skill.toLowerCase()),
            ),
          );
          if (!hasRequiredSkill) continue;
        }

        // Filter by experience
        if (params.experienceMin && resume.experience < params.experienceMin)
          continue;
        if (params.experienceMax && resume.experience > params.experienceMax)
          continue;

        recommendations.push({
          candidate: {
            _id: application._id,
            userId: application.userId,
            jobId: application.jobId,
          },
          matchScore: matchDetails.overallMatch,
          matchDetails,
          status: application.status,
          appliedDate: application.appliedAt || application.createdAt,
          resume: resume,
        });
      }

      // 6. Sort by match score descending and limit
      recommendations.sort((a, b) => b.matchScore - a.matchScore);
      const limitedRecommendations = recommendations.slice(0, params.limit);

      console.log(`✅ Found ${limitedRecommendations.length} recommendations`);

      return limitedRecommendations;
    } catch (error) {
      console.error("❌ Error getting candidate recommendations:", error);
      throw error;
    }
  }

  /**
   * Calculate match score between a candidate and a job
   */
  private async calculateMatchScore(
    resume: any,
    job: any,
    params: RecommendationParams,
  ): Promise<{
    skillsMatch: {
      matched: string[];
      missing: string[];
      matchPercentage: number;
    };
    experienceMatch: {
      candidateYears: number;
      requiredYears: number;
      match: boolean;
    };
    educationMatch: {
      match: boolean;
      details: string;
    };
    aiScore: number;
    overallMatch: number;
  }> {
    // 1. Skills Match
    const jobSkills = job.skills || [];
    const candidateSkills =
      resume.skills?.map((s: any) => s.name?.toLowerCase()) || [];

    const matchedSkills = jobSkills.filter((skill: string) =>
      candidateSkills.some((cs: string) => cs.includes(skill.toLowerCase())),
    );

    const missingSkills = jobSkills.filter(
      (skill: string) =>
        !candidateSkills.some((cs: string) => cs.includes(skill.toLowerCase())),
    );

    const skillsMatchPercentage =
      jobSkills.length > 0
        ? (matchedSkills.length / jobSkills.length) * 100
        : 100;

    // 2. Experience Match
    const candidateYears = resume.experience || 0;

    // Extract required experience from job description or use default
    let requiredYears = 2; // Default
    if (job.experienceLevel) {
      const expMap: Record<string, number> = {
        entry: 0,
        mid: 3,
        senior: 5,
        lead: 8,
      };
      requiredYears = expMap[job.experienceLevel] || 2;
    }

    const experienceMatch = candidateYears >= requiredYears;

    // 3. Education Match
    let educationMatch = false;
    let educationDetails = "No education data";

    if (resume.education && resume.education.length > 0) {
      educationMatch = true;
      const degrees = resume.education.map((e: any) => e.degree).join(", ");
      educationDetails = `Candidate has: ${degrees}`;
    }

    // 4. Calculate Overall Match Score
    const weights = {
      skills: 0.5,
      experience: 0.3,
      education: 0.1,
      aiScore: 0.1,
    };

    const aiScore = resume.aiScore || 50; // Default to 50 if no AI score

    const overallMatch =
      (skillsMatchPercentage / 100) * weights.skills * 100 +
      (experienceMatch ? 100 : 0) * weights.experience +
      (educationMatch ? 100 : 0) * weights.education +
      (aiScore / 100) * weights.aiScore * 100;

    return {
      skillsMatch: {
        matched: matchedSkills,
        missing: missingSkills,
        matchPercentage: Math.round(skillsMatchPercentage),
      },
      experienceMatch: {
        candidateYears,
        requiredYears,
        match: experienceMatch,
      },
      educationMatch: {
        match: educationMatch,
        details: educationDetails,
      },
      aiScore: aiScore,
      overallMatch: Math.round(overallMatch),
    };
  }

  /**
   * Build search filters for MongoDB aggregation
   */
  private buildSearchFilters(
    filters: FilterOptions,
    userAlias: string,
    resumeAlias: string,
  ): any {
    const match: any = {};

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, "i");
      match.$or = [
        { [`${userAlias}.name`]: searchRegex },
        { [`${userAlias}.email`]: searchRegex },
        { [`${resumeAlias}.desiredPosition`]: searchRegex },
        { [`${resumeAlias}.skills.name`]: searchRegex },
      ];
    }

    if (filters.skills && filters.skills.length > 0) {
      match[`${resumeAlias}.skills.name`] = { $in: filters.skills };
    }

    if (filters.experienceMin || filters.experienceMax) {
      const experienceFilter: any = {};
      if (filters.experienceMin) {
        experienceFilter.$gte = filters.experienceMin;
      }
      if (filters.experienceMax) {
        experienceFilter.$lte = filters.experienceMax;
      }
      match[`${resumeAlias}.experience`] = experienceFilter;
    }

    if (filters.location) {
      match[`${userAlias}.location`] = new RegExp(filters.location, "i");
    }

    if (filters.availability) {
      match[`${resumeAlias}.availability`] = filters.availability;
    }

    return match;
  }

  /**
   * Get candidate by ID
   */
  async getCandidateById(
    candidateId: string,
    employerId: string,
  ): Promise<any | null> {
    // ✅ Use findById with proper population
    const application = await this.Application.findById(candidateId)
      .populate("userId", "name email phone location") // ✅ Use userId
      .populate("jobId", "title company")
      .populate("resumeId");

    if (!application) {
      return null;
    }

    // Check if the job belongs to this employer
    const job = await this.Job.findOne({
      _id: application.jobId,
      postedBy: employerId,
      isDeleted: { $ne: true },
    });

    if (!job) {
      return null;
    }

    return {
      _id: application._id,
      user: application.userId, // ✅ Use userId
      job: application.jobId,
      status: application.status,
      appliedDate: application.appliedAt || application.createdAt,
      notes: application.notes,
      score: application.aiScore,
      resume: application.resumeId,
      coverLetter: application.coverLetter,
      expectedSalary: application.expectedSalary,
      aiRecommendation: application.aiRecommendation,
      aiStrengths: application.aiStrengths,
      aiWeaknesses: application.aiWeaknesses,
    };
  }

  /**
   * Update candidate status
   */
  async updateCandidateStatus(
    candidateId: string,
    employerId: string,
    status: string,
    notes?: string,
  ): Promise<any | null> {
    try {
      // 1. Find the application
      const application = await this.Application.findById(candidateId);
      if (!application) {
        console.log(`❌ Application not found: ${candidateId}`);
        return null;
      }

      console.log(`✅ Application found:`, {
        id: application._id,
        jobId: application.jobId,
        userId: application.userId,
        currentStatus: application.status,
      });

      // 2. Verify the job belongs to this employer
      const job = await this.Job.findOne({
        _id: application.jobId,
        postedBy: employerId,
        isDeleted: { $ne: true },
      });

      if (!job) {
        console.log(
          `❌ Job not found or access denied for employer: ${employerId}`,
        );
        return null;
      }

      // 3. Update status
      application.status = status;

      // 4. Add notes if provided
      if (notes) {
        application.notes = notes;
      }

      // 5. Create status history entry
      application.statusHistory = application.statusHistory || [];
      application.statusHistory.push({
        status,
        notes: notes || "",
        updatedAt: new Date(),
        updatedBy: employerId,
      });

      // 6. Update timestamp
      application.updatedAt = new Date();

      // 7. If hired, add to employee records
      if (status === "hired") {
        // Logic to add candidate as employee
        console.log(`🎉 Candidate ${candidateId} was hired!`);
        // You can add employee creation logic here
      }

      // 8. Save the application
      await application.save();

      // 9. Return populated application
      await application.populate("userId", "name email phone");
      await application.populate("jobId", "title company");

      return application;
    } catch (error) {
      console.error("❌ Error updating candidate status:", error);
      throw error;
    }
  }

  // backend/src/services/candidate.service.ts

  /**
   * Get candidate resume
   */
  async getCandidateResume(
    candidateId: string,
    employerId: string,
  ): Promise<any | null> {
    try {
      console.log(`📄 Fetching resume for candidate: ${candidateId}`);

      // 1. Verify the application exists
      const application = await this.Application.findById(candidateId);
      if (!application) {
        console.log(`❌ Application not found: ${candidateId}`);
        return null;
      }

      console.log(`✅ Application found:`, {
        id: application._id,
        jobId: application.jobId,
        userId: application.userId,
        resumeId: application.resumeId,
      });

      // 2. Verify the job belongs to this employer
      const job = await this.Job.findOne({
        _id: application.jobId,
        postedBy: employerId,
        isDeleted: { $ne: true },
      });

      if (!job) {
        console.log(
          `❌ Job not found or access denied for employer: ${employerId}`,
        );
        return null;
      }

      console.log(`✅ Job belongs to employer: ${employerId}`);

      // 3. Find the resume
      // First try using resumeId from application
      let resume = null;

      if (application.resumeId) {
        resume = await this.Resume.findById(application.resumeId);
        console.log(`📄 Found resume by resumeId: ${!!resume}`);
      }

      // If not found by resumeId, try by userId
      if (!resume) {
        resume = await this.Resume.findOne({
          userId: application.userId,
        });
        console.log(`📄 Found resume by userId: ${!!resume}`);
      }

      if (!resume) {
        console.log(`❌ Resume not found for user: ${application.userId}`);
        return null;
      }

      console.log(`✅ Resume found:`, {
        id: resume._id,
        title: resume.title,
        hasPdf: !!resume.pdfFile,
      });

      // 4. Return the PDF file
      // If resume has a pdfFile (Buffer or path), return it
      if (resume.pdfFile) {
        return resume.pdfFile;
      }

      // If resume has a fileUrl or path
      if (resume.fileUrl) {
        return resume.fileUrl;
      }

      // If resume is stored in cloud storage (S3, Cloudinary, etc.)
      if (resume.cloudStorageUrl) {
        return resume.cloudStorageUrl;
      }

      // If resume is stored as a path
      if (resume.filePath) {
        return resume.filePath;
      }

      console.log(`⚠️ Resume found but no PDF file attached`);
      return null;
    } catch (error) {
      console.error("❌ Error fetching candidate resume:", error);
      throw error;
    }
  }

  /**
   * Get candidate analytics for employer
   */
  async getAnalytics(employerId: string): Promise<AnalyticsData> {
    const jobs = await this.Job.find({ employerId }).select("_id");
    const jobIds = jobs.map((job: any) => job._id);

    const [
      totalApplications,
      byStatus,
      byJob,
      dailyApplications,
      averageScore,
      topSkills,
    ] = await Promise.all([
      this.Application.countDocuments({ jobId: { $in: jobIds } }),
      this.Application.aggregate([
        { $match: { jobId: { $in: jobIds } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      this.Application.aggregate([
        { $match: { jobId: { $in: jobIds } } },
        {
          $lookup: {
            from: "jobs",
            localField: "jobId",
            foreignField: "_id",
            as: "job",
          },
        },
        { $unwind: "$job" },
        { $group: { _id: "$job.title", count: { $sum: 1 } } },
      ]),
      this.Application.aggregate([
        { $match: { jobId: { $in: jobIds } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ]),
      this.Application.aggregate([
        { $match: { jobId: { $in: jobIds }, score: { $exists: true } } },
        { $group: { _id: null, avg: { $avg: "$score" } } },
      ]),
      this.getTopSkills(jobIds),
    ]);

    return {
      totalApplications,
      byStatus,
      byJob,
      dailyApplications,
      averageScore: averageScore[0]?.avg || 0,
      topSkills,
    };
  }

  /**
   * Get top skills from candidates
   */
  private async getTopSkills(
    jobIds: Types.ObjectId[],
  ): Promise<{ skill: string; count: number }[]> {
    const applications = await this.Application.find({
      jobId: { $in: jobIds },
    });
    const userIds = applications.map((app: any) => app.userId);

    const resumes = await this.Resume.find({ userId: { $in: userIds } });

    const skillCount: Record<string, number> = {};
    resumes.forEach((resume: any) => {
      if (resume.skills) {
        resume.skills.forEach((skill: any) => {
          const skillName = skill.name?.toLowerCase();
          if (skillName) {
            skillCount[skillName] = (skillCount[skillName] || 0) + 1;
          }
        });
      }
    });

    return Object.entries(skillCount)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get status summary
   */
  private async getStatusSummary(
    jobIds: Types.ObjectId[],
    filters: FilterOptions,
  ): Promise<any[]> {
    const match: any = { jobId: { $in: jobIds } };

    if (filters.search || filters.skills || filters.location) {
      // Add search filters logic here if needed
    }

    return this.Application.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
  }

  /**
   * Export candidates data
   */
  async exportCandidates(employerId: string): Promise<any[]> {
    const jobs = await this.Job.find({ employerId }).select("_id");
    const jobIds = jobs.map((job: any) => job._id);

    const applications = await this.Application.find({
      jobId: { $in: jobIds },
    })
      .populate("userId", "name email phone location")
      .populate("jobId", "title");

    return applications.map((app: any) => ({
      name: app.userId?.name || "N/A",
      email: app.userId?.email || "N/A",
      phone: app.userId?.phone || "N/A",
      position: app.jobId?.title || "N/A",
      status: app.status,
      appliedDate: app.createdAt,
    }));
  }

  /**
   * Add note to candidate
   */
  async addCandidateNote(
    candidateId: string,
    employerId: string,
    note: string,
  ): Promise<any | null> {
    const application = await this.Application.findById(candidateId);
    if (!application) {
      return null;
    }

    const job = await this.Job.findOne({
      _id: application.jobId,
      postedBy: employerId,
    });

    if (!job) {
      return null;
    }

    application.notes = application.notes
      ? `${application.notes}\n${note}`
      : note;

    await application.save();
    return application;
  }

  /**
   * Get candidate timeline
   */
  async getCandidateTimeline(
    candidateId: string,
    employerId: string,
  ): Promise<any | null> {
    const application = await this.Application.findById(candidateId);
    if (!application) {
      return null;
    }

    const job = await this.Job.findOne({
      _id: application.jobId,
      postedBy: employerId,
    });

    if (!job) {
      return null;
    }

    // Return status history as timeline
    return application.statusHistory || [];
  }

  /**
   * Get job applications
   */
  // backend/src/services/candidate.service.ts

  async getJobApplications(
    jobId: string,
    employerId: string,
    page: number,
    limit: number,
    status?: string,
  ): Promise<{ applications: any[]; pagination: any }> {
    try {
      console.log(`📊 Fetching applications for job: ${jobId}`);
      console.log(`👤 Employer ID: ${employerId}`);
      console.log(`🔍 Query: { _id: ${jobId}, postedBy: ${employerId} }`);

      // 1. First check if the job exists at all
      const jobExists = await this.Job.findById(jobId);
      console.log(`📊 Job exists in DB: ${!!jobExists}`);

      if (jobExists) {
        console.log(`📊 Job data:`, {
          id: jobExists._id,
          title: jobExists.title,
          postedBy: jobExists.postedBy,
          employerId: jobExists.employerId, // Check if this field exists
          companyId: jobExists.companyId, // Check if this field exists
          ownerId: jobExists.ownerId, // Check if this field exists
        });

        // Check if the employer ID matches any possible field
        console.log(
          `🔍 postedBy match: ${jobExists.postedBy?.toString() === employerId?.toString()}`,
        );
        console.log(
          `🔍 employerId match: ${jobExists.employerId?.toString() === employerId?.toString()}`,
        );
        console.log(
          `🔍 ownerId match: ${jobExists.ownerId?.toString() === employerId?.toString()}`,
        );
      }

      // 2. Try different field combinations
      let job = await this.Job.findOne({
        _id: jobId,
        postedBy: employerId,
        isDeleted: { $ne: true },
      });

      // If not found, try with employerId field
      if (!job) {
        console.log(`🔍 Trying with employerId field...`);
        job = await this.Job.findOne({
          _id: jobId,
          employerId: employerId,
          isDeleted: { $ne: true },
        });
      }

      // If still not found, try with ownerId field
      if (!job) {
        console.log(`🔍 Trying with ownerId field...`);
        job = await this.Job.findOne({
          _id: jobId,
          ownerId: employerId,
          isDeleted: { $ne: true },
        });
      }

      if (!job) {
        console.log(`❌ Job not found with any field`);
        throw new AppError("Job not found or access denied", 404);
      }

      console.log(`✅ Job found: ${job.title}`);

      // ... rest of the code remains the same ...

      const match: any = { jobId };
      if (status) {
        match.status = status;
      }

      const skip = (page - 1) * limit;

      const [applications, total] = await Promise.all([
        this.Application.find(match)
          .populate("userId", "name email phone")
          .skip(skip)
          .limit(limit)
          .sort({ appliedAt: -1, createdAt: -1 }),
        this.Application.countDocuments(match),
      ]);

      console.log(`✅ Found ${applications.length} applications`);

      return {
        applications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error("❌ Error fetching job applications:", error);
      throw error;
    }
  }
  /**
   * Get job statistics
   */
  async getJobStats(jobId: string, employerId: string): Promise<any | null> {
    const job = await this.Job.findOne({ _id: jobId, postedBy: employerId });
    if (!job) {
      return null;
    }

    const [totalApplications, byStatus] = await Promise.all([
      this.Application.countDocuments({ jobId }),
      this.Application.aggregate([
        { $match: { jobId: new Types.ObjectId(jobId) } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    return {
      totalApplications,
      byStatus,
      job: {
        title: job.title,
        status: job.status,
        createdAt: job.createdAt,
      },
    };
  }

  /**
   * Get candidate statistics for employer dashboard
   */
  async getCandidateStats(employerId: string): Promise<any> {
    try {
      console.log(`📊 Fetching candidate stats for employer: ${employerId}`);

      // 1. Get all jobs posted by this employer
      const employerJobs = await this.Job.find({
        $or: [
          { postedBy: employerId },
          { employerId: employerId },
          { ownerId: employerId },
        ],
        isDeleted: { $ne: true },
      }).select("_id title status");

      const jobIds = employerJobs.map((job: any) => job._id);

      console.log(`📊 Found ${employerJobs.length} jobs for employer`);

      // If no jobs, return empty stats
      if (jobIds.length === 0) {
        return {
          overview: {
            totalCandidates: 0,
            activeCandidates: 0,
            conversionRate: 0,
            avgDaysToHire: 0,
          },
          statusDistribution: {
            pending: 0,
            reviewing: 0,
            shortlisted: 0,
            rejected: 0,
            hired: 0,
          },
          stageDistribution: {
            screening: 0,
            interview: 0,
            technical: 0,
            final: 0,
            offer: 0,
          },
          candidatesByJob: [],
          recentActivity: [],
          timestamp: new Date().toISOString(),
        };
      }

      // 2. Get all applications for these jobs
      const applications = await this.Application.find({
        jobId: { $in: jobIds },
      });

      console.log(`📊 Found ${applications.length} applications`);

      // 3. Calculate status distribution
      const statusDistribution = {
        pending: applications.filter((a: any) => a.status === "pending").length,
        reviewing: applications.filter((a: any) => a.status === "reviewing")
          .length,
        shortlisted: applications.filter((a: any) => a.status === "shortlisted")
          .length,
        rejected: applications.filter((a: any) => a.status === "rejected")
          .length,
        hired: applications.filter((a: any) => a.status === "hired").length,
      };

      // 4. Calculate stage distribution (if stage field exists)
      const stageDistribution = {
        screening: applications.filter((a: any) => a.stage === "screening")
          .length,
        interview: applications.filter((a: any) => a.stage === "interview")
          .length,
        technical: applications.filter((a: any) => a.stage === "technical")
          .length,
        final: applications.filter((a: any) => a.stage === "final").length,
        offer: applications.filter((a: any) => a.stage === "offer").length,
      };

      // 5. Get candidates by job
      const candidatesByJob = await this.Application.aggregate([
        {
          $match: { jobId: { $in: jobIds } },
        },
        {
          $group: {
            _id: "$jobId",
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "jobs",
            localField: "_id",
            foreignField: "_id",
            as: "job",
          },
        },
        {
          $unwind: {
            path: "$job",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            jobTitle: "$job.title",
            jobId: "$_id",
            count: 1,
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      // 6. Get recent activity (last 5 updated applications)
      const recentActivity = await this.Application.find({
        jobId: { $in: jobIds },
      })
        .sort({ updatedAt: -1 })
        .limit(5)
        .populate("userId", "name email")
        .populate("jobId", "title")
        .select("_id userId jobId status stage updatedAt createdAt");

      // 7. Calculate conversion rate
      const totalCandidates = applications.length;
      const hiredCount = statusDistribution.hired;
      const conversionRate =
        totalCandidates > 0
          ? parseFloat(((hiredCount / totalCandidates) * 100).toFixed(1))
          : 0;

      // 8. Calculate average days to hire
      const hiredApplications = applications.filter(
        (a: any) => a.status === "hired",
      );
      let avgDaysToHire = 0;

      if (hiredApplications.length > 0) {
        const totalDays = hiredApplications.reduce((sum: number, app: any) => {
          const hiredDate = app.hiredAt || app.updatedAt;
          const appliedDate = app.appliedAt || app.createdAt;
          const days = Math.ceil(
            (new Date(hiredDate).getTime() - new Date(appliedDate).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          return sum + days;
        }, 0);
        avgDaysToHire = Math.round(totalDays / hiredApplications.length);
      }

      // 9. Calculate active candidates (not rejected or hired)
      const activeCandidates =
        totalCandidates -
        statusDistribution.rejected -
        statusDistribution.hired;

      // 10. Get pending screening count
      const pendingScreening = applications.filter(
        (a: any) => a.status === "pending" && (!a.aiScore || a.aiScore === 0),
      ).length;

      // 11. Get AI screening coverage
      const screenedCount = applications.filter(
        (a: any) => a.aiScore && a.aiScore > 0,
      ).length;
      const screeningCoverage =
        totalCandidates > 0
          ? parseFloat(((screenedCount / totalCandidates) * 100).toFixed(1))
          : 0;

      // 12. Get average AI score
      const applicationsWithScore = applications.filter(
        (a: any) => a.aiScore && a.aiScore > 0,
      );
      const avgAiScore =
        applicationsWithScore.length > 0
          ? parseFloat(
              (
                applicationsWithScore.reduce(
                  (sum: number, a: any) => sum + a.aiScore,
                  0,
                ) / applicationsWithScore.length
              ).toFixed(1),
            )
          : 0;

      // 13. Get status history for timeline
      const statusHistory = await this.Application.aggregate([
        {
          $match: { jobId: { $in: jobIds } },
        },
        {
          $group: {
            _id: {
              date: {
                $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" },
              },
              status: "$status",
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.date",
            statuses: {
              $push: {
                status: "$_id.status",
                count: "$count",
              },
            },
          },
        },
        {
          $sort: { _id: 1 },
        },
        {
          $limit: 30,
        },
      ]);

      return {
        overview: {
          totalCandidates,
          activeCandidates,
          conversionRate,
          avgDaysToHire,
          pendingScreening,
          screeningCoverage,
          avgAiScore,
        },
        statusDistribution,
        stageDistribution,
        candidatesByJob,
        recentActivity: recentActivity.map((app: any) => ({
          id: app._id,
          candidateName: app.userId?.name || "Unknown",
          candidateEmail: app.userId?.email || "Unknown",
          jobTitle: app.jobId?.title || "N/A",
          status: app.status,
          stage: app.stage,
          updatedAt: app.updatedAt,
          createdAt: app.createdAt,
        })),
        statusHistory,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("❌ Error in CandidateService.getCandidateStats:", error);
      throw error;
    }
  }

  /**
   * Get shortlisted candidates for an employer
   */
  async getShortlistedCandidates(
    employerId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      jobId?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {},
  ): Promise<{
    candidates: any[];
    total: number;
    summary: {
      totalShortlisted: number;
      byJob: { jobTitle: string; count: number }[];
      byStage: { stage: string; count: number }[];
    };
  }> {
    try {
      console.log(
        `📊 Fetching shortlisted candidates for employer: ${employerId}`,
      );

      const {
        page = 1,
        limit = 10,
        search = "",
        jobId,
        sortBy = "updatedAt",
        sortOrder = "desc",
      } = options;

      const skip = (page - 1) * limit;

      // 1. Get all jobs posted by this employer
      const employerJobs = await this.Job.find({
        $or: [
          { postedBy: employerId },
          { employerId: employerId },
          { ownerId: employerId },
        ],
        isDeleted: { $ne: true },
      }).select("_id title");

      const jobIds = employerJobs.map((job: any) => job._id);

      if (jobIds.length === 0) {
        return {
          candidates: [],
          total: 0,
          summary: {
            totalShortlisted: 0,
            byJob: [],
            byStage: [],
          },
        };
      }

      // 2. Build query for shortlisted candidates
      const query: any = {
        jobId: { $in: jobIds },
        status: { $in: ["shortlisted", "interview_scheduled"] }, // Shortlisted or interview
      };

      // Add job filter if specified
      if (jobId) {
        query.jobId = jobId;
      }

      // Add search filter
      if (search) {
        const userIds = await this.getUserIdsBySearch(search);
        if (userIds.length > 0) {
          query.userId = { $in: userIds };
        }
      }

      // 3. Get shortlisted candidates with pagination
      const [candidates, total] = await Promise.all([
        this.Application.find(query)
          .populate("userId", "name email phone location")
          .populate("jobId", "title company department")
          .populate("resumeId")
          .skip(skip)
          .limit(limit)
          .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 }),
        this.Application.countDocuments(query),
      ]);

      // 4. Get summary statistics
      const summary = await this.getShortlistedSummary(jobIds, jobId);

      // 5. Format candidates
      const formattedCandidates = candidates.map((app: any) => ({
        _id: app._id,
        user: {
          _id: app.userId?._id,
          name: app.userId?.name || "Unknown",
          email: app.userId?.email,
          phone: app.userId?.phone,
          location: app.userId?.location,
        },
        job: {
          _id: app.jobId?._id,
          title: app.jobId?.title || "N/A",
          company: app.jobId?.company,
          department: app.jobId?.department,
        },
        status: app.status,
        stage: app.stage || "shortlisted",
        score: app.aiScore || 0,
        appliedDate: app.appliedAt || app.createdAt,
        shortlistedDate: app.shortlistedAt || app.updatedAt,
        resume: app.resumeId,
        coverLetter: app.coverLetter,
        expectedSalary: app.expectedSalary,
        notes: app.notes,
        aiRecommendation: app.aiRecommendation,
        aiStrengths: app.aiStrengths,
        aiWeaknesses: app.aiWeaknesses,
        statusHistory: app.statusHistory?.slice(-5) || [], // Last 5 status changes
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      }));

      return {
        candidates: formattedCandidates,
        total,
        summary,
      };
    } catch (error) {
      console.error(
        "❌ Error in CandidateService.getShortlistedCandidates:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get shortlisted candidates summary
   */
  private async getShortlistedSummary(
    jobIds: Types.ObjectId[],
    jobId?: string,
  ): Promise<{
    totalShortlisted: number;
    byJob: { jobTitle: string; count: number }[];
    byStage: { stage: string; count: number }[];
  }> {
    const match: any = {
      jobId: { $in: jobIds },
      status: { $in: ["shortlisted", "interview_scheduled"] },
    };

    if (jobId) {
      match.jobId = jobId;
    }

    // Get total count
    const totalShortlisted = await this.Application.countDocuments(match);

    // Get count by job
    const byJob = await this.Application.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "jobs",
          localField: "jobId",
          foreignField: "_id",
          as: "job",
        },
      },
      { $unwind: "$job" },
      {
        $group: {
          _id: "$jobId",
          jobTitle: { $first: "$job.title" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          jobTitle: 1,
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get count by stage
    const byStage = await this.Application.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ["$stage", "shortlisted"] },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          stage: "$_id",
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    return {
      totalShortlisted,
      byJob: byJob.map((item: any) => ({
        jobTitle: item.jobTitle,
        count: item.count,
      })),
      byStage: byStage.map((item: any) => ({
        stage: item.stage,
        count: item.count,
      })),
    };
  }

  /**
   * Helper: Get user IDs by search term
   */
  private async getUserIdsBySearch(search: string): Promise<Types.ObjectId[]> {
    const users = await this.User.find({
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    }).select("_id");

    return users.map((user: any) => user._id);
  }

  /**
   * Get applications for shortlisted candidates
   */
  async getShortlistedApplications(
    employerId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      jobId?: string;
      status?: string;
      stage?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      startDate?: string;
      endDate?: string;
    } = {},
  ): Promise<{
    applications: any[];
    total: number;
    summary: {
      totalShortlisted: number;
      byStatus: { status: string; count: number }[];
      byJob: { jobTitle: string; count: number }[];
      byStage: { stage: string; count: number }[];
      averageScore: number;
      totalWithAI: number;
    };
  }> {
    try {
      console.log(
        `📊 Fetching shortlisted applications for employer: ${employerId}`,
      );

      const {
        page = 1,
        limit = 10,
        search = "",
        jobId,
        status,
        stage,
        sortBy = "updatedAt",
        sortOrder = "desc",
        startDate,
        endDate,
      } = options;

      const skip = (page - 1) * limit;

      // 1. Get all jobs posted by this employer
      const employerJobs = await this.Job.find({
        $or: [
          { postedBy: employerId },
          { employerId: employerId },
          { ownerId: employerId },
        ],
        isDeleted: { $ne: true },
      }).select("_id title");

      const jobIds = employerJobs.map((job: any) => job._id);

      if (jobIds.length === 0) {
        return {
          applications: [],
          total: 0,
          summary: {
            totalShortlisted: 0,
            byStatus: [],
            byJob: [],
            byStage: [],
            averageScore: 0,
            totalWithAI: 0,
          },
        };
      }

      // 2. Build query
      const query: any = {
        jobId: { $in: jobIds },
        status: { $in: ["shortlisted", "interview_scheduled"] },
      };

      // Add job filter
      if (jobId) {
        query.jobId = jobId;
      }

      // Add status filter
      if (status) {
        query.status = status;
      }

      // Add stage filter
      if (stage) {
        query.stage = stage;
      }

      // Add date range filter
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      // Add search filter
      if (search) {
        const userIds = await this.getUserIdsBySearch(search);
        if (userIds.length > 0) {
          query.userId = { $in: userIds };
        }
      }

      // 3. Get applications with pagination and sorting
      const [applications, total] = await Promise.all([
        this.Application.find(query)
          .populate("userId", "name email phone location profileImage")
          .populate("jobId", "title company department location type")
          .populate("resumeId")
          .skip(skip)
          .limit(limit)
          .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 }),
        this.Application.countDocuments(query),
      ]);

      // 4. Get summary statistics
      const summary = await this.getShortlistedApplicationsSummary(jobIds, {
        jobId,
        status,
        stage,
        startDate,
        endDate,
      });

      // 5. Format applications
      const formattedApplications = await Promise.all(
        applications.map(async (app: any) => {
          // Get interview schedule if exists
          let interviewDetails = null;
          if (app.interviewSchedule) {
            interviewDetails = {
              scheduledDate: app.interviewSchedule.scheduledDate,
              duration: app.interviewSchedule.duration,
              location: app.interviewSchedule.location,
              meetingLink: app.interviewSchedule.meetingLink,
              notes: app.interviewSchedule.notes,
              status: app.interviewSchedule.status || "scheduled",
            };
          }

          return {
            _id: app._id,
            candidate: {
              _id: app.userId?._id,
              name: app.userId?.name || "Unknown",
              email: app.userId?.email,
              phone: app.userId?.phone,
              location: app.userId?.location,
              profileImage: app.userId?.profileImage,
            },
            job: {
              _id: app.jobId?._id,
              title: app.jobId?.title || "N/A",
              company: app.jobId?.company,
              department: app.jobId?.department,
              location: app.jobId?.location,
              type: app.jobId?.type,
            },
            status: app.status,
            stage: app.stage || "shortlisted",
            aiScore: app.aiScore || 0,
            aiRecommendation: app.aiRecommendation,
            aiStrengths: app.aiStrengths || [],
            aiWeaknesses: app.aiWeaknesses || [],
            appliedDate: app.appliedAt || app.createdAt,
            shortlistedDate: app.shortlistedAt || app.updatedAt,
            resume: app.resumeId,
            coverLetter: app.coverLetter,
            expectedSalary: app.expectedSalary,
            availability: app.availability,
            notes: app.notes,
            interviewSchedule: interviewDetails,
            statusHistory: app.statusHistory?.slice(-5) || [],
            createdAt: app.createdAt,
            updatedAt: app.updatedAt,
          };
        }),
      );

      return {
        applications: formattedApplications,
        total,
        summary,
      };
    } catch (error) {
      console.error(
        "❌ Error in CandidateService.getShortlistedApplications:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get shortlisted applications summary
   */
  private async getShortlistedApplicationsSummary(
    jobIds: Types.ObjectId[],
    filters: {
      jobId?: string;
      status?: string;
      stage?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<{
    totalShortlisted: number;
    byStatus: { status: string; count: number }[];
    byJob: { jobTitle: string; count: number }[];
    byStage: { stage: string; count: number }[];
    averageScore: number;
    totalWithAI: number;
  }> {
    const match: any = {
      jobId: { $in: jobIds },
      status: { $in: ["shortlisted", "interview_scheduled"] },
    };

    if (filters.jobId) match.jobId = filters.jobId;
    if (filters.status) match.status = filters.status;
    if (filters.stage) match.stage = filters.stage;
    if (filters.startDate || filters.endDate) {
      match.createdAt = {};
      if (filters.startDate) match.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) match.createdAt.$lte = new Date(filters.endDate);
    }

    // Get total count
    const totalShortlisted = await this.Application.countDocuments(match);

    // Get count by status
    const byStatus = await this.Application.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          status: "$_id",
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get count by job
    const byJob = await this.Application.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "jobs",
          localField: "jobId",
          foreignField: "_id",
          as: "job",
        },
      },
      { $unwind: "$job" },
      {
        $group: {
          _id: "$jobId",
          jobTitle: { $first: "$job.title" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          jobTitle: 1,
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get count by stage
    const byStage = await this.Application.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ["$stage", "shortlisted"] },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          stage: "$_id",
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get average AI score
    const scoreResult = await this.Application.aggregate([
      { $match: { ...match, aiScore: { $exists: true } } },
      {
        $group: {
          _id: null,
          average: { $avg: "$aiScore" },
          count: { $sum: 1 },
        },
      },
    ]);

    const averageScore =
      scoreResult.length > 0 ? Math.round(scoreResult[0].average) : 0;
    const totalWithAI = scoreResult.length > 0 ? scoreResult[0].count : 0;

    return {
      totalShortlisted,
      byStatus: byStatus.map((item: any) => ({
        status: item.status,
        count: item.count,
      })),
      byJob: byJob.map((item: any) => ({
        jobTitle: item.jobTitle,
        count: item.count,
      })),
      byStage: byStage.map((item: any) => ({
        stage: item.stage,
        count: item.count,
      })),
      averageScore,
      totalWithAI,
    };
  }

  /**
   * Get resume for a shortlisted candidate
   */
  async getShortlistedCandidateResume(
    candidateId: string,
    employerId: string,
    format: "pdf" | "json" | "url" = "pdf",
  ): Promise<{
    resume: any;
    fileName: string;
    fileType: string;
    content?: Buffer | string;
    url?: string;
    metadata: {
      candidateName: string;
      candidateEmail: string;
      jobTitle: string;
      applicationId: string;
      resumeTitle: string;
      template: string;
      createdAt: Date;
      updatedAt: Date;
    };
  } | null> {
    try {
      console.log(
        `📄 Fetching resume for shortlisted candidate: ${candidateId}`,
      );

      // 1. Find the application
      const application = await this.Application.findById(candidateId)
        .populate("userId", "name email")
        .populate("jobId", "title company")
        .populate("resumeId");

      if (!application) {
        console.log(`❌ Application not found: ${candidateId}`);
        return null;
      }

      // 2. Verify the job belongs to this employer
      const job = await this.Job.findOne({
        _id: application.jobId,
        $or: [
          { postedBy: employerId },
          { employerId: employerId },
          { ownerId: employerId },
        ],
        isDeleted: { $ne: true },
      });

      if (!job) {
        console.log(
          `❌ Job not found or access denied for employer: ${employerId}`,
        );
        return null;
      }

      // 3. Check if candidate is shortlisted
      if (
        !["shortlisted", "interview_scheduled"].includes(application.status)
      ) {
        console.log(
          `❌ Candidate is not shortlisted. Status: ${application.status}`,
        );
        return null;
      }

      // 4. Get the resume
      let resume = application.resumeId;

      if (!resume) {
        // Try to find resume by userId
        resume = await this.Resume.findOne({ userId: application.userId });
      }

      if (!resume) {
        console.log(`❌ Resume not found for user: ${application.userId}`);
        return null;
      }

      console.log(`✅ Resume found: ${resume.title || "Untitled"}`);

      // 5. Prepare response based on format
      const metadata = {
        candidateName: application.userId?.name || "Unknown",
        candidateEmail: application.userId?.email || "Unknown",
        jobTitle: application.jobId?.title || "N/A",
        applicationId: application._id.toString(),
        resumeTitle: resume.title || "Resume",
        template: resume.template || "default",
        createdAt: resume.createdAt,
        updatedAt: resume.updatedAt,
      };

      if (format === "json") {
        // Return full resume data as JSON
        return {
          resume: {
            _id: resume._id,
            title: resume.title,
            template: resume.template,
            personalInfo: resume.personalInfo,
            summary: resume.summary,
            workExperience: resume.workExperience,
            education: resume.education,
            skills: resume.skills,
            projects: resume.projects,
            certifications: resume.certifications,
            languages: resume.languages,
            awards: resume.awards,
            completionScore: resume.completionScore,
          },
          fileName: `${application.userId?.name || "candidate"}_resume.json`,
          fileType: "application/json",
          metadata,
        };
      }

      if (format === "url") {
        // Return URL to the resume file
        const resumeUrl =
          resume.pdfUrl || resume.fileUrl || resume.cloudStorageUrl;

        if (!resumeUrl) {
          console.log(`❌ No URL found for resume`);
          return null;
        }

        return {
          resume: null,
          fileName: `${application.userId?.name || "candidate"}_resume.pdf`,
          fileType: "application/pdf",
          url: resumeUrl,
          metadata,
        };
      }

      // Default: Return PDF
      if (resume.pdfFile) {
        return {
          resume: resume.pdfFile,
          fileName: `${application.userId?.name || "candidate"}_resume.pdf`,
          fileType: "application/pdf",
          content: resume.pdfFile,
          metadata,
        };
      }

      if (resume.pdfUrl || resume.fileUrl || resume.cloudStorageUrl) {
        const resumeUrl =
          resume.pdfUrl || resume.fileUrl || resume.cloudStorageUrl;

        // If we have a URL, redirect or return it
        return {
          resume: null,
          fileName: `${application.userId?.name || "candidate"}_resume.pdf`,
          fileType: "application/pdf",
          url: resumeUrl,
          metadata,
        };
      }

      // If we have file path, read and return
      if (resume.filePath) {
        // You might want to implement file reading here
        // For now, return the path
        return {
          resume: resume.filePath,
          fileName: `${application.userId?.name || "candidate"}_resume.pdf`,
          fileType: "application/pdf",
          metadata,
        };
      }

      console.log(`❌ No PDF file found for resume`);
      return null;
    } catch (error) {
      console.error(
        "❌ Error in CandidateService.getShortlistedCandidateResume:",
        error,
      );
      throw error;
    }
  }

  /**
   * Get multiple shortlisted candidate resumes
   */
  async getShortlistedCandidateResumes(
    employerId: string,
    options: {
      jobId?: string;
      candidateIds?: string[];
      format?: "pdf" | "json" | "url";
      limit?: number;
    } = {},
  ): Promise<{
    resumes: any[];
    total: number;
  }> {
    try {
      const { jobId, candidateIds, format = "pdf", limit = 10 } = options;

      // 1. Get all jobs posted by this employer
      const employerJobs = await this.Job.find({
        $or: [
          { postedBy: employerId },
          { employerId: employerId },
          { ownerId: employerId },
        ],
        isDeleted: { $ne: true },
      }).select("_id");

      const jobIds = employerJobs.map((job: any) => job._id);

      // 2. Build query
      const query: any = {
        jobId: { $in: jobIds },
        status: { $in: ["shortlisted", "interview_scheduled"] },
      };

      if (jobId) {
        query.jobId = jobId;
      }

      if (candidateIds && candidateIds.length > 0) {
        query._id = { $in: candidateIds };
      }

      // 3. Get applications
      const applications = await this.Application.find(query)
        .populate("userId", "name email")
        .populate("jobId", "title")
        .limit(limit)
        .sort({ updatedAt: -1 });

      // 4. Get resumes for each application
      const resumes = await Promise.all(
        applications.map(async (app) => {
          const result = await this.getShortlistedCandidateResume(
            app._id.toString(),
            employerId,
            format as "pdf" | "json" | "url",
          );
          return result;
        }),
      );

      // Filter out null results
      const validResumes = resumes.filter((r) => r !== null);

      return {
        resumes: validResumes,
        total: validResumes.length,
      };
    } catch (error) {
      console.error(
        "❌ Error in CandidateService.getShortlistedCandidateResumes:",
        error,
      );
      throw error;
    }
  }
}

export default new CandidateService();
