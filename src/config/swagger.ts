import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { config } from "./index.js";

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AI Job Portal API",
      version: "1.0.0",
      description: "AI-powered Job Portal API with authentication, job management, applications, resumes, and AI-powered features",
      contact: {
        name: "AI Job Portal Team",
        email: "support@aijobportal.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: `http://localhost:${config.PORT || 3000}/api`,
        description: "Development server",
      },
      {
        url: `https://api.aijobportal.com/api`,
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter JWT token in format: Bearer <token>",
        },
      },
      schemas: {
        // Auth schemas
        RegisterRequest: {
          type: "object",
          required: ["username", "email", "password"],
          properties: {
            username: {
              type: "string",
              minLength: 3,
              maxLength: 30,
              pattern: "^[a-zA-Z0-zzA-Z0-9_]+$",
              description: "Username (alphanumeric and underscore only)",
            },
            email: {
              type: "string",
              format: "email",
              description: "Valid email address",
            },
            password: {
              type: "string",
              minLength: 6,
              maxLength: 128,
              description: "Password (min 6 characters)",
            },
            role: {
              type: "string",
              enum: ["job_seeker", "employer"],
              default: "job_seeker",
              description: "User role",
            },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
            },
            password: {
              type: "string",
            },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                id: { type: "string" },
                username: { type: "string" },
                email: { type: "string" },
                role: { type: "string", enum: ["job_seeker", "employer", "admin"] },
              },
            },
            token: {
              type: "string",
              description: "JWT token for authentication",
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string" },
            details: { type: "object" },
          },
        },
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", default: true },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
        // User schemas
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            username: { type: "string" },
            email: { type: "string" },
            role: { type: "string", enum: ["job_seeker", "employer", "admin"] },
            isActive: { type: "boolean" },
            profile: {
              type: "object",
              properties: {
                firstName: { type: "string" },
                lastName: { type: "string" },
                headline: { type: "string" },
                bio: { type: "string" },
                location: { type: "string" },
                website: { type: "string" },
                linkedin: { type: "string" },
                github: { type: "string" },
                avatar: { type: "string" },
                skills: { type: "array", items: { type: "string" } },
                experience: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      company: { type: "string" },
                      role: { type: "string" },
                      startDate: { type: "string", format: "date" },
                      endDate: { type: "string", format: "date" },
                      current: { type: "boolean" },
                      description: { type: "string" },
                    },
                  },
                },
                education: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      institution: { type: "string" },
                      degree: { type: "string" },
                      field: { type: "string" },
                      startDate: { type: "string", format: "date" },
                      endDate: { type: "string", format: "date" },
                    },
                  },
                },
              },
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        UpdateProfileRequest: {
          type: "object",
          properties: {
            profile: {
              type: "object",
              properties: {
                firstName: { type: "string" },
                lastName: { type: "string" },
                headline: { type: "string" },
                bio: { type: "string" },
                location: { type: "string" },
                website: { type: "string" },
                linkedin: { type: "string" },
                github: { type: "string" },
                avatar: { type: "string" },
                skills: { type: "array", items: { type: "string" } },
                experience: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      company: { type: "string" },
                      role: { type: "string" },
                      startDate: { type: "string", format: "date" },
                      endDate: { type: "string", format: "date" },
                      current: { type: "boolean" },
                      description: { type: "string" },
                    },
                  },
                },
                education: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      institution: { type: "string" },
                      degree: { type: "string" },
                      field: { type: "string" },
                      startDate: { type: "string", format: "date" },
                      endDate: { type: "string", format: "date" },
                    },
                  },
                },
              },
            },
          },
        },
        ChangePasswordRequest: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string" },
            newPassword: { type: "string", minLength: 6 },
          },
        },
        // Job schemas
        Job: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            company: { type: "string" },
            location: { type: "string" },
            workMode: { type: "string", enum: ["remote", "hybrid", "on-site"] },
            employmentType: { type: "string", enum: ["full-time", "part-time", "contract", "internship"] },
            minSalary: { type: "number" },
            maxSalary: { type: "number" },
            currency: { type: "string", default: "USD" },
            description: { type: "string" },
            requirements: { type: "string" },
            responsibilities: { type: "string" },
            benefits: { type: "string" },
            department: { type: "string" },
            experienceLevel: { type: "string", enum: ["entry", "mid", "senior", "lead", "executive"] },
            skills: { type: "array", items: { type: "string" } },
            industry: { type: "string" },
            companySize: { type: "string", enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"] },
            postedBy: { type: "string" },
            isActive: { type: "boolean" },
            isFeatured: { type: "boolean" },
            applicationDeadline: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateJobRequest: {
          type: "object",
          required: ["title", "company", "location", "description", "requirements"],
          properties: {
            title: { type: "string" },
            company: { type: "string" },
            location: { type: "string" },
            workMode: { type: "string", enum: ["remote", "hybrid", "on-site"] },
            employmentType: { type: "string", enum: ["full-time", "part-time", "contract", "internship"] },
            minSalary: { type: "number" },
            maxSalary: { type: "number" },
            currency: { type: "string", default: "USD" },
            description: { type: "string" },
            requirements: { type: "string" },
            responsibilities: { type: "string" },
            benefits: { type: "string" },
            department: { type: "string" },
            experienceLevel: { type: "string", enum: ["entry", "mid", "senior", "lead", "executive"] },
            skills: { type: "array", items: { type: "string" } },
            industry: { type: "string" },
            companySize: { type: "string", enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"] },
            applicationDeadline: { type: "string", format: "date-time" },
            isFeatured: { type: "boolean", default: false },
          },
        },
        JobListResponse: {
          type: "object",
          properties: {
            jobs: {
              type: "array",
              items: { $ref: "#/components/schemas/Job" },
            },
            pagination: {
              type: "object",
              properties: {
                page: { type: "number" },
                limit: { type: "number" },
                total: { type: "number" },
                totalPages: { type: "number" },
              },
            },
          },
        },
        JobSearchAIRequest: {
          type: "object",
          properties: {
            query: {
              type: "string",
              example: "Remote senior React developer jobs with salary above 120k",
            },
          },
        },
        JobSearchAIResponse: {
          type: "object",
          properties: {
            query: { type: "string" },
            parsedFilters: { type: "object" },
            results: {
              type: "object",
              properties: {
                jobs: { type: "array", items: { $ref: "#/components/schemas/Job" } },
                pagination: { type: "object" },
              },
            },
          },
        },
        GenerateJobContentRequest: {
          type: "object",
          required: ["jobTitle"],
          properties: {
            jobTitle: { type: "string", example: "Senior React Developer" },
          },
        },
        GenerateJobContentResponse: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            requirements: { type: "string" },
            responsibilities: { type: "string" },
            benefits: { type: "string" },
            skills: { type: "array", items: { type: "string" } },
            experienceLevel: { type: "string" },
            employmentType: { type: "string" },
            minSalary: { type: "number" },
            maxSalary: { type: "number" },
          },
        },
        // Application schemas
        Application: {
          type: "object",
          properties: {
            id: { type: "string" },
            jobId: { type: "string" },
            applicantId: { type: "string" },
            resumeId: { type: "string" },
            coverLetter: { type: "string" },
            expectedSalary: { type: "number" },
            availableFrom: { type: "string", format: "date-time" },
            status: {
              type: "string",
              enum: ["pending", "reviewing", "shortlisted", "interviewing", "hired", "rejected"],
            },
            aiScore: { type: "number", minimum: 0, maximum: 100 },
            aiExplanation: { type: "string" },
            aiStrengths: { type: "array", items: { type: "string" } },
            aiWeaknesses: { type: "array", items: { type: "string" } },
            aiRecommendation: { type: "string" },
            appliedAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            job: { $ref: "#/components/schemas/Job" },
            applicant: { $ref: "#/components/schemas/User" },
            resume: { $ref: "#/components/schemas/Resume" },
          },
        },
        CreateApplicationRequest: {
          type: "object",
          required: ["jobId"],
          properties: {
            jobId: { type: "string" },
            resumeId: { type: "string" },
            coverLetter: { type: "string" },
            expectedSalary: { type: "number" },
            availableFrom: { type: "string", format: "date-time" },
          },
        },
        // Resume schemas
        Resume: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            title: { type: "string" },
            content: { type: "string" },
            version: { type: "number" },
            isActive: { type: "boolean" },
            isDefault: { type: "boolean" },
            skills: { type: "array", items: { type: "string" } },
            experience: {
              type: "object",
              properties: {
                years: { type: "number" },
                level: { type: "string", enum: ["entry", "mid", "senior", "lead"] },
              },
            },
            education: {
              type: "object",
              properties: {
                degree: { type: "string" },
                field: { type: "string" },
                institution: { type: "string" },
              },
            },
            summary: { type: "string" },
            analysis: {
              type: "object",
              properties: {
                score: { type: "number" },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                suggestions: { type: "array", items: { type: "string" } },
                lastAnalyzedAt: { type: "string", format: "date-time" },
              },
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateResumeRequest: {
          type: "object",
          required: ["title", "content"],
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            skills: { type: "array", items: { type: "string" } },
            experience: {
              type: "object",
              properties: {
                years: { type: "number" },
                level: { type: "string", enum: ["entry", "mid", "senior", "lead"] },
              },
            },
            education: {
              type: "object",
              properties: {
                degree: { type: "string" },
                field: { type: "string" },
                institution: { type: "string" },
              },
            },
            summary: { type: "string" },
          },
        },
        // AI schemas
        ResumeAnalysisResponse: {
          type: "object",
          properties: {
            resume: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
              },
            },
            job: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                company: { type: "string" },
              },
            },
            analysis: {
              type: "object",
              properties: {
                score: { type: "number" },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                suggestions: { type: "array", items: { type: "string" } },
                matchDetails: {
                  type: "object",
                  properties: {
                    skillMatch: { type: "number" },
                    experienceMatch: { type: "number" },
                    educationMatch: { type: "number" },
                    keywordMatch: { type: "number" },
                  },
                },
              },
            },
          },
        },
        CoverLetterRequest: {
          type: "object",
          required: ["jobId"],
          properties: {
            jobId: { type: "string" },
          },
        },
        CoverLetterResponse: {
          type: "object",
          properties: {
            coverLetter: { type: "string" },
          },
        },
        CareerFeedbackResponse: {
          type: "object",
          properties: {
            feedback: { type: "string" },
          },
        },
        JobMatchResponse: {
          type: "object",
          properties: {
            matches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  job: { $ref: "#/components/schemas/Job" },
                  score: { type: "number" },
                  matchDetails: {
                    type: "object",
                    properties: {
                      skillMatch: { type: "number" },
                      experienceMatch: { type: "number" },
                      locationMatch: { type: "number" },
                      salaryMatch: { type: "number" },
                    },
                  },
                  reasoning: { type: "string" },
                },
              },
            },
          },
        },
        ApplicationScreeningResponse: {
          type: "object",
          properties: {
            score: { type: "number", minimum: 0, maximum: 100 },
            explanation: { type: "string" },
            strengths: { type: "array", items: { type: "string" } },
            weaknesses: { type: "array", items: { type: "string" } },
            recommendation: { type: "string" },
          },
        },
        // Admin schemas
        UserStats: {
          type: "object",
          properties: {
            totalUsers: { type: "number" },
            activeUsers: { type: "number" },
            inactiveUsers: { type: "number" },
            byRole: {
              type: "object",
              properties: {
                job_seeker: { type: "number" },
                employer: { type: "number" },
                admin: { type: "number" },
              },
            },
            recentRegistrations: { type: "number" },
          },
        },
        BulkUpdateRolesRequest: {
          type: "object",
          required: ["userIds", "role"],
          properties: {
            userIds: { type: "array", items: { type: "string" } },
            role: { type: "string", enum: ["job_seeker", "employer", "admin"] },
          },
        },
        BulkDeactivateRequest: {
          type: "object",
          required: ["userIds"],
          properties: {
            userIds: { type: "array", items: { type: "string" } },
          },
        },
        BulkOperationResponse: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                updated: { type: "number" },
                failed: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
        // Company schemas
        Company: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            description: { type: "string" },
            website: { type: "string" },
            logo: { type: "string" },
            coverImage: { type: "string" },
            size: {
              type: "string",
              enum: ["startup", "small", "medium", "large", "enterprise"],
            },
            industry: {
              type: "string",
              enum: [
                "technology",
                "finance",
                "healthcare",
                "education",
                "retail",
                "manufacturing",
                "consulting",
                "media",
                "real_estate",
                "transportation",
                "energy",
                "government",
                "non_profit",
                "other",
              ],
            },
            foundedYear: { type: "number" },
            headquarters: {
              type: "object",
              properties: {
                address: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                country: { type: "string" },
                postalCode: { type: "string" },
                coordinates: {
                  type: "object",
                  properties: {
                    lat: { type: "number" },
                    lng: { type: "number" },
                  },
                },
              },
            },
            locations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  address: { type: "string" },
                  city: { type: "string" },
                  state: { type: "string" },
                  country: { type: "string" },
                  isHeadquarters: { type: "boolean" },
                },
              },
            },
            socialLinks: {
              type: "object",
              properties: {
                linkedin: { type: "string" },
                twitter: { type: "string" },
                facebook: { type: "string" },
                instagram: { type: "string" },
                github: { type: "string" },
                youtube: { type: "string" },
                website: { type: "string" },
              },
            },
            culture: {
              type: "object",
              properties: {
                mission: { type: "string" },
                vision: { type: "string" },
                values: { type: "array", items: { type: "string" } },
                benefits: { type: "array", items: { type: "string" } },
                perks: { type: "array", items: { type: "string" } },
                workCulture: { type: "string" },
              },
            },
            owner: { type: "string" },
            members: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  user: { type: "string" },
                  role: { type: "string", enum: ["owner", "admin", "member", "recruiter"] },
                  joinedAt: { type: "string", format: "date-time" },
                },
              },
            },
            isVerified: { type: "boolean" },
            isActive: { type: "boolean" },
            stats: {
              type: "object",
              properties: {
                totalJobsPosted: { type: "number" },
                activeJobs: { type: "number" },
                totalApplications: { type: "number" },
                totalHires: { type: "number" },
                averageRating: { type: "number" },
                totalReviews: { type: "number" },
              },
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateCompanyRequest: {
          type: "object",
          required: ["name", "slug"],
          properties: {
            name: { type: "string", maxLength: 100 },
            slug: { type: "string", pattern: "^[a-z0-9-]+$", maxLength: 100 },
            description: { type: "string", maxLength: 5000 },
            website: { type: "string", format: "uri" },
            logo: { type: "string", format: "uri" },
            coverImage: { type: "string", format: "uri" },
            size: {
              type: "string",
              enum: ["startup", "small", "medium", "large", "enterprise"],
            },
            industry: {
              type: "string",
              enum: [
                "technology",
                "finance",
                "healthcare",
                "education",
                "retail",
                "manufacturing",
                "consulting",
                "media",
                "real_estate",
                "transportation",
                "energy",
                "government",
                "non_profit",
                "other",
              ],
            },
            foundedYear: { type: "number", minimum: 1800, maximum: 2026 },
            headquarters: {
              type: "object",
              properties: {
                address: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                country: { type: "string" },
                postalCode: { type: "string" },
                coordinates: {
                  type: "object",
                  properties: {
                    lat: { type: "number", minimum: -90, maximum: 90 },
                    lng: { type: "number", minimum: -180, maximum: 180 },
                  },
                },
              },
            },
          },
        },
        UpdateCompanyRequest: {
          type: "object",
          properties: {
            name: { type: "string", maxLength: 100 },
            description: { type: "string", maxLength: 5000 },
            website: { type: "string", format: "uri" },
            logo: { type: "string", format: "uri" },
            coverImage: { type: "string", format: "uri" },
            size: {
              type: "string",
              enum: ["startup", "small", "medium", "large", "enterprise"],
            },
            industry: {
              type: "string",
              enum: [
                "technology",
                "finance",
                "healthcare",
                "education",
                "retail",
                "manufacturing",
                "consulting",
                "media",
                "real_estate",
                "transportation",
                "energy",
                "government",
                "non_profit",
                "other",
              ],
            },
            foundedYear: { type: "number", minimum: 1800, maximum: 2026 },
            headquarters: {
              type: "object",
              properties: {
                address: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                country: { type: "string" },
                postalCode: { type: "string" },
                coordinates: {
                  type: "object",
                  properties: {
                    lat: { type: "number", minimum: -90, maximum: 90 },
                    lng: { type: "number", minimum: -180, maximum: 180 },
                  },
                },
              },
            },
            socialLinks: {
              type: "object",
              properties: {
                linkedin: { type: "string" },
                twitter: { type: "string" },
                facebook: { type: "string" },
                instagram: { type: "string" },
                github: { type: "string" },
                youtube: { type: "string" },
                website: { type: "string" },
              },
            },
            culture: {
              type: "object",
              properties: {
                mission: { type: "string" },
                vision: { type: "string" },
                values: { type: "array", items: { type: "string" } },
                benefits: { type: "array", items: { type: "string" } },
                perks: { type: "array", items: { type: "string" } },
                workCulture: { type: "string" },
              },
            },
            isActive: { type: "boolean" },
          },
        },
        CompanyListResponse: {
          type: "object",
          properties: {
            companies: {
              type: "array",
              items: { $ref: "#/components/schemas/Company" },
            },
            pagination: {
              type: "object",
              properties: {
                page: { type: "number" },
                limit: { type: "number" },
                total: { type: "number" },
                totalPages: { type: "number" },
              },
            },
          },
        },
        // Query parameters
        PaginationQuery: {
          type: "object",
          properties: {
            page: { type: "number", default: 1, minimum: 1 },
            limit: { type: "number", default: 10, minimum: 1, maximum: 100 },
          },
        },
        SortQuery: {
          type: "object",
          properties: {
            sortBy: { type: "string", default: "createdAt" },
            sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
          },
        },
        UserFilterQuery: {
          type: "object",
          properties: {
            role: { type: "string", enum: ["job_seeker", "employer", "admin"] },
            isActive: { type: "boolean" },
            search: { type: "string" },
            skills: { type: "string", description: "Comma-separated skills" },
          },
        },
        JobFilterQuery: {
          type: "object",
          properties: {
            title: { type: "string" },
            company: { type: "string" },
            location: { type: "string" },
            workMode: { type: "string", enum: ["remote", "hybrid", "on-site"] },
            employmentType: { type: "string", enum: ["full-time", "part-time", "contract", "internship"] },
            minSalary: { type: "number" },
            maxSalary: { type: "number" },
            experienceLevel: { type: "string", enum: ["entry", "mid", "senior", "lead", "executive"] },
            skills: { type: "string", description: "Comma-separated skills" },
            isActive: { type: "boolean", default: true },
            isFeatured: { type: "boolean" },
            postedBy: { type: "string" },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    tags: [
      { name: "Auth", description: "Authentication endpoints" },
      { name: "Users", description: "User management endpoints" },
      { name: "Jobs", description: "Job management endpoints" },
      { name: "Applications", description: "Job application endpoints" },
      { name: "Resumes", description: "Resume management endpoints" },
      { name: "AI", description: "AI-powered features" },
      { name: "Admin", description: "Admin-only endpoints" },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/models/*.ts"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export { swaggerSpec, swaggerUi };