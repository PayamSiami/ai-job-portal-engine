import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import {
  authRoutes,
  jobRoutes,
  applicationRoutes,
  resumeRoutes,
  userRoutes,
  dashboardRoutes,
  candidateRoutes,
  activityRoutes,
  companyRoutes,
} from "./routes/index.js";
import { config } from "./config/index.js";
import { swaggerSpec, swaggerUi } from "./config/swagger.js";
import healthService from "./services/health.service.js";
import logger from "./utils/logger.js";
import { AppError, errorHandler } from "./utils/errorHandler.js";
import { connectDB } from "./utils/database.js";
import { sendSuccess, sendError } from "./utils/responseFormatter.js";

const app = express();

// ============ Parse CORS Origins ============
const parseCorsOrigins = (originString: string): string[] => {
  if (config.NODE_ENV === "production") {
    return originString.split(",").map((origin) => origin.trim());
  }
  return originString === "*"
    ? ["*"]
    : originString.split(",").map((origin) => origin.trim());
};

const corsOrigins = parseCorsOrigins(config.CORS_ORIGIN);

// ============ Middleware ============
app.use(
  cors({
    origin: corsOrigins,
    credentials: config.CORS_CREDENTIALS,
    methods: config.CORS_METHODS.split(",").map((method) => method.trim()),
    allowedHeaders: config.CORS_ALLOWED_HEADERS.split(",").map((header) =>
      header.trim(),
    ),
  }),
);

// Configure helmet to allow iframe embedding
// Convert CORS origins to frame ancestors format
const getFrameAncestors = (origins: string[]): string[] => {
  // If it's "*", allow all origins (or use ['*'] based on your needs)
  if (origins.includes("*")) {
    return ["*"];
  }

  // Add "'self'" to allow same origin
  return ["'self'", ...origins];
};

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        frameAncestors: getFrameAncestors(corsOrigins),
        // Add other necessary directives
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
      },
    },
    frameguard: {
      action: "sameorigin",
    },
  }),
);

app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ============ Serve Static Files ============
try {
  // Use process.cwd() for the root directory
  const uploadsDir = path.join(process.cwd(), "uploads");
  const resumeDir = path.join(uploadsDir, "resumes");
  const profileDir = path.join(uploadsDir, "profiles");
  const tempDir = path.join(uploadsDir, "temp");

  // Create directories
  const directories = [uploadsDir, resumeDir, profileDir, tempDir];
  directories.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });

  // Serve static files
  app.use(
    "/uploads",
    express.static(uploadsDir, {
      setHeaders: (res, filePath) => {
        res.setHeader("Cache-Control", "public, max-age=86400");

        if (filePath.endsWith(".pdf")) {
          res.setHeader("Content-Type", "application/pdf");
          // Allow inline display in iframe
          res.setHeader(
            "Content-Disposition",
            `inline; filename="${path.basename(filePath)}"`,
          );
          // Remove X-Frame-Options for PDFs to allow embedding
          res.removeHeader("X-Frame-Options");
        }
        if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
          res.setHeader("Content-Type", "image/jpeg");
        }
        if (filePath.endsWith(".png")) {
          res.setHeader("Content-Type", "image/png");
        }

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      },
    }),
  );

  logger.info(`📁 Static files served from: ${uploadsDir}`);
} catch (error) {
  logger.error("Error setting up static file serving:", error);
}

// ============ Rate limiting ============
const apiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  message: { error: "Too many requests from this IP, please try again later." },
});

if (config.NODE_ENV === "production") {
  app.use("/api/", apiLimiter);
}

// ============ Swagger Documentation ============
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "AI Job Portal API Docs",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  }),
);

// Connect to database
await connectDB();

// ============ Routes ============
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Health check endpoints
app.get("/health", async (req, res) => {
  try {
    const health = await healthService.checkLiveness();
    sendSuccess(res, health, "Service is alive");
  } catch (error) {
    sendError(res, "Health check failed", 503, {
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/health/detailed", async (req, res) => {
  try {
    const health = await healthService.checkHealth();
    const statusCode =
      health.status === "healthy"
        ? 200
        : health.status === "degraded"
          ? 200
          : 503;

    if (statusCode >= 400) {
      sendError(res, health, statusCode);
    } else {
      sendSuccess(res, health, "Health check completed");
    }
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : "Unknown error",
      503,
      { timestamp: new Date().toISOString() },
    );
  }
});

app.get("/health/ready", async (req, res) => {
  try {
    const readiness = await healthService.checkReadiness();
    const statusCode = readiness.status === "ready" ? 200 : 503;

    if (statusCode >= 400) {
      sendError(res, readiness, statusCode);
    } else {
      sendSuccess(res, readiness, "Service is ready");
    }
  } catch (error) {
    sendError(
      res,
      error instanceof Error ? error.message : "Unknown error",
      503,
      { timestamp: new Date().toISOString() },
    );
  }
});

// 404 handler
app.use((req, _res, next) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
});

// ============ Global Error Handler ============
app.use(errorHandler);

const PORT = config.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  logger.info(`📁 Uploads: http://localhost:${PORT}/uploads/`);
});

export default app;
