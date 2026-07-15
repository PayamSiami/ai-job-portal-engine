// src/services/employerService.ts
import Job, { IJob } from "../models/Job.models.js";
import Application, { IApplication, ApplicationStatus } from "../models/Application.model.js";
import Company, { ICompany, CompanySize, CompanyType, IndustryType, CompanyStatus } from "../models/Company.models.js";
import User, { IUser, UserRole } from "../models/User.models.js";
import mongoose from "mongoose";
import logger from "../utils/logger.js";

// ============ Type Definitions ============

export interface EmployerDashboard {
  company: {
    id: string;
    name: string;
    slug?: string;
    tagline?: string;
    logoUrl?: string;
    coverImageUrl?: string;
    isVerified: boolean;
    companySize?: CompanySize;
    companyType?: CompanyType;
    industryType?: IndustryType;
    status: CompanyStatus;
  } | null;
  jobs: {
    total: number;
    active: number;
    inactive: number;
    byStatus: {
      draft: number;
      active: number;
      expired: number;
    };
    recent: IJob[];
  };
  applications: {
    total: number;
    byStatus: Record<ApplicationStatus, number>;
    recent: Array<{
      id: string;
      jobId: string;
      jobTitle: string;
      applicantId: string;
      applicantName: string;
      applicantEmail: string;
      status: ApplicationStatus;
      aiScore?: number;
      appliedAt: Date;
    }>;
    needsReview: number;
  };
  topCandidates: Array<{
    id: string;
    jobId: string;
    jobTitle: string;
    applicantId: string;
    applicantName: string;
    applicantEmail: string;
    aiScore: number;
    status: ApplicationStatus;
    appliedAt: Date;
  }>;
  recentActivity: Array<{
    type: "job_created" | "application_received" | "application_status_changed" | "candidate_hired";
    timestamp: Date;
    description: string;
    metadata?: Record<string, any>;
  }>;
}

export interface EmployerJobStats {
  total: number;
  active: number;
  inactive: number;
  byType: Record<string, number>;
  byMode: Record<string, number>;
  byLevel: Record<string, number>;
  totalViews: number;
  totalApplications: number;
  conversionRate: number;
}

export interface EmployerApplicationStats {
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  recentApplications: number;
  byJob: Array<{
    jobId: string;
    jobTitle: string;
    totalApplications: number;
    byStatus: Record<ApplicationStatus, number>;
  }>;
  timeToHire: number;
  timeToFill: number;
}

export interface EmployerCompanyProfile {
  id: string;
  name: string;
  slug?: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  website?: string;
  email?: string;
  phone?: string;
  foundedYear?: number;
  companySize?: CompanySize;
  companyType?: CompanyType;
  industryType?: IndustryType;
  registrationNumber?: string;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  socialLinks: Array<{
    platform: string;
    url: string;
  }>;
  status: CompanyStatus;
  isActive: boolean;
  isVerified: boolean;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCompanyData {
  name: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  website?: string;
  email?: string;
  phone?: string;
  foundedYear?: number;
  companySize: CompanySize;
  companyType: CompanyType;
  industryType: IndustryType;
  registrationNumber?: string;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  socialLinks?: Array<{
    platform: string;
    url: string;
  }>;
}

export interface UpdateCompanyData extends Partial<CreateCompanyData> {
  isActive?: boolean;
  status?: CompanyStatus;
}

// ============ Service Class ============

class EmployerService {
  /**
   * Get employer dashboard with aggregated statistics
   */
  async getDashboard(employerId: string): Promise<EmployerDashboard> {
    try {
      logger.info("Fetching employer dashboard", { employerId });

      if (!mongoose.Types.ObjectId.isValid(employerId)) {
        throw new Error("Invalid employer ID");
      }

      // Get company profile owned by employer
      const company = await Company.findOne({ ownerId: employerId }).lean();

      // Get company's jobs
      let jobs: IJob[] = [];
      if (company) {
        jobs = await Job.find({ companyId: company._id, isDeleted: false }).sort({ createdAt: -1 }).lean();
      }

      const totalJobs = jobs.length;
      const activeJobs = jobs.filter((j) => j.isActive).length;
      const inactiveJobs = totalJobs - activeJobs;

      // Get applications for company's jobs
      const jobIds = jobs.map((j) => j._id);
      const applications = await Application.find({ jobId: { $in: jobIds } })
        .populate("jobId", "title")
        .populate("applicantId", "username email profile.firstName profile.lastName")
        .sort({ appliedAt: -1 })
        .lean();

      const totalApplications = applications.length;

      // Applications by status
      const byStatus: Record<ApplicationStatus, number> = {
        [ApplicationStatus.PENDING]: 0,
        [ApplicationStatus.REVIEWING]: 0,
        [ApplicationStatus.SHORTLISTED]: 0,
        [ApplicationStatus.INTERVIEWING]: 0,
        [ApplicationStatus.HIRED]: 0,
        [ApplicationStatus.REJECTED]: 0,
      };

      applications.forEach((app: any) => {
        if (app.status && byStatus.hasOwnProperty(app.status)) {
          byStatus[app.status as ApplicationStatus]++;
        }
      });

      // Recent applications (last 10)
      const recentApplications = applications.slice(0, 10).map((app: any) => ({
        id: app._id.toString(),
        jobId: app.jobId?._id?.toString() || "",
        jobTitle: app.jobId?.title || "Unknown Job",
        applicantId: app.applicantId?._id?.toString() || "",
        applicantName: `${app.applicantId?.profile?.firstName || ""} ${app.applicantId?.profile?.lastName || ""}`.trim() || app.applicantId?.username || "Unknown",
        applicantEmail: app.applicantId?.email || "",
        status: app.status,
        aiScore: app.aiScore,
        appliedAt: app.appliedAt,
      }));

      // Needs review count (pending + reviewing)
      const needsReview = byStatus[ApplicationStatus.PENDING] + byStatus[ApplicationStatus.REVIEWING];

      // Top candidates (highest AI scores, not yet hired/rejected)
      const topCandidates = applications
        .filter(
          (app: any) =>
            app.aiScore !== null &&
            app.aiScore !== undefined &&
            app.status !== ApplicationStatus.HIRED &&
            app.status !== ApplicationStatus.REJECTED
        )
        .sort((a: any, b: any) => (b.aiScore || 0) - (a.aiScore || 0))
        .slice(0, 10)
        .map((app: any) => ({
          id: app._id.toString(),
          jobId: app.jobId?._id?.toString() || "",
          jobTitle: app.jobId?.title || "Unknown Job",
          applicantId: app.applicantId?._id?.toString() || "",
          applicantName: `${app.applicantId?.profile?.firstName || ""} ${app.applicantId?.profile?.lastName || ""}`.trim() || app.applicantId?.username || "Unknown",
          applicantEmail: app.applicantId?.email || "",
          aiScore: app.aiScore,
          status: app.status,
          appliedAt: app.appliedAt,
        }));

      // Jobs by status
      const now = new Date();
      const jobsByStatus = {
        draft: jobs.filter((j) => !j.isActive).length,
        active: jobs.filter((j) => j.isActive && (!j.applicationDeadline || new Date(j.applicationDeadline) > now)).length,
        expired: jobs.filter((j) => j.isActive && j.applicationDeadline && new Date(j.applicationDeadline) <= now).length,
      };

      // Recent activity
      const recentActivity: EmployerDashboard["recentActivity"] = [
        ...jobs.slice(0, 5).map((job) => ({
          type: "job_created" as const,
          timestamp: job.createdAt,
          description: `Created job: ${job.title}`,
          metadata: { jobId: job._id.toString(), jobTitle: job.title },
        })),
        ...applications.slice(0, 5).map((app: any) => ({
          type: "application_received" as const,
          timestamp: app.appliedAt,
          description: `New application for ${app.jobId?.title || "Unknown Job"} from ${app.applicantId?.username || "Unknown"}`,
          metadata: {
            applicationId: app._id.toString(),
            jobId: app.jobId?._id?.toString(),
            applicantId: app.applicantId?._id?.toString(),
          },
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

      return {
        company: company
          ? {
              id: company._id.toString(),
              name: company.name,
              slug: company.slug,
              tagline: company.tagline,
              logoUrl: company.logoUrl,
              coverImageUrl: company.coverImageUrl,
              isVerified: company.isVerified,
              companySize: company.companySize,
              companyType: company.companyType,
              industryType: company.industryType,
              status: company.status,
            }
          : null,
        jobs: {
          total: totalJobs,
          active: activeJobs,
          inactive: inactiveJobs,
          byStatus: jobsByStatus,
          recent: jobs.slice(0, 5),
        },
        applications: {
          total: totalApplications,
          byStatus,
          recent: recentApplications,
          needsReview,
        },
        topCandidates,
        recentActivity,
      };
    } catch (error) {
      logger.error("Failed to get employer dashboard", {
        error: error instanceof Error ? error.message : "Unknown error",
        employerId,
      });
      throw error;
    }
  }

  /**
   * Get detailed job statistics for employer
   */
  async getJobStats(employerId: string): Promise<EmployerJobStats> {
    try {
      if (!mongoose.Types.ObjectId.isValid(employerId)) {
        throw new Error("Invalid employer ID");
      }

      const company = await Company.findOne({ ownerId: employerId }).lean();
      if (!company) {
        return {
          total: 0,
          active: 0,
          inactive: 0,
          byType: {},
          byMode: {},
          byLevel: {},
          totalViews: 0,
          totalApplications: 0,
          conversionRate: 0,
        };
      }

      const jobs = await Job.find({ companyId: company._id, isDeleted: false }).lean();
      const jobIds = jobs.map((j) => j._id);
      const applications = await Application.find({ jobId: { $in: jobIds } }).lean();

      const byType: Record<string, number> = {};
      const byMode: Record<string, number> = {};
      const byLevel: Record<string, number> = {};

      jobs.forEach((job) => {
        byType[job.jobType] = (byType[job.jobType] || 0) + 1;
        byMode[job.workMode] = (byMode[job.workMode] || 0) + 1;
        byLevel[job.experienceLevel] = (byLevel[job.experienceLevel] || 0) + 1;
      });

      const totalApplications = applications.length;
      const totalViews = jobs.reduce((sum, j) => sum + (j.views || 0), 0);
      const conversionRate = jobs.length > 0 ? totalApplications / jobs.length : 0;

      return {
        total: jobs.length,
        active: jobs.filter((j) => j.isActive).length,
        inactive: jobs.filter((j) => !j.isActive).length,
        byType,
        byMode,
        byLevel,
        totalViews,
        totalApplications,
        conversionRate,
      };
    } catch (error) {
      logger.error("Failed to get employer job stats", {
        error: error instanceof Error ? error.message : "Unknown error",
        employerId,
      });
      throw error;
    }
  }

  /**
   * Get detailed application statistics for employer
   */
  async getApplicationStats(employerId: string): Promise<EmployerApplicationStats> {
    try {
      if (!mongoose.Types.ObjectId.isValid(employerId)) {
        throw new Error("Invalid employer ID");
      }

      const company = await Company.findOne({ ownerId: employerId }).lean();
      if (!company) {
        return {
          total: 0,
          byStatus: {
            [ApplicationStatus.PENDING]: 0,
            [ApplicationStatus.REVIEWING]: 0,
            [ApplicationStatus.SHORTLISTED]: 0,
            [ApplicationStatus.INTERVIEWING]: 0,
            [ApplicationStatus.HIRED]: 0,
            [ApplicationStatus.REJECTED]: 0,
          },
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          recentApplications: 0,
          byJob: [],
          timeToHire: 0,
          timeToFill: 0,
        };
      }

      const jobs = await Job.find({ companyId: company._id, isDeleted: false }).lean();
      const jobIds = jobs.map((j) => j._id);
      const applications = await Application.find({ jobId: { $in: jobIds } }).lean();

      const byStatus: Record<ApplicationStatus, number> = {
        [ApplicationStatus.PENDING]: 0,
        [ApplicationStatus.REVIEWING]: 0,
        [ApplicationStatus.SHORTLISTED]: 0,
        [ApplicationStatus.INTERVIEWING]: 0,
        [ApplicationStatus.HIRED]: 0,
        [ApplicationStatus.REJECTED]: 0,
      };

      let totalScore = 0;
      let scoredCount = 0;
      let highestScore = 0;
      let lowestScore = 100;

      applications.forEach((app) => {
        if (app.status && byStatus.hasOwnProperty(app.status)) {
          byStatus[app.status as ApplicationStatus]++;
        }
        if (app.aiScore !== null && app.aiScore !== undefined) {
          totalScore += app.aiScore;
          scoredCount++;
          if (app.aiScore > highestScore) highestScore = app.aiScore;
          if (app.aiScore < lowestScore) lowestScore = app.aiScore;
        }
      });

      const recentApplications = applications.filter(
        (app) => new Date(app.appliedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
      ).length;

      // Per-job breakdown
      const byJob = jobs.map((job) => {
        const jobApps = applications.filter((app) => app.jobId.toString() === job._id.toString());
        const jobByStatus: Record<ApplicationStatus, number> = {
          [ApplicationStatus.PENDING]: 0,
          [ApplicationStatus.REVIEWING]: 0,
          [ApplicationStatus.SHORTLISTED]: 0,
          [ApplicationStatus.INTERVIEWING]: 0,
          [ApplicationStatus.HIRED]: 0,
          [ApplicationStatus.REJECTED]: 0,
        };
        jobApps.forEach((app) => {
          if (app.status && jobByStatus.hasOwnProperty(app.status)) {
            jobByStatus[app.status as ApplicationStatus]++;
          }
        });
        return {
          jobId: job._id.toString(),
          jobTitle: job.title,
          totalApplications: jobApps.length,
          byStatus: jobByStatus,
        };
      });

      // Calculate time to hire/fill
      const hiredApps = applications.filter((app) => app.status === ApplicationStatus.HIRED);
      let timeToHire = 0;
      if (hiredApps.length > 0) {
        const hireTimes = hiredApps.map((app) => {
          const job = jobs.find((j) => j._id.toString() === app.jobId.toString());
          if (job) {
            return new Date(app.updatedAt).getTime() - new Date(job.createdAt).getTime();
          }
          return 0;
        });
        timeToHire = hireTimes.reduce((a, b) => a + b, 0) / hireTimes.length / (1000 * 60 * 60 * 24);
      }

      return {
        total: applications.length,
        byStatus,
        averageScore: scoredCount > 0 ? totalScore / scoredCount : 0,
        highestScore,
        lowestScore: lowestScore === 100 ? 0 : lowestScore,
        recentApplications,
        byJob,
        timeToHire,
        timeToFill: timeToHire, // simplified
      };
    } catch (error) {
      logger.error("Failed to get employer application stats", {
        error: error instanceof Error ? error.message : "Unknown error",
        employerId,
      });
      throw error;
    }
  }

  /**
   * Get company profile for employer
   */
  async getCompanyProfile(employerId: string): Promise<EmployerCompanyProfile | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(employerId)) {
        throw new Error("Invalid employer ID");
      }

      const company = await Company.findOne({ ownerId: employerId }).lean();

      if (!company) {
        return null;
      }

      return {
        id: company._id.toString(),
        name: company.name,
        slug: company.slug,
        tagline: company.tagline,
        description: company.description,
        logoUrl: company.logoUrl,
        coverImageUrl: company.coverImageUrl,
        website: company.website,
        email: company.email,
        phone: company.phone,
        foundedYear: company.foundedYear,
        companySize: company.companySize,
        companyType: company.companyType,
        industryType: company.industryType,
        registrationNumber: company.registrationNumber,
        location: company.location
          ? {
              address: company.location.address,
              city: company.location.city,
              state: company.location.state,
              country: company.location.country,
              zipCode: company.location.zipCode,
            }
          : undefined,
        socialLinks: company.socialLinks || [],
        status: company.status,
        isActive: company.isActive,
        isVerified: company.isVerified,
        verifiedAt: company.verifiedAt,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
      };
    } catch (error) {
      logger.error("Failed to get company profile", {
        error: error instanceof Error ? error.message : "Unknown error",
        employerId,
      });
      throw error;
    }
  }

  /**
   * Create company profile for employer
   */
  async createCompanyProfile(employerId: string, data: CreateCompanyData): Promise<any> {
    try {
      if (!mongoose.Types.ObjectId.isValid(employerId)) {
        throw new Error("Invalid employer ID");
      }

      // Check if company already exists for this employer
      const existing = await Company.findOne({ ownerId: employerId });
      if (existing) {
        throw new Error("Company profile already exists for this employer");
      }

      // Check name uniqueness
      const nameExists = await Company.findOne({ name: data.name });
      if (nameExists) {
        throw new Error("Company name already taken");
      }

      const company = new Company({
        ...data,
        ownerId: employerId,
        isActive: true,
        status: CompanyStatus.PENDING,
        isVerified: false,
      });

      await company.save();

      // Update user role to employer if not already
      await User.findByIdAndUpdate(employerId, { role: UserRole.EMPLOYER });

      logger.info("Company profile created", { employerId, companyId: company._id });
      return company;
    } catch (error) {
      logger.error("Failed to create company profile", {
        error: error instanceof Error ? error.message : "Unknown error",
        employerId,
        data,
      });
      throw error;
    }
  }

  /**
   * Update company profile
   */
  async updateCompanyProfile(employerId: string, data: UpdateCompanyData): Promise<any> {
    try {
      if (!mongoose.Types.ObjectId.isValid(employerId)) {
        throw new Error("Invalid employer ID");
      }

      const company = await Company.findOne({ ownerId: employerId });
      if (!company) {
        throw new Error("Company profile not found");
      }

      // If name is being updated, check uniqueness
      if (data.name && data.name !== company.name) {
        const nameExists = await Company.findOne({ name: data.name });
        if (nameExists) {
          throw new Error("Company name already taken");
        }
      }

      Object.assign(company, data);
      await company.save();

      logger.info("Company profile updated", { employerId, companyId: company._id });
      return company;
    } catch (error) {
      logger.error("Failed to update company profile", {
        error: error instanceof Error ? error.message : "Unknown error",
        employerId,
        data,
      });
      throw error;
    }
  }

  /**
   * Get employer's jobs with pagination
   */
  async getEmployerJobs(
    employerId: string,
    options: { page?: number; limit?: number; isActive?: boolean } = {}
  ): Promise<{ jobs: IJob[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
    try {
      if (!mongoose.Types.ObjectId.isValid(employerId)) {
        throw new Error("Invalid employer ID");
      }

      const company = await Company.findOne({ ownerId: employerId }).lean();
      if (!company) {
        return { jobs: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } };
      }

      const { page = 1, limit = 10, isActive } = options;
      const skip = (page - 1) * limit;

      const query: any = { companyId: company._id, isDeleted: false };
      if (isActive !== undefined) {
        query.isActive = isActive;
      }

      const [jobs, total] = await Promise.all([
        Job.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
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
    } catch (error) {
      logger.error("Failed to get employer jobs", {
        error: error instanceof Error ? error.message : "Unknown error",
        employerId,
      });
      throw error;
    }
  }

  /**
   * Get employer's applications with pagination
   */
  async getEmployerApplications(
    employerId: string,
    options: {
      page?: number;
      limit?: number;
      status?: ApplicationStatus;
      jobId?: string;
    } = {}
  ): Promise<{ applications: any[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
    try {
      if (!mongoose.Types.ObjectId.isValid(employerId)) {
        throw new Error("Invalid employer ID");
      }

      const company = await Company.findOne({ ownerId: employerId }).lean();
      if (!company) {
        return { applications: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } };
      }

      const jobs = await Job.find({ companyId: company._id, isDeleted: false }).lean();
      const jobIds = jobs.map((j) => j._id);

      const { page = 1, limit = 10, status, jobId } = options;
      const skip = (page - 1) * limit;

      const query: any = { jobId: { $in: jobIds } };
      if (status) query.status = status;
      if (jobId) query.jobId = jobId;

      const [applications, total] = await Promise.all([
        Application.find(query)
          .populate("jobId", "title")
          .populate("applicantId", "username email profile.firstName profile.lastName")
          .sort({ appliedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Application.countDocuments(query),
      ]);

      return {
        applications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to get employer applications", {
        error: error instanceof Error ? error.message : "Unknown error",
        employerId,
      });
      throw error;
    }
  }
}

export default new EmployerService();