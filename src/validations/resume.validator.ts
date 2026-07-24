import { body, param, query } from "express-validator";

/**
 * Validation for creating a resume
 */
export const createResumeValidation = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 100 })
    .withMessage("Title must be less than 100 characters"),
  
  body("template")
    .optional()
    .isIn(["modern", "classic", "minimal", "creative"])
    .withMessage("Invalid template type. Must be one of: modern, classic, minimal, creative"),
  
  body("visibility")
    .optional()
    .isIn(["private", "public", "shared"])
    .withMessage("Invalid visibility option. Must be one of: private, public, shared"),
  
  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage("isDefault must be a boolean"),
  
  body("personalInfo")
    .optional()
    .isObject()
    .withMessage("Personal info must be an object"),
  
  body("experience")
    .optional()
    .isArray()
    .withMessage("Experience must be an array"),
  
  body("education")
    .optional()
    .isArray()
    .withMessage("Education must be an array"),
  
  body("skills")
    .optional()
    .isArray()
    .withMessage("Skills must be an array"),
  
  body("certifications")
    .optional()
    .isArray()
    .withMessage("Certifications must be an array"),
  
  body("languages")
    .optional()
    .isArray()
    .withMessage("Languages must be an array"),
  
  body("projects")
    .optional()
    .isArray()
    .withMessage("Projects must be an array"),
];

/**
 * Validation for updating a resume
 */
export const updateResumeValidation = [
  param("id")
    .notEmpty()
    .withMessage("Resume ID is required")
    .isMongoId()
    .withMessage("Invalid resume ID format"),
  
  body("title")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Title must be less than 100 characters"),
  
  body("status")
    .optional()
    .isIn(["draft", "active", "archived"])
    .withMessage("Invalid status. Must be one of: draft, active, archived"),
  
  body("template")
    .optional()
    .isIn(["modern", "classic", "minimal", "creative"])
    .withMessage("Invalid template type"),
  
  body("visibility")
    .optional()
    .isIn(["private", "public", "shared"])
    .withMessage("Invalid visibility option"),
  
  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage("isDefault must be a boolean"),
];

/**
 * Validation for getting a single resume
 */
export const getResumeValidation = [
  param("id")
    .notEmpty()
    .withMessage("Resume ID is required")
    .isMongoId()
    .withMessage("Invalid resume ID format"),
];

/**
 * Validation for duplicating a resume
 */
export const duplicateResumeValidation = [
  param("id")
    .notEmpty()
    .withMessage("Resume ID is required")
    .isMongoId()
    .withMessage("Invalid resume ID format"),
];

/**
 * Validation for deleting a resume
 */
export const deleteResumeValidation = [
  param("id")
    .notEmpty()
    .withMessage("Resume ID is required")
    .isMongoId()
    .withMessage("Invalid resume ID format"),
];

/**
 * Validation for setting default resume
 */
export const setDefaultResumeValidation = [
  param("id")
    .notEmpty()
    .withMessage("Resume ID is required")
    .isMongoId()
    .withMessage("Invalid resume ID format"),
];

/**
 * Validation for downloading PDF
 */
export const downloadPDFValidation = [
  param("id")
    .notEmpty()
    .withMessage("Resume ID is required")
    .isMongoId()
    .withMessage("Invalid resume ID format"),
];

/**
 * Validation for exporting resume
 */
export const exportResumeValidation = [
  param("id")
    .notEmpty()
    .withMessage("Resume ID is required")
    .isMongoId()
    .withMessage("Invalid resume ID format"),
  
  query("format")
    .optional()
    .isIn(["json", "pdf"])
    .withMessage("Invalid export format. Must be one of: json, pdf"),
];

// ============================================
// AI Feature Validations
// ============================================

/**
 * Validation for analyzing a resume
 */
export const analyzeResumeValidation = [
  param("id")
    .notEmpty()
    .withMessage("Resume ID is required")
    .isMongoId()
    .withMessage("Invalid resume ID format"),
  
  query("jobId")
    .optional()
    .isMongoId()
    .withMessage("Invalid job ID format"),
  
  body("jobId")
    .optional()
    .isMongoId()
    .withMessage("Invalid job ID format"),
];

/**
 * Validation for generating a cover letter
 */
export const generateCoverLetterValidation = [
  param("id")
    .notEmpty()
    .withMessage("Resume ID is required")
    .isMongoId()
    .withMessage("Invalid resume ID format"),
  
  body("jobId")
    .notEmpty()
    .withMessage("Job ID is required")
    .isMongoId()
    .withMessage("Invalid job ID format"),
  
  body("tone")
    .optional()
    .isIn(["professional", "enthusiastic", "confident", "creative"])
    .withMessage("Invalid tone option. Must be one of: professional, enthusiastic, confident, creative"),
  
  body("length")
    .optional()
    .isIn(["short", "medium", "long"])
    .withMessage("Invalid length option. Must be one of: short, medium, long"),
  
  body("includeContactInfo")
    .optional()
    .isBoolean()
    .withMessage("includeContactInfo must be a boolean"),
  
  body("highlightSkills")
    .optional()
    .isBoolean()
    .withMessage("highlightSkills must be a boolean"),
];

/**
 * Validation for getting career feedback
 */
export const careerFeedbackValidation = [
  param("id")
    .notEmpty()
    .withMessage("Resume ID is required")
    .isMongoId()
    .withMessage("Invalid resume ID format"),
  
  query("focus")
    .optional()
    .isString()
    .withMessage("Focus must be a string"),
];

/**
 * Validation for getting job matches
 */
export const jobMatchesValidation = [
  param("id")
    .notEmpty()
    .withMessage("Resume ID is required")
    .isMongoId()
    .withMessage("Invalid resume ID format"),
  
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  
  query("minMatchScore")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("Minimum match score must be between 0 and 100"),
];

/**
 * Validation for getting improvement suggestions
 */
export const improvementSuggestionsValidation = [
  param("id")
    .notEmpty()
    .withMessage("Resume ID is required")
    .isMongoId()
    .withMessage("Invalid resume ID format"),
];

/**
 * Validation for bulk delete
 */
export const bulkDeleteValidation = [
  body("resumeIds")
    .isArray({ min: 1, max: 50 })
    .withMessage("resumeIds must be an array with at least 1 and at most 50 items"),
  
  body("resumeIds.*")
    .isMongoId()
    .withMessage("Each resume ID must be a valid MongoDB ID"),
];

// ============================================
// Combined Exports for Convenience
// ============================================

export const resumeValidations = {
  create: createResumeValidation,
  update: updateResumeValidation,
  get: getResumeValidation,
  delete: deleteResumeValidation,
  duplicate: duplicateResumeValidation,
  setDefault: setDefaultResumeValidation,
  downloadPDF: downloadPDFValidation,
  export: exportResumeValidation,
  analyze: analyzeResumeValidation,
  coverLetter: generateCoverLetterValidation,
  careerFeedback: careerFeedbackValidation,
  jobMatches: jobMatchesValidation,
  improvements: improvementSuggestionsValidation,
  bulkDelete: bulkDeleteValidation,
};