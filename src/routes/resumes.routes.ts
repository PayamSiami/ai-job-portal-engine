// src/routes/resume.routes.ts
import express, { Request, Response, Router } from "express";
import resumeService from "../services/resumeService.js";
import resumeAnalyzerService from "../services/ai/resumeAnalyzer.js";
import coverLetterGeneratorService from "../services/ai/coverLetterGenerator.js";
import jobMatchRecommenderService from "../services/ai/jobMatchRecommender.js";
import jobService from "../services/jobService.js";
import { protect } from "../middleware/authMiddleware.js";
import { getStringParam, getUserId } from "../utils/routeHelpers.js";

const router: Router = express.Router();

// Get user's resumes
router.get("/", protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const resumes = await resumeService.getResumesByUser(userId);
    res.json(resumes);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch resumes";
    res.status(500).json({ error: errorMessage });
  }
});

// // Create resume
router.post(
  "/",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const resume = await resumeService.createResume(userId, req.body);
      res.status(201).json(resume);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create resume";
      res.status(400).json({ error: errorMessage });
    }
  },
);

// // Get single resume
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

      const resumeId = getStringParam(req.params.id);
      if (!resumeId) {
        res.status(400).json({ error: "Invalid resume ID" });
        return;
      }

      const resume = await resumeService.getResumeById(resumeId);

      if (!resume) {
        res.status(404).json({ error: "Resume not found" });
        return;
      }

      if (resume.userId.toString() !== userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      res.json(resume);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch resume";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// // AI resume analyzer
// router.get(
//   "/:id/analyze",
//   protect,
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       const userId = getUserId(req);

//       if (!userId) {
//         res.status(401).json({ error: "User not authenticated" });
//         return;
//       }

//       const resumeId = getStringParam(req.params.id);
//       if (!resumeId) {
//         res.status(400).json({ error: "Invalid resume ID" });
//         return;
//       }

//       const resume = await resumeService.getResumeById(resumeId);

//       if (!resume) {
//         res.status(404).json({ error: "Resume not found" });
//         return;
//       }

//       if (resume.userId.toString() !== userId) {
//         res.status(403).json({ error: "Access denied" });
//         return;
//       }

//       // Get a sample job to analyze against
//       const sampleJob = await jobService.getSampleJob();

//       if (!sampleJob) {
//         res.status(404).json({ error: "No jobs available for analysis" });
//         return;
//       }

//       const analysis = await resumeAnalyzerService.analyzeResumeVsJob(
//         resume.content,
//         sampleJob.requirements || "",
//         sampleJob.description || "",
//       );

//       res.json({
//         resume: {
//           id: resume._id,
//           title: resume.title,
//         },
//         job: {
//           id: sampleJob._id,
//           title: sampleJob.title,
//           company: sampleJob.company,
//         },
//         analysis,
//       });
//     } catch (error) {
//       const errorMessage =
//         error instanceof Error ? error.message : "Analysis failed";
//       res.status(500).json({ error: errorMessage });
//     }
//   },
// );

// // AI cover letter generator
// router.post(
//   "/:id/generate-cover-letter",
//   protect,
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       const userId = getUserId(req);
//       const { jobId } = req.body;

//       if (!userId) {
//         res.status(401).json({ error: "User not authenticated" });
//         return;
//       }

//       if (!jobId) {
//         res.status(400).json({ error: "Job ID is required" });
//         return;
//       }

//       const resumeId = getStringParam(req.params.id);
//       if (!resumeId) {
//         res.status(400).json({ error: "Invalid resume ID" });
//         return;
//       }

//       const resume = await resumeService.getResumeById(resumeId);
//       const job = await jobService.getJobById(jobId);

//       if (!resume || !job) {
//         res.status(404).json({ error: "Resume or job not found" });
//         return;
//       }

//       if (resume.userId.toString() !== userId) {
//         res.status(403).json({ error: "Access denied" });
//         return;
//       }

//       const coverLetter = await coverLetterGeneratorService.generateCoverLetter(
//         {
//           title: job.title || "",
//           company: job.company || "",
//           location: job.location || "",
//           requirements: job.requirements || "",
//           description: job.description || "",
//         },
//         resume.content,
//       );

//       res.json({ coverLetter });
//     } catch (error) {
//       const errorMessage =
//         error instanceof Error
//           ? error.message
//           : "Failed to generate cover letter";
//       res.status(500).json({ error: errorMessage });
//     }
//   },
// );

// // AI career feedback
// router.get(
//   "/:id/career-feedback",
//   protect,
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       const userId = getUserId(req);

//       if (!userId) {
//         res.status(401).json({ error: "User not authenticated" });
//         return;
//       }

//       const resumeId = getStringParam(req.params.id);
//       if (!resumeId) {
//         res.status(400).json({ error: "Invalid resume ID" });
//         return;
//       }

//       const resume = await resumeService.getResumeById(resumeId);

//       if (!resume) {
//         res.status(404).json({ error: "Resume not found" });
//         return;
//       }

//       if (resume.userId.toString() !== userId) {
//         res.status(403).json({ error: "Access denied" });
//         return;
//       }

//       const feedback = await resumeAnalyzerService.generateCareerFeedback(
//         resume.content,
//       );

//       res.json({ feedback });
//     } catch (error) {
//       const errorMessage =
//         error instanceof Error ? error.message : "Failed to generate feedback";
//       res.status(500).json({ error: errorMessage });
//     }
//   },
// );

// const mapIJobToJob = (job: any) => ({
//   id: job._id?.toString(),
//   title: job.title || "",
//   company: job.company || "",
//   location: job.location || "",
//   workMode: job.workMode || "remote", // Provide default
//   minSalary: job.minSalary,
//   maxSalary: job.maxSalary,
//   requirements: job.requirements || "",
//   description: job.description || "",
//   postedDate: job.createdAt?.toISOString(),
//   department: job.department,
//   employmentType: job.jobType || "full-time",
//   benefits: job.benefits?.split(",").map((b: string) => b.trim()) || [],
//   skills: job.skills || [],
//   industry: job.industry,
//   companySize: job.companySize,
// });

// // AI job match recommendations
// router.get(
//   "/:id/job-matches",
//   protect,
//   async (req: Request, res: Response): Promise<void> => {
//     try {
//       const userId = getUserId(req);

//       if (!userId) {
//         res.status(401).json({ error: "User not authenticated" });
//         return;
//       }

//       const resumeId = getStringParam(req.params.id);
//       if (!resumeId) {
//         res.status(400).json({ error: "Invalid resume ID" });
//         return;
//       }

//       const resume = await resumeService.getResumeById(resumeId);

//       if (!resume) {
//         res.status(404).json({ error: "Resume not found" });
//         return;
//       }

//       if (resume.userId.toString() !== userId) {
//         res.status(403).json({ error: "Access denied" });
//         return;
//       }

//       // Get all active jobs
//       const jobs = await jobService.getActiveJobs();

//       // ✅ Map IJob[] to Job[]
//       const mappedJobs = jobs.map(mapIJobToJob);

//       const matches = await jobMatchRecommenderService.getJobMatches(
//         resume.content,
//         mappedJobs,
//       );

//       res.json({ matches });
//     } catch (error) {
//       const errorMessage =
//         error instanceof Error ? error.message : "Failed to find job matches";
//       res.status(500).json({ error: errorMessage });
//     }
//   },
// );

export default router;
