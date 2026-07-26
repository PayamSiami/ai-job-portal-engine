// utils/companyHelper.ts
import { Types } from "mongoose";
import Company from "../models/Company.models.js";
import logger from "./logger.js";

/**
 * Get company name from job object
 * Handles both populated and unpopulated cases
 */
export const getCompanyNameFromJob = async (job: any): Promise<string> => {
  try {
    if (!job) return "Unknown Company";

    // Case 1: Company is already populated with name
    if (job.company && typeof job.company === "object") {
      // Check if it has a name property
      if ("name" in job.company && job.company.name) {
        return job.company.name;
      }
      // If it has _id but no name (partially populated)
      if ("_id" in job.company) {
        const company = await Company.findById(job.company._id);
        return company?.name || "Unknown Company";
      }
    }

    // Case 2: Company is a string (ObjectId string)
    if (typeof job.company === "string") {
      // Check if it's a valid ObjectId
      if (Types.ObjectId.isValid(job.company)) {
        const company = await Company.findById(job.company);
        return company?.name || "Unknown Company";
      }
      // If it's already a company name
      return job.company;
    }

    // Case 3: Company is an ObjectId instance
    if (job.company instanceof Types.ObjectId) {
      const company = await Company.findById(job.company);
      return company?.name || "Unknown Company";
    }

    return "Unknown Company";
  } catch (error) {
    logger.error("Error fetching company name:", error);
    return "Unknown Company";
  }
};

/**
 * Get company name by ID (safe version)
 */
export const getCompanyNameById = async (
  companyId: string | Types.ObjectId,
): Promise<string> => {
  try {
    if (!companyId) return "Unknown Company";

    const id = typeof companyId === "string" ? companyId : companyId.toString();

    if (!Types.ObjectId.isValid(id)) {
      return "Unknown Company";
    }

    const company = await Company.findById(id);
    return company?.name || "Unknown Company";
  } catch (error) {
    logger.error("Error fetching company by ID:", error);
    return "Unknown Company";
  }
};
