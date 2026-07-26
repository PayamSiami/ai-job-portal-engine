import mongoose from "mongoose";
import Job from "../models/Job.models";
import Application, { ApplicationStatus } from "../models/Application.model";
import Resume from "../models/Resume.models";
import User from "../models/User.models";
import jobService from "./job.service";
export class CandidateService {
    Application;
    Job;
    Resume;
    User;
    constructor() {
        this.Application = Application;
        this.Job = Job;
        this.Resume = Resume;
        this.User = User;
    }
    async getCandidates(employerId, filters, options) {
        try {
            if (!mongoose.Types.ObjectId.isValid(employerId)) {
                throw new Error("Invalid employer ID format");
            }
            const { page, limit, sortBy = "createdAt", sortOrder = "desc" } = options;
            const skip = (page - 1) * limit;
            const jobs = await jobService.getJobsByEmployer(employerId);
            const jobIds = jobs.map((job) => job._id);
            if (jobIds.length === 0) {
                return {
                    candidates: [],
                    total: 0,
                    statusSummary: [],
                };
            }
            const matchStage = {
                job: { $in: jobIds },
            };
            if (filters.status && filters.status !== "all") {
                matchStage.status = filters.status;
            }
            const pipeline = [
                {
                    $match: matchStage,
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "user",
                        foreignField: "_id",
                        as: "userData",
                    },
                },
                {
                    $unwind: {
                        path: "$userData",
                        preserveNullAndEmptyArrays: false,
                    },
                },
                {
                    $lookup: {
                        from: "resumes",
                        localField: "user",
                        foreignField: "user",
                        as: "resumeData",
                    },
                },
                {
                    $unwind: {
                        path: "$resumeData",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                ...(filters.search ? [this.buildSearchFilter(filters.search)] : []),
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
                                    user: "$userData._id",
                                    name: {
                                        $concat: [
                                            { $ifNull: ["$userData.profile.firstName", ""] },
                                            " ",
                                            { $ifNull: ["$userData.profile.lastName", ""] },
                                        ],
                                    },
                                    email: "$userData.email",
                                    phone: "$userData.profile.phone",
                                    position: "$resumeData.desiredPosition",
                                    status: 1,
                                    experience: "$resumeData.experience",
                                    skills: "$resumeData.skills",
                                    location: "$userData.profile.location",
                                    appliedDate: "$createdAt",
                                    updatedAt: 1,
                                    resume: "$resumeData",
                                    aiScore: 1,
                                    aiStrengths: 1,
                                    aiWeaknesses: 1,
                                    notes: 1,
                                    job: 1,
                                    jobTitle: "$job.title",
                                },
                            },
                        ],
                    },
                },
            ];
            const result = await this.Application.aggregate(pipeline);
            const candidates = result[0]?.data || [];
            const total = result[0]?.metadata[0]?.total || 0;
            const statusSummary = await this.getStatusSummary(jobIds, filters);
            return {
                candidates,
                total,
                statusSummary,
            };
        }
        catch (error) {
            console.error("Error in getCandidates:", error);
            throw new Error(`Failed to get candidates: ${error.message}`);
        }
    }
    async getCandidateRecommendations(employerId, params) {
        try {
            const jobs = await this.Job.find({
                postedBy: employerId,
                isDeleted: { $ne: true },
                isActive: true,
            });
            if (jobs.length === 0) {
                console.log("⚠️ No active jobs found for employer");
                return [];
            }
            let targetJobs = jobs;
            if (params.jobId) {
                const specificJob = jobs.find((j) => j._id.toString() === params.jobId);
                if (specificJob) {
                    targetJobs = [specificJob];
                }
                else {
                    console.log(`⚠️ Job ${params.jobId} not found or not owned by employer`);
                    return [];
                }
            }
            console.log(`📊 Target jobs: ${targetJobs.length}`);
            const jobIds = targetJobs.map((job) => job._id);
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
            const recommendations = [];
            for (const application of applications) {
                const resume = application.resumeId;
                const job = targetJobs.find((j) => j._id.toString() === application.jobId.toString());
                if (!resume || !job)
                    continue;
                const matchDetails = await this.calculateMatchScore(resume, job, params);
                if (matchDetails.overallMatch < params.minScore)
                    continue;
                if (params.skills && params.skills.length > 0) {
                    const hasRequiredSkill = params.skills.some((skill) => resume.skills?.some((s) => s.name?.toLowerCase().includes(skill.toLowerCase())));
                    if (!hasRequiredSkill)
                        continue;
                }
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
            recommendations.sort((a, b) => b.matchScore - a.matchScore);
            const limitedRecommendations = recommendations.slice(0, params.limit);
            console.log(`✅ Found ${limitedRecommendations.length} recommendations`);
            return limitedRecommendations;
        }
        catch (error) {
            console.error("❌ Error getting candidate recommendations:", error);
            throw error;
        }
    }
    async calculateMatchScore(resume, job, params) {
        const jobSkills = job.skills || [];
        const candidateSkills = resume.skills?.map((s) => s.name?.toLowerCase()) || [];
        const matchedSkills = jobSkills.filter((skill) => candidateSkills.some((cs) => cs.includes(skill.toLowerCase())));
        const missingSkills = jobSkills.filter((skill) => !candidateSkills.some((cs) => cs.includes(skill.toLowerCase())));
        const skillsMatchPercentage = jobSkills.length > 0
            ? (matchedSkills.length / jobSkills.length) * 100
            : 100;
        const candidateYears = resume.experience || 0;
        let requiredYears = 2;
        if (job.experienceLevel) {
            const expMap = {
                entry: 0,
                mid: 3,
                senior: 5,
                lead: 8,
            };
            requiredYears = expMap[job.experienceLevel] || 2;
        }
        const experienceMatch = candidateYears >= requiredYears;
        let educationMatch = false;
        let educationDetails = "No education data";
        if (resume.education && resume.education.length > 0) {
            educationMatch = true;
            const degrees = resume.education.map((e) => e.degree).join(", ");
            educationDetails = `Candidate has: ${degrees}`;
        }
        const weights = {
            skills: 0.5,
            experience: 0.3,
            education: 0.1,
            aiScore: 0.1,
        };
        const aiScore = resume.aiScore || 50;
        const overallMatch = (skillsMatchPercentage / 100) * weights.skills * 100 +
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
    buildSearchFilters(filters, userAlias, resumeAlias) {
        const match = {};
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
            const experienceFilter = {};
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
    async getCandidateById(candidateId, employerId) {
        const application = await this.Application.findById(candidateId)
            .populate("userId", "name email phone location")
            .populate("jobId", "title company")
            .populate("resumeId");
        if (!application) {
            return null;
        }
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
            user: application.userId,
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
    async updateCandidateStatus(candidateId, employerId, status, notes) {
        try {
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
            const job = await this.Job.findOne({
                _id: application.jobId,
                postedBy: employerId,
                isDeleted: { $ne: true },
            });
            if (!job) {
                console.log(`❌ Job not found or access denied for employer: ${employerId}`);
                return null;
            }
            application.status = status;
            if (notes) {
                application.notes = notes;
            }
            application.statusHistory = application.statusHistory || [];
            application.statusHistory.push({
                status,
                notes: notes || "",
                updatedAt: new Date(),
                updatedBy: employerId,
            });
            application.updatedAt = new Date();
            if (status === "hired") {
                console.log(`🎉 Candidate ${candidateId} was hired!`);
            }
            await application.save();
            await application.populate("userId", "name email phone");
            await application.populate("jobId", "title company");
            return application;
        }
        catch (error) {
            console.error("❌ Error updating candidate status:", error);
            throw error;
        }
    }
    async getCandidateResume(candidateId, employerId) {
        try {
            console.log(`📄 Fetching resume for candidate: ${candidateId}`);
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
            const job = await this.Job.findOne({
                _id: application.jobId,
                postedBy: employerId,
                isDeleted: { $ne: true },
            });
            if (!job) {
                console.log(`❌ Job not found or access denied for employer: ${employerId}`);
                return null;
            }
            console.log(`✅ Job belongs to employer: ${employerId}`);
            let resume = null;
            if (application.resumeId) {
                resume = await this.Resume.findById(application.resumeId);
                console.log(`📄 Found resume by resumeId: ${!!resume}`);
            }
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
            if (resume.pdfFile) {
                return resume.pdfFile;
            }
            if (resume.fileUrl) {
                return resume.fileUrl;
            }
            if (resume.cloudStorageUrl) {
                return resume.cloudStorageUrl;
            }
            if (resume.filePath) {
                return resume.filePath;
            }
            console.log(`⚠️ Resume found but no PDF file attached`);
            return null;
        }
        catch (error) {
            console.error("❌ Error fetching candidate resume:", error);
            throw error;
        }
    }
    async getAnalytics(employerId) {
        const jobs = await this.Job.find({ employerId }).select("_id");
        const jobIds = jobs.map((job) => job._id);
        const [totalApplications, byStatus, byJob, dailyApplications, averageScore, topSkills,] = await Promise.all([
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
    async getTopSkills(jobIds) {
        const applications = await this.Application.find({
            jobId: { $in: jobIds },
        });
        const userIds = applications.map((app) => app.userId);
        const resumes = await this.Resume.find({ userId: { $in: userIds } });
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
    buildSearchFilter(search) {
        return {
            $match: {
                $or: [
                    { "userData.email": { $regex: search, $options: "i" } },
                    { "userData.profile.firstName": { $regex: search, $options: "i" } },
                    { "userData.profile.lastName": { $regex: search, $options: "i" } },
                    { "resumeData.desiredPosition": { $regex: search, $options: "i" } },
                    { "resumeData.skills.name": { $regex: search, $options: "i" } },
                ],
            },
        };
    }
    async getStatusSummary(jobIds, filters) {
        try {
            const matchStage = {
                job: { $in: jobIds },
            };
            if (filters.status && filters.status !== "all") {
                matchStage.status = filters.status;
            }
            const summary = await this.Application.aggregate([
                {
                    $match: matchStage,
                },
                {
                    $group: {
                        _id: "$status",
                        count: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        status: "$_id",
                        count: 1,
                        _id: 0,
                    },
                },
                {
                    $sort: { count: -1 },
                },
            ]);
            const allStatuses = Object.values(ApplicationStatus);
            const summaryMap = new Map();
            summary.forEach((item) => {
                summaryMap.set(item.status, item.count);
            });
            return allStatuses.map((status) => ({
                status,
                count: summaryMap.get(status) || 0,
            }));
        }
        catch (error) {
            console.error("Error getting status summary:", error);
            return [];
        }
    }
    async exportCandidates(employerId) {
        const jobs = await this.Job.find({ employerId }).select("_id");
        const jobIds = jobs.map((job) => job._id);
        const applications = await this.Application.find({
            jobId: { $in: jobIds },
        })
            .populate("userId", "name email phone location")
            .populate("jobId", "title");
        return applications.map((app) => ({
            name: app.userId?.name || "N/A",
            email: app.userId?.email || "N/A",
            phone: app.userId?.phone || "N/A",
            position: app.jobId?.title || "N/A",
            status: app.status,
            appliedDate: app.createdAt,
        }));
    }
    async addCandidateNote(candidateId, employerId, note) {
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
    async getCandidateTimeline(candidateId, employerId) {
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
        return application.statusHistory || [];
    }
    async getCandidateStats(employerId) {
        if (!mongoose.Types.ObjectId.isValid(employerId)) {
            throw new Error("Invalid employer ID format");
        }
        const jobs = await jobService.getJobsByEmployer(employerId, {
            limit: 10,
            page: 0,
        });
        const jobIds = jobs.map((job) => job._id);
        if (jobIds.length === 0) {
            return this.getEmptyCandidateStats();
        }
        const applications = await this.Application.find({
            job: { $in: jobIds },
        })
            .populate("user", "name email profile")
            .populate("job", "title");
        const statusDistribution = {
            pending: applications.filter((a) => a.status === ApplicationStatus.PENDING).length,
            reviewing: applications.filter((a) => a.status === ApplicationStatus.REVIEWING).length,
            shortlisted: applications.filter((a) => a.status === ApplicationStatus.SHORTLISTED).length,
            interviewing: applications.filter((a) => a.status === ApplicationStatus.INTERVIEWING).length,
            rejected: applications.filter((a) => a.status === ApplicationStatus.REJECTED).length,
            hired: applications.filter((a) => a.status === ApplicationStatus.HIRED).length,
            withdrawn: applications.filter((a) => a.status === ApplicationStatus.WITHDRAWN).length,
        };
        const totalCandidates = applications.length;
        const hiredCount = statusDistribution.hired;
        const rejectedCount = statusDistribution.rejected;
        const withdrawnCount = statusDistribution.withdrawn;
        const conversionRate = totalCandidates > 0
            ? parseFloat(((hiredCount / totalCandidates) * 100).toFixed(1))
            : 0;
        const activeCandidates = totalCandidates - rejectedCount - hiredCount - withdrawnCount;
        const screenedCount = applications.filter((a) => a.aiScore && a.aiScore > 0).length;
        const screeningCoverage = totalCandidates > 0
            ? parseFloat(((screenedCount / totalCandidates) * 100).toFixed(1))
            : 0;
        const applicationsWithScore = applications.filter((a) => a.aiScore && a.aiScore > 0);
        const avgAiScore = applicationsWithScore.length > 0
            ? parseFloat((applicationsWithScore.reduce((sum, a) => sum + a.aiScore, 0) / applicationsWithScore.length).toFixed(1))
            : 0;
        const candidatesByJob = await this.Application.aggregate([
            {
                $match: {
                    job: { $in: jobIds },
                },
            },
            {
                $group: {
                    _id: "$job",
                    count: { $sum: 1 },
                },
            },
            {
                $lookup: {
                    from: "jobs",
                    localField: "_id",
                    foreignField: "_id",
                    as: "jobData",
                },
            },
            {
                $unwind: {
                    path: "$jobData",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $project: {
                    jobTitle: "$jobData.title",
                    jobId: "$_id",
                    count: 1,
                },
            },
            {
                $sort: { count: -1 },
            },
        ]);
        const recentActivity = await this.Application.find({
            job: { $in: jobIds },
        })
            .sort({ updatedAt: -1 })
            .limit(5)
            .populate("user", "name email profile")
            .populate("job", "title");
        const hiredApplications = applications.filter((a) => a.status === ApplicationStatus.HIRED && a.createdAt && a.updatedAt);
        let averageTimeToHire = 0;
        if (hiredApplications.length > 0) {
            const totalDays = hiredApplications.reduce((sum, app) => {
                const days = (app.updatedAt - app.createdAt) / (1000 * 60 * 60 * 24);
                return sum + days;
            }, 0);
            averageTimeToHire = parseFloat((totalDays / hiredApplications.length).toFixed(1));
        }
        return {
            overview: {
                totalCandidates,
                activeCandidates,
                conversionRate,
                pendingScreening: applications.filter((a) => a.status === ApplicationStatus.PENDING &&
                    (!a.aiScore || a.aiScore === 0)).length,
                screeningCoverage,
                avgAiScore,
                averageTimeToHire,
            },
            statusDistribution,
            candidatesByJob: candidatesByJob.map((item) => ({
                jobTitle: item.jobTitle || "Unknown Job",
                jobId: item.jobId,
                count: item.count,
            })),
            recentActivity: recentActivity.map((app) => ({
                id: app._id,
                candidateName: app.user?.name || app.user?.profile?.firstName || "Unknown",
                candidateEmail: app.user?.email || "",
                jobTitle: app.job?.title || "N/A",
                status: app.status,
                updatedAt: app.updatedAt,
                appliedAt: app.createdAt,
            })),
            timestamp: new Date().toISOString(),
        };
    }
    async getShortlistedCandidates(employerId, options = {}) {
        try {
            console.log(`📊 Fetching shortlisted candidates for employer: ${employerId}`);
            const { page = 1, limit = 10, search = "", jobId, sortBy = "updatedAt", sortOrder = "desc", } = options;
            const skip = (page - 1) * limit;
            const employerJobs = await this.Job.find({
                $or: [
                    { postedBy: employerId },
                    { employerId: employerId },
                    { ownerId: employerId },
                ],
                isDeleted: { $ne: true },
            }).select("_id title");
            const jobIds = employerJobs.map((job) => job._id);
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
            const query = {
                jobId: { $in: jobIds },
                status: { $in: ["shortlisted", "interview_scheduled"] },
            };
            if (jobId) {
                query.jobId = jobId;
            }
            if (search) {
                const userIds = await this.getUserIdsBySearch(search);
                if (userIds.length > 0) {
                    query.userId = { $in: userIds };
                }
            }
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
            const summary = await this.getShortlistedSummary(jobIds, jobId);
            const formattedCandidates = candidates.map((app) => ({
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
                statusHistory: app.statusHistory?.slice(-5) || [],
                createdAt: app.createdAt,
                updatedAt: app.updatedAt,
            }));
            return {
                candidates: formattedCandidates,
                total,
                summary,
            };
        }
        catch (error) {
            console.error("❌ Error in CandidateService.getShortlistedCandidates:", error);
            throw error;
        }
    }
    async getShortlistedSummary(jobIds, jobId) {
        const match = {
            jobId: { $in: jobIds },
            status: { $in: ["shortlisted", "interview_scheduled"] },
        };
        if (jobId) {
            match.jobId = jobId;
        }
        const totalShortlisted = await this.Application.countDocuments(match);
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
            byJob: byJob.map((item) => ({
                jobTitle: item.jobTitle,
                count: item.count,
            })),
            byStage: byStage.map((item) => ({
                stage: item.stage,
                count: item.count,
            })),
        };
    }
    async getUserIdsBySearch(search) {
        const users = await this.User.find({
            $or: [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ],
        }).select("_id");
        return users.map((user) => user._id);
    }
    async getShortlistedApplications(employerId, options = {}) {
        try {
            console.log(`📊 Fetching shortlisted applications for employer: ${employerId}`);
            const { page = 1, limit = 10, search = "", jobId, status, stage, sortBy = "updatedAt", sortOrder = "desc", startDate, endDate, } = options;
            const skip = (page - 1) * limit;
            const employerJobs = await this.Job.find({
                $or: [
                    { postedBy: employerId },
                    { employerId: employerId },
                    { ownerId: employerId },
                ],
                isDeleted: { $ne: true },
            }).select("_id title");
            const jobIds = employerJobs.map((job) => job._id);
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
            const query = {
                jobId: { $in: jobIds },
                status: { $in: ["shortlisted", "interview_scheduled"] },
            };
            if (jobId) {
                query.jobId = jobId;
            }
            if (status) {
                query.status = status;
            }
            if (stage) {
                query.stage = stage;
            }
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate)
                    query.createdAt.$gte = new Date(startDate);
                if (endDate)
                    query.createdAt.$lte = new Date(endDate);
            }
            if (search) {
                const userIds = await this.getUserIdsBySearch(search);
                if (userIds.length > 0) {
                    query.userId = { $in: userIds };
                }
            }
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
            const summary = await this.getShortlistedApplicationsSummary(jobIds, {
                jobId,
                status,
                stage,
                startDate,
                endDate,
            });
            const formattedApplications = await Promise.all(applications.map(async (app) => {
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
            }));
            return {
                applications: formattedApplications,
                total,
                summary,
            };
        }
        catch (error) {
            console.error("❌ Error in CandidateService.getShortlistedApplications:", error);
            throw error;
        }
    }
    async getShortlistedApplicationsSummary(jobIds, filters) {
        const match = {
            jobId: { $in: jobIds },
            status: { $in: ["shortlisted", "interview_scheduled"] },
        };
        if (filters.jobId)
            match.jobId = filters.jobId;
        if (filters.status)
            match.status = filters.status;
        if (filters.stage)
            match.stage = filters.stage;
        if (filters.startDate || filters.endDate) {
            match.createdAt = {};
            if (filters.startDate)
                match.createdAt.$gte = new Date(filters.startDate);
            if (filters.endDate)
                match.createdAt.$lte = new Date(filters.endDate);
        }
        const totalShortlisted = await this.Application.countDocuments(match);
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
        const averageScore = scoreResult.length > 0 ? Math.round(scoreResult[0].average) : 0;
        const totalWithAI = scoreResult.length > 0 ? scoreResult[0].count : 0;
        return {
            totalShortlisted,
            byStatus: byStatus.map((item) => ({
                status: item.status,
                count: item.count,
            })),
            byJob: byJob.map((item) => ({
                jobTitle: item.jobTitle,
                count: item.count,
            })),
            byStage: byStage.map((item) => ({
                stage: item.stage,
                count: item.count,
            })),
            averageScore,
            totalWithAI,
        };
    }
    async getShortlistedCandidateResume(candidateId, employerId, format = "pdf") {
        try {
            console.log(`📄 Fetching resume for shortlisted candidate: ${candidateId}`);
            const application = await this.Application.findById(candidateId)
                .populate("userId", "name email")
                .populate("jobId", "title company")
                .populate("resumeId");
            if (!application) {
                console.log(`❌ Application not found: ${candidateId}`);
                return null;
            }
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
                console.log(`❌ Job not found or access denied for employer: ${employerId}`);
                return null;
            }
            if (!["shortlisted", "interview_scheduled"].includes(application.status)) {
                console.log(`❌ Candidate is not shortlisted. Status: ${application.status}`);
                return null;
            }
            let resume = application.resumeId;
            if (!resume) {
                resume = await this.Resume.findOne({ userId: application.userId });
            }
            if (!resume) {
                console.log(`❌ Resume not found for user: ${application.userId}`);
                return null;
            }
            console.log(`✅ Resume found: ${resume.title || "Untitled"}`);
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
                const resumeUrl = resume.pdfUrl || resume.fileUrl || resume.cloudStorageUrl;
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
                const resumeUrl = resume.pdfUrl || resume.fileUrl || resume.cloudStorageUrl;
                return {
                    resume: null,
                    fileName: `${application.userId?.name || "candidate"}_resume.pdf`,
                    fileType: "application/pdf",
                    url: resumeUrl,
                    metadata,
                };
            }
            if (resume.filePath) {
                return {
                    resume: resume.filePath,
                    fileName: `${application.userId?.name || "candidate"}_resume.pdf`,
                    fileType: "application/pdf",
                    metadata,
                };
            }
            console.log(`❌ No PDF file found for resume`);
            return null;
        }
        catch (error) {
            console.error("❌ Error in CandidateService.getShortlistedCandidateResume:", error);
            throw error;
        }
    }
    async getShortlistedCandidateResumes(employerId, options = {}) {
        try {
            const { jobId, candidateIds, format = "pdf", limit = 10 } = options;
            const employerJobs = await this.Job.find({
                $or: [
                    { postedBy: employerId },
                    { employerId: employerId },
                    { ownerId: employerId },
                ],
                isDeleted: { $ne: true },
            }).select("_id");
            const jobIds = employerJobs.map((job) => job._id);
            const query = {
                jobId: { $in: jobIds },
                status: { $in: ["shortlisted", "interview_scheduled"] },
            };
            if (jobId) {
                query.jobId = jobId;
            }
            if (candidateIds && candidateIds.length > 0) {
                query._id = { $in: candidateIds };
            }
            const applications = await this.Application.find(query)
                .populate("userId", "name email")
                .populate("jobId", "title")
                .limit(limit)
                .sort({ updatedAt: -1 });
            const resumes = await Promise.all(applications.map(async (app) => {
                const result = await this.getShortlistedCandidateResume(app._id.toString(), employerId, format);
                return result;
            }));
            const validResumes = resumes.filter((r) => r !== null);
            return {
                resumes: validResumes,
                total: validResumes.length,
            };
        }
        catch (error) {
            console.error("❌ Error in CandidateService.getShortlistedCandidateResumes:", error);
            throw error;
        }
    }
    getEmptyCandidateStats() {
        return {
            overview: {
                totalCandidates: 0,
                activeCandidates: 0,
                conversionRate: 0,
                pendingScreening: 0,
                screeningCoverage: 0,
                avgAiScore: 0,
                averageTimeToHire: 0,
            },
            statusDistribution: {
                pending: 0,
                reviewing: 0,
                shortlisted: 0,
                interviewing: 0,
                rejected: 0,
                hired: 0,
                withdrawn: 0,
            },
            candidatesByJob: [],
            recentActivity: [],
            timestamp: new Date().toISOString(),
        };
    }
}
export default new CandidateService();
