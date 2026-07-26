/**
 * Validation for creating a resume
 */
export declare const createResumeValidation: import("express-validator").ValidationChain[];
/**
 * Validation for updating a resume
 */
export declare const updateResumeValidation: import("express-validator").ValidationChain[];
/**
 * Validation for getting a single resume
 */
export declare const getResumeValidation: import("express-validator").ValidationChain[];
/**
 * Validation for duplicating a resume
 */
export declare const duplicateResumeValidation: import("express-validator").ValidationChain[];
/**
 * Validation for deleting a resume
 */
export declare const deleteResumeValidation: import("express-validator").ValidationChain[];
/**
 * Validation for setting default resume
 */
export declare const setDefaultResumeValidation: import("express-validator").ValidationChain[];
/**
 * Validation for downloading PDF
 */
export declare const downloadPDFValidation: import("express-validator").ValidationChain[];
/**
 * Validation for exporting resume
 */
export declare const exportResumeValidation: import("express-validator").ValidationChain[];
/**
 * Validation for analyzing a resume
 */
export declare const analyzeResumeValidation: import("express-validator").ValidationChain[];
/**
 * Validation for generating a cover letter
 */
export declare const generateCoverLetterValidation: import("express-validator").ValidationChain[];
/**
 * Validation for getting career feedback
 */
export declare const careerFeedbackValidation: import("express-validator").ValidationChain[];
/**
 * Validation for getting job matches
 */
export declare const jobMatchesValidation: import("express-validator").ValidationChain[];
/**
 * Validation for getting improvement suggestions
 */
export declare const improvementSuggestionsValidation: import("express-validator").ValidationChain[];
/**
 * Validation for bulk delete
 */
export declare const bulkDeleteValidation: import("express-validator").ValidationChain[];
export declare const resumeValidations: {
    create: import("express-validator").ValidationChain[];
    update: import("express-validator").ValidationChain[];
    get: import("express-validator").ValidationChain[];
    delete: import("express-validator").ValidationChain[];
    duplicate: import("express-validator").ValidationChain[];
    setDefault: import("express-validator").ValidationChain[];
    downloadPDF: import("express-validator").ValidationChain[];
    export: import("express-validator").ValidationChain[];
    analyze: import("express-validator").ValidationChain[];
    coverLetter: import("express-validator").ValidationChain[];
    careerFeedback: import("express-validator").ValidationChain[];
    jobMatches: import("express-validator").ValidationChain[];
    improvements: import("express-validator").ValidationChain[];
    bulkDelete: import("express-validator").ValidationChain[];
};
//# sourceMappingURL=resume.validator.d.ts.map