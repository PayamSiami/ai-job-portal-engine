// src/models/Job.model.ts
import mongoose, { Schema, Document } from "mongoose";

// Define Job interface
export interface IJob extends Document {
  title: string;
  company: string;
  location: string;
  salary?: number;
  minSalary?: number;
  maxSalary?: number;
  experienceLevel?: "entry" | "mid" | "senior" | "lead";
  workMode?: "remote" | "hybrid" | "on-site";
  jobType?: "full-time" | "part-time" | "contract" | "internship";
  description?: string;
  requirements?: string;
  benefits?: string;
  skills: string[]; // ✅ Fixed: Added type
  tags: string[];
  postedBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Define schema
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
    location: {
      type: String,
      required: true,
      index: true,
    },
    salary: {
      type: Number,
    },
    minSalary: {
      type: Number,
    },
    maxSalary: {
      type: Number,
    },
    experienceLevel: {
      type: String,
      enum: ["entry", "mid", "senior", "lead"],
    },
    workMode: {
      type: String,
      enum: ["remote", "hybrid", "on-site"],
    },
    jobType: {
      type: String,
      enum: ["full-time", "part-time", "contract", "internship"],
    },
    description: {
      type: String,
    },
    requirements: {
      type: String,
    },
    benefits: {
      type: String,
    },
    skills: {
      type: [String],
      index: true,
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

jobSchema.index({ title: "text", description: "text" });
jobSchema.index({ company: 1, location: 1 });
jobSchema.index({ minSalary: 1, maxSalary: 1 });
jobSchema.index({ createdAt: -1 });

// Create and export model
const Job = mongoose.model<IJob>("Job", jobSchema);

export default Job;
