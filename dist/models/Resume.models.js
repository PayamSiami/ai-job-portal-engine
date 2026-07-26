import mongoose, { Schema } from "mongoose";
const resumeSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
    template: {
        type: String,
        enum: ["modern", "classic", "minimal", "creative"],
        default: "modern",
    },
    visibility: {
        type: String,
        enum: ["private", "public", "shared"],
        default: "private",
    },
    status: {
        type: String,
        enum: ["draft", "active", "archived"],
        default: "draft",
    },
    personalInfo: {
        firstName: { type: String, default: "" },
        lastName: { type: String, default: "" },
        email: { type: String, default: "" },
        phone: { type: String, default: "" },
        location: { type: String, default: "" },
        website: { type: String, default: "" },
        linkedin: { type: String, default: "" },
        github: { type: String, default: "" },
        summary: { type: String, default: "" },
        title: { type: String, default: "" },
    },
    experience: [
        {
            _id: { type: Schema.Types.ObjectId, auto: true },
            company: { type: String, required: true },
            position: { type: String, required: true },
            location: String,
            startDate: { type: Date, required: true },
            endDate: Date,
            current: { type: Boolean, default: false },
            description: String,
            achievements: [String],
        },
    ],
    education: [
        {
            _id: { type: Schema.Types.ObjectId, auto: true },
            institution: { type: String, required: true },
            degree: { type: String, required: true },
            fieldOfStudy: String,
            location: String,
            startDate: { type: Date, required: true },
            endDate: Date,
            current: { type: Boolean, default: false },
            description: String,
            gpa: Number,
        },
    ],
    skills: [
        {
            _id: { type: Schema.Types.ObjectId, auto: true },
            name: { type: String, required: true },
            level: {
                type: String,
                enum: ["beginner", "intermediate", "advanced", "expert"],
                default: "intermediate",
            },
            category: String,
        },
    ],
    certifications: [
        {
            _id: { type: Schema.Types.ObjectId, auto: true },
            name: { type: String, required: true },
            issuer: { type: String, required: true },
            date: { type: Date, required: true },
            expiryDate: Date,
            credentialId: String,
            url: String,
        },
    ],
    languages: [
        {
            _id: { type: Schema.Types.ObjectId, auto: true },
            name: { type: String, required: true },
            proficiency: {
                type: String,
                enum: ["basic", "conversational", "professional", "native"],
                required: true,
            },
        },
    ],
    projects: [
        {
            _id: { type: Schema.Types.ObjectId, auto: true },
            name: { type: String, required: true },
            description: String,
            url: String,
            technologies: [String],
            startDate: Date,
            endDate: Date,
        },
    ],
    customSections: [
        {
            _id: { type: Schema.Types.ObjectId, auto: true },
            title: { type: String, required: true },
            content: { type: String, required: true },
            order: Number,
        },
    ],
    pdfFile: {
        filename: String,
        path: String,
        size: Number,
        mimeType: String,
        uploadedAt: Date,
    },
}, {
    timestamps: true,
    toJSON: { versionKey: false },
    toObject: { versionKey: false },
});
// Indexes
resumeSchema.index({ user: 1, isDefault: 1 });
resumeSchema.index({ user: 1, status: 1 });
resumeSchema.index({ user: 1, createdAt: -1 });
const Resume = mongoose.model("Resume", resumeSchema);
export default Resume;
