import mongoose, { Document } from "mongoose";
export declare enum ApplicationStatus {
    PENDING = "pending",
    REVIEWING = "reviewing",
    SHORTLISTED = "shortlisted",
    INTERVIEWING = "interviewing",
    HIRED = "hired",
    REJECTED = "rejected",
    WITHDRAWN = "withdrawn"
}
export interface IApplication extends Document {
    job: mongoose.Types.ObjectId;
    user: mongoose.Types.ObjectId;
    resume?: mongoose.Types.ObjectId;
    coverLetter?: string;
    expectedSalary?: number;
    availableFrom?: Date;
    status: ApplicationStatus;
    aiScore?: number;
    aiExplanation?: string;
    aiStrengths: string[];
    aiWeaknesses: string[];
    aiRecommendation?: string;
    notes?: string;
    statusHistory: Array<{
        status: ApplicationStatus;
        notes: string;
        updatedAt: Date;
        updatedBy: mongoose.Types.ObjectId;
    }>;
    withdrawalReason?: string;
    withdrawnAt?: Date;
    interview?: mongoose.Types.ObjectId;
    hiredAt?: Date;
    rejectedAt?: Date;
    appliedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
declare const Application: mongoose.Model<IApplication, {}, {}, {}, Document<unknown, {}, IApplication, {}, mongoose.DefaultSchemaOptions> & IApplication & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IApplication>;
export default Application;
//# sourceMappingURL=Application.model.d.ts.map