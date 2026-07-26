import mongoose, { Schema } from "mongoose";
export const JOB_TYPES = [
    "full-time",
    "part-time",
    "contract",
    "internship",
];
export const EXPERIENCE_LEVELS = ["entry", "mid", "senior", "lead"];
export const WORK_MODES = ["remote", "hybrid", "on-site"];
const jobSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    company: {
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
}, {
    timestamps: true,
    toJSON: { versionKey: false },
    toObject: { versionKey: false },
});
jobSchema.index({ title: "text", description: "text" });
jobSchema.index({ company: 1, isActive: 1 });
jobSchema.index({ postedBy: 1, isActive: 1 });
jobSchema.index({ jobType: 1 });
jobSchema.index({ experienceLevel: 1 });
jobSchema.index({ workMode: 1 });
jobSchema.index({ createdAt: -1 });
const Job = mongoose.model("Job", jobSchema);
export default Job;
