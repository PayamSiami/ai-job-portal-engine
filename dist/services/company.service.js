import { Company, CompanyStatus } from "../models/Company.models";
import Job from "../models/Job.models";
import Application from "../models/Application.model";
import User from "../models/User.models";
import { AppError } from "../utils/errorHandler";
import Resume from "../models/Resume.models";
class CompanyService {
    async createCompany(userId, data) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error("User not found");
        }
        const existingCompany = await Company.findOne({ ownerId: userId });
        if (existingCompany) {
            throw new Error("User already has a company");
        }
        const nameExists = await Company.findOne({ name: data.name });
        if (nameExists) {
            throw new Error("Company name already exists");
        }
        const company = new Company({
            ...data,
            ownerId: userId,
            status: CompanyStatus.PENDING,
            isActive: true,
            isVerified: false,
        });
        await company.save();
        return company;
    }
    async getCompanyById(companyId) {
        return Company.findById(companyId);
    }
    async getCompanyByOwnerId(userId) {
        return Company.findOne({ ownerId: userId });
    }
    async getCompanyWithStats(userId) {
        const company = await Company.findOne({ ownerId: userId });
        if (!company) {
            return null;
        }
        const jobs = await Job.find({ employerId: userId });
        const jobIds = jobs.map((job) => job._id);
        const applications = await Application.find({
            jobId: { $in: jobIds },
        });
        const companyObj = company.toObject();
        return {
            ...companyObj,
            totalJobs: jobs.length,
            activeJobs: jobs.filter((j) => j.isActive === true).length,
            totalApplications: applications.length,
            totalHires: applications.filter((a) => a.status === "hired").length,
        };
    }
    async updateCompany(userId, companyId, data) {
        const company = await Company.findOne({ _id: companyId, ownerId: userId });
        if (!company) {
            throw new Error("Company not found or unauthorized");
        }
        if (data.name && data.name !== company.name) {
            const nameExists = await Company.findOne({
                name: data.name,
                _id: { $ne: companyId },
            });
            if (nameExists) {
                throw new Error("Company name already exists");
            }
        }
        const updated = await Company.findByIdAndUpdate(companyId, { $set: data }, { new: true, runValidators: true });
        return updated;
    }
    async uploadLogo(userId, file) {
        const company = await Company.findOne({ ownerId: userId });
        if (!company) {
            throw new Error("Company not found");
        }
        const logoUrl = `/uploads/companies/${company._id}/logo-${Date.now()}.${file.originalname.split(".").pop()}`;
        await Company.findByIdAndUpdate(company._id, { logoUrl });
        return logoUrl;
    }
    async verifyCompany(companyId) {
        return Company.findByIdAndUpdate(companyId, {
            $set: {
                isVerified: true,
                status: CompanyStatus.ACTIVE,
                verifiedAt: new Date(),
            },
        }, { new: true });
    }
    async suspendCompany(companyId) {
        return Company.findByIdAndUpdate(companyId, {
            $set: {
                status: CompanyStatus.SUSPENDED,
                isActive: false,
            },
        }, { new: true });
    }
    async hasCompany(userId) {
        const company = await Company.findOne({ ownerId: userId });
        return !!company;
    }
    async getAllCompanies(filters) {
        const query = {};
        if (filters.companyType)
            query.companyType = filters.companyType;
        if (filters.industryType)
            query.industryType = filters.industryType;
        if (filters.status)
            query.status = filters.status;
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
    async deleteCompany(userId, companyId) {
        const company = await Company.findOne({
            _id: companyId,
            ownerId: userId,
        });
        if (!company) {
            throw new AppError("Company not found", 404);
        }
        await company.save();
        await Job.updateMany({ company: company._id }, {
            isDeleted: true,
            deletedAt: new Date(),
        });
        return company;
    }
    async getCompanyJobs(userId, page, limit, status) {
        const company = await Company.findOne({ ownerId: userId });
        if (!company) {
            throw new AppError("Company not found", 404);
        }
        const query = {
            company: company._id,
            isDeleted: false,
        };
        if (status === "active") {
            query.isActive = true;
        }
        else if (status === "inactive") {
            query.isActive = false;
        }
        const skip = (page - 1) * limit;
        const [jobs, total] = await Promise.all([
            Job.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("postedBy", "name email")
                .populate("company", "name logo industry"),
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
    async getCompanyStats(userId) {
        const company = await Company.findOne({ ownerId: userId });
        if (!company) {
            throw new AppError("Company not found", 404);
        }
        const jobs = await Job.find({
            company: company._id,
            isDeleted: false,
        });
        const jobIds = jobs.map((job) => job._id);
        const jobIdStrings = jobIds.map((id) => id.toString());
        const [totalApplications, applicationsByStatus, applicationsByMonth, topSkills, totalJobs, activeJobs,] = await Promise.all([
            Application.countDocuments({
                jobId: { $in: jobIdStrings },
            }),
            Application.aggregate([
                { $match: { jobId: { $in: jobIdStrings } } },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),
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
            ]),
            this.getTopSkills(jobIdStrings),
            Job.countDocuments({
                company: company._id,
                isDeleted: false,
            }),
            Job.countDocuments({
                company: company._id,
                isActive: true,
                isDeleted: false,
            }),
        ]);
        return {
            company: {
                id: company._id,
                name: company.name,
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
    async getTopSkills(jobIds) {
        const applications = await Application.find({
            jobId: { $in: jobIds },
        });
        const userIds = applications.map((app) => app.userId?.toString());
        const resumes = await Resume.find({
            userId: { $in: userIds },
        });
        const skillCount = {};
        resumes.forEach((resume) => {
            if (resume.skills) {
                resume.skills.forEach((skill) => {
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
export default new CompanyService;
