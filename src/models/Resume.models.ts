// src/models/Resume.model.ts
import mongoose, { Schema, Document } from "mongoose";

// Define Resume interface
export interface IResume extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  version: number;
  isActive: boolean;
  isDefault: boolean;
  skills: string[];
  experience: {
    years: number;
    level: "entry" | "mid" | "senior" | "lead";
  };
  education: {
    degree: string;
    field: string;
    institution: string;
  };
  summary: string;
  analysis?: {
    score: number;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    lastAnalyzedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Define schema
const resumeSchema = new Schema<IResume>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    skills: {
      type: [String],
      default: [],
    },
    experience: {
      years: {
        type: Number,
        default: 0,
      },
      level: {
        type: String,
        enum: ["entry", "mid", "senior", "lead"],
        default: "entry",
      },
    },
    education: {
      degree: String,
      field: String,
      institution: String,
    },
    summary: {
      type: String,
      default: "",
    },
    analysis: {
      score: Number,
      strengths: [String],
      weaknesses: [String],
      suggestions: [String],
      lastAnalyzedAt: Date,
    },
  },
  {
    timestamps: true,
  },
);

// ✅ FIX 1: Remove 'next' parameter when using async/await
resumeSchema.pre("save", async function (this: IResume) {
  if (this.isModified("content")) {
    this.version += 1;
  }
});

// ✅ FIX 2: Remove 'next' parameter when using async/await
resumeSchema.pre("save", async function (this: IResume) {
  if (this.isDefault) {
    await mongoose
      .model("Resume")
      .updateMany(
        { userId: this.userId, _id: { $ne: this._id }, isDefault: true },
        { isDefault: false },
      );
  }
});

// Create and export model
const Resume = mongoose.model<IResume>("Resume", resumeSchema);

export default Resume;
