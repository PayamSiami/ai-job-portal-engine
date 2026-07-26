import { getUserId } from "../utils/routeHelpers";
import { sendSuccess } from "../utils/responseFormatter";
import { AppError } from "../utils/errorHandler";
import { asyncHandler } from "./base.controller";
import candidateService from "../services/candidate.service";
class CandidateController {
    getCandidates = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const filters = {
            search: req.query.search,
            status: req.query.status,
            skills: req.query.skills
                ? req.query.skills.split(",")
                : undefined,
            experienceMin: req.query.experienceMin
                ? Number(req.query.experienceMin)
                : undefined,
            experienceMax: req.query.experienceMax
                ? Number(req.query.experienceMax)
                : undefined,
            location: req.query.location,
            availability: req.query.availability,
        };
        const options = {
            page: req.query.page ? Number(req.query.page) : 1,
            limit: req.query.limit ? Number(req.query.limit) : 10,
            sortBy: req.query.sortBy || "createdAt",
            sortOrder: req.query.sortOrder || "desc",
        };
        Object.keys(filters).forEach((key) => filters[key] === undefined &&
            delete filters[key]);
        const result = await candidateService.getCandidates(userId, filters, options);
        sendSuccess(res, {
            candidates: result.candidates,
            total: result.total,
            statusSummary: result.statusSummary,
            pagination: {
                page: options.page,
                limit: options.limit,
                total: result.total,
                totalPages: Math.ceil(result.total / options.limit),
            },
        }, "Candidates fetched successfully");
    });
    getCandidateRecommendations = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const params = {
            jobId: req.query.jobId,
            limit: req.query.limit ? Number(req.query.limit) : 10,
            minScore: req.query.minScore ? Number(req.query.minScore) : 60,
            skills: req.query.skills ? req.query.skills.split(",") : [],
            experienceMin: req.query.experienceMin
                ? Number(req.query.experienceMin)
                : undefined,
            experienceMax: req.query.experienceMax
                ? Number(req.query.experienceMax)
                : undefined,
        };
        const recommendations = await candidateService.getCandidateRecommendations(userId, params);
        sendSuccess(res, {
            recommendations,
            count: recommendations.length,
            params,
        }, "Candidate recommendations fetched successfully");
    });
    getCandidateById = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const candidateId = req.params.id;
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        if (!candidateId) {
            throw new AppError("Candidate ID is required", 400);
        }
        const candidate = await candidateService.getCandidateById(String(candidateId), userId);
        if (!candidate) {
            throw new AppError("Candidate not found or access denied", 404);
        }
        sendSuccess(res, candidate, "Candidate fetched successfully");
    });
    updateCandidateStatus = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const candidateId = req.params.id;
        const { status, notes } = req.body;
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        if (!candidateId) {
            throw new AppError("Candidate ID is required", 400);
        }
        if (!status) {
            throw new AppError("Status is required", 400);
        }
        const validStatuses = [
            "pending",
            "reviewing",
            "shortlisted",
            "interviewing",
            "hired",
            "rejected",
        ];
        if (!validStatuses.includes(status)) {
            throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(", ")}`, 400);
        }
        const updated = await candidateService.updateCandidateStatus(String(candidateId), userId, status, notes);
        if (!updated) {
            throw new AppError("Candidate not found or access denied", 404);
        }
        sendSuccess(res, updated, "Candidate status updated successfully");
    });
    getCandidateResume = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        const candidateId = req.params.id;
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        if (!candidateId) {
            throw new AppError("Candidate ID is required", 400);
        }
        const resume = await candidateService.getCandidateResume(String(candidateId), userId);
        if (!resume) {
            throw new AppError("Resume not found or access denied", 404);
        }
        if (Buffer.isBuffer(resume)) {
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="candidate-resume-${candidateId}.pdf"`);
            res.send(resume);
            return;
        }
        if (typeof resume === "string" && resume.startsWith("http")) {
            sendSuccess(res, { resumeUrl: resume }, "Resume URL fetched successfully");
            return;
        }
        if (typeof resume === "object" && resume !== null) {
            sendSuccess(res, resume, "Resume fetched successfully");
            return;
        }
        sendSuccess(res, { resume }, "Resume fetched successfully");
    });
    bulkUpdateCandidateStatus = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const { candidateIds, status, notes } = req.body;
        if (!candidateIds ||
            !Array.isArray(candidateIds) ||
            candidateIds.length === 0) {
            throw new AppError("candidateIds must be a non-empty array", 400);
        }
        if (candidateIds.length > 50) {
            throw new AppError("Cannot update more than 50 candidates at once", 400);
        }
        if (!status) {
            throw new AppError("Status is required", 400);
        }
        const results = await Promise.all(candidateIds.map(async (candidateId) => {
            try {
                const updated = await candidateService.updateCandidateStatus(candidateId, userId, status, notes);
                return { candidateId, success: true, data: updated };
            }
            catch (error) {
                return {
                    candidateId,
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                };
            }
        }));
        const succeeded = results.filter((r) => r.success);
        const failed = results.filter((r) => !r.success);
        sendSuccess(res, {
            total: results.length,
            succeeded: succeeded.length,
            failed: failed.length,
            results,
            failedDetails: failed,
        }, `Updated ${succeeded.length} candidates`);
    });
    bulkDeleteCandidates = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const { candidateIds } = req.body;
        if (!candidateIds ||
            !Array.isArray(candidateIds) ||
            candidateIds.length === 0) {
            throw new AppError("candidateIds must be a non-empty array", 400);
        }
        if (candidateIds.length > 50) {
            throw new AppError("Cannot delete more than 50 candidates at once", 400);
        }
        const { confirm } = req.query;
        if (confirm !== "true") {
            throw new AppError("Please confirm deletion with ?confirm=true", 400);
        }
        const results = await Promise.all(candidateIds.map(async (candidateId) => {
            try {
                const updated = await candidateService.updateCandidateStatus(candidateId, userId, "rejected", "Bulk deleted");
                return { candidateId, success: true };
            }
            catch (error) {
                return {
                    candidateId,
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                };
            }
        }));
        const succeeded = results.filter((r) => r.success);
        const failed = results.filter((r) => !r.success);
        sendSuccess(res, {
            total: results.length,
            deleted: succeeded.length,
            failed: failed.length,
            results,
        }, `Deleted ${succeeded.length} candidates`);
    });
    getCandidateStats = asyncHandler(async (req, res) => {
        const userId = getUserId(req);
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const stats = await candidateService.getCandidateStats(userId);
        sendSuccess(res, stats, "Candidate stats fetched successfully");
    });
}
export default new CandidateController();
