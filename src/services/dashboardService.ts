import Job from "../models/Job.models.js";
import Application, { ApplicationStatus } from "../models/Application.model.js";
import Company from "../models/Company.models.js";
import Resume from "../models/Resume.models.js";
import { AppError } from "../utils/errorHandler.js";

// ==================== INTERFACES ====================

interface DashboardStats {
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
  recentActivities: {
    id: string;
    candidateName: string;
    jobTitle: string;
    status: string;
    timestamp: Date;
    aiScore?: number;
  }[];
}

interface AIScreeningData {
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

interface ApplicationStats {
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

interface RecentActivity {
  id: string;
  candidateName: string;
  jobTitle: string;
  status: string;
  timestamp: Date;
  aiScore?: number;
}

interface JobPerformance {
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

// ==================== DASHBOARD SERVICE ====================

export class DashboardService {
  private Job: any;
  private Application: any;
  private Company: any;
  private Resume: any;

  constructor() {
    this.Job = Job;
    this.Application = Application;
    this.Company = Company;
    this.Resume = Resume;
  }

  /**
   * Get comprehensive dashboard statistics for an employer
   */
  async getDashboardStats(employerId: string): Promise<DashboardStats> {
    // 1. Get company for this employer
    const company = await this.Company.findOne({ ownerId: employerId });
    if (!company) {
      throw new AppError("Company not found for this employer", 404);
    }

    // 2. Get all jobs for this employer
    const jobs = await this.Job.find({ postedBy: employerId }).select(
      "_id title isActive createdAt",
    );

    // 3. Get job IDs for applications query
    const jobIds = jobs.map((job: any) => job._id);

    // If no jobs, return empty stats
    if (jobIds.length === 0) {
      return this.getEmptyDashboardStats();
    }

    // 4. Get all applications for these jobs
    const applications = await this.Application.find({
      jobId: { $in: jobIds },
    }).populate("userId", "fullName email");

    // 5. Calculate statistics
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

    // 6. Get recent activities (last 7 days)
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
      candidateName: (app.userId as any)?.fullName || "Unknown",
      jobTitle:
        jobs.find((j: any) => j._id.toString() === app.jobId.toString())
          ?.title || "Unknown",
      status: app.status,
      timestamp: app.appliedAt || app.createdAt,
      aiScore: app.aiScore,
    }));

    return stats;
  }

  /**
   * Get AI screening data for dashboard
   */
  async getAIScreeningData(employerId: string): Promise<AIScreeningData> {
    const company = await this.Company.findOne({ ownerId: employerId });
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    // Get jobs for this employer
    const jobs = await this.Job.find({ postedBy: employerId });
    const jobIds = jobs.map((job: any) => job._id);

    if (jobIds.length === 0) {
      return this.getEmptyScreeningData();
    }

    // Get all applications
    const applications = await this.Application.find({
      jobId: { $in: jobIds },
    }).populate("userId", "fullName");

    const total = applications.length;
    const screened = applications.filter(
      (a: any) => a.aiScore !== null && a.aiScore !== undefined,
    );
    const pending = applications.filter(
      (a: any) => a.aiScore === null || a.aiScore === undefined,
    );

    // Calculate average AI score
    const totalAIScore = screened.reduce(
      (sum: number, a: any) => sum + (a.aiScore || 0),
      0,
    );
    const averageAIScore =
      screened.length > 0 ? totalAIScore / screened.length : 0;

    // Screening history by job
    const screeningHistory = jobs.map((job: any) => {
      const jobApps = applications.filter(
        (app: any) => app.jobId.toString() === job._id.toString(),
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

    // Pending screening
    const pendingScreening = pending.slice(0, 20).map((app: any) => ({
      id: app._id.toString(),
      candidateName: (app.userId as any)?.fullName || "Unknown",
      jobTitle:
        jobs.find((j: any) => j._id.toString() === app.jobId.toString())
          ?.title || "Unknown",
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
   * Get recent activity for dashboard
   */
  async getRecentActivity(
    employerId: string,
    limit: number = 10,
  ): Promise<RecentActivity[]> {
    const company = await this.Company.findOne({ ownerId: employerId });
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    const jobs = await this.Job.find({ postedBy: employerId });
    const jobIds = jobs.map((job: any) => job._id);

    if (jobIds.length === 0) {
      return [];
    }

    const applications = await this.Application.find({
      jobId: { $in: jobIds },
    })
      .populate("userId", "fullName")
      .sort({ appliedAt: -1, createdAt: -1 })
      .limit(limit);

    return applications.map((app: any) => ({
      id: app._id.toString(),
      candidateName: (app.userId as any)?.fullName || "Unknown",
      jobTitle:
        jobs.find((j: any) => j._id.toString() === app.jobId.toString())
          ?.title || "Unknown",
      status: app.status,
      timestamp: app.appliedAt || app.createdAt,
      aiScore: app.aiScore,
    }));
  }

  /**
   * Get application statistics for dashboard
   */
  async getApplicationStats(employerId: string): Promise<ApplicationStats> {
    const company = await this.Company.findOne({ ownerId: employerId });
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    const jobs = await this.Job.find({ postedBy: employerId }).select(
      "_id title",
    );
    const jobIds = jobs.map((job: any) => job._id);

    if (jobIds.length === 0) {
      return this.getEmptyApplicationStats();
    }

    // Use aggregation pipeline for better performance
    const pipeline = [
      {
        $match: {
          jobId: { $in: jobIds },
        },
      },
      {
        $facet: {
          statusCounts: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ],
          aiStats: [
            {
              $match: {
                aiScore: { $exists: true, $ne: null },
              },
            },
            {
              $group: {
                _id: null,
                averageAIScore: { $avg: "$aiScore" },
                totalScreened: { $sum: 1 },
              },
            },
          ],
          applicationsByJob: [
            {
              $lookup: {
                from: "jobs",
                localField: "jobId",
                foreignField: "_id",
                as: "job",
              },
            },
            {
              $unwind: "$job",
            },
            {
              $group: {
                _id: "$job.title",
                count: { $sum: 1 },
              },
            },
            {
              $sort: { count: -1 },
            },
            {
              $limit: 10,
            },
          ],
          recentActivity: [
            {
              $match: {
                createdAt: {
                  $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                count: { $sum: 1 },
              },
            },
            {
              $sort: { _id: 1 },
            },
          ],
          hiredApplications: [
            {
              $match: {
                status: ApplicationStatus.HIRED,
                createdAt: { $exists: true },
              },
            },
            {
              $project: {
                timeToHire: {
                  $subtract: ["$updatedAt", "$createdAt"],
                },
              },
            },
          ],
        },
      },
    ];

    const result = await this.Application.aggregate(pipeline as any);
    const data = result[0] || {};

    // Parse status counts
    const statusCounts: Record<string, number> = {};
    (data.statusCounts || []).forEach((item: any) => {
      statusCounts[item._id] = item.count;
    });

    // Parse AI stats
    const aiStats = data.aiStats?.[0] || {
      averageAIScore: 0,
      totalScreened: 0,
    };

    const totalApplications = Object.values(statusCounts).reduce(
      (sum: number, count: number) => sum + count,
      0,
    );

    // Calculate screening coverage
    const screeningCoverage =
      totalApplications > 0
        ? (aiStats.totalScreened / totalApplications) * 100
        : 0;

    // Calculate average time to hire (in days)
    let averageTimeToHire = 0;
    if (data.hiredApplications && data.hiredApplications.length > 0) {
      const totalDays = data.hiredApplications.reduce(
        (sum: number, app: any) => {
          const days = app.timeToHire / (1000 * 60 * 60 * 24);
          return sum + days;
        },
        0,
      );
      averageTimeToHire = totalDays / data.hiredApplications.length;
    }

    return {
      total: totalApplications,
      pending: statusCounts[ApplicationStatus.PENDING] || 0,
      reviewing: statusCounts[ApplicationStatus.REVIEWING] || 0,
      shortlisted: statusCounts[ApplicationStatus.SHORTLISTED] || 0,
      interviewing: statusCounts[ApplicationStatus.INTERVIEWING] || 0,
      rejected: statusCounts[ApplicationStatus.REJECTED] || 0,
      hired: statusCounts[ApplicationStatus.HIRED] || 0,
      averageAIScore: Math.round((aiStats.averageAIScore || 0) * 100) / 100,
      screeningCoverage: Math.round(screeningCoverage * 100) / 100,
      statusBreakdown: {
        [ApplicationStatus.PENDING]:
          statusCounts[ApplicationStatus.PENDING] || 0,
        [ApplicationStatus.REVIEWING]:
          statusCounts[ApplicationStatus.REVIEWING] || 0,
        [ApplicationStatus.SHORTLISTED]:
          statusCounts[ApplicationStatus.SHORTLISTED] || 0,
        [ApplicationStatus.INTERVIEWING]:
          statusCounts[ApplicationStatus.INTERVIEWING] || 0,
        [ApplicationStatus.HIRED]: statusCounts[ApplicationStatus.HIRED] || 0,
        [ApplicationStatus.REJECTED]:
          statusCounts[ApplicationStatus.REJECTED] || 0,
      },
      recentActivity: (data.recentActivity || []).map((item: any) => ({
        date: item._id,
        count: item.count,
      })),
      applicationsByJob: (data.applicationsByJob || []).map((item: any) => ({
        jobTitle: item._id || "Unknown",
        count: item.count,
      })),
      averageTimeToHire: Math.round(averageTimeToHire * 100) / 100,
    };
  }

  /**
   * Get job performance metrics
   */
  async getJobPerformance(
    employerId: string,
    timeframe: number = 30,
  ): Promise<JobPerformance> {
    const company = await this.Company.findOne({ ownerId: employerId });
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    const jobs = await this.Job.find({
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

    const applications = await this.Application.find({
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

  /**
   * ✅ ADD THIS METHOD: Get top candidates based on AI scores
   */
  async getTopCandidates(
    employerId: string,
    limit: number = 5,
  ): Promise<any[]> {
    const company = await this.Company.findOne({ ownerId: employerId });
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    const jobs = await this.Job.find({ companyId: company._id });
    const jobIds = jobs.map((job: any) => job._id);

    if (jobIds.length === 0) {
      return [];
    }

    // Get applications with AI scores, sorted by score
    const applications = await this.Application.find({
      jobId: { $in: jobIds },
      aiScore: { $exists: true, $ne: null },
    })
      .sort({ aiScore: -1 })
      .limit(limit)
      .populate("userId", "fullName email profileImage")
      .populate("jobId", "title");

    return applications.map((app: any) => ({
      id: app._id,
      candidateName: app.userId?.fullName || "Unknown",
      email: app.userId?.email,
      profileImage: app.userId?.profileImage,
      jobTitle: app.jobId?.title || "Unknown",
      status: app.status,
      aiScore: app.aiScore,
      appliedDate: app.appliedAt || app.createdAt,
      skills: app.skills || [],
      matchPercentage: app.aiScore ? Math.round(app.aiScore) : 0,
    }));
  }

  /**
   * ✅ ADD THIS METHOD: Get application timeline for chart
   */
  async getApplicationTimeline(
    employerId: string,
    days: number = 30,
    status?: string,
  ): Promise<any[]> {
    const company = await this.Company.findOne({ ownerId: employerId });
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    const jobs = await this.Job.find({ companyId: company._id });
    const jobIds = jobs.map((job: any) => job._id);

    if (jobIds.length === 0) {
      return [];
    }

    const matchStage: any = {
      jobId: { $in: jobIds },
      createdAt: {
        $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      },
    };

    if (status) {
      matchStage.status = status;
    }

    const timeline = await this.Application.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
          applications: {
            $push: {
              id: "$_id",
              status: "$status",
              aiScore: "$aiScore",
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ] as any);

    return timeline.map((item: any) => ({
      date: item._id,
      count: item.count,
      applications: item.applications.slice(0, 10), // Limit details
    }));
  }

  /**
   * ✅ ADD THIS METHOD: Get skill distribution of applicants
   */
  async getSkillDistribution(
    employerId: string,
    limit: number = 10,
  ): Promise<any[]> {
    const company = await this.Company.findOne({ ownerId: employerId });
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    const jobs = await this.Job.find({ companyId: company._id });
    const jobIds = jobs.map((job: any) => job._id);

    if (jobIds.length === 0) {
      return [];
    }

    // Get all applications for these jobs
    const applications = await this.Application.find({
      jobId: { $in: jobIds },
    });

    const userIds = applications.map((app: any) => app.userId);

    // Get resumes to extract skills
    const resumes = await this.Resume.find({
      userId: { $in: userIds },
    });

    const skillCount: Record<string, number> = {};
    resumes.forEach((resume: any) => {
      if (resume.skills && Array.isArray(resume.skills)) {
        resume.skills.forEach((skill: any) => {
          const skillName = skill.name?.toLowerCase();
          if (skillName) {
            skillCount[skillName] = (skillCount[skillName] || 0) + 1;
          }
        });
      }
    });

    return Object.entries(skillCount)
      .map(([skill, count]) => ({
        skill,
        count,
        percentage: resumes.length > 0 ? (count / resumes.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * ✅ ADD THIS METHOD: Get status breakdown
   */
  async getStatusBreakdown(employerId: string): Promise<any> {
    const company = await this.Company.findOne({ ownerId: employerId });
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    const jobs = await this.Job.find({ companyId: company._id });
    const jobIds = jobs.map((job: any) => job._id);

    if (jobIds.length === 0) {
      return {
        pending: 0,
        reviewing: 0,
        shortlisted: 0,
        interviewing: 0,
        hired: 0,
        rejected: 0,
        total: 0,
      };
    }

    const statusCounts = await this.Application.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ] as any);

    const breakdown: Record<string, number> = {
      pending: 0,
      reviewing: 0,
      shortlisted: 0,
      interviewing: 0,
      hired: 0,
      rejected: 0,
    };

    statusCounts.forEach((item: any) => {
      if (item._id in breakdown) {
        breakdown[item._id] = item.count;
      }
    });

    const total = Object.values(breakdown).reduce(
      (sum, count) => sum + count,
      0,
    );

    return {
      ...breakdown,
      total,
      // Add percentage breakdown
      percentages: Object.entries(breakdown).reduce(
        (acc, [key, value]) => {
          acc[key] = total > 0 ? Math.round((value / total) * 100) : 0;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  /**
   * ✅ ADD THIS METHOD: Export dashboard data
   */
  async exportDashboard(
    employerId: string,
    format: string = "csv",
    type: string = "summary",
  ): Promise<any> {
    const company = await this.Company.findOne({ ownerId: employerId });
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    const jobs = await this.Job.find({ companyId: company._id });
    const jobIds = jobs.map((job: any) => job._id);

    let data: any[] = [];

    if (type === "summary") {
      // Get summary data
      const stats = await this.getDashboardStats(employerId);
      data = [
        {
          companyName: company.name,
          totalJobs: stats.totalJobs,
          activeJobs: stats.activeJobs,
          totalApplications: stats.totalApplications,
          pendingApplications: stats.pendingApplications,
          reviewingApplications: stats.reviewingApplications,
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
      // Get all applications
      const applications = await this.Application.find({
        jobId: { $in: jobIds },
      }).populate("userId", "fullName email");

      data = applications.map((app: any) => ({
        candidateName: app.userId?.fullName || "Unknown",
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

  /**
   * Get empty dashboard stats
   */
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

  /**
   * Get empty screening data
   */
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

  /**
   * Get empty application stats
   */
  private getEmptyApplicationStats(): ApplicationStats {
    return {
      total: 0,
      pending: 0,
      reviewing: 0,
      shortlisted: 0,
      interviewing: 0,
      rejected: 0,
      hired: 0,
      averageAIScore: 0,
      screeningCoverage: 0,
      statusBreakdown: {
        [ApplicationStatus.PENDING]: 0,
        [ApplicationStatus.REVIEWING]: 0,
        [ApplicationStatus.SHORTLISTED]: 0,
        [ApplicationStatus.INTERVIEWING]: 0,
        [ApplicationStatus.HIRED]: 0,
        [ApplicationStatus.REJECTED]: 0,
      },
      recentActivity: [],
      applicationsByJob: [],
      averageTimeToHire: 0,
    };
  }
}

export default DashboardService;
