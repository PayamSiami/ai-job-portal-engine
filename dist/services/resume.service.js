import { Types } from "mongoose";
import Resume from "../models/Resume.models";
import { AppError } from "../utils/errorHandler";
import logger from "../utils/logger";
class ResumeService {
    async getResumesByUser(userId, options) {
        try {
            const { status, page, limit, search, sortBy = "createdAt", sortOrder = "desc" } = options;
            const filter = { user: new Types.ObjectId(userId) };
            if (status && status !== "all") {
                filter.status = status;
            }
            if (search) {
                filter.$or = [
                    { title: { $regex: search, $options: "i" } },
                    { "personalInfo.firstName": { $regex: search, $options: "i" } },
                    { "personalInfo.lastName": { $regex: search, $options: "i" } },
                ];
            }
            const skip = (page - 1) * limit;
            const sortOptions = {};
            sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;
            const [resumes, total] = await Promise.all([
                Resume.find(filter)
                    .sort(sortOptions)
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Resume.countDocuments(filter),
            ]);
            const pages = Math.ceil(total / limit);
            return {
                resumes,
                pagination: {
                    total,
                    page,
                    limit,
                    pages,
                },
            };
        }
        catch (error) {
            logger.error("Get resumes by user error:", error);
            throw new AppError("Failed to fetch resumes", 500);
        }
    }
    async getResume(resumeId, userId) {
        try {
            const resume = await Resume.findOne({
                _id: new Types.ObjectId(resumeId),
                user: new Types.ObjectId(userId),
            }).lean();
            return resume;
        }
        catch (error) {
            logger.error("Get resume error:", error);
            throw new AppError("Failed to fetch resume", 500);
        }
    }
    async createResume(userId, data) {
        try {
            if (data.isDefault) {
                await Resume.updateMany({ user: new Types.ObjectId(userId) }, { isDefault: false });
            }
            const resume = await Resume.create({
                user: new Types.ObjectId(userId),
                ...data,
                status: data.status || "draft",
            });
            return resume;
        }
        catch (error) {
            logger.error("Create resume error:", error);
            throw new AppError("Failed to create resume", 400);
        }
    }
    async updateResume(resumeId, userId, data) {
        try {
            if (data.isDefault) {
                await Resume.updateMany({ user: new Types.ObjectId(userId) }, { isDefault: false });
            }
            const resume = await Resume.findOneAndUpdate({
                _id: new Types.ObjectId(resumeId),
                user: new Types.ObjectId(userId),
            }, {
                ...data,
                updatedAt: new Date(),
            }, {
                new: true,
                runValidators: true,
            }).lean();
            if (!resume) {
                throw new AppError("Resume not found", 404);
            }
            return resume;
        }
        catch (error) {
            logger.error("Update resume error:", error);
            if (error instanceof AppError)
                throw error;
            throw new AppError("Failed to update resume", 400);
        }
    }
    async deleteResume(resumeId, userId) {
        try {
            const result = await Resume.findOneAndDelete({
                _id: new Types.ObjectId(resumeId),
                user: new Types.ObjectId(userId),
            });
            if (!result) {
                throw new AppError("Resume not found", 404);
            }
            return result;
        }
        catch (error) {
            logger.error("Delete resume error:", error);
            if (error instanceof AppError)
                throw error;
            throw new AppError("Failed to delete resume", 500);
        }
    }
    async duplicateResume(resumeId, userId) {
        try {
            const sourceResume = await Resume.findOne({
                _id: new Types.ObjectId(resumeId),
                user: new Types.ObjectId(userId),
            });
            if (!sourceResume) {
                throw new AppError("Source resume not found", 404);
            }
            const newResume = await Resume.create({
                user: new Types.ObjectId(userId),
                title: `${sourceResume.title} (Copy)`,
                template: sourceResume.template,
                visibility: sourceResume.visibility || "private",
                status: "draft",
                isDefault: false,
                personalInfo: sourceResume.personalInfo,
                experience: sourceResume.experience,
                education: sourceResume.education,
                skills: sourceResume.skills,
                certifications: sourceResume.certifications,
                languages: sourceResume.languages,
                projects: sourceResume.projects,
                customSections: sourceResume.customSections,
            });
            return newResume;
        }
        catch (error) {
            logger.error("Duplicate resume error:", error);
            if (error instanceof AppError)
                throw error;
            throw new AppError("Failed to duplicate resume", 500);
        }
    }
    async setDefaultResume(resumeId, userId) {
        try {
            await Resume.updateMany({ user: new Types.ObjectId(userId) }, { isDefault: false });
            const resume = await Resume.findOneAndUpdate({
                _id: new Types.ObjectId(resumeId),
                user: new Types.ObjectId(userId),
            }, {
                isDefault: true,
                updatedAt: new Date(),
            }, {
                new: true,
                runValidators: true,
            }).lean();
            if (!resume) {
                throw new AppError("Resume not found", 404);
            }
            return resume;
        }
        catch (error) {
            logger.error("Set default resume error:", error);
            if (error instanceof AppError)
                throw error;
            throw new AppError("Failed to set default resume", 500);
        }
    }
    async getUserResumeStats(userId) {
        try {
            const stats = await Resume.aggregate([
                {
                    $match: {
                        user: new Types.ObjectId(userId),
                    },
                },
                {
                    $facet: {
                        total: [{ $count: "count" }],
                        byStatus: [
                            {
                                $group: {
                                    _id: "$status",
                                    count: { $sum: 1 },
                                },
                            },
                        ],
                        byTemplate: [
                            {
                                $group: {
                                    _id: "$template",
                                    count: { $sum: 1 },
                                },
                            },
                        ],
                        byVisibility: [
                            {
                                $group: {
                                    _id: "$visibility",
                                    count: { $sum: 1 },
                                },
                            },
                        ],
                        default: [
                            {
                                $match: { isDefault: true },
                            },
                            { $count: "count" },
                        ],
                        latest: [
                            {
                                $sort: { createdAt: -1 },
                            },
                            { $limit: 5 },
                            {
                                $project: {
                                    _id: 1,
                                    title: 1,
                                    template: 1,
                                    status: 1,
                                    createdAt: 1,
                                },
                            },
                        ],
                    },
                },
            ]);
            const result = stats[0] || {};
            return {
                total: result.total?.[0]?.count || 0,
                byStatus: result.byStatus || [],
                byTemplate: result.byTemplate || [],
                byVisibility: result.byVisibility || [],
                hasDefault: (result.default?.[0]?.count || 0) > 0,
                latestResumes: result.latest || [],
            };
        }
        catch (error) {
            logger.error("Get resume stats error:", error);
            throw new AppError("Failed to get resume statistics", 500);
        }
    }
    async bulkDeleteResumes(resumeIds, userId) {
        try {
            const objectIds = resumeIds.map(id => new Types.ObjectId(id));
            const result = await Resume.deleteMany({
                _id: { $in: objectIds },
                user: new Types.ObjectId(userId),
            });
            return {
                deletedCount: result.deletedCount || 0,
                failedIds: result.deletedCount < resumeIds.length ?
                    resumeIds.filter((_, index) => result.deletedCount < resumeIds.length) :
                    [],
            };
        }
        catch (error) {
            logger.error("Bulk delete resumes error:", error);
            throw new AppError("Failed to delete resumes", 500);
        }
    }
    async getDefaultResume(userId) {
        try {
            const resume = await Resume.findOne({
                user: new Types.ObjectId(userId),
                isDefault: true,
            }).lean();
            return resume;
        }
        catch (error) {
            logger.error("Get default resume error:", error);
            throw new AppError("Failed to get default resume", 500);
        }
    }
    async searchResumes(userId, query) {
        try {
            const resumes = await Resume.find({
                user: new Types.ObjectId(userId),
                $or: [
                    { title: { $regex: query, $options: "i" } },
                    { "personalInfo.firstName": { $regex: query, $options: "i" } },
                    { "personalInfo.lastName": { $regex: query, $options: "i" } },
                    { "personalInfo.summary": { $regex: query, $options: "i" } },
                    { "skills.name": { $regex: query, $options: "i" } },
                ],
            }).lean();
            return resumes;
        }
        catch (error) {
            logger.error("Search resumes error:", error);
            throw new AppError("Failed to search resumes", 500);
        }
    }
    async updateResumeStatus(resumeId, userId, status) {
        try {
            const resume = await Resume.findOneAndUpdate({
                _id: new Types.ObjectId(resumeId),
                user: new Types.ObjectId(userId),
            }, {
                status,
                updatedAt: new Date(),
            }, {
                new: true,
                runValidators: true,
            }).lean();
            if (!resume) {
                throw new AppError("Resume not found", 404);
            }
            return resume;
        }
        catch (error) {
            logger.error("Update resume status error:", error);
            if (error instanceof AppError)
                throw error;
            throw new AppError("Failed to update resume status", 500);
        }
    }
    async getResumesByTemplate(userId, template) {
        try {
            const resumes = await Resume.find({
                user: new Types.ObjectId(userId),
                template: template,
            }).lean();
            return resumes;
        }
        catch (error) {
            logger.error("Get resumes by template error:", error);
            throw new AppError("Failed to fetch resumes", 500);
        }
    }
    async getRecentResumes(userId, days = 30) {
        try {
            const date = new Date();
            date.setDate(date.getDate() - days);
            const resumes = await Resume.find({
                user: new Types.ObjectId(userId),
                createdAt: { $gte: date },
            })
                .sort({ createdAt: -1 })
                .lean();
            return resumes;
        }
        catch (error) {
            logger.error("Get recent resumes error:", error);
            throw new AppError("Failed to fetch recent resumes", 500);
        }
    }
    async hasResumes(userId) {
        try {
            const count = await Resume.countDocuments({
                user: new Types.ObjectId(userId),
            });
            return count > 0;
        }
        catch (error) {
            logger.error("Check resumes error:", error);
            return false;
        }
    }
    async getResumesByUserId(userId, options) {
        return this.getResumesByUser(userId, options);
    }
    async getTemplateStats(userId) {
        try {
            const stats = await Resume.aggregate([
                {
                    $match: {
                        user: new Types.ObjectId(userId),
                    },
                },
                {
                    $group: {
                        _id: "$template",
                        count: { $sum: 1 },
                        resumes: {
                            $push: {
                                _id: "$_id",
                                title: "$title",
                                status: "$status",
                                createdAt: "$createdAt",
                            }
                        },
                    },
                },
                {
                    $sort: { count: -1 },
                },
            ]);
            return stats;
        }
        catch (error) {
            logger.error("Get template stats error:", error);
            throw new AppError("Failed to get template statistics", 500);
        }
    }
    async getStatusStats(userId) {
        try {
            const stats = await Resume.aggregate([
                {
                    $match: {
                        user: new Types.ObjectId(userId),
                    },
                },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 },
                    },
                },
                {
                    $sort: { count: -1 },
                },
            ]);
            return stats;
        }
        catch (error) {
            logger.error("Get status stats error:", error);
            throw new AppError("Failed to get status statistics", 500);
        }
    }
    async getResumeCount(userId) {
        try {
            return await Resume.countDocuments({
                user: new Types.ObjectId(userId),
            });
        }
        catch (error) {
            logger.error("Get resume count error:", error);
            return 0;
        }
    }
}
export default new ResumeService();
