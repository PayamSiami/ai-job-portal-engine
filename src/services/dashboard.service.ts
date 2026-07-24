// services/dashboard.service.ts
import { Types } from "mongoose";
import Job from "../models/Job.models.js";
import Application, { ApplicationStatus } from "../models/Application.model.js";
import Company from "../models/Company.models.js";
import Resume from "../models/Resume.models.js";
import User from "../models/User.models.js";
import { AppError } from "../utils/errorHandler.js";
import logger from "../utils/logger.js";
import companyService from "./company.service.js";
import jobService from "./job.service.js";

// ==================== INTERFACES ====================

// Define interfaces for populated documents
interface PopulatedUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  location?: string;
  profileImage?: string;
}

interface PopulatedJob {
  _id: Types.ObjectId;
  title: string;
  company: string;
}

interface PopulatedResume {
  _id: Types.ObjectId;
  skills: Array<{ name: string; level?: string; category?: string }>;
  experience: number;
  education: any[];
  certifications: any[];
  languages: any[];
  projects: any[];
  aiScore?: number;
  [key: string]: any;
}

// Extended application type with populated fields
interface PopulatedApplication {
  _id: Types.ObjectId;
  userId: PopulatedUser; // ✅ Now it's the populated user, not ObjectId
  jobId: PopulatedJob; // ✅ Now it's the populated job, not ObjectId
  resumeId: PopulatedResume; // ✅ Now it's the populated resume, not ObjectId
  status: string;
  aiScore?: number;
  appliedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  totalApplications: number;
  pendingApplications: number;
  reviewingApplications: number;
  shortlistedCandidates: number;
  interviewingCandidates: number;
  hiredCandidates: number;
  rejectedCandidates: number;
  aiScreenedCount: number;
  screeningCoverage: number;
  averageAIScore: number;
  recentActivities: RecentActivity[];
}

export interface RecentActivity {
  id: string;
  candidateName: string;
  jobTitle: string;
  status: string;
  timestamp: Date;
  aiScore?: number;
}

export interface AIScreeningData {
  screeningCoverage: number;
  totalCandidatesScreened: number;
  candidatesNotScreened: number;
  averageAIScore: number;
  screeningHistory: {
    jobId: string;
    jobTitle: string;
    totalApplicants: number;
    screenedCount: number;
    avgScore: number;
    postedDate: Date;
  }[];
  pendingScreening: {
    id: string;
    candidateName: string;
    jobTitle: string;
    appliedDate: Date;
  }[];
}

export interface ApplicationStats {
  total: number;
  pending: number;
  reviewing: number;
  shortlisted: number;
  interviewing: number;
  rejected: number;
  hired: number;
  averageAIScore: number;
  screeningCoverage: number;
  statusBreakdown: Record<ApplicationStatus, number>;
  recentActivity: Array<{
    date: string;
    count: number;
  }>;
  applicationsByJob: Array<{
    jobTitle: string;
    count: number;
  }>;
  averageTimeToHire: number;
}

export interface JobPerformance {
  totalJobs: number;
  activeJobs: number;
  jobsByStatus: Record<string, number>;
  applicationsPerJob: number;
  averageTimeToFill: number;
  topPerformingJobs: Array<{
    jobTitle: string;
    applicationCount: number;
    hireCount: number;
    conversionRate: number;
  }>;
}

export interface CandidateFilters {
  search?: string;
  status?: string;
  skills?: string[];
  experienceMin?: number;
  experienceMax?: number;
  location?: string;
  availability?: string;
}

export interface CandidateRecommendation {
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

export interface Activity {
  id: string;
  title: string;
  description?: string;
  score?: number | null;
  status: "pending" | "in-progress" | "completed";
  time: string;
  type:
    | "application"
    | "screening"
    | "generation"
    | "analytics"
    | "interview"
    | "status_change"
    | "job";
  link?: string;
  user?: { name: string; avatar?: string };
  timestamp: Date;
  jobTitle?: string;
  companyName?: string;
  metadata?: Record<string, any>;
}

// ==================== MERGED SERVICE ====================

class DashboardService {
  private Job: typeof Job;
  private Application: typeof Application;
  private Company: typeof Company;
  private Resume: typeof Resume;
  private User: typeof User;

  constructor() {
    this.Job = Job;
    this.Application = Application;
    this.Company = Company;
    this.Resume = Resume;
    this.User = User;
  }

  // ============================================================
  // 1. DASHBOARD STATS
  // ============================================================

  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(employerId: string): Promise<DashboardStats> {
    const company = await this.Company.findOne({
      ownerId: employerId,
    });

    if (!company) {
      throw new AppError("Company not found for this employer", 404);
    }

    const jobs = await this.Job.find({
      $or: [{ postedBy: employerId }, { company: company._id }],
    }).select("_id title isActive createdAt");

    const jobIds = jobs.map((job: any) => job._id);

    if (jobIds.length === 0) {
      return this.getEmptyDashboardStats();
    }

    const applications = await this.Application.find({
      job: { $in: jobIds },
    }).populate("user", "name email");

    const screenedApps = applications.filter(
      (a: any) => a.aiScore !== null && a.aiScore !== undefined,
    );

    const totalAIScore = screenedApps.reduce(
      (sum: number, a: any) => sum + (a.aiScore || 0),
      0,
    );

    const stats: DashboardStats = {
      totalJobs: jobs.length,
      activeJobs: jobs.filter((j: any) => j.isActive === true).length,
      totalApplications: applications.length,
      pendingApplications: applications.filter(
        (a: any) => a.status === ApplicationStatus.PENDING,
      ).length,
      reviewingApplications: applications.filter(
        (a: any) => a.status === ApplicationStatus.REVIEWING,
      ).length,
      shortlistedCandidates: applications.filter(
        (a: any) => a.status === ApplicationStatus.SHORTLISTED,
      ).length,
      interviewingCandidates: applications.filter(
        (a: any) => a.status === ApplicationStatus.INTERVIEWING,
      ).length,
      hiredCandidates: applications.filter(
        (a: any) => a.status === ApplicationStatus.HIRED,
      ).length,
      rejectedCandidates: applications.filter(
        (a: any) => a.status === ApplicationStatus.REJECTED,
      ).length,
      aiScreenedCount: screenedApps.length,
      screeningCoverage:
        applications.length > 0
          ? (screenedApps.length / applications.length) * 100
          : 0,
      averageAIScore:
        screenedApps.length > 0 ? totalAIScore / screenedApps.length : 0,
      recentActivities: [],
    };

    // Get recent activities
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentApps = applications
      .filter(
        (app: any) => new Date(app.appliedAt || app.createdAt) >= sevenDaysAgo,
      )
      .sort(
        (a: any, b: any) =>
          new Date(b.appliedAt || b.createdAt).getTime() -
          new Date(a.appliedAt || a.createdAt).getTime(),
      )
      .slice(0, 10);

    stats.recentActivities = recentApps.map((app: any) => ({
      id: app._id.toString(),
      candidateName: (app.user as any)?.name || "Unknown",
      jobTitle:
        jobs.find((j: any) => j._id.toString() === app.job.toString())?.title ||
        "Unknown",
      status: app.status,
      timestamp: app.appliedAt || app.createdAt,
      aiScore: app.aiScore,
    }));

    return stats;
  }

  // ============================================================
  // 2. AI SCREENING DATA
  // ============================================================

  async getAIScreeningData(employerId: string): Promise<AIScreeningData> {
    const jobs = await jobService.getJobsByEmployer(employerId);
    const jobIds = jobs.map((job: any) => job._id);

    if (jobIds.length === 0) {
      return this.getEmptyScreeningData();
    }

    const applications = await this.Application.find({
      job: { $in: jobIds },
    }).populate("user", "name");

    const total = applications.length;
    const screened = applications.filter(
      (a: any) => a.aiScore !== null && a.aiScore !== undefined,
    );
    const pending = applications.filter(
      (a: any) => a.aiScore === null || a.aiScore === undefined,
    );

    const totalAIScore = screened.reduce(
      (sum: number, a: any) => sum + (a.aiScore || 0),
      0,
    );
    const averageAIScore =
      screened.length > 0 ? totalAIScore / screened.length : 0;

    const screeningHistory = jobs.map((job: any) => {
      const jobApps = applications.filter(
        (app: any) => app.job.toString() === job._id.toString(),
      );
      const jobScreened = jobApps.filter(
        (app: any) => app.aiScore !== null && app.aiScore !== undefined,
      );
      const jobTotalAIScore = jobScreened.reduce(
        (sum: number, app: any) => sum + (app.aiScore || 0),
        0,
      );
      const avgScore =
        jobScreened.length > 0 ? jobTotalAIScore / jobScreened.length : 0;

      return {
        jobId: job._id.toString(),
        jobTitle: job.title,
        totalApplicants: jobApps.length,
        screenedCount: jobScreened.length,
        avgScore,
        postedDate: job.createdAt,
      };
    });

    const pendingScreening = pending.slice(0, 20).map((app: any) => ({
      id: app._id.toString(),
      candidateName: (app.user as any)?.name || "Unknown",
      jobTitle:
        jobs.find((j: any) => j._id.toString() === app.job.toString())?.title ||
        "Unknown",
      appliedDate: app.appliedAt || app.createdAt,
    }));

    return {
      screeningCoverage: total > 0 ? (screened.length / total) * 100 : 0,
      totalCandidatesScreened: screened.length,
      candidatesNotScreened: pending.length,
      averageAIScore: Math.round(averageAIScore * 100) / 100,
      screeningHistory,
      pendingScreening,
    };
  }

  /**
   * Export dashboard data
   */
  async exportDashboard(
    employerId: string,
    format: string = "csv",
    type: string = "summary",
  ): Promise<any> {
    const company = await companyService.getCompanyByOwnerId(employerId);
    const jobs = await jobService.getJobsByEmployer(employerId);
    const jobIds = jobs.map((job: any) => job._id);

    let data: any[] = [];

    if (type === "summary") {
      const stats = await this.getDashboardStats(employerId);
      data = [
        {
          companyName: company?.name || "-",
          totalJobs: stats.totalJobs,
          activeJobs: stats.activeJobs,
          totalApplications: stats.totalApplications,
          pendingApplications: stats.pendingApplications,
          shortlistedCandidates: stats.shortlistedCandidates,
          interviewingCandidates: stats.interviewingCandidates,
          hiredCandidates: stats.hiredCandidates,
          rejectedCandidates: stats.rejectedCandidates,
          aiScreenedCount: stats.aiScreenedCount,
          screeningCoverage: stats.screeningCoverage,
          averageAIScore: stats.averageAIScore,
          exportDate: new Date().toISOString(),
        },
      ];
    } else if (type === "applications") {
      const applications = await this.Application.find({
        jobId: { $in: jobIds },
      }).populate("userId", "name email");

      data = applications.map((app: any) => ({
        candidateName: app.userId?.name || "Unknown",
        email: app.userId?.email || "",
        jobTitle:
          jobs.find((j: any) => j._id.toString() === app.jobId.toString())
            ?.title || "Unknown",
        status: app.status,
        aiScore: app.aiScore || 0,
        appliedDate: app.appliedAt || app.createdAt,
      }));
    }

    return {
      format,
      type,
      data,
      totalRecords: data.length,
      exportedAt: new Date().toISOString(),
    };
  }

  // ============================================================
  // 9. HELPER METHODS
  // ============================================================

  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  }

  private mapApplicationStatus(
    status: string,
  ): "pending" | "in-progress" | "completed" {
    switch (status) {
      case ApplicationStatus.PENDING:
      case ApplicationStatus.REVIEWING:
        return "pending";
      case ApplicationStatus.SHORTLISTED:
      case ApplicationStatus.INTERVIEWING:
        return "in-progress";
      case ApplicationStatus.HIRED:
      case ApplicationStatus.REJECTED:
        return "completed";
      default:
        return "pending";
    }
  }

  private getEmptyDashboardStats(): DashboardStats {
    return {
      totalJobs: 0,
      activeJobs: 0,
      totalApplications: 0,
      pendingApplications: 0,
      reviewingApplications: 0,
      shortlistedCandidates: 0,
      interviewingCandidates: 0,
      hiredCandidates: 0,
      rejectedCandidates: 0,
      aiScreenedCount: 0,
      screeningCoverage: 0,
      averageAIScore: 0,
      recentActivities: [],
    };
  }

  private getEmptyScreeningData(): AIScreeningData {
    return {
      screeningCoverage: 0,
      totalCandidatesScreened: 0,
      candidatesNotScreened: 0,
      averageAIScore: 0,
      screeningHistory: [],
      pendingScreening: [],
    };
  }
}

export default new DashboardService();
