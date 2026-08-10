// src/controllers/index.ts
// Barrel export for all controllers
export { default as ApplicationController } from "./application.controller";
export { default as CandidateController } from "./candidate.controller";
export { CompanyController } from "./company.controller";
export { default as DashboardController } from "./dashboardController";
export { default as GoogleAuthController } from "./googleAuth.controller";
export { default as JobController } from "./job.controller";
export { default as ResumeController } from "./resume.controller";
export { default as ActivityController } from "./activity.controller";
export { asyncHandler } from "./base.controller";