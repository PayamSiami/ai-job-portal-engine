import { Types } from "mongoose";
import { CreateResumeDTO, UpdateResumeDTO } from "../types/resume.types.js";
declare class ResumeService {
    /**
     * Get all resumes for a user with pagination and filtering
     */
    getResumesByUser(userId: string, options: {
        status?: string;
        page: number;
        limit: number;
        search?: string;
        sortBy?: string;
        sortOrder?: "asc" | "desc";
    }): Promise<{
        resumes: (import("../models/Resume.models.js").IResume & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            pages: number;
        };
    }>;
    /**
     * Get a single resume by ID
     */
    getResume(resumeId: string, userId: string): Promise<(import("../models/Resume.models.js").IResume & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    /**
     * Create a new resume
     */
    createResume(userId: string, data: CreateResumeDTO): Promise<import("mongoose").Document<unknown, {}, import("../models/Resume.models.js").IResume, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Resume.models.js").IResume & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    /**
     * Update an existing resume
     */
    updateResume(resumeId: string, userId: string, data: UpdateResumeDTO): Promise<import("../models/Resume.models.js").IResume & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    /**
     * Delete a resume
     */
    deleteResume(resumeId: string, userId: string): Promise<import("mongoose").Document<unknown, {}, import("../models/Resume.models.js").IResume, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Resume.models.js").IResume & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    /**
     * Duplicate an existing resume
     */
    duplicateResume(resumeId: string, userId: string): Promise<import("mongoose").Document<unknown, {}, import("../models/Resume.models.js").IResume, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Resume.models.js").IResume & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    /**
     * Set a resume as default
     */
    setDefaultResume(resumeId: string, userId: string): Promise<import("../models/Resume.models.js").IResume & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    /**
     * Get resume statistics for a user
     */
    getUserResumeStats(userId: string): Promise<{
        total: any;
        byStatus: any;
        byTemplate: any;
        byVisibility: any;
        hasDefault: boolean;
        latestResumes: any;
    }>;
    /**
     * Bulk delete resumes
     */
    bulkDeleteResumes(resumeIds: string[], userId: string): Promise<{
        deletedCount: number;
        failedIds: string[];
    }>;
    /**
     * Get default resume for a user
     */
    getDefaultResume(userId: string): Promise<(import("../models/Resume.models.js").IResume & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    /**
     * Search resumes by keyword
     */
    searchResumes(userId: string, query: string): Promise<(import("../models/Resume.models.js").IResume & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    /**
     * Update resume status
     */
    updateResumeStatus(resumeId: string, userId: string, status: string): Promise<import("../models/Resume.models.js").IResume & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    }>;
    /**
     * Get resumes by template type - FIXED VERSION
     */
    getResumesByTemplate(userId: string, template: "modern" | "classic" | "minimal" | "creative"): Promise<(import("../models/Resume.models.js").IResume & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    /**
     * Get recent resumes (last 30 days)
     */
    getRecentResumes(userId: string, days?: number): Promise<(import("../models/Resume.models.js").IResume & Required<{
        _id: Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    /**
     * Check if user has resumes
     */
    hasResumes(userId: string): Promise<boolean>;
    /**
     * Get resumes by user ID (alias for getResumesByUser)
     */
    getResumesByUserId(userId: string, options: any): Promise<{
        resumes: (import("../models/Resume.models.js").IResume & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        })[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            pages: number;
        };
    }>;
    /**
     * Get template statistics
     */
    getTemplateStats(userId: string): Promise<any[]>;
    /**
     * Get status statistics
     */
    getStatusStats(userId: string): Promise<any[]>;
    /**
     * Get resume count by user
     */
    getResumeCount(userId: string): Promise<number>;
}
declare const _default: ResumeService;
export default _default;
//# sourceMappingURL=resume.service.d.ts.map