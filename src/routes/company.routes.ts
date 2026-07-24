import express from "express";
import multer from "multer";

import { CompanyController } from "../controllers/company.controller.js";
import { authorize, protect } from "../middleware/authMiddleware.js";

const router = express.Router();
const companyController = new CompanyController();

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/companies/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

// All routes require authentication
router.use(protect);

// Company CRUD
router.post("/", authorize("employer"), companyController.createCompany);

router.get("/", companyController.getCompany);
router.get("/check", companyController.checkCompany);

router.put("/", authorize("employer"), companyController.updateCompany);

router.post(
  "/upload-logo",
  upload.single("logo"),
  companyController.uploadLogo,
);
router.delete("/company", protect, companyController.deleteCompany);

export default router;
