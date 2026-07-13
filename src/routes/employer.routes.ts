// backend/src/routes/employer.routes.ts
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import { EmployerController } from "../controllers/employer.controller.js";
import { CompanyController } from "../controllers/company.controller.js";
import { authorize, protect } from "../middleware/authMiddleware.js";
import { DashboardController } from "../controllers/dashboardController.js";

const router = express.Router();

// ==================== MULTER CONFIGURATION ====================
const uploadDir = "uploads/companies/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "logo-" + uniqueSuffix + ext);
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, GIF, and WEBP images are allowed"), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
});

// ==================== MIDDLEWARE ====================
router.use(protect);
router.use(authorize("employer"));

// ==================== CONTROLLERS ====================
const employerController = new EmployerController();
const dashboardController = new DashboardController();
const companyController = new CompanyController();

// ==================== COMPANY ROUTES ====================
router.post("/company", companyController.createCompany);
router.get("/company", companyController.getCompany);
router.get("/company/check", companyController.checkCompany);
router.put("/company", companyController.updateCompany);
router.delete("/company", companyController.deleteCompany);
router.post(
  "/company/upload-logo",
  upload.single("logo"),
  companyController.uploadLogo,
);
router.get("/company/stats", companyController.getCompanyStats);

// ==================== DASHBOARD ROUTES ====================
router.get("/dashboard/stats", dashboardController.getStats);
router.get("/dashboard/ai-screening", dashboardController.getAIScreeningData);
router.get("/dashboard/recent-activity", dashboardController.getRecentActivity);
router.get(
  "/dashboard/application-stats",
  dashboardController.getApplicationStats,
);
router.get("/dashboard/job-performance", dashboardController.getJobPerformance);
router.get("/dashboard/top-candidates", dashboardController.getTopCandidates);
router.get(
  "/dashboard/application-timeline",
  dashboardController.getApplicationTimeline,
);
router.get(
  "/dashboard/skill-distribution",
  dashboardController.getSkillDistribution,
);
router.get(
  "/dashboard/status-breakdown",
  dashboardController.getStatusBreakdown,
);
router.get("/dashboard/export", dashboardController.exportDashboard);

// ==================== CANDIDATE ROUTES ====================
router.get("/candidates", employerController.getCandidates);
router.get("/candidates/stats", employerController.getCandidateStats);
router.get("/candidates/recommendations", employerController.getCandidateRecommendations);
router.get(
  "/candidates/shortlisted",
  employerController.getShortlistedCandidates,
);
router.get(
  "/candidates/shortlisted/applications",
  employerController.getShortlistedApplications,
);
router.get("/candidates/analytics", employerController.getCandidateAnalytics);
router.get("/candidates/shortlisted/resume", employerController.getShortlistedCandidateResume);
router.get("/candidates/export", employerController.exportCandidates);
router.get("/candidates/:id", employerController.getCandidateById);
router.patch(
  "/candidates/:id/status",
  employerController.updateCandidateStatus,
);
router.get("/candidates/:id/resume", employerController.getCandidateResume);
router.post("/candidates/:id/note", employerController.addCandidateNote);
router.get("/candidates/:id/timeline", employerController.getCandidateTimeline);

// ==================== JOB ROUTES ====================
router.get("/jobs", employerController.getEmployerJobs);
router.get("/jobs/:id/applications", employerController.getJobApplications);
router.get("/jobs/:id/stats", employerController.getJobStats);

export default router;
