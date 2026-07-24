// backend/src/models/Interview.model.ts
import mongoose, { Schema, Document } from "mongoose";

// ==================== Enums ====================

export enum InterviewStatus {
  SCHEDULED = "scheduled",
  CONFIRMED = "confirmed",
  RESCHEDULED = "rescheduled",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  NO_SHOW = "no-show",
}

export enum InterviewType {
  PHONE = "phone",
  VIDEO = "video",
  IN_PERSON = "in-person",
  TECHNICAL = "technical",
  HR = "hr",
  PANEL = "panel",
}

// ==================== Interface ====================

export interface IInterview extends Document {
  // Relations
  application: mongoose.Types.ObjectId;
  job: mongoose.Types.ObjectId;
  company: mongoose.Types.ObjectId;
  candidate: mongoose.Types.ObjectId;
  interviewerIds: mongoose.Types.ObjectId[];

  // Interview Details
  title: string;
  type: InterviewType;
  status: InterviewStatus;

  // Schedule
  scheduledDate: Date;
  duration: number; // in minutes
  timezone: string;

  // Location
  location?: string;
  meetingLink?: string;
  meetingPlatform?: "zoom" | "google-meet" | "teams" | "other";
  meetingId?: string;
  meetingPassword?: string;

  // Feedback & Notes
  feedback?: string;
  notes?: string;
  rating?: number; // 1-5
  recommendation?: "hire" | "no-hire" | "undecided";

  // History
  statusHistory: Array<{
    status: InterviewStatus;
    notes: string;
    updatedAt: Date;
    updatedBy: mongoose.Types.ObjectId;
  }>;
  rescheduleHistory: Array<{
    oldDate: Date;
    newDate: Date;
    reason: string;
    rescheduledAt: Date;
    rescheduledBy: mongoose.Types.ObjectId;
  }>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;

  // Metadata
  calendarEventId?: string;
  reminderSent: boolean;
  reminderSentAt?: Date;
}

// ==================== Schema ====================

const InterviewSchema = new Schema<IInterview>(
  {
    // Relations
    application: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      required: true,
    },
    job: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    candidate: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    interviewerIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    // Interview Details
    title: {
      type: String,
      required: true,
      trim: true,
      default: function () {
        return `Interview for ${this.job}`;
      },
    },
    type: {
      type: String,
      enum: Object.values(InterviewType),
      required: true,
      default: InterviewType.VIDEO,
    },
    status: {
      type: String,
      enum: Object.values(InterviewStatus),
      default: InterviewStatus.SCHEDULED,
      index: true,
    },

    // Schedule
    scheduledDate: {
      type: Date,
      required: true,
      index: true,
    },
    duration: {
      type: Number,
      required: true,
      default: 60,
      min: 15,
      max: 480,
    },
    timezone: {
      type: String,
      default: "UTC",
    },

    // Location
    location: {
      type: String,
      trim: true,
    },
    meetingLink: {
      type: String,
      trim: true,
    },
    meetingPlatform: {
      type: String,
      enum: ["zoom", "google-meet", "teams", "other"],
    },
    meetingId: {
      type: String,
      trim: true,
    },
    meetingPassword: {
      type: String,
      trim: true,
    },

    // Feedback
    feedback: {
      type: String,
      maxlength: 5000,
    },
    notes: {
      type: String,
      maxlength: 1000,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    recommendation: {
      type: String,
      enum: ["hire", "no-hire", "undecided"],
    },

    // History
    statusHistory: [
      {
        status: {
          type: String,
          enum: Object.values(InterviewStatus),
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
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      },
    ],
    rescheduleHistory: [
      {
        oldDate: {
          type: Date,
          required: true,
        },
        newDate: {
          type: Date,
          required: true,
        },
        reason: {
          type: String,
          required: true,
        },
        rescheduledAt: {
          type: Date,
          default: Date.now,
        },
        rescheduledBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      },
    ],

    // Timestamps
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },

    // Metadata
    calendarEventId: {
      type: String,
      trim: true,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    reminderSentAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

// ==================== Indexes ====================

// For efficient queries
InterviewSchema.index({ candidate: 1, scheduledDate: -1 });
InterviewSchema.index({ interviewerIds: 1, scheduledDate: -1 });
InterviewSchema.index({ status: 1, scheduledDate: 1 });
InterviewSchema.index({ company: 1, scheduledDate: -1 });
InterviewSchema.index({ application: 1 });

// ==================== Virtuals ====================

InterviewSchema.virtual("isUpcoming").get(function () {
  return (
    this.scheduledDate > new Date() && this.status === InterviewStatus.SCHEDULED
  );
});

InterviewSchema.virtual("isPast").get(function () {
  return this.scheduledDate < new Date();
});

InterviewSchema.virtual("canReschedule").get(function () {
  return [InterviewStatus.SCHEDULED, InterviewStatus.CONFIRMED].includes(
    this.status,
  );
});

// ==================== Methods ====================

InterviewSchema.methods.getDurationInHours = function (): number {
  return this.duration / 60;
};

InterviewSchema.methods.formatDate = function (): string {
  return new Date(this.scheduledDate).toLocaleString();
};

// ==================== Statics ====================

InterviewSchema.statics.findUpcomingForCandidate = function (
  candidate: string,
) {
  return this.find({
    candidate,
    status: { $in: [InterviewStatus.SCHEDULED, InterviewStatus.CONFIRMED] },
    scheduledDate: { $gte: new Date() },
  }).sort({ scheduledDate: 1 });
};

InterviewSchema.statics.findTodayInterviews = function () {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return this.find({
    status: { $in: [InterviewStatus.SCHEDULED, InterviewStatus.CONFIRMED] },
    scheduledDate: { $gte: start, $lte: end },
  }).populate("candidate", "name email phone");
};

// ==================== Model ====================

export const Interview = mongoose.model<IInterview>(
  "Interview",
  InterviewSchema,
);
export default Interview;
