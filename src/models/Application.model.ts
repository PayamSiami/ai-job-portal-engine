// src/models/Application.model.ts
import mongoose, { Schema, Document } from "mongoose";

// ✅ Export enum directly - this already exports it
export enum ApplicationStatus {
  PENDING = "pending",
  REVIEWING = "reviewing",
  SHORTLISTED = "shortlisted",
  INTERVIEWING = "interviewing",
  HIRED = "hired",
  REJECTED = "rejected",
}

export interface IApplication extends Document {
  jobId: mongoose.Types.ObjectId;
  applicantId: mongoose.Types.ObjectId;
  resumeId?: mongoose.Types.ObjectId;
  coverLetter?: string;
  expectedSalary?: number;
  availableFrom?: Date;
  status: ApplicationStatus;
  aiScore?: number;
  aiExplanation?: string;
  aiStrengths: string[];
  aiWeaknesses: string[];
  aiRecommendation?: string;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
    },
    coverLetter: String,
    expectedSalary: Number,
    availableFrom: Date,
    status: {
      type: String,
      enum: Object.values(ApplicationStatus),
      default: ApplicationStatus.PENDING,
    },
    aiScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    aiExplanation: String,
    aiStrengths: {
      type: [String],
      default: [],
    },
    aiWeaknesses: {
      type: [String],
      default: [],
    },
    aiRecommendation: String,
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Create indexes
applicationSchema.index({ jobId: 1, applicantId: 1 }, { unique: true });
applicationSchema.index({ applicantId: 1 });
applicationSchema.index({ jobId: 1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ appliedAt: -1 });
applicationSchema.index({ aiScore: -1 });

const Application = mongoose.model<IApplication>(
  "Application",
  applicationSchema,
);

export default Application;
