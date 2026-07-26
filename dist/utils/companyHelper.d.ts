import { Types } from "mongoose";
/**
 * Get company name from job object
 * Handles both populated and unpopulated cases
 */
export declare const getCompanyNameFromJob: (job: any) => Promise<string>;
/**
 * Get company name by ID (safe version)
 */
export declare const getCompanyNameById: (companyId: string | Types.ObjectId) => Promise<string>;
//# sourceMappingURL=companyHelper.d.ts.map