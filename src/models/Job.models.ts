// backend/src/models/Job.models.ts
import mongoose, { Schema, Document } from "mongoose";

// ✅ Define enums as constants
export const JOB_TYPES = [
  "full-time",
  "part-time",
  "contract",
  "internship",
] as const;
export const EXPERIENCE_LEVELS = ["entry", "mid", "senior", "lead"] as const;
export const WORK_MODES = ["remote", "hybrid", "on-site"] as const;

export type JobType = (typeof JOB_TYPES)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export type WorkMode = (typeof WORK_MODES)[number];

export interface IJob extends Document {
  title: string;
  company: string;
  companyId: mongoose.Types.ObjectId;
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

const jobSchema = new Schema<IJob>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    location: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    requirements: {
      type: String, 
      required: true,
    },
    responsibilities: {
      type: String,
      default: "",
    },
    benefits: {
      type: String,
      default: "",
    },
    skills: {
      type: [String],
      default: [],
      index: true,
    },
    jobType: {
      type: String,
      enum: JOB_TYPES,
      required: true,
      default: "full-time",
    },
    experienceLevel: {
      type: String,
      enum: EXPERIENCE_LEVELS,
      required: true,
      default: "mid",
    },
    workMode: {
      type: String,
      enum: WORK_MODES,
      default: "remote",
    },
    minSalary: {
      type: Number,
      min: 0,
    },
    maxSalary: {
      type: Number,
      min: 0,
    },
    openings: {
      type: Number,
      default: 1,
      min: 1,
    },
    applicationDeadline: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    views: {
      type: Number,
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
jobSchema.index({ title: "text", description: "text" });
jobSchema.index({ companyId: 1, isActive: 1 });
jobSchema.index({ postedBy: 1, isActive: 1 });
jobSchema.index({ jobType: 1 });
jobSchema.index({ experienceLevel: 1 });
jobSchema.index({ workMode: 1 });
jobSchema.index({ createdAt: -1 });

const Job = mongoose.model<IJob>("Job", jobSchema);

export default Job;
