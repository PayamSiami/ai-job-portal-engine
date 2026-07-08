import express, { Request, Response, Router } from "express";
import applicationService from "../services/applicationService.js";
import applicationScreeningService from "../services/ai/applicationScreening.js";
import jobService from "../services/jobService.js";
import resumeService from "../services/resumeService.js";
import { protect } from "../middleware/authMiddleware.js";
import logger from "../utils/logger.js";

const router: Router = express.Router();

// ✅ Helper to safely get string parameter
const getStringParam = (param: string | string[] | undefined): string => {
  if (!param) return "";
  if (Array.isArray(param)) return param[0] || "";
  return param;
};

// ✅ Helper to get user ID from request
const getUserId = (req: Request): string | null => {
  const user = (req as any).user;
  if (!user) return null;
  return user.id?.toString() || null;
};

// ✅ Helper to map job to job details
const mapJobToJobDetails = (job: any) => ({
  title: job.title || "",
  company: job.company || "",
  location: job.location || "",
  requirements: job.requirements || "",
  description: job.description || "",
  minSalary: job.minSalary,
  maxSalary: job.maxSalary,
  benefits: job.benefits,
  department: job.department,
  employmentType: job.employmentType,
  experienceLevel: job.experienceLevel,
});

// ✅ Helper to build resume content from structured data
const buildResumeContent = (resume: any): string => {
  const parts: string[] = [];

  // Personal Info
  const { personalInfo } = resume;
  if (personalInfo) {
    if (personalInfo.firstName || personalInfo.lastName) {
      parts.push(`Name: ${personalInfo.firstName || ""} ${personalInfo.lastName || ""}`);
    }
    if (personalInfo.email) parts.push(`Email: ${personalInfo.email}`);
    if (personalInfo.phone) parts.push(`Phone: ${personalInfo.phone}`);
    if (personalInfo.location) parts.push(`Location: ${personalInfo.location}`);
    if (personalInfo.title) parts.push(`Title: ${personalInfo.title}`);
    if (personalInfo.summary) parts.push(`Summary: ${personalInfo.summary}`);
  }

  // Experience
  if (resume.experience && resume.experience.length > 0) {
    parts.push("\nExperience:");
    resume.experience.forEach((exp: any) => {
      parts.push(`- ${exp.position} at ${exp.company}`);
      if (exp.location) parts.push(`  Location: ${exp.location}`);
      const startDate = exp.startDate ? new Date(exp.startDate).toLocaleDateString() : '';
      const endDate = exp.current ? 'Present' : (exp.endDate ? new Date(exp.endDate).toLocaleDateString() : '');
      if (startDate || endDate) {
        parts.push(`  ${startDate} - ${endDate}`);
      }
      if (exp.description) parts.push(`  ${exp.description}`);
      if (exp.achievements && exp.achievements.length > 0) {
        exp.achievements.forEach((ach: string) => parts.push(`  • ${ach}`));
      }
    });
  }

  // Education
  if (resume.education && resume.education.length > 0) {
    parts.push("\nEducation:");
    resume.education.forEach((edu: any) => {
      parts.push(`- ${edu.degree} from ${edu.institution}`);
      if (edu.fieldOfStudy) parts.push(`  ${edu.fieldOfStudy}`);
      const startDate = edu.startDate ? new Date(edu.startDate).toLocaleDateString() : '';
      const endDate = edu.current ? 'Present' : (edu.endDate ? new Date(edu.endDate).toLocaleDateString() : '');
      if (startDate || endDate) {
        parts.push(`  ${startDate} - ${endDate}`);
      }
      if (edu.gpa) parts.push(`  GPA: ${edu.gpa}`);
    });
  }

  // Skills
  if (resume.skills && resume.skills.length > 0) {
    parts.push("\nSkills:");
    resume.skills.forEach((skill: any) => {
      const level = skill.level ? ` (${skill.level})` : '';
      parts.push(`- ${skill.name}${level}`);
    });
  }

  // Certifications
  if (resume.certifications && resume.certifications.length > 0) {
    parts.push("\nCertifications:");
    resume.certifications.forEach((cert: any) => {
      parts.push(`- ${cert.name} - ${cert.issuer}`);
      if (cert.date) {
        parts.push(`  Date: ${new Date(cert.date).toLocaleDateString()}`);
      }
    });
  }

  // Languages
  if (resume.languages && resume.languages.length > 0) {
    parts.push("\nLanguages:");
    resume.languages.forEach((lang: any) => {
      parts.push(`- ${lang.name} (${lang.proficiency || "professional"})`);
    });
  }

  // Projects
  if (resume.projects && resume.projects.length > 0) {
    parts.push("\nProjects:");
    resume.projects.forEach((project: any) => {
      parts.push(`- ${project.name}`);
      if (project.description) parts.push(`  ${project.description}`);
      if (project.technologies && project.technologies.length > 0) {
        parts.push(`  Technologies: ${project.technologies.join(", ")}`);
      }
      if (project.url) parts.push(`  URL: ${project.url}`);
    });
  }

  return parts.join("\n");
};

/**
 * @swagger
 * /api/applications:
 *   post:
 *     summary: Apply for a job with AI screening
 *     tags: [Applications, AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateApplicationRequest'
 *     responses:
 *       201:
 *         description: Application created with AI screening
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Application'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to create application
 */
router.post(
  "/",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { jobId, resumeId, coverLetter, expectedSalary, availableFrom } =
        req.body;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      // Validate required fields
      if (!jobId) {
        res.status(400).json({ error: "Job ID is required" });
        return;
      }
      if (!resumeId) {
        res.status(400).json({ error: "Resume ID is required" });
        return;
      }
      if (!coverLetter || coverLetter.length < 50) {
        res
          .status(400)
          .json({ error: "Cover letter must be at least 50 characters" });
        return;
      }

      // Get the resume by ID with user validation
      const resume = await resumeService.getResume(resumeId, userId);
      if (!resume) {
        res.status(404).json({ error: "Resume not found" });
        return;
      }

      // Get the job
      const job = await jobService.getJobById(jobId);
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }

      // Create the application
      const application = await applicationService.createApplication({
        jobId,
        applicantId: userId,
        resumeId,
        coverLetter,
        expectedSalary,
        availableFrom,
      });

      // ✅ Check if application was created successfully
      if (!application || !application._id) {
        logger.error("Application creation failed - no _id returned");
        res.status(500).json({ error: "Failed to create application" });
        return;
      }

      // Build content from structured resume data
      const resumeContent = buildResumeContent(resume);

      // Run AI screening
      try {
        const jobDetails = {
          title: job.title || "",
          company: job.company || "",
          location: job.location || "",
          requirements: job.requirements || "",
          description: job.description || "",
          workMode: job.workMode || "on-site",
          employmentType: job.jobType || "full-time",
          experienceLevel: job.experienceLevel || "mid",
          minSalary: job.minSalary || 0,
          maxSalary: job.maxSalary || 0,
          skills: job.skills || [],
        };

        const screeningResult =
          await applicationScreeningService.screenApplication(
            resumeContent,
            {
              expectedSalary,
              availableFrom,
              coverLetter,
            },
            jobDetails,
          );

        // ✅ Use the application _id safely
        const applicationId = application._id.toString();
        
        // Update application with AI results
        await applicationService.updateApplication(applicationId, {
          aiScore: screeningResult.score,
          aiExplanation: screeningResult.explanation,
          aiStrengths: screeningResult.strengths,
          aiWeaknesses: screeningResult.weaknesses,
          aiRecommendation: screeningResult.recommendation,
        });

        // Get updated application
        const updatedApplication = await applicationService.getApplicationById(
          applicationId,
        );
        
        res.status(201).json({
          success: true,
          data: updatedApplication || application,
          message: "Application submitted with AI screening",
        });
        return;
      } catch (aiError) {
        logger.error("AI screening failed:", aiError);
        // Return application without AI screening
        res.status(201).json({
          success: true,
          data: application,
          message:
            "Application submitted successfully (AI screening unavailable)",
        });
        return;
      }
    } catch (error) {
      logger.error("Error creating application:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create application";
      res.status(500).json({ error: errorMessage });
    }
  },
);

/**
 * @swagger
 * /api/applications:
 *   get:
 *     summary: Get current user's applications
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's applications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Application'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const applications =
      await applicationService.getApplicationsByApplicant(userId);
    res.json(applications);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch applications";
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * @swagger
 * /api/applications/{id}:
 *   get:
 *     summary: Get application details (applicant or employer)
 *     tags: [Applications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Application'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Application not found
 *       500:
 *         description: Server error
 */
router.get(
  "/:id",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const applicationId = getStringParam(req.params.id);

      if (!applicationId) {
        res.status(400).json({ error: "Invalid application ID" });
        return;
      }

      const application =
        await applicationService.getApplicationById(applicationId);

      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      // Convert ObjectId to string for comparison
      const app = application as any;
      const isApplicant = app.applicantId?.toString() === userId;
      const isEmployer = app.job?.postedBy?.toString() === userId;

      if (!isApplicant && !isEmployer) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      res.json(application);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch application";
      res.status(500).json({ error: errorMessage });
    }
  },
);

export default router;