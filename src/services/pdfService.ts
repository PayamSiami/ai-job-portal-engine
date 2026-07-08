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
    startDate: Date;
    endDate?: Date;
    current: boolean;
    description?: string;
    achievements?: string[];
  }>;
  education: Array<{
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
    name: string;
    level?: "beginner" | "intermediate" | "advanced" | "expert";
    category?: string;
  }>;
  certifications: Array<{
    name: string;
    issuer: string;
    date: Date;
    expiryDate?: Date;
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
    startDate?: Date;
    endDate?: Date;
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

  constructor() {
    this.fontsPath = path.join(__dirname, "../../src/assets/fonts");
    this.storagePath = path.join(__dirname, "../../uploads/resumes");

    // Ensure directories exist
    if (!fs.existsSync(this.fontsPath)) {
      fs.mkdirSync(this.fontsPath, { recursive: true });
    }
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  /**
   * Convert Mongoose resume document to ResumeData
   */
  private convertToResumeData(resume: any): ResumeData {
    return {
      id: resume._id?.toString(),
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
      experience:
        resume.experience?.map((exp: any) => ({
          company: exp.company || "",
          position: exp.position || "",
          location: exp.location || "",
          startDate: exp.startDate || new Date(),
          endDate: exp.endDate,
          current: exp.current || false,
          description: exp.description || "",
          achievements: exp.achievements || [],
        })) || [],
      education:
        resume.education?.map((edu: any) => ({
          institution: edu.institution || "",
          degree: edu.degree || "",
          fieldOfStudy: edu.fieldOfStudy || "",
          location: edu.location || "",
          startDate: edu.startDate || new Date(),
          endDate: edu.endDate,
          current: edu.current || false,
          description: edu.description || "",
          gpa: edu.gpa,
        })) || [],
      skills:
        resume.skills?.map((skill: any) => ({
          name: skill.name || "",
          level: skill.level || "intermediate",
          category: skill.category || "",
        })) || [],
      certifications:
        resume.certifications?.map((cert: any) => ({
          name: cert.name || "",
          issuer: cert.issuer || "",
          date: cert.date || new Date(),
          expiryDate: cert.expiryDate,
          credentialId: cert.credentialId || "",
          url: cert.url || "",
        })) || [],
      languages:
        resume.languages?.map((lang: any) => ({
          name: lang.name || "",
          proficiency: lang.proficiency || "professional",
        })) || [],
      projects:
        resume.projects?.map((project: any) => ({
          name: project.name || "",
          description: project.description || "",
          url: project.url || "",
          technologies: project.technologies || [],
          startDate: project.startDate,
          endDate: project.endDate,
        })) || [],
      template: resume.template || "modern",
      visibility: resume.visibility || "private",
      status: resume.status || "draft",
      isDefault: resume.isDefault || false,
    };
  }

  /**
   * Generate a PDF resume - accepts Mongoose document or ResumeData
   */
  private async generateResumePDF(
    resume: any,
    template: string = "modern",
  ): Promise<Buffer> {
    const resumeData = resume._id
      ? this.convertToResumeData(resume)
      : (resume as ResumeData);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margin: 50,
          info: {
            Title: `Resume - ${resumeData.personalInfo.firstName} ${resumeData.personalInfo.lastName}`,
            Author:
              resumeData.personalInfo.firstName +
              " " +
              resumeData.personalInfo.lastName,
          },
        });

        const chunks: Buffer[] = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));

        // Generate based on template
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

        doc.end();
      } catch (error) {
        logger.error("Failed to generate PDF:", error);
        reject(error);
      }
    });
  }

  /**
   * Generate and save PDF to disk
   */
  /**
   * Generate and save PDF to disk
   */
  async generateAndSavePDF(
    resume: any,
    template: string = "modern",
  ): Promise<SaveResult> {
    try {
      // Generate PDF buffer
      const pdfBuffer = await this.generateResumePDF(resume, template);

      // Generate filename with timestamp
      const timestamp = Date.now();
      const resumeId = resume._id || resume.id || "unknown";
      const filename = `resume-${resumeId}-${timestamp}.pdf`;
      const filePath = path.join(this.storagePath, filename);

      // Ensure directory exists (in case it was deleted)
      if (!fs.existsSync(this.storagePath)) {
        fs.mkdirSync(this.storagePath, { recursive: true });
      }

      // Write file to disk synchronously
      fs.writeFileSync(filePath, pdfBuffer);

      // Get file stats
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
   * Get PDF file path by resume ID
   */
  getPDFPath(resumeId: string): string | null {
    try {
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
   * Delete PDF file
   */
  deletePDF(resumeId: string): boolean {
    try {
      const files = fs.readdirSync(this.storagePath);
      const pdfFile = files.find(
        (file) => file.includes(resumeId) && file.endsWith(".pdf"),
      );

      if (pdfFile) {
        const filePath = path.join(this.storagePath, pdfFile);
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
   * Modern Template - Clean and professional with blue gradient header
   */
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

    // Header - Blue gradient effect
    doc.rect(50, 50, 495, 120).fill("#1e40af");

    // Name
    doc
      .fillColor("#ffffff")
      .fontSize(28)
      .font("Helvetica-Bold")
      .text(`${personalInfo.firstName} ${personalInfo.lastName}`, 70, 65);

    // Title
    doc
      .fontSize(16)
      .font("Helvetica")
      .text(personalInfo.title || "Professional", 70, 100);

    // Contact info
    doc.fontSize(10).fillColor("#93c5fd");

    let contactY = 130;
    const contactX = 70;
    const contactSpacing = 15;

    if (personalInfo.email) {
      doc.text(`✉ ${personalInfo.email}`, contactX, contactY);
      contactY += contactSpacing;
    }
    if (personalInfo.phone) {
      doc.text(`📞 ${personalInfo.phone}`, contactX, contactY);
      contactY += contactSpacing;
    }
    if (personalInfo.location) {
      doc.text(`📍 ${personalInfo.location}`, contactX, contactY);
      contactY += contactSpacing;
    }

    let y = 190;

    // Summary
    if (personalInfo.summary) {
      doc
        .fillColor("#1f2937")
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Professional Summary", 50, y);

      y += 20;
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#4b5563")
        .text(personalInfo.summary, 50, y, {
          width: 495,
          align: "left",
        });

      y += doc.heightOfString(personalInfo.summary, { width: 495 }) + 15;
    }

    // Two-column layout
    const leftColX = 50;
    const rightColX = 280;
    const colWidth = 200;

    // Left Column - Skills, Languages, Certifications
    let leftY = y;

    // Skills
    if (skills && skills.length > 0) {
      doc
        .fillColor("#1f2937")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Skills", leftColX, leftY);

      leftY += 18;
      skills.forEach((skill) => {
        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#4b5563")
          .text(
            `• ${skill.name}${skill.level ? ` (${skill.level})` : ""}`,
            leftColX + 5,
            leftY,
          );
        leftY += 16;
      });
      leftY += 10;
    }

    // Languages
    if (languages && languages.length > 0) {
      doc
        .fillColor("#1f2937")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Languages", leftColX, leftY);

      leftY += 18;
      languages.forEach((lang) => {
        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#4b5563")
          .text(`• ${lang.name} - ${lang.proficiency}`, leftColX + 5, leftY);
        leftY += 16;
      });
      leftY += 10;
    }

    // Certifications
    if (certifications && certifications.length > 0) {
      doc
        .fillColor("#1f2937")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Certifications", leftColX, leftY);

      leftY += 18;
      certifications.forEach((cert) => {
        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#4b5563")
          .text(`• ${cert.name}`, leftColX + 5, leftY);
        leftY += 14;
        doc
          .fontSize(8)
          .fillColor("#9ca3af")
          .text(`  ${cert.issuer}`, leftColX + 5, leftY);
        leftY += 18;
      });
    }

    // Right Column - Experience, Education, Projects
    let rightY = y;

    // Experience
    if (experience && experience.length > 0) {
      doc
        .fillColor("#1f2937")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Experience", rightColX, rightY);

      rightY += 18;
      experience.forEach((exp) => {
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#1f2937")
          .text(exp.position, rightColX, rightY);

        rightY += 14;
        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#6b7280")
          .text(`${exp.company}`, rightColX, rightY);

        rightY += 12;
        const dateStr = `${new Date(exp.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })} - ${exp.current ? "Present" : new Date(exp.endDate!).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
        doc.fontSize(8).fillColor("#9ca3af").text(dateStr, rightColX, rightY);

        rightY += 14;
        if (exp.description) {
          doc
            .fontSize(9)
            .font("Helvetica")
            .fillColor("#4b5563")
            .text(exp.description, rightColX, rightY, {
              width: colWidth,
            });
          rightY +=
            doc.heightOfString(exp.description, { width: colWidth }) + 5;
        }
        rightY += 5;
      });
    }

    // Education
    if (education && education.length > 0) {
      if (rightY > y + 100) {
        rightY = y + 100;
      }

      doc
        .fillColor("#1f2937")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Education", rightColX, rightY);

      rightY += 18;
      education.forEach((edu) => {
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#1f2937")
          .text(edu.degree, rightColX, rightY);

        rightY += 14;
        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#6b7280")
          .text(edu.institution, rightColX, rightY);

        rightY += 12;
        const dateStr = `${new Date(edu.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })} - ${edu.current ? "Present" : new Date(edu.endDate!).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
        doc.fontSize(8).fillColor("#9ca3af").text(dateStr, rightColX, rightY);

        rightY += 16;
      });
    }

    // Projects
    if (projects && projects.length > 0) {
      if (rightY > y + 100) {
        rightY = y + 100;
      }

      doc
        .fillColor("#1f2937")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Projects", rightColX, rightY);

      rightY += 18;
      projects.forEach((project) => {
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#1f2937")
          .text(project.name, rightColX, rightY);

        rightY += 14;
        if (project.description) {
          doc
            .fontSize(9)
            .font("Helvetica")
            .fillColor("#4b5563")
            .text(project.description, rightColX, rightY, {
              width: colWidth,
            });
          rightY +=
            doc.heightOfString(project.description, { width: colWidth }) + 5;
        }
        if (project.technologies && project.technologies.length > 0) {
          doc
            .fontSize(8)
            .fillColor("#9ca3af")
            .text(
              `Tech: ${project.technologies.join(", ")}`,
              rightColX,
              rightY,
            );
          rightY += 16;
        }
        rightY += 5;
      });
    }
  }

  /**
   * Classic Template - Traditional single-column layout
   */
  private generateClassicTemplate(
    doc: PDFKit.PDFDocument,
    resume: ResumeData,
  ): void {
    const { personalInfo, experience, education, skills, languages } = resume;

    // Header - Classic style
    doc.rect(50, 50, 495, 100).fill("#f3f4f6");

    // Name
    doc
      .fillColor("#111827")
      .fontSize(26)
      .font("Helvetica-Bold")
      .text(`${personalInfo.firstName} ${personalInfo.lastName}`, 70, 65);

    // Title
    doc
      .fontSize(14)
      .font("Helvetica")
      .fillColor("#4b5563")
      .text(personalInfo.title || "Professional", 70, 100);

    // Contact info - centered line
    const contactY = 125;
    const contactX = 70;
    let contactText = "";
    if (personalInfo.email) contactText += personalInfo.email;
    if (personalInfo.phone) contactText += ` • ${personalInfo.phone}`;
    if (personalInfo.location) contactText += ` • ${personalInfo.location}`;

    doc.fontSize(9).fillColor("#6b7280").text(contactText, contactX, contactY, {
      width: 455,
      align: "center",
    });

    let y = 175;

    // Summary
    if (personalInfo.summary) {
      doc
        .fillColor("#111827")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Professional Summary", 50, y);

      y += 16;
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#4b5563")
        .text(personalInfo.summary, 50, y, {
          width: 495,
        });

      y += doc.heightOfString(personalInfo.summary, { width: 495 }) + 15;
    }

    // Experience
    if (experience && experience.length > 0) {
      doc
        .fillColor("#111827")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Experience", 50, y);

      y += 16;
      experience.forEach((exp) => {
        // Company and position
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor("#1f2937")
          .text(exp.position, 50, y);

        const dateStr = `${new Date(exp.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })} - ${exp.current ? "Present" : new Date(exp.endDate!).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#6b7280")
          .text(`${exp.company} • ${dateStr}`, 50, y + 14);

        y += 28;
        if (exp.description) {
          doc
            .fontSize(9)
            .font("Helvetica")
            .fillColor("#4b5563")
            .text(exp.description, 55, y, {
              width: 490,
            });
          y += doc.heightOfString(exp.description, { width: 490 }) + 5;
        }
        if (exp.achievements && exp.achievements.length > 0) {
          exp.achievements.forEach((achievement) => {
            doc
              .fontSize(9)
              .fillColor("#4b5563")
              .text(`• ${achievement}`, 60, y, {
                width: 485,
              });
            y += doc.heightOfString(achievement, { width: 485 }) + 3;
          });
        }
        y += 10;
      });
    }

    // Education
    if (education && education.length > 0) {
      doc
        .fillColor("#111827")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Education", 50, y);

      y += 16;
      education.forEach((edu) => {
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor("#1f2937")
          .text(edu.degree, 50, y);

        const dateStr = `${new Date(edu.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })} - ${edu.current ? "Present" : new Date(edu.endDate!).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#6b7280")
          .text(`${edu.institution} • ${dateStr}`, 50, y + 14);

        y += 28;
        if (edu.fieldOfStudy) {
          doc
            .fontSize(9)
            .fillColor("#4b5563")
            .text(`Field: ${edu.fieldOfStudy}`, 55, y);
          y += 14;
        }
        if (edu.gpa) {
          doc.fontSize(9).fillColor("#4b5563").text(`GPA: ${edu.gpa}`, 55, y);
          y += 16;
        }
        y += 5;
      });
    }

    // Skills
    if (skills && skills.length > 0) {
      doc
        .fillColor("#111827")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Skills", 50, y);

      y += 16;
      const skillsText = skills.map((s) => s.name).join(", ");
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#4b5563")
        .text(skillsText, 50, y, {
          width: 495,
        });

      y += doc.heightOfString(skillsText, { width: 495 }) + 15;
    }

    // Languages
    if (languages && languages.length > 0) {
      doc
        .fillColor("#111827")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Languages", 50, y);

      y += 16;
      const languagesText = languages
        .map((l) => `${l.name} (${l.proficiency})`)
        .join(", ");
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#4b5563")
        .text(languagesText, 50, y, {
          width: 495,
        });
    }
  }

  /**
   * Minimal Template - Clean whitespace, no decorations
   */
  private generateMinimalTemplate(
    doc: PDFKit.PDFDocument,
    resume: ResumeData,
  ): void {
    const { personalInfo, experience, education, skills, languages } = resume;

    // Simple header
    doc
      .fillColor("#111827")
      .fontSize(30)
      .font("Helvetica-Light")
      .text(`${personalInfo.firstName} ${personalInfo.lastName}`, 50, 50, {
        align: "center",
      });

    doc
      .fontSize(14)
      .font("Helvetica")
      .fillColor("#6b7280")
      .text(personalInfo.title || "Professional", 50, 85, {
        align: "center",
      });

    // Divider
    doc.moveTo(50, 105).lineTo(545, 105).stroke("#e5e7eb");

    // Contact
    let contactY = 120;
    let contactText = "";
    if (personalInfo.email) contactText += personalInfo.email;
    if (personalInfo.phone) contactText += `  •  ${personalInfo.phone}`;
    if (personalInfo.location) contactText += `  •  ${personalInfo.location}`;

    doc.fontSize(9).fillColor("#9ca3af").text(contactText, 50, contactY, {
      align: "center",
      width: 495,
    });

    let y = 155;

    // Summary
    if (personalInfo.summary) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#4b5563")
        .text(personalInfo.summary, 50, y, {
          align: "center",
          width: 495,
        });
      y += doc.heightOfString(personalInfo.summary, { width: 495 }) + 20;
    }

    // Sections with minimal styling
    const renderSection = (
      title: string,
      content: any[],
      renderItem: (item: any, y: number) => number,
    ) => {
      if (!content || content.length === 0) return y;

      doc
        .fillColor("#111827")
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(title, 50, y);

      y += 14;
      content.forEach((item) => {
        y = renderItem(item, y);
      });
      y += 10;
      return y;
    };

    // Experience
    y = renderSection("Experience", experience, (exp, y) => {
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor("#1f2937")
        .text(exp.position, 50, y);

      const dateStr = `${new Date(exp.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })} - ${exp.current ? "Present" : new Date(exp.endDate!).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#9ca3af")
        .text(`${exp.company}  •  ${dateStr}`, 50, y + 12);

      y += 24;
      if (exp.description) {
        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor("#4b5563")
          .text(exp.description, 55, y, {
            width: 490,
          });
        y += doc.heightOfString(exp.description, { width: 490 }) + 5;
      }
      y += 10;
      return y;
    });

    // Education
    y = renderSection("Education", education, (edu, y) => {
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor("#1f2937")
        .text(edu.degree, 50, y);

      const dateStr = `${new Date(edu.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })} - ${edu.current ? "Present" : new Date(edu.endDate!).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#9ca3af")
        .text(`${edu.institution}  •  ${dateStr}`, 50, y + 12);

      y += 26;
      return y;
    });

    // Skills
    y = renderSection("Skills", skills, (skill, y) => {
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#4b5563")
        .text(
          `• ${skill.name}${skill.level ? ` (${skill.level})` : ""}`,
          55,
          y,
        );
      y += 16;
      return y;
    });

    // Languages
    y = renderSection("Languages", languages, (lang, y) => {
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#4b5563")
        .text(`• ${lang.name} - ${lang.proficiency}`, 55, y);
      y += 16;
      return y;
    });
  }

  /**
   * Creative Template - Bold & graphic-heavy layout
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

    // Left sidebar - Colorful
    const sidebarWidth = 150;
    const contentX = 50 + sidebarWidth + 30;
    const contentWidth = 495 - sidebarWidth - 30;

    // Sidebar background
    doc.rect(50, 50, sidebarWidth, 742).fill("#7c3aed");
    doc.rect(50, 50, sidebarWidth, 742).fillOpacity(0.9);

    // Name on sidebar
    doc
      .fillColor("#ffffff")
      .fontSize(18)
      .font("Helvetica-Bold")
      .text(`${personalInfo.firstName} ${personalInfo.lastName}`, 60, 70, {
        width: 130,
        align: "center",
      });

    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#c4b5fd")
      .text(personalInfo.title || "Professional", 60, 105, {
        width: 130,
        align: "center",
      });

    let sidebarY = 140;

    // Contact on sidebar
    doc
      .fillColor("#f3e8ff")
      .fontSize(8)
      .font("Helvetica-Bold")
      .text("CONTACT", 60, sidebarY);

    sidebarY += 14;
    doc.fontSize(8).font("Helvetica").fillColor("#d8b4fe");

    if (personalInfo.email) {
      doc.text(personalInfo.email, 60, sidebarY, { width: 130 });
      sidebarY += 14;
    }
    if (personalInfo.phone) {
      doc.text(personalInfo.phone, 60, sidebarY, { width: 130 });
      sidebarY += 14;
    }
    if (personalInfo.location) {
      doc.text(personalInfo.location, 60, sidebarY, { width: 130 });
      sidebarY += 14;
    }
    sidebarY += 10;

    // Skills on sidebar
    if (skills && skills.length > 0) {
      doc
        .fillColor("#f3e8ff")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("SKILLS", 60, sidebarY);

      sidebarY += 14;
      skills.forEach((skill) => {
        doc
          .fontSize(7)
          .font("Helvetica")
          .fillColor("#d8b4fe")
          .text(`• ${skill.name}`, 60, sidebarY, { width: 130 });
        sidebarY += 12;
      });
      sidebarY += 10;
    }

    // Languages on sidebar
    if (languages && languages.length > 0) {
      doc
        .fillColor("#f3e8ff")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("LANGUAGES", 60, sidebarY);

      sidebarY += 14;
      languages.forEach((lang) => {
        doc
          .fontSize(7)
          .font("Helvetica")
          .fillColor("#d8b4fe")
          .text(`${lang.name} - ${lang.proficiency}`, 60, sidebarY, {
            width: 130,
          });
        sidebarY += 12;
      });
      sidebarY += 10;
    }

    // Certifications on sidebar
    if (certifications && certifications.length > 0) {
      doc
        .fillColor("#f3e8ff")
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("CERTIFICATIONS", 60, sidebarY);

      sidebarY += 14;
      certifications.forEach((cert) => {
        doc
          .fontSize(7)
          .font("Helvetica")
          .fillColor("#d8b4fe")
          .text(`• ${cert.name}`, 60, sidebarY, { width: 130 });
        sidebarY += 12;
      });
    }

    // Main content
    let y = 70;

    // Summary
    if (personalInfo.summary) {
      doc
        .fillColor("#1f2937")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("About Me", contentX, y);

      y += 16;
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#4b5563")
        .text(personalInfo.summary, contentX, y, {
          width: contentWidth,
        });

      y +=
        doc.heightOfString(personalInfo.summary, { width: contentWidth }) + 20;
    }

    // Experience
    if (experience && experience.length > 0) {
      doc
        .fillColor("#1f2937")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Experience", contentX, y);

      y += 16;
      experience.forEach((exp) => {
        // Colored line
        doc.rect(contentX, y, 3, 12).fill("#7c3aed");

        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#1f2937")
          .text(exp.position, contentX + 10, y);

        const dateStr = `${new Date(exp.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })} - ${exp.current ? "Present" : new Date(exp.endDate!).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#9ca3af")
          .text(`${exp.company}  •  ${dateStr}`, contentX + 10, y + 12);

        y += 26;
        if (exp.description) {
          doc
            .fontSize(9)
            .font("Helvetica")
            .fillColor("#4b5563")
            .text(exp.description, contentX + 15, y, {
              width: contentWidth - 15,
            });
          y +=
            doc.heightOfString(exp.description, { width: contentWidth - 15 }) +
            5;
        }
        y += 10;
      });
    }

    // Education
    if (education && education.length > 0) {
      doc
        .fillColor("#1f2937")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Education", contentX, y);

      y += 16;
      education.forEach((edu) => {
        doc.rect(contentX, y, 3, 12).fill("#7c3aed");

        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#1f2937")
          .text(edu.degree, contentX + 10, y);

        const dateStr = `${new Date(edu.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })} - ${edu.current ? "Present" : new Date(edu.endDate!).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#9ca3af")
          .text(`${edu.institution}  •  ${dateStr}`, contentX + 10, y + 12);

        y += 28;
      });
    }

    // Projects
    if (projects && projects.length > 0) {
      doc
        .fillColor("#1f2937")
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Projects", contentX, y);

      y += 16;
      projects.forEach((project) => {
        doc.rect(contentX, y, 3, 12).fill("#7c3aed");

        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#1f2937")
          .text(project.name, contentX + 10, y);

        y += 16;
        if (project.description) {
          doc
            .fontSize(9)
            .font("Helvetica")
            .fillColor("#4b5563")
            .text(project.description, contentX + 15, y, {
              width: contentWidth - 15,
            });
          y +=
            doc.heightOfString(project.description, {
              width: contentWidth - 15,
            }) + 5;
        }
        if (project.technologies && project.technologies.length > 0) {
          doc
            .fontSize(8)
            .fillColor("#9ca3af")
            .text(`Tech: ${project.technologies.join(", ")}`, contentX + 15, y);
          y += 16;
        }
        y += 5;
      });
    }
  }
}

export default new PDFService();
