import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

class PDFService {
  private fontsPath: string;
  private storagePath: string;
  private colors = {
    primary: "#2563EB",
    primaryLight: "#3B82F6",
    primaryDark: "#1D4ED8",
    secondary: "#1E293B",
    text: "#334155",
    textLight: "#64748B",
    textMuted: "#94A3B8",
    background: "#F8FAFC",
    border: "#E2E8F0",
    white: "#FFFFFF",
    success: "#10B981",
    warning: "#F59E0B",
    sidebar: "#7C3AED",
    sidebarLight: "#A78BFA",
    sidebarLighter: "#DDD6FE",
  };

  constructor() {
    this.fontsPath = path.join(__dirname, "../../src/assets/fonts");
    this.storagePath = path.join(process.cwd(), "uploads/resumes");

    // Create directories if they don't exist
    [this.fontsPath, this.storagePath].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    logger.info("PDFService initialized", {
      fontsPath: this.fontsPath,
      storagePath: this.storagePath,
    });
  }

  /**
   * Convert database resume object to ResumeData interface
   */
  private convertToResumeData(resume: any): ResumeData {
    return {
      id: resume._id?.toString() || resume.id,
      title: resume.title || "Untitled Resume",
      personalInfo: {
        firstName: resume.personalInfo?.firstName || "",
        lastName: resume.personalInfo?.lastName || "",
        email: resume.personalInfo?.email || "",
        phone: resume.personalInfo?.phone || "",
        location: resume.personalInfo?.location || "",
        website: resume.personalInfo?.website || "",
        linkedin: resume.personalInfo?.linkedin || "",
        github: resume.personalInfo?.github || "",
        summary: resume.personalInfo?.summary || "",
        title: resume.personalInfo?.title || "",
      },
      experience: (resume.experience || []).map((exp: any) => ({
        company: exp.company || "",
        position: exp.position || exp.title || "",
        location: exp.location || "",
        startDate: exp.startDate || new Date(),
        endDate: exp.endDate || undefined,
        current: exp.current || false,
        description: exp.description || "",
        achievements: exp.achievements || [],
      })),
      education: (resume.education || []).map((edu: any) => ({
        institution: edu.institution || "",
        degree: edu.degree || "",
        fieldOfStudy: edu.fieldOfStudy || "",
        location: edu.location || "",
        startDate: edu.startDate || new Date(),
        endDate: edu.endDate || undefined,
        current: edu.current || false,
        description: edu.description || "",
        gpa: edu.gpa || undefined,
      })),
      skills: (resume.skills || []).map((skill: any) => ({
        name: skill.name || "",
        level: skill.level || "intermediate",
        category: skill.category || "",
      })),
      certifications: (resume.certifications || []).map((cert: any) => ({
        name: cert.name || "",
        issuer: cert.issuer || cert.issuingOrganization || "",
        date: cert.date || cert.issueDate || new Date(),
        expiryDate: cert.expiryDate || cert.expirationDate || undefined,
        credentialId: cert.credentialId || "",
        url: cert.url || "",
      })),
      languages: (resume.languages || []).map((lang: any) => ({
        name: lang.name || "",
        proficiency: lang.proficiency || "professional",
      })),
      projects: (resume.projects || []).map((project: any) => ({
        name: project.name || "",
        description: project.description || "",
        url: project.url || "",
        technologies: project.technologies || [],
        startDate: project.startDate || undefined,
        endDate: project.endDate || undefined,
      })),
      template: resume.template || "modern",
      visibility: resume.visibility || "private",
      status: resume.status || "draft",
      isDefault: resume.isDefault || false,
    };
  }

  /**
   * Main method to generate PDF from resume data
   */
  async generateResumePDF(
    resume: any,
    template: string = "modern",
  ): Promise<Buffer> {
    try {
      // Convert to ResumeData if it's a database object
      const resumeData = resume._id || resume.id
        ? this.convertToResumeData(resume)
        : (resume as ResumeData);

      // Validate required data
      if (!resumeData.personalInfo?.firstName || !resumeData.personalInfo?.lastName) {
        throw new Error("Resume must have at least first name and last name");
      }

      return new Promise((resolve, reject) => {
        try {
          const doc = new PDFDocument({
            size: "A4",
            margin: 50,
            info: {
              Title: `Resume - ${resumeData.personalInfo.firstName} ${resumeData.personalInfo.lastName}`,
              Author: `${resumeData.personalInfo.firstName} ${resumeData.personalInfo.lastName}`,
              Subject: "Professional Resume",
              Keywords: "resume, cv, job application",
            },
          });

          const chunks: Buffer[] = [];
          doc.on("data", (chunk) => chunks.push(chunk));
          doc.on("end", () => resolve(Buffer.concat(chunks)));
          doc.on("error", (error) => reject(error));

          // Generate template
          switch (template) {
            case "modern":
              this.generateModernTemplate(doc, resumeData);
              break;
            case "classic":
              this.generateClassicTemplate(doc, resumeData);
              break;
            case "minimal":
              this.generateMinimalTemplate(doc, resumeData);
              break;
            case "creative":
              this.generateCreativeTemplate(doc, resumeData);
              break;
            default:
              this.generateModernTemplate(doc, resumeData);
          }

          // Add page numbers
          const pages = doc.bufferedPageRange();
          for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            doc
              .fillColor(this.colors.textMuted)
              .fontSize(8)
              .font("Helvetica")
              .text(`Page ${i + 1} of ${pages.count}`, 50, doc.page.height - 30, {
                align: "center",
                width: doc.page.width - 100,
              });
          }

          doc.end();
        } catch (error) {
          logger.error("PDF generation failed:", error);
          reject(error);
        }
      });
    } catch (error) {
      logger.error("Failed to generate resume PDF:", {
        error: error instanceof Error ? error.message : "Unknown error",
        template,
      });
      throw error;
    }
  }

  /**
   * Generate and save PDF to storage
   */
  async generateAndSavePDF(
    resume: any,
    template: string = "modern",
  ): Promise<SaveResult> {
    try {
      const pdfBuffer = await this.generateResumePDF(resume, template);

      const timestamp = Date.now();
      const resumeId = resume._id?.toString() || resume.id || "unknown";
      const filename = `resume-${resumeId}-${timestamp}.pdf`;
      const filePath = path.join(this.storagePath, filename);

      // Ensure directory exists
      if (!fs.existsSync(this.storagePath)) {
        fs.mkdirSync(this.storagePath, { recursive: true });
      }

      // Save file
      fs.writeFileSync(filePath, pdfBuffer);
      const stats = fs.statSync(filePath);

      logger.info("PDF saved successfully", {
        filename,
        path: filePath,
        size: stats.size,
        resumeId,
      });

      return {
        filename,
        path: filePath,
        size: stats.size,
        blob: pdfBuffer,
      };
    } catch (error) {
      logger.error("Failed to save PDF:", {
        error: error instanceof Error ? error.message : "Unknown error",
        resumeId: resume._id || resume.id,
        template,
      });
      throw error;
    }
  }

  /**
   * Get PDF file path for a resume
   */
  getPDFPath(resumeId: string): string | null {
    try {
      if (!fs.existsSync(this.storagePath)) {
        return null;
      }

      const files = fs.readdirSync(this.storagePath);
      const pdfFile = files.find(
        (file) => file.includes(resumeId) && file.endsWith(".pdf"),
      );

      if (pdfFile) {
        return path.join(this.storagePath, pdfFile);
      }
      return null;
    } catch (error) {
      logger.error("Failed to find PDF:", error);
      return null;
    }
  }

  /**
   * Get all PDFs for a user
   */
  getUserPDFs(userId: string): string[] {
    try {
      if (!fs.existsSync(this.storagePath)) {
        return [];
      }

      const files = fs.readdirSync(this.storagePath);
      return files
        .filter((file) => file.includes(userId) && file.endsWith(".pdf"))
        .map((file) => path.join(this.storagePath, file));
    } catch (error) {
      logger.error("Failed to get user PDFs:", error);
      return [];
    }
  }

  /**
   * Delete a PDF file
   */
  deletePDF(resumeId: string): boolean {
    try {
      const filePath = this.getPDFPath(resumeId);
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info("PDF deleted successfully", { resumeId, filePath });
        return true;
      }
      return false;
    } catch (error) {
      logger.error("Failed to delete PDF:", error);
      return false;
    }
  }

  /**
   * Clean up old PDFs (older than 30 days)
   */
  cleanupOldPDFs(daysOld: number = 30): number {
    try {
      if (!fs.existsSync(this.storagePath)) {
        return 0;
      }

      const files = fs.readdirSync(this.storagePath);
      const now = Date.now();
      const maxAge = daysOld * 24 * 60 * 60 * 1000;
      let deleted = 0;

      for (const file of files) {
        if (file.endsWith(".pdf")) {
          const filePath = path.join(this.storagePath, file);
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > maxAge) {
            fs.unlinkSync(filePath);
            deleted++;
          }
        }
      }

      logger.info(`Cleaned up ${deleted} old PDFs`);
      return deleted;
    } catch (error) {
      logger.error("Failed to cleanup old PDFs:", error);
      return 0;
    }
  }

  /**
   * Get PDF as base64 string
   */
  async getPDFAsBase64(resume: any, template: string = "modern"): Promise<string> {
    const buffer = await this.generateResumePDF(resume, template);
    return buffer.toString("base64");
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private formatDate(date: Date | string | undefined): string {
    if (!date) return "";
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }

  private getLevelIcon(level?: string): string {
    switch (level) {
      case "expert":
        return "⭐⭐⭐";
      case "advanced":
        return "⭐⭐";
      case "intermediate":
        return "⭐";
      default:
        return "";
    }
  }

  private getProficiencyStars(proficiency?: string): string {
    switch (proficiency) {
      case "native":
        return "⭐⭐⭐";
      case "professional":
        return "⭐⭐";
      case "conversational":
        return "⭐";
      default:
        return "";
    }
  }

  private getProficiencyLabel(proficiency?: string): string {
    switch (proficiency) {
      case "native":
        return "Native";
      case "professional":
        return "Professional";
      case "conversational":
        return "Conversational";
      case "basic":
        return "Basic";
      default:
        return "";
    }
  }

  private renderSidebarSection(
    doc: PDFKit.PDFDocument,
    title: string,
    x: number,
    y: number,
  ): void {
    doc
      .fillColor("#F3E8FF")
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(title, x, y);
    doc
      .moveTo(x, y + 12)
      .lineTo(x + 100, y + 12)
      .stroke("#A78BFA");
  }

  // ============================================
  // TEMPLATE: MODERN
  // ============================================

  private generateModernTemplate(
    doc: PDFKit.PDFDocument,
    resume: ResumeData,
  ): void {
    const {
      personalInfo,
      experience,
      education,
      skills,
      certifications,
      languages,
      projects,
    } = resume;

    // Header
    const headerHeight = 140;
    doc.rect(50, 50, 495, headerHeight).fill(this.colors.primary);
    doc.rect(50, 50, 495, 4).fill(this.colors.primaryDark);

    // Name
    doc
      .fillColor(this.colors.white)
      .fontSize(32)
      .font("Helvetica-Bold")
      .text(`${personalInfo.firstName} ${personalInfo.lastName}`, 70, 70);

    // Title
    if (personalInfo.title) {
      doc
        .fillColor("#DBEAFE")
        .fontSize(16)
        .font("Helvetica")
        .text(personalInfo.title, 70, 110);
    }

    // Contact info in header
    let contactY = 135;
    const contactX = 70;
    const contactItems = [];

    if (personalInfo.email) contactItems.push(`✉ ${personalInfo.email}`);
    if (personalInfo.phone) contactItems.push(`📞 ${personalInfo.phone}`);
    if (personalInfo.location) contactItems.push(`📍 ${personalInfo.location}`);
    if (personalInfo.linkedin) contactItems.push(`🔗 ${personalInfo.linkedin}`);
    if (personalInfo.github) contactItems.push(`💻 ${personalInfo.github}`);

    if (contactItems.length > 0) {
      doc
        .fillColor("#BFDBFE")
        .fontSize(9)
        .font("Helvetica")
        .text(contactItems.join("  •  "), contactX, contactY, {
          width: 455,
          align: "left",
        });
    }

    let y = 50 + headerHeight + 20;

    // Summary
    if (personalInfo.summary) {
      doc
        .fillColor(this.colors.secondary)
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("PROFESSIONAL SUMMARY", 50, y);

      doc
        .moveTo(50, y + 18)
        .lineTo(545, y + 18)
        .stroke(this.colors.primary);

      y += 28;
      doc
        .fillColor(this.colors.text)
        .fontSize(10)
        .font("Helvetica")
        .text(personalInfo.summary, 50, y, {
          width: 495,
          align: "justify",
          lineGap: 3,
        });

      y +=
        doc.heightOfString(personalInfo.summary, { width: 495, lineGap: 3 }) +
        20;
    }

    // TWO-COLUMN LAYOUT
    const leftCol = 50;
    const rightCol = 290;
    const colWidth = 205;

    let leftY = y;

    // LEFT COLUMN - Skills, Languages, Certifications
    // Skills
    if (skills && skills.length > 0) {
      doc
        .fillColor(this.colors.secondary)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("SKILLS", leftCol, leftY);

      doc
        .moveTo(leftCol, leftY + 16)
        .lineTo(leftCol + colWidth, leftY + 16)
        .stroke(this.colors.primary);

      leftY += 26;

      // Group skills by category
      const groupedSkills = skills.reduce(
        (acc, skill) => {
          const category = skill.category || "General";
          if (!acc[category]) acc[category] = [];
          acc[category].push(skill);
          return acc;
        },
        {} as Record<string, typeof skills>,
      );

      Object.entries(groupedSkills).forEach(([category, skillList]) => {
        if (category !== "General") {
          doc
            .fillColor(this.colors.secondary)
            .fontSize(9)
            .font("Helvetica-Bold")
            .text(category, leftCol, leftY);
          leftY += 14;
        }

        skillList.forEach((skill) => {
          const stars = this.getLevelIcon(skill.level);
          doc
            .fillColor(this.colors.text)
            .fontSize(8)
            .font("Helvetica")
            .text(
              `• ${skill.name} ${stars}`,
              leftCol + (category !== "General" ? 10 : 0),
              leftY,
            );
          leftY += 13;
        });
        leftY += 5;
      });

      leftY += 10;
    }

    // Languages
    if (languages && languages.length > 0) {
      doc
        .fillColor(this.colors.secondary)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("LANGUAGES", leftCol, leftY);

      doc
        .moveTo(leftCol, leftY + 16)
        .lineTo(leftCol + colWidth, leftY + 16)
        .stroke(this.colors.primary);

      leftY += 26;

      languages.forEach((lang) => {
        const stars = this.getProficiencyStars(lang.proficiency);
        doc
          .fillColor(this.colors.text)
          .fontSize(9)
          .font("Helvetica")
          .text(`${lang.name} ${stars}`, leftCol, leftY);
        leftY += 14;
        doc
          .fillColor(this.colors.textLight)
          .fontSize(7)
          .font("Helvetica")
          .text(`(${this.getProficiencyLabel(lang.proficiency)})`, leftCol + 10, leftY);
        leftY += 16;
      });

      leftY += 5;
    }

    // Certifications
    if (certifications && certifications.length > 0) {
      doc
        .fillColor(this.colors.secondary)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("CERTIFICATIONS", leftCol, leftY);

      doc
        .moveTo(leftCol, leftY + 16)
        .lineTo(leftCol + colWidth, leftY + 16)
        .stroke(this.colors.primary);

      leftY += 26;

      certifications.forEach((cert) => {
        doc
          .fillColor(this.colors.text)
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(cert.name, leftCol, leftY);
        leftY += 13;
        doc
          .fillColor(this.colors.textLight)
          .fontSize(8)
          .font("Helvetica")
          .text(cert.issuer, leftCol + 5, leftY);
        leftY += 13;
        if (cert.date) {
          doc
            .fillColor(this.colors.textMuted)
            .fontSize(7)
            .font("Helvetica")
            .text(this.formatDate(cert.date), leftCol + 5, leftY);
          leftY += 16;
        }
      });
    }

    // RIGHT COLUMN - Experience, Education, Projects
    let rightY = y;

    // Experience
    if (experience && experience.length > 0) {
      doc
        .fillColor(this.colors.secondary)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("EXPERIENCE", rightCol, rightY);

      doc
        .moveTo(rightCol, rightY + 16)
        .lineTo(rightCol + colWidth, rightY + 16)
        .stroke(this.colors.primary);

      rightY += 26;

      experience.forEach((exp) => {
        // Position
        doc
          .fillColor(this.colors.secondary)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(exp.position, rightCol, rightY);

        // Company and date
        const dateStr = `${this.formatDate(exp.startDate)} - ${exp.current ? "Present" : this.formatDate(exp.endDate)}`;
        doc
          .fillColor(this.colors.primary)
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(exp.company, rightCol + 5, rightY + 13);

        doc
          .fillColor(this.colors.textMuted)
          .fontSize(8)
          .font("Helvetica")
          .text(dateStr, rightCol + 120, rightY + 13);

        rightY += 28;

        // Description
        if (exp.description) {
          doc
            .fillColor(this.colors.text)
            .fontSize(8)
            .font("Helvetica")
            .text(exp.description, rightCol + 10, rightY, {
              width: colWidth - 10,
              align: "justify",
              lineGap: 2,
            });

          rightY +=
            doc.heightOfString(exp.description, {
              width: colWidth - 10,
              lineGap: 2,
            }) + 3;
        }

        // Achievements
        if (exp.achievements && exp.achievements.length > 0) {
          exp.achievements.forEach((achievement) => {
            doc
              .fillColor(this.colors.textLight)
              .fontSize(8)
              .font("Helvetica")
              .text(`• ${achievement}`, rightCol + 15, rightY, {
                width: colWidth - 15,
                lineGap: 2,
              });

            rightY +=
              doc.heightOfString(`• ${achievement}`, {
                width: colWidth - 15,
                lineGap: 2,
              }) + 2;
          });
        }

        rightY += 10;

        // Check for page break
        if (rightY > 720) {
          doc.addPage();
          rightY = 50;
          leftY = 50;
        }
      });
    }

    // Education
    if (education && education.length > 0) {
      if (rightY > 650) {
        doc.addPage();
        rightY = 50;
        leftY = 50;
      }

      doc
        .fillColor(this.colors.secondary)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("EDUCATION", rightCol, rightY);

      doc
        .moveTo(rightCol, rightY + 16)
        .lineTo(rightCol + colWidth, rightY + 16)
        .stroke(this.colors.primary);

      rightY += 26;

      education.forEach((edu) => {
        // Degree
        doc
          .fillColor(this.colors.secondary)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(edu.degree, rightCol, rightY);

        // Institution and date
        const dateStr = `${this.formatDate(edu.startDate)} - ${edu.current ? "Present" : this.formatDate(edu.endDate)}`;
        doc
          .fillColor(this.colors.primary)
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(edu.institution, rightCol + 5, rightY + 13);

        doc
          .fillColor(this.colors.textMuted)
          .fontSize(8)
          .font("Helvetica")
          .text(dateStr, rightCol + 130, rightY + 13);

        rightY += 28;

        if (edu.fieldOfStudy) {
          doc
            .fillColor(this.colors.textLight)
            .fontSize(8)
            .font("Helvetica")
            .text(`Field: ${edu.fieldOfStudy}`, rightCol + 10, rightY);
          rightY += 14;
        }

        if (edu.gpa) {
          doc
            .fillColor(this.colors.textLight)
            .fontSize(8)
            .font("Helvetica")
            .text(`GPA: ${edu.gpa}`, rightCol + 10, rightY);
          rightY += 14;
        }

        if (edu.description) {
          doc
            .fillColor(this.colors.text)
            .fontSize(8)
            .font("Helvetica")
            .text(edu.description, rightCol + 10, rightY, {
              width: colWidth - 10,
            });
          rightY +=
            doc.heightOfString(edu.description, {
              width: colWidth - 10,
            }) + 5;
        }

        rightY += 10;
      });
    }

    // Projects
    if (projects && projects.length > 0) {
      if (rightY > 650) {
        doc.addPage();
        rightY = 50;
        leftY = 50;
      }

      doc
        .fillColor(this.colors.secondary)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("PROJECTS", rightCol, rightY);

      doc
        .moveTo(rightCol, rightY + 16)
        .lineTo(rightCol + colWidth, rightY + 16)
        .stroke(this.colors.primary);

      rightY += 26;

      projects.forEach((project) => {
        doc
          .fillColor(this.colors.secondary)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(project.name, rightCol, rightY);

        rightY += 16;

        if (project.description) {
          doc
            .fillColor(this.colors.text)
            .fontSize(8)
            .font("Helvetica")
            .text(project.description, rightCol + 10, rightY, {
              width: colWidth - 10,
              align: "justify",
            });

          rightY +=
            doc.heightOfString(project.description, {
              width: colWidth - 10,
            }) + 5;
        }

        if (project.technologies && project.technologies.length > 0) {
          doc
            .fillColor(this.colors.primary)
            .fontSize(7)
            .font("Helvetica-Bold")
            .text(
              `Tech: ${project.technologies.join(" • ")}`,
              rightCol + 10,
              rightY,
              {
                width: colWidth - 10,
              },
            );
          rightY += 16;
        }

        rightY += 10;
      });
    }
  }

  /**
   * CLASSIC TEMPLATE - Traditional, single-column, elegant
   */
  private generateClassicTemplate(
    doc: PDFKit.PDFDocument,
    resume: ResumeData,
  ): void {
    const {
      personalInfo,
      experience,
      education,
      skills,
      languages,
      certifications,
      projects,
    } = resume;

    // Header - Classic style
    doc.rect(50, 50, 495, 110).fill("#F1F5F9");
    doc.rect(50, 50, 495, 3).fill(this.colors.secondary);

    // Name
    doc
      .fillColor(this.colors.secondary)
      .fontSize(28)
      .font("Helvetica-Bold")
      .text(`${personalInfo.firstName} ${personalInfo.lastName}`, 70, 65);

    // Title
    if (personalInfo.title) {
      doc
        .fillColor(this.colors.textLight)
        .fontSize(13)
        .font("Helvetica")
        .text(personalInfo.title, 70, 100);
    }

    // Contact info
    const contactItems = [];
    if (personalInfo.email) contactItems.push(personalInfo.email);
    if (personalInfo.phone) contactItems.push(personalInfo.phone);
    if (personalInfo.location) contactItems.push(personalInfo.location);
    if (personalInfo.linkedin) contactItems.push(personalInfo.linkedin);

    doc
      .fillColor(this.colors.textMuted)
      .fontSize(8)
      .font("Helvetica")
      .text(contactItems.join("  |  "), 70, 130, {
        width: 455,
        align: "center",
      });

    let y = 180;

    // Summary
    if (personalInfo.summary) {
      doc
        .fillColor(this.colors.secondary)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text("Professional Summary", 50, y);

      doc
        .moveTo(50, y + 18)
        .lineTo(545, y + 18)
        .stroke(this.colors.border);

      y += 28;
      doc
        .fillColor(this.colors.text)
        .fontSize(10)
        .font("Helvetica")
        .text(personalInfo.summary, 50, y, {
          width: 495,
          align: "justify",
          lineGap: 3,
        });

      y +=
        doc.heightOfString(personalInfo.summary, {
          width: 495,
          lineGap: 3,
        }) + 20;
    }

    // Experience
    if (experience && experience.length > 0) {
      doc
        .fillColor(this.colors.secondary)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text("Work Experience", 50, y);

      doc
        .moveTo(50, y + 18)
        .lineTo(545, y + 18)
        .stroke(this.colors.border);

      y += 28;

      experience.forEach((exp) => {
        // Position and company
        doc
          .fillColor(this.colors.secondary)
          .fontSize(11)
          .font("Helvetica-Bold")
          .text(exp.position, 50, y);

        doc
          .fillColor(this.colors.primary)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(exp.company, 50, y + 16);

        const dateStr = `${this.formatDate(exp.startDate)} - ${exp.current ? "Present" : this.formatDate(exp.endDate)}`;
        doc
          .fillColor(this.colors.textMuted)
          .fontSize(9)
          .font("Helvetica")
          .text(dateStr, 300, y + 16);

        y += 32;

        if (exp.description) {
          doc
            .fillColor(this.colors.text)
            .fontSize(9)
            .font("Helvetica")
            .text(exp.description, 55, y, {
              width: 490,
              align: "justify",
              lineGap: 2,
            });

          y +=
            doc.heightOfString(exp.description, {
              width: 490,
              lineGap: 2,
            }) + 5;
        }

        if (exp.achievements && exp.achievements.length > 0) {
          exp.achievements.forEach((achievement) => {
            doc
              .fillColor(this.colors.textLight)
              .fontSize(9)
              .font("Helvetica")
              .text(`• ${achievement}`, 60, y, {
                width: 485,
                lineGap: 2,
              });

            y +=
              doc.heightOfString(`• ${achievement}`, {
                width: 485,
                lineGap: 2,
              }) + 2;
          });
        }

        y += 15;

        if (y > 720) {
          doc.addPage();
          y = 50;
        }
      });
    }

    // Education
    if (education && education.length > 0) {
      if (y > 650) {
        doc.addPage();
        y = 50;
      }

      doc
        .fillColor(this.colors.secondary)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text("Education", 50, y);

      doc
        .moveTo(50, y + 18)
        .lineTo(545, y + 18)
        .stroke(this.colors.border);

      y += 28;

      education.forEach((edu) => {
        doc
          .fillColor(this.colors.secondary)
          .fontSize(11)
          .font("Helvetica-Bold")
          .text(edu.degree, 50, y);

        doc
          .fillColor(this.colors.primary)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(edu.institution, 50, y + 16);

        const dateStr = `${this.formatDate(edu.startDate)} - ${edu.current ? "Present" : this.formatDate(edu.endDate)}`;
        doc
          .fillColor(this.colors.textMuted)
          .fontSize(9)
          .font("Helvetica")
          .text(dateStr, 300, y + 16);

        y += 32;

        if (edu.fieldOfStudy) {
          doc
            .fillColor(this.colors.textLight)
            .fontSize(9)
            .font("Helvetica")
            .text(`Field of Study: ${edu.fieldOfStudy}`, 55, y);
          y += 16;
        }

        if (edu.gpa) {
          doc
            .fillColor(this.colors.textLight)
            .fontSize(9)
            .font("Helvetica")
            .text(`GPA: ${edu.gpa}`, 55, y);
          y += 16;
        }

        if (edu.description) {
          doc
            .fillColor(this.colors.text)
            .fontSize(9)
            .font("Helvetica")
            .text(edu.description, 55, y, {
              width: 490,
            });
          y +=
            doc.heightOfString(edu.description, {
              width: 490,
            }) + 5;
        }

        y += 15;
      });
    }

    // Skills
    if (skills && skills.length > 0) {
      if (y > 650) {
        doc.addPage();
        y = 50;
      }

      doc
        .fillColor(this.colors.secondary)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text("Skills", 50, y);

      doc
        .moveTo(50, y + 18)
        .lineTo(545, y + 18)
        .stroke(this.colors.border);

      y += 28;

      const skillsText = skills.map((s) => s.name).join("  •  ");
      doc
        .fillColor(this.colors.text)
        .fontSize(9)
        .font("Helvetica")
        .text(skillsText, 50, y, {
          width: 495,
          align: "left",
        });

      y += doc.heightOfString(skillsText, { width: 495 }) + 20;
    }

    // Languages
    if (languages && languages.length > 0) {
      doc
        .fillColor(this.colors.secondary)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text("Languages", 50, y);

      doc
        .moveTo(50, y + 18)
        .lineTo(545, y + 18)
        .stroke(this.colors.border);

      y += 28;

      const languagesText = languages
        .map((l) => `${l.name} (${this.getProficiencyLabel(l.proficiency)})`)
        .join("  •  ");
      doc
        .fillColor(this.colors.text)
        .fontSize(9)
        .font("Helvetica")
        .text(languagesText, 50, y, {
          width: 495,
        });
    }
  }

  /**
   * MINIMAL TEMPLATE - Clean, lots of whitespace, modern minimalist
   */
  private generateMinimalTemplate(
    doc: PDFKit.PDFDocument,
    resume: ResumeData,
  ): void {
    const { personalInfo, experience, education, skills, languages } = resume;

    // Clean header - just name and title
    doc
      .fillColor(this.colors.secondary)
      .fontSize(34)
      .font("Helvetica-Light")
      .text(`${personalInfo.firstName} ${personalInfo.lastName}`, 50, 50, {
        align: "center",
      });

    if (personalInfo.title) {
      doc
        .fillColor(this.colors.textLight)
        .fontSize(14)
        .font("Helvetica-Light")
        .text(personalInfo.title, 50, 90, {
          align: "center",
        });
    }

    // Divider
    doc.moveTo(100, 115).lineTo(500, 115).stroke(this.colors.border);

    // Contact
    const contactItems = [];
    if (personalInfo.email) contactItems.push(personalInfo.email);
    if (personalInfo.phone) contactItems.push(personalInfo.phone);
    if (personalInfo.location) contactItems.push(personalInfo.location);

    doc
      .fillColor(this.colors.textMuted)
      .fontSize(9)
      .font("Helvetica")
      .text(contactItems.join("  •  "), 50, 130, {
        align: "center",
        width: 495,
      });

    let y = 170;

    // Summary
    if (personalInfo.summary) {
      doc
        .fillColor(this.colors.text)
        .fontSize(10)
        .font("Helvetica-Light")
        .text(personalInfo.summary, 50, y, {
          align: "center",
          width: 495,
          lineGap: 3,
        });

      y +=
        doc.heightOfString(personalInfo.summary, {
          width: 495,
          lineGap: 3,
        }) + 25;
    }

    // Experience
    if (experience && experience.length > 0) {
      doc
        .fillColor(this.colors.secondary)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("Experience", 50, y);

      y += 20;

      experience.forEach((exp) => {
        doc
          .fillColor(this.colors.secondary)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(exp.position, 50, y);

        const dateStr = `${this.formatDate(exp.startDate)} - ${exp.current ? "Present" : this.formatDate(exp.endDate)}`;
        doc
          .fillColor(this.colors.textMuted)
          .fontSize(8)
          .font("Helvetica")
          .text(`${exp.company}  •  ${dateStr}`, 50, y + 13);

        y += 26;

        if (exp.description) {
          doc
            .fillColor(this.colors.text)
            .fontSize(9)
            .font("Helvetica")
            .text(exp.description, 55, y, {
              width: 490,
              align: "justify",
              lineGap: 2,
            });

          y +=
            doc.heightOfString(exp.description, {
              width: 490,
              lineGap: 2,
            }) + 5;
        }

        y += 15;
      });
    }

    // Education
    if (education && education.length > 0) {
      if (y > 650) {
        doc.addPage();
        y = 50;
      }

      doc
        .fillColor(this.colors.secondary)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("Education", 50, y);

      y += 20;

      education.forEach((edu) => {
        doc
          .fillColor(this.colors.secondary)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(edu.degree, 50, y);

        const dateStr = `${this.formatDate(edu.startDate)} - ${edu.current ? "Present" : this.formatDate(edu.endDate)}`;
        doc
          .fillColor(this.colors.textMuted)
          .fontSize(8)
          .font("Helvetica")
          .text(`${edu.institution}  •  ${dateStr}`, 50, y + 13);

        y += 28;
      });
    }

    // Skills
    if (skills && skills.length > 0) {
      if (y > 650) {
        doc.addPage();
        y = 50;
      }

      doc
        .fillColor(this.colors.secondary)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("Skills", 50, y);

      y += 20;

      const skillsText = skills.map((s) => s.name).join("  •  ");
      doc
        .fillColor(this.colors.text)
        .fontSize(9)
        .font("Helvetica")
        .text(skillsText, 50, y, {
          width: 495,
        });

      y += 20;
    }

    // Languages
    if (languages && languages.length > 0) {
      doc
        .fillColor(this.colors.secondary)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("Languages", 50, y);

      y += 20;

      const languagesText = languages
        .map((l) => `${l.name} (${this.getProficiencyLabel(l.proficiency)})`)
        .join("  •  ");
      doc
        .fillColor(this.colors.text)
        .fontSize(9)
        .font("Helvetica")
        .text(languagesText, 50, y, {
          width: 495,
        });
    }
  }

  /**
   * CREATIVE TEMPLATE - Bold, colorful, modern design with sidebar
   */
  private generateCreativeTemplate(
    doc: PDFKit.PDFDocument,
    resume: ResumeData,
  ): void {
    const {
      personalInfo,
      experience,
      education,
      skills,
      certifications,
      languages,
      projects,
    } = resume;

    // Sidebar
    const sidebarWidth = 160;
    const contentX = 50 + sidebarWidth + 25;
    const contentWidth = 495 - sidebarWidth - 25;

    // Sidebar background
    doc.rect(50, 50, sidebarWidth, 742).fill(this.colors.sidebar);
    doc.rect(50, 50, sidebarWidth, 742).fillOpacity(0.95);

    // Sidebar content
    let sidebarY = 60;

    // Avatar placeholder (initial circle)
    doc.circle(50 + sidebarWidth / 2, 80, 35).fill("#6D28D9");
    doc
      .fillColor(this.colors.white)
      .fontSize(24)
      .font("Helvetica-Bold")
      .text(
        `${personalInfo.firstName[0]}${personalInfo.lastName[0]}`,
        50 + sidebarWidth / 2 - 12,
        70,
        { align: "center", width: 24 },
      );

    sidebarY = 130;

    // Name on sidebar
    doc
      .fillColor(this.colors.white)
      .fontSize(16)
      .font("Helvetica-Bold")
      .text(
        `${personalInfo.firstName} ${personalInfo.lastName}`,
        60,
        sidebarY,
        {
          width: sidebarWidth - 20,
          align: "center",
        },
      );

    sidebarY += 24;
    doc
      .fillColor("#C4B5FD")
      .fontSize(10)
      .font("Helvetica")
      .text(personalInfo.title || "Professional", 60, sidebarY, {
        width: sidebarWidth - 20,
        align: "center",
      });

    sidebarY += 30;

    // Contact on sidebar
    this.renderSidebarSection(doc, "CONTACT", 60, sidebarY);
    sidebarY += 18;

    const contactFields = [
      { icon: "✉", value: personalInfo.email },
      { icon: "📞", value: personalInfo.phone },
      { icon: "📍", value: personalInfo.location },
      { icon: "🔗", value: personalInfo.linkedin },
      { icon: "💻", value: personalInfo.github },
    ];

    for (const field of contactFields) {
      if (field.value) {
        doc
          .fillColor("#DDD6FE")
          .fontSize(8)
          .font("Helvetica")
          .text(`${field.icon} ${field.value}`, 65, sidebarY, {
            width: sidebarWidth - 30,
          });
        sidebarY += 14;
      }
    }

    sidebarY += 10;

    // Skills on sidebar
    if (skills && skills.length > 0) {
      this.renderSidebarSection(doc, "SKILLS", 60, sidebarY);
      sidebarY += 18;

      skills.forEach((skill) => {
        doc
          .fillColor("#DDD6FE")
          .fontSize(8)
          .font("Helvetica")
          .text(`• ${skill.name}`, 65, sidebarY, {
            width: sidebarWidth - 30,
          });
        sidebarY += 13;
      });
      sidebarY += 10;
    }

    // Languages on sidebar
    if (languages && languages.length > 0) {
      this.renderSidebarSection(doc, "LANGUAGES", 60, sidebarY);
      sidebarY += 18;

      languages.forEach((lang) => {
        const stars = this.getProficiencyStars(lang.proficiency);
        doc
          .fillColor("#DDD6FE")
          .fontSize(8)
          .font("Helvetica")
          .text(`${lang.name} ${stars}`, 65, sidebarY, {
            width: sidebarWidth - 30,
          });
        sidebarY += 13;
      });
      sidebarY += 10;
    }

    // Certifications on sidebar
    if (certifications && certifications.length > 0) {
      this.renderSidebarSection(doc, "CERTIFICATIONS", 60, sidebarY);
      sidebarY += 18;

      certifications.forEach((cert) => {
        doc
          .fillColor("#DDD6FE")
          .fontSize(8)
          .font("Helvetica")
          .text(`• ${cert.name}`, 65, sidebarY, {
            width: sidebarWidth - 30,
          });
        sidebarY += 13;
        doc
          .fillColor("#A78BFA")
          .fontSize(7)
          .font("Helvetica")
          .text(cert.issuer, 70, sidebarY, {
            width: sidebarWidth - 35,
          });
        sidebarY += 13;
      });
    }

    // MAIN CONTENT
    let y = 60;

    // Summary
    if (personalInfo.summary) {
      doc
        .fillColor(this.colors.secondary)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text("About Me", contentX, y);

      y += 18;
      doc
        .fillColor(this.colors.text)
        .fontSize(9)
        .font("Helvetica")
        .text(personalInfo.summary, contentX, y, {
          width: contentWidth,
          align: "justify",
          lineGap: 3,
        });

      y +=
        doc.heightOfString(personalInfo.summary, {
          width: contentWidth,
          lineGap: 3,
        }) + 20;
    }

    // Experience
    if (experience && experience.length > 0) {
      doc
        .fillColor(this.colors.secondary)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text("Experience", contentX, y);

      y += 18;

      experience.forEach((exp) => {
        // Colored accent line
        doc.rect(contentX, y, 4, 14).fill(this.colors.primary);

        doc
          .fillColor(this.colors.secondary)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(exp.position, contentX + 12, y);

        const dateStr = `${this.formatDate(exp.startDate)} - ${exp.current ? "Present" : this.formatDate(exp.endDate)}`;
        doc
          .fillColor(this.colors.primary)
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(exp.company, contentX + 12, y + 14);

        doc
          .fillColor(this.colors.textMuted)
          .fontSize(8)
          .font("Helvetica")
          .text(dateStr, contentX + 150, y + 14);

        y += 30;

        if (exp.description) {
          doc
            .fillColor(this.colors.text)
            .fontSize(8)
            .font("Helvetica")
            .text(exp.description, contentX + 17, y, {
              width: contentWidth - 17,
              align: "justify",
              lineGap: 2,
            });

          y +=
            doc.heightOfString(exp.description, {
              width: contentWidth - 17,
              lineGap: 2,
            }) + 5;
        }

        if (exp.achievements && exp.achievements.length > 0) {
          exp.achievements.forEach((achievement) => {
            doc
              .fillColor(this.colors.textLight)
              .fontSize(8)
              .font("Helvetica")
              .text(`• ${achievement}`, contentX + 22, y, {
                width: contentWidth - 22,
                lineGap: 2,
              });

            y +=
              doc.heightOfString(`• ${achievement}`, {
                width: contentWidth - 22,
                lineGap: 2,
              }) + 2;
          });
        }

        y += 15;

        if (y > 720) {
          doc.addPage();
          y = 50;
          // Re-draw sidebar on new page
          doc.rect(50, 50, sidebarWidth, 742).fill(this.colors.sidebar);
          doc.rect(50, 50, sidebarWidth, 742).fillOpacity(0.95);
        }
      });
    }

    // Education
    if (education && education.length > 0) {
      if (y > 650) {
        doc.addPage();
        y = 50;
        doc.rect(50, 50, sidebarWidth, 742).fill(this.colors.sidebar);
        doc.rect(50, 50, sidebarWidth, 742).fillOpacity(0.95);
      }

      doc
        .fillColor(this.colors.secondary)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text("Education", contentX, y);

      y += 18;

      education.forEach((edu) => {
        doc.rect(contentX, y, 4, 14).fill(this.colors.primary);

        doc
          .fillColor(this.colors.secondary)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(edu.degree, contentX + 12, y);

        const dateStr = `${this.formatDate(edu.startDate)} - ${edu.current ? "Present" : this.formatDate(edu.endDate)}`;
        doc
          .fillColor(this.colors.primary)
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(edu.institution, contentX + 12, y + 14);

        doc
          .fillColor(this.colors.textMuted)
          .fontSize(8)
          .font("Helvetica")
          .text(dateStr, contentX + 160, y + 14);

        y += 30;

        if (edu.fieldOfStudy) {
          doc
            .fillColor(this.colors.textLight)
            .fontSize(8)
            .font("Helvetica")
            .text(`Field: ${edu.fieldOfStudy}`, contentX + 17, y);
          y += 14;
        }

        if (edu.gpa) {
          doc
            .fillColor(this.colors.textLight)
            .fontSize(8)
            .font("Helvetica")
            .text(`GPA: ${edu.gpa}`, contentX + 17, y);
          y += 14;
        }

        y += 15;
      });
    }

    // Projects
    if (projects && projects.length > 0) {
      if (y > 650) {
        doc.addPage();
        y = 50;
        doc.rect(50, 50, sidebarWidth, 742).fill(this.colors.sidebar);
        doc.rect(50, 50, sidebarWidth, 742).fillOpacity(0.95);
      }

      doc
        .fillColor(this.colors.secondary)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text("Projects", contentX, y);

      y += 18;

      projects.forEach((project) => {
        doc.rect(contentX, y, 4, 14).fill(this.colors.primary);

        doc
          .fillColor(this.colors.secondary)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(project.name, contentX + 12, y);

        y += 18;

        if (project.description) {
          doc
            .fillColor(this.colors.text)
            .fontSize(8)
            .font("Helvetica")
            .text(project.description, contentX + 17, y, {
              width: contentWidth - 17,
              align: "justify",
            });

          y +=
            doc.heightOfString(project.description, {
              width: contentWidth - 17,
            }) + 5;
        }

        if (project.technologies && project.technologies.length > 0) {
          doc
            .fillColor(this.colors.primary)
            .fontSize(7)
            .font("Helvetica-Bold")
            .text(
              `Tech: ${project.technologies.join(" • ")}`,
              contentX + 17,
              y,
              {
                width: contentWidth - 17,
              },
            );
          y += 16;
        }

        y += 15;
      });
    }
  }
}

export default new PDFService();