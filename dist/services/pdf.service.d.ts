export interface ResumeData {
    id?: string;
    title: string;
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
        company: string;
        position: string;
        location?: string;
        startDate: Date | string;
        endDate?: Date | string;
        current: boolean;
        description?: string;
        achievements?: string[];
    }>;
    education: Array<{
        institution: string;
        degree: string;
        fieldOfStudy?: string;
        location?: string;
        startDate: Date | string;
        endDate?: Date | string;
        current: boolean;
        description?: string;
        gpa?: number;
    }>;
    skills: Array<{
        name: string;
        level?: "beginner" | "intermediate" | "advanced" | "expert";
        category?: string;
    }>;
    certifications: Array<{
        name: string;
        issuer: string;
        date: Date | string;
        expiryDate?: Date | string;
        credentialId?: string;
        url?: string;
    }>;
    languages: Array<{
        name: string;
        proficiency: "basic" | "conversational" | "professional" | "native";
    }>;
    projects: Array<{
        name: string;
        description?: string;
        url?: string;
        technologies?: string[];
        startDate?: Date | string;
        endDate?: Date | string;
    }>;
    template: "modern" | "classic" | "minimal" | "creative";
    visibility?: string;
    status?: string;
    isDefault?: boolean;
}
interface SaveResult {
    filename: string;
    path: string;
    size: number;
    blob?: Buffer;
}
declare class PDFService {
    private fontsPath;
    private storagePath;
    private colors;
    constructor();
    /**
     * Convert database resume object to ResumeData interface
     */
    private convertToResumeData;
    /**
     * Main method to generate PDF from resume data
     */
    generateResumePDF(resume: any, template?: string): Promise<Buffer>;
    /**
     * Generate and save PDF to storage
     */
    generateAndSavePDF(resume: any, template?: string): Promise<SaveResult>;
    /**
     * Get PDF file path for a resume
     */
    getPDFPath(resumeId: string): string | null;
    /**
     * Get all PDFs for a user
     */
    getUserPDFs(userId: string): string[];
    /**
     * Delete a PDF file
     */
    deletePDF(resumeId: string): boolean;
    /**
     * Clean up old PDFs (older than 30 days)
     */
    cleanupOldPDFs(daysOld?: number): number;
    /**
     * Get PDF as base64 string
     */
    getPDFAsBase64(resume: any, template?: string): Promise<string>;
    private formatDate;
    private getLevelIcon;
    private getProficiencyStars;
    private getProficiencyLabel;
    private renderSidebarSection;
    private generateModernTemplate;
    /**
     * CLASSIC TEMPLATE - Traditional, single-column, elegant
     */
    private generateClassicTemplate;
    /**
     * MINIMAL TEMPLATE - Clean, lots of whitespace, modern minimalist
     */
    private generateMinimalTemplate;
    /**
     * CREATIVE TEMPLATE - Bold, colorful, modern design with sidebar
     */
    private generateCreativeTemplate;
}
declare const _default: PDFService;
export default _default;
//# sourceMappingURL=pdf.service.d.ts.map