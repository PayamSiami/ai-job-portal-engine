// backend/src/services/company.service.ts
import { Company, ICompany, CompanyStatus } from "../models/Company.models.js";
import Job, { IJob } from "../models/Job.models.js";
import Application from "../models/Application.model.js";
import User from "../models/User.models.js";
import { AppError } from "../utils/errorHandler.js";
import { ObjectId } from "mongoose";
import Resume from "../models/Resume.models.js";

export interface CreateCompanyDto {
  name: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  website?: string;
  email?: string;
  phone?: string;
  foundedYear?: number;
  companySize: string;
  companyType: string;
  industryType: string;
  registrationNumber?: string;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  socialLinks?: {
    platform: string;
    url: string;
  }[];
}

export interface UpdateCompanyDto extends Partial<CreateCompanyDto> {
  status?: CompanyStatus;
  isActive?: boolean;
  isVerified?: boolean;
}

export class CompanyService {
  /**
   * Create a new company
   */
  async createCompany(
    userId: string,
    data: CreateCompanyDto,
  ): Promise<ICompany> {
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if user already has a company
    const existingCompany = await Company.findOne({ ownerId: userId });
    if (existingCompany) {
      throw new Error("User already has a company");
    }

    // Check if company name is taken
    const nameExists = await Company.findOne({ name: data.name });
    if (nameExists) {
      throw new Error("Company name already exists");
    }

    // Create company
    const company = new Company({
      ...data,
      ownerId: userId,
      status: CompanyStatus.PENDING,
      isActive: true,
      isVerified: false,
    });

    await company.save();

    // Update user with companyId
    await User.findByIdAndUpdate(userId, {
      $set: {
        companyId: company._id,
        role: "employer",
      },
    });

    return company;
  }

  /**
   * Get company by ID
   */
  async getCompanyById(companyId: string): Promise<ICompany | null> {
    return Company.findById(companyId);
  }

  /**
   * Get company by owner ID
   */
  async getCompanyByOwnerId(userId: string): Promise<ICompany | null> {
    return Company.findOne({ ownerId: userId });
  }

  /**
   * Get company with statistics
   */
  async getCompanyWithStats(userId: string): Promise<any> {
    const company = await Company.findOne({ ownerId: userId });
    if (!company) {
      return null;
    }

    // Get job statistics
    const jobs = await Job.find({ employerId: userId });
    const jobIds = jobs.map((job) => job._id);

    const applications = await Application.find({
      jobId: { $in: jobIds },
    });

    const companyObj = company.toObject();

    return {
      ...companyObj,
      totalJobs: jobs.length,
      activeJobs: jobs.filter((j: IJob) => j.isActive === true).length,
      totalApplications: applications.length,
      totalHires: applications.filter((a) => a.status === "hired").length,
    };
  }

  /**
   * Update company
   */
  async updateCompany(
    userId: string,
    companyId: string,
    data: UpdateCompanyDto,
  ): Promise<ICompany | null> {
    // Verify ownership
    const company = await Company.findOne({ _id: companyId, ownerId: userId });
    if (!company) {
      throw new Error("Company not found or unauthorized");
    }

    // Prevent duplicate name
    if (data.name && data.name !== company.name) {
      const nameExists = await Company.findOne({
        name: data.name,
        _id: { $ne: companyId },
      });
      if (nameExists) {
        throw new Error("Company name already exists");
      }
    }

    // Update
    const updated = await Company.findByIdAndUpdate(
      companyId,
      { $set: data },
      { new: true, runValidators: true },
    );

    return updated;
  }

  /**
   * Upload company logo
   */
  async uploadLogo(userId: string, file: Express.Multer.File): Promise<string> {
    const company = await Company.findOne({ ownerId: userId });
    if (!company) {
      throw new Error("Company not found");
    }

    // In production, upload to S3 or Cloudinary
    const logoUrl = `/uploads/companies/${company._id}/logo-${Date.now()}.${file.originalname.split(".").pop()}`;

    await Company.findByIdAndUpdate(company._id, { logoUrl });

    return logoUrl;
  }

  /**
   * Verify company (Admin only)
   */
  async verifyCompany(companyId: string): Promise<ICompany | null> {
    return Company.findByIdAndUpdate(
      companyId,
      {
        $set: {
          isVerified: true,
          status: CompanyStatus.ACTIVE,
          verifiedAt: new Date(),
        },
      },
      { new: true },
    );
  }

  /**
   * Suspend company
   */
  async suspendCompany(companyId: string): Promise<ICompany | null> {
    return Company.findByIdAndUpdate(
      companyId,
      {
        $set: {
          status: CompanyStatus.SUSPENDED,
          isActive: false,
        },
      },
      { new: true },
    );
  }

  /**
   * Check if user has a company
   */
  async hasCompany(userId: string): Promise<boolean> {
    const company = await Company.findOne({ ownerId: userId });
    return !!company;
  }

  /**
   * Get all companies with pagination and filters
   */
  async getAllCompanies(filters: {
    companyType?: string;
    industryType?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ companies: ICompany[]; total: number }> {
    const query: any = {};

    if (filters.companyType) query.companyType = filters.companyType;
    if (filters.industryType) query.industryType = filters.industryType;
    if (filters.status) query.status = filters.status;

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [companies, total] = await Promise.all([
      Company.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Company.countDocuments(query),
    ]);

    return { companies, total };
  }

  /**
   * ✅ ADD THIS METHOD: Delete company (soft delete)
   */
  async deleteCompany(userId: string, companyId: string): Promise<any> {
    const company = await Company.findOne({
      _id: companyId,
      ownerId: userId,
    });

    if (!company) {
      throw new AppError("Company not found", 404);
    }

    // Soft delete
    // company.isDeleted = true;
    // company.deletedAt = new Date();
    await company.save();

    // Optionally, also soft delete all jobs associated with this company
    await Job.updateMany(
      { companyId: company._id },
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
    );

    return company;
  }

  /**
   * Get company jobs with pagination (using companyId)
   */
  async getCompanyJobs(
    userId: string,
    page: number,
    limit: number,
    status?: string,
  ): Promise<{
    jobs: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const company = await Company.findOne({ ownerId: userId });

    if (!company) {
      throw new AppError("Company not found", 404);
    }

    // Query jobs using companyId
    const query: any = {
      companyId: company._id,
      isDeleted: false,
    };

    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }

    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      Job.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("postedBy", "name email")
        .populate("companyId", "name logo industry"),
      Job.countDocuments(query),
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
  }
  /**
   * ✅ ADD THIS METHOD: Get company statistics only
   */
  async getCompanyStats(userId: string): Promise<any> {
    const company = await Company.findOne({ ownerId: userId });

    if (!company) {
      throw new AppError("Company not found", 404);
    }

    // Use companyId instead of postedBy for company-level stats
    const jobs = await Job.find({
      companyId: company._id,
      isDeleted: false,
    });

    const jobIds = jobs.map((job: any) => job._id);
    const jobIdStrings = jobIds.map((id: any) => id.toString());

    const [
      totalApplications,
      applicationsByStatus,
      applicationsByMonth,
      topSkills,
      totalJobs,
      activeJobs,
    ] = await Promise.all([
      Application.countDocuments({
        jobId: { $in: jobIdStrings },
      }),
      Application.aggregate([
        { $match: { jobId: { $in: jobIdStrings } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ] as any),
      Application.aggregate([
        { $match: { jobId: { $in: jobIdStrings } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 12 },
      ] as any),
      this.getTopSkills(jobIdStrings),
      Job.countDocuments({
        companyId: company._id,
        isDeleted: false,
      }),
      Job.countDocuments({
        companyId: company._id,
        isActive: true,
        isDeleted: false,
      }),
    ]);

    return {
      company: {
        id: company._id,
        name: company.name,
        // logo: company.logo,
        // industry: company.industry,
        website: company.website,
      },
      stats: {
        totalJobs,
        activeJobs,
        totalApplications,
        applicationsByStatus,
        applicationsByMonth,
        topSkills,
      },
    };
  }

  /**
   * Get top skills from applications
   */
  private async getTopSkills(jobIds: string[]): Promise<any[]> {
    const applications = await Application.find({
      jobId: { $in: jobIds },
    });
    const userIds = applications.map((app: any) => app.userId?.toString());

    const resumes = await Resume.find({
      userId: { $in: userIds },
    });

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
}
