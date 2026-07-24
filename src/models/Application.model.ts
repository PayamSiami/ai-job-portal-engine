// backend/src/models/Application.model.ts
import mongoose, { Schema, Document } from "mongoose";

export enum ApplicationStatus {
  PENDING = "pending",
  REVIEWING = "reviewing",
  SHORTLISTED = "shortlisted",
  INTERVIEWING = "interviewing",
  HIRED = "hired",
  REJECTED = "rejected",
  WITHDRAWN = "withdrawn",
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

const applicationSchema = new Schema<IApplication>(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    resume: {
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
    statusHistory: {
      type: [
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
      default: [],
    },
    withdrawalReason: {
      type: String,
      maxlength: 500,
    },
    withdrawnAt: {
      type: Date,
    },
    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Interview",
    },
    hiredAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    appliedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
    toObject: { versionKey: false },
  },
);

// Indexes
applicationSchema.index({ job: 1, userId: 1 }, { unique: true });
applicationSchema.index({ userId: 1, status: 1 });
applicationSchema.index({ job: 1, status: 1 });
applicationSchema.index({ status: 1, appliedAt: -1 });
applicationSchema.index({ interview: 1 });

const Application = mongoose.model<IApplication>(
  "Application",
  applicationSchema,
);
export default Application;
