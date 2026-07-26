import mongoose, { Document } from "mongoose";
export interface IResume extends Document {
    user: mongoose.Types.ObjectId;
    title: string;
    isDefault: boolean;
    template: "modern" | "classic" | "minimal" | "creative";
    visibility: "private" | "public" | "shared";
    status: "draft" | "active" | "archived";
    personalInfo: {
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
        location?: string;
        website?: string;
        linkedin?: string;
        github?: string;
        summary?: string;
        title?: string;
    };
    experience: Array<{
        _id?: mongoose.Types.ObjectId;
        company: string;
        position: string;
        location?: string;
        startDate: Date;
        endDate?: Date;
        current: boolean;
        description?: string;
        achievements?: string[];
    }>;
    education: Array<{
        _id?: mongoose.Types.ObjectId;
        institution: string;
        degree: string;
        fieldOfStudy?: string;
        location?: string;
        startDate: Date;
        endDate?: Date;
        current: boolean;
        description?: string;
        gpa?: number;
    }>;
    skills: Array<{
        _id?: mongoose.Types.ObjectId;
        name: string;
        level?: "beginner" | "intermediate" | "advanced" | "expert";
        category?: string;
    }>;
    certifications: Array<{
        _id?: mongoose.Types.ObjectId;
        name: string;
        issuer: string;
        date: Date;
        expiryDate?: Date;
        credentialId?: string;
        url?: string;
    }>;
    languages: Array<{
        _id?: mongoose.Types.ObjectId;
        name: string;
        proficiency: "basic" | "conversational" | "professional" | "native";
    }>;
    projects: Array<{
        _id?: mongoose.Types.ObjectId;
        name: string;
        description?: string;
        url?: string;
        technologies?: string[];
        startDate?: Date;
        endDate?: Date;
    }>;
    customSections: Array<{
        _id?: mongoose.Types.ObjectId;
        title: string;
        content: string;
        order: number;
    }>;
    pdfFile?: {
        filename: string;
        path: string;
        size: number;
        mimeType: string;
        uploadedAt: Date;
    };
    createdAt: Date;
    updatedAt: Date;
}
declare const Resume: mongoose.Model<IResume, {}, {}, {}, Document<unknown, {}, IResume, {}, mongoose.DefaultSchemaOptions> & IResume & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IResume>;
export default Resume;
//# sourceMappingURL=Resume.models.d.ts.map