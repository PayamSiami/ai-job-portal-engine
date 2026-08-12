import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
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
} from "./routes";
import { config } from "./config";
import { swaggerSpec, swaggerUi } from "./config/swagger";
import healthService from "./services/health.service";
import logger from "./utils/logger";
import { AppError, errorHandler } from "./utils/errorHandler";
import { connectDB } from "./utils/database";
import { sendSuccess, sendError } from "./utils/responseFormatter";

const app = express();

// ============ Parse CORS Origins ============
const parseCorsOrigins = (originString: string): string[] => {
  if (config.NODE_ENV === "production") {
    return originString.split(",").map((origin) => origin.trim());
  }
  // In development, allow all origins or specific ones
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

// Dynamic CORS configuration based on environment
app.use(
  helmet({
    contentSecurityPolicy: config.NODE_ENV === "production" ? undefined : false,
  }),
);

app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Rate limiting
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

// Detailed health check
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

// Readiness probe
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

// 404 handler — delegate to the shared error handler for consistent response shape
app.use((req, _res, next) => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
});

// ============ Global Error Handler ============
app.use(errorHandler);

const PORT = config.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
});

export default app;
