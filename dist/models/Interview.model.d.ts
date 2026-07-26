import mongoose, { Document } from "mongoose";
export declare enum InterviewStatus {
    SCHEDULED = "scheduled",
    CONFIRMED = "confirmed",
    RESCHEDULED = "rescheduled",
    COMPLETED = "completed",
    CANCELLED = "cancelled",
    NO_SHOW = "no-show"
}
export declare enum InterviewType {
    PHONE = "phone",
    VIDEO = "video",
    IN_PERSON = "in-person",
    TECHNICAL = "technical",
    HR = "hr",
    PANEL = "panel"
}
export interface IInterview extends Document {
    application: mongoose.Types.ObjectId;
    job: mongoose.Types.ObjectId;
    company: mongoose.Types.ObjectId;
    candidate: mongoose.Types.ObjectId;
    interviewerIds: mongoose.Types.ObjectId[];
    title: string;
    type: InterviewType;
    status: InterviewStatus;
    scheduledDate: Date;
    duration: number;
    timezone: string;
    location?: string;
    meetingLink?: string;
    meetingPlatform?: "zoom" | "google-meet" | "teams" | "other";
    meetingId?: string;
    meetingPassword?: string;
    feedback?: string;
    notes?: string;
    rating?: number;
    recommendation?: "hire" | "no-hire" | "undecided";
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
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    cancelledAt?: Date;
    calendarEventId?: string;
    reminderSent: boolean;
    reminderSentAt?: Date;
}
export declare const Interview: mongoose.Model<IInterview, {}, {}, {}, Document<unknown, {}, IInterview, {}, mongoose.DefaultSchemaOptions> & IInterview & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IInterview>;
export default Interview;
//# sourceMappingURL=Interview.model.d.ts.map