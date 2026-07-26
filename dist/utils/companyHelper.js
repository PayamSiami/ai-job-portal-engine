import { Types } from "mongoose";
import Company from "../models/Company.models.js";
import logger from "./logger.js";
export const getCompanyNameFromJob = async (job) => {
    try {
        if (!job)
            return "Unknown Company";
        if (job.company && typeof job.company === "object") {
            if ("name" in job.company && job.company.name) {
                return job.company.name;
            }
            if ("_id" in job.company) {
                const company = await Company.findById(job.company._id);
                return company?.name || "Unknown Company";
            }
        }
        if (typeof job.company === "string") {
            if (Types.ObjectId.isValid(job.company)) {
                const company = await Company.findById(job.company);
                return company?.name || "Unknown Company";
            }
            return job.company;
        }
        if (job.company instanceof Types.ObjectId) {
            const company = await Company.findById(job.company);
            return company?.name || "Unknown Company";
        }
        return "Unknown Company";
    }
    catch (error) {
        logger.error("Error fetching company name:", error);
        return "Unknown Company";
    }
};
export const getCompanyNameById = async (companyId) => {
    try {
        if (!companyId)
            return "Unknown Company";
        const id = typeof companyId === "string" ? companyId : companyId.toString();
        if (!Types.ObjectId.isValid(id)) {
            return "Unknown Company";
        }
        const company = await Company.findById(id);
        return company?.name || "Unknown Company";
    }
    catch (error) {
        logger.error("Error fetching company by ID:", error);
        return "Unknown Company";
    }
};
