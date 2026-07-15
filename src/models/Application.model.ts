// backend/src/models/Application.model.ts
import mongoose, { Schema, Document } from "mongoose";

// ==================== Enums ====================

export enum ApplicationStatus {
  PENDING = "pending", // Initial state, waiting for review
  REVIEWING = "reviewing", // Being reviewed by employer
  SHORTLISTED = "shortlisted", // Candidate selected for next round
  INTERVIEWING = "interviewing", // In interview process
  HIRED = "hired", // Candidate hired
  REJECTED = "rejected", // Candidate rejected
  WITHDRAWN = "withdrawn", // Candidate withdrew their application
}

export interface IApplication extends Document {
  jobId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
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
  notes?: string;
  statusHistory: Array<{
    status: ApplicationStatus;
    notes: string;
    updatedAt: Date;
    updatedBy: mongoose.Types.ObjectId;
  }>;
  withdrawalReason?: string;
  withdrawnAt?: Date;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Schema ====================

const applicationSchema = new Schema<IApplication>(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
    },
    coverLetter: {
      type: String,
      maxlength: 5000,
    },
    expectedSalary: {
      type: Number,
      min: 0,
    },
    availableFrom: {
      type: Date,
    },
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
    aiExplanation: {
      type: String,
    },
    aiStrengths: {
      type: [String],
      default: [],
    },
    aiWeaknesses: {
      type: [String],
      default: [],
    },
    aiRecommendation: {
      type: String,
      enum: ["consider", "interview", "shortlist", "reject"],
    },
    notes: {
      type: String,
      maxlength: 1000,
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: Object.values(ApplicationStatus),
          required: true,
        },
        notes: {
          type: String,
          default: "",
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      },
    ],
    withdrawalReason: {
      type: String,
      maxlength: 500,
    },
    withdrawnAt: {
      type: Date,
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// ==================== Indexes ====================

applicationSchema.index({ jobId: 1, userId: 1 }, { unique: true });
applicationSchema.index({ userId: 1 });
applicationSchema.index({ jobId: 1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ appliedAt: -1 });
applicationSchema.index({ aiScore: -1 });

// ==================== Model ====================

const Application = mongoose.model<IApplication>(
  "Application",
  applicationSchema,
);

export default Application;
