import mongoose, { Schema } from "mongoose";
export var ApplicationStatus;
(function (ApplicationStatus) {
    ApplicationStatus["PENDING"] = "pending";
    ApplicationStatus["REVIEWING"] = "reviewing";
    ApplicationStatus["SHORTLISTED"] = "shortlisted";
    ApplicationStatus["INTERVIEWING"] = "interviewing";
    ApplicationStatus["HIRED"] = "hired";
    ApplicationStatus["REJECTED"] = "rejected";
    ApplicationStatus["WITHDRAWN"] = "withdrawn";
})(ApplicationStatus || (ApplicationStatus = {}));
const applicationSchema = new Schema({
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
}, {
    timestamps: true,
    toJSON: { versionKey: false },
    toObject: { versionKey: false },
});
applicationSchema.index({ job: 1, userId: 1 }, { unique: true });
applicationSchema.index({ userId: 1, status: 1 });
applicationSchema.index({ job: 1, status: 1 });
applicationSchema.index({ status: 1, appliedAt: -1 });
applicationSchema.index({ interview: 1 });
const Application = mongoose.model("Application", applicationSchema);
export default Application;
