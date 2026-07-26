import mongoose, { Document } from "mongoose";
export declare const JOB_TYPES: readonly ["full-time", "part-time", "contract", "internship"];
export declare const EXPERIENCE_LEVELS: readonly ["entry", "mid", "senior", "lead"];
export declare const WORK_MODES: readonly ["remote", "hybrid", "on-site"];
export type JobType = (typeof JOB_TYPES)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export type WorkMode = (typeof WORK_MODES)[number];
export interface IJob extends Document {
    title: string;
    company: mongoose.Types.ObjectId;
    postedBy: mongoose.Types.ObjectId;
    location: string;
    description: string;
    requirements: string;
    responsibilities: string;
    benefits: string;
    skills: string[];
    jobType: JobType;
    experienceLevel: ExperienceLevel;
    workMode: WorkMode;
    minSalary?: number;
    maxSalary?: number;
    openings: number;
    applicationDeadline?: Date;
    expiresAt?: Date;
    isActive: boolean;
    isDeleted: boolean;
    views: number;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}
declare const Job: mongoose.Model<IJob, {}, {}, {}, Document<unknown, {}, IJob, {}, mongoose.DefaultSchemaOptions> & IJob & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IJob>;
export default Job;
//# sourceMappingURL=Job.models.d.ts.map