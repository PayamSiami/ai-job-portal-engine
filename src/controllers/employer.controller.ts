// backend/src/controllers/employer.controller.ts
import { Request, Response } from "express";
import { CandidateService } from "../services/candidate.service.js";
import { CompanyService } from "../services/company.service.js";
import { AppError } from "../utils/errorHandler.js";
import { catchAsync } from "../utils/catchAsync.js";
import { Parser } from "json2csv";

const candidateService = new CandidateService();
const companyService = new CompanyService();

export class EmployerController {
  // ==================== CANDIDATE CONTROLLERS ====================

  getCandidates = catchAsync(async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      skills,
      experienceMin,
      experienceMax,
      location,
      availability,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const employerId = (req as any).user?.id;

    const filters: any = {
      search,
      status,
      skills: skills ? (skills as string).split(",") : undefined,
      experienceMin: experienceMin
        ? parseInt(experienceMin as string)
        : undefined,
      experienceMax: experienceMax
        ? parseInt(experienceMax as string)
        : undefined,
      location,
      availability,
    };

    Object.keys(filters).forEach(
      (key) => filters[key] === undefined && delete filters[key],
    );

    const result = await candidateService.getCandidates(employerId, filters, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sortBy: sortBy as string,
      sortOrder: sortOrder as string,
    });

    res.status(200).json({
      success: true,
      data: result.candidates,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: result.total,
        totalPages: Math.ceil(result.total / parseInt(limit as string)),
      },
      meta: { filters, sortBy, sortOrder },
    });
  });

  // backend/src/controllers/employer.controller.ts

  /**
   * GET /api/employer/candidates/recommendations
   * Get AI-powered candidate recommendations
   */
  getCandidateRecommendations = catchAsync(
    async (req: Request, res: Response) => {
      const employerId = (req as any).user?.id;
      const {
        jobId,
        limit = 10,
        minScore = 60,
        skills,
        experienceMin,
        experienceMax,
      } = req.query;

      if (!employerId) {
        throw new AppError("Unauthorized - Employer ID not found", 401);
      }

      let skillsArray: string[] = [];
      if (skills) {
        if (Array.isArray(skills)) {
          skillsArray = skills as string[];
        } else if (typeof skills === "string") {
          skillsArray = (skills as string)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }

      const recommendations =
        await candidateService.getCandidateRecommendations(employerId, {
          jobId: jobId as string,
          limit: parseInt(limit as string),
          minScore: parseInt(minScore as string),
          skills: skillsArray,
          experienceMin: experienceMin
            ? parseInt(experienceMin as string)
            : undefined,
          experienceMax: experienceMax
            ? parseInt(experienceMax as string)
            : undefined,
        });

      res.status(200).json({
        success: true,
        data: recommendations,
        message:
          recommendations.length > 0
            ? `Found ${recommendations.length} recommended candidates`
            : "No recommendations found",
      });
    },
  );

  getCandidateById = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const employerId = (req as any).user?.id;

    const candidate = await candidateService.getCandidateById(
      String(id),
      employerId,
    );

    if (!candidate) {
      throw new AppError("Candidate not found or access denied", 404);
    }

    res.status(200).json({
      success: true,
      data: candidate,
    });
  });

  /**
   * Get shortlisted candidates
   */
  getShortlistedCandidates = catchAsync(async (req: Request, res: Response) => {
    try {
      const employerId = (req as any).user?.id;

      const {
        page = 1,
        limit = 10,
        search = "",
        jobId,
        sortBy = "updatedAt",
        sortOrder = "desc",
      } = req.query;

      const result = await candidateService.getShortlistedCandidates(
        employerId,
        {
          page: Number(page),
          limit: Number(limit),
          search: search as string,
          jobId: jobId as string,
          sortBy: sortBy as string,
          sortOrder: sortOrder as "asc" | "desc",
        },
      );

      res.status(200).json({
        success: true,
        data: result.candidates,
        total: result.total,
        summary: result.summary,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: result.total,
          totalPages: Math.ceil(result.total / Number(limit)),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch shortlisted candidates",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Get shortlisted applications
   */
  getShortlistedApplications = catchAsync(
    async (req: Request, res: Response) => {
      try {
        const employerId = (req as any).user?.id;

        const {
          page = 1,
          limit = 10,
          search = "",
          jobId,
          status,
          stage,
          sortBy = "updatedAt",
          sortOrder = "desc",
          startDate,
          endDate,
        } = req.query;

        // ✅ Call the service
        const result = await candidateService.getShortlistedApplications(
          employerId,
          {
            page: Number(page),
            limit: Number(limit),
            search: search as string,
            jobId: jobId as string,
            status: status as string,
            stage: stage as string,
            sortBy: sortBy as string,
            sortOrder: sortOrder as "asc" | "desc",
            startDate: startDate as string,
            endDate: endDate as string,
          },
        );

        res.status(200).json({
          success: true,
          data: result.applications,
          total: result.total,
          summary: result.summary,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: result.total,
            totalPages: Math.ceil(result.total / Number(limit)),
          },
        });
      } catch (error) {
        console.error("❌ Error in getShortlistedApplications:", error);
        res.status(500).json({
          success: false,
          message: "Failed to fetch shortlisted applications",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  getCandidateStats = catchAsync(async (req: Request, res: Response) => {
    try {
      const employerId = (req as any).user?.id;

      // ✅ Call the service
      const stats = await candidateService.getCandidateStats(employerId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error in getCandidateStats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch candidate statistics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Get resume for a shortlisted candidate
   */
  getShortlistedCandidateResume = catchAsync(
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const employerId = (req as any).user?.id;

        const { format = "pdf" } = req.query;

        const result = await candidateService.getShortlistedCandidateResume(
          String(id),
          employerId,
          format as "pdf" | "json" | "url",
        );

        if (!result) {
          return res.status(404).json({
            success: false,
            message: "Resume not found or candidate is not shortlisted",
          });
        }

        // If format is URL, return the URL
        if (format === "url") {
          return res.status(200).json({
            success: true,
            data: {
              url: result.url,
              metadata: result.metadata,
            },
          });
        }

        // If format is JSON, return the JSON data
        if (format === "json") {
          return res.status(200).json({
            success: true,
            data: {
              resume: result.resume,
              metadata: result.metadata,
            },
          });
        }

        // Default: Return PDF file
        if (result.content) {
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `inline; filename="${result.fileName}"`,
          );
          return res.send(result.content);
        }

        // If we have a URL and format is pdf, redirect or return URL
        if (result.url) {
          return res.status(200).json({
            success: true,
            data: {
              url: result.url,
              metadata: result.metadata,
            },
          });
        }

        return res.status(404).json({
          success: false,
          message: "No resume file available",
        });
      } catch (error) {
        console.error("❌ Error in getShortlistedCandidateResume:", error);
        res.status(500).json({
          success: false,
          message: "Failed to fetch candidate resume",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  updateCandidateStatus = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, notes } = req.body;
    const employerId = (req as any).user?.id;

    // Validate employerId
    if (!employerId) {
      throw new AppError("Unauthorized - Employer ID not found", 401);
    }

    // Validate id
    if (!id) {
      throw new AppError("Candidate ID is required", 400);
    }

    // Validate status
    const validStatuses = [
      "pending",
      "reviewed",
      "shortlisting",
      "shortlisted",
      "interviewing",
      "interviewed",
      "rejected",
      "hired",
    ];

    if (!validStatuses.includes(status)) {
      throw new AppError(
        `Invalid status value. Must be one of: ${validStatuses.join(", ")}`,
        400,
      );
    }

    console.log(`📊 Updating candidate ${id} to status: ${status}`);

    const updated = await candidateService.updateCandidateStatus(
      String(id),
      employerId,
      status,
      notes,
    );

    if (!updated) {
      throw new AppError("Candidate not found or access denied", 404);
    }

    res.status(200).json({
      success: true,
      data: updated,
      message: `Candidate status updated to ${status}`,
    });
  });

  getCandidateResume = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const employerId = (req as any).user?.id;

    const resume = await candidateService.getCandidateResume(
      String(id),
      employerId,
    );

    if (!resume) {
      throw new AppError("Resume not found or access denied", 404);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="candidate-${id}-resume.pdf"`,
    );
    res.send(resume);
  });

  getCandidateAnalytics = catchAsync(async (req: Request, res: Response) => {
    const employerId = (req as any).user?.id;

    const analytics = await candidateService.getAnalytics(employerId);

    res.status(200).json({
      success: true,
      data: analytics,
    });
  });

  exportCandidates = catchAsync(async (req: Request, res: Response) => {
    const { format = "csv" } = req.query;
    const employerId = (req as any).user?.id;

    const candidates = await candidateService.exportCandidates(employerId);

    if (format === "csv") {
      const fields = [
        "name",
        "email",
        "phone",
        "position",
        "status",
        "experience",
        "skills",
        "location",
        "appliedDate",
      ];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(candidates);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=candidates.csv",
      );
      res.send(csv);
    } else if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=candidates.json",
      );
      res.json(candidates);
    } else {
      throw new AppError("Unsupported export format. Use csv or json", 400);
    }
  });

  addCandidateNote = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { note } = req.body;
    const employerId = (req as any).user?.id;

    if (!note) {
      throw new AppError("Note content is required", 400);
    }

    const updated = await candidateService.addCandidateNote(
      String(id),
      employerId,
      note,
    );

    if (!updated) {
      throw new AppError("Candidate not found or access denied", 404);
    }

    res.status(200).json({
      success: true,
      message: "Note added successfully",
      data: updated,
    });
  });

  getCandidateTimeline = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const employerId = (req as any).user?.id;

    const timeline = await candidateService.getCandidateTimeline(
      String(id),
      employerId,
    );

    if (!timeline) {
      throw new AppError("Candidate not found or access denied", 404);
    }

    res.status(200).json({
      success: true,
      data: timeline,
    });
  });

  // ==================== JOB CONTROLLERS ====================

  getEmployerJobs = catchAsync(async (req: Request, res: Response) => {
    const employerId = (req as any).user?.id;
    const { page = 1, limit = 10, status } = req.query;

    const result = await companyService.getCompanyJobs(
      employerId,
      parseInt(page as string),
      parseInt(limit as string),
      status as string,
    );

    res.status(200).json({
      success: true,
      data: result.jobs,
      pagination: result.pagination,
    });
  });

  getJobApplications = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const employerId = (req as any).user?.id;
    const { page = 1, limit = 10, status } = req.query;

    const result = await candidateService.getJobApplications(
      String(id),
      employerId,
      parseInt(page as string),
      parseInt(limit as string),
      status as string,
    );

    res.status(200).json({
      success: true,
      data: result.applications,
      pagination: result.pagination,
    });
  });

  getJobStats = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const employerId = (req as any).user?.id;

    const stats = await candidateService.getJobStats(String(id), employerId);

    if (!stats) {
      throw new AppError("Job not found or access denied", 404);
    }

    res.status(200).json({
      success: true,
      data: stats,
    });
  });
}
