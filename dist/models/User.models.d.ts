import mongoose, { Document } from "mongoose";
export declare enum UserRole {
    ADMIN = "admin",
    JOB_SEEKER = "job-seeker",
    EMPLOYER = "employer"
}
export interface IUser extends Document {
    username: string;
    email: string;
    password: string;
    role: UserRole;
    profile: {
        firstName?: string;
        lastName?: string;
        phone?: string;
        profileImage?: string;
        bio?: string;
        headline?: string;
        location?: string;
        skills: string[];
        experience?: number;
        education?: string;
        website?: string;
        linkedin?: string;
        github?: string;
        twitter?: string;
    };
    resumeId?: mongoose.Types.ObjectId;
    isActive: boolean;
    lastLogin?: Date;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
    toPublicJSON(): Partial<IUser>;
}
declare const User: mongoose.Model<IUser, {}, {}, {}, Document<unknown, {}, IUser, {}, mongoose.DefaultSchemaOptions> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IUser>;
export default User;
//# sourceMappingURL=User.models.d.ts.map