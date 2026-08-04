import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.routes";
import jobRoutes from "./routes/job.routes";
import applicationRoutes from "./routes/application.routes";
import resumeRoutes from "./routes/resume.routes";
import userRoutes from "./routes/user.routes";
import { config } from "./config";
import { swaggerSpec, swaggerUi } from "./config/swagger";
import healthService from "./services/health.service";
import logger from "./utils/logger";
import dashboardRoutes from "./routes/dashboard.routes";
import candidateRoutes from "./routes/candidates.routes";
import activityRoutes from "./routes/activity.routes";
import companyRoutes from "./routes/company.routes";

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

app.use("/api/", apiLimiter);

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

// ============ Database Connection ============
const MONGODB_URI = config.MONGODB_URI;

mongoose
  .connect(MONGODB_URI)
  .then(() => logger.info("✅ MongoDB connected"))
  .catch((err) => logger.error("⚠️ MongoDB not connected:", err.message));

// ============ Routes ============
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/company", companyRoutes);
app.use("/api", dashboardRoutes);

// Health check endpoints
app.get("/health", async (req, res) => {
  try {
    const health = await healthService.checkLiveness();
    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: "error",
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
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Readiness probe
app.get("/health/ready", async (req, res) => {
  try {
    const readiness = await healthService.checkReadiness();
    const statusCode = readiness.status === "ready" ? 200 : 503;
    res.status(statusCode).json(readiness);
  } catch (error) {
    res.status(503).json({
      status: "not ready",
      checks: {},
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ============ Global Error Handler ============
app.use((err: any, req: any, res: any, next: any) => {
  console.error("❌ Error:", {
    message: err.message,
    statusCode: err.statusCode || err.status,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  let statusCode = 500;
  let message = "Internal server error";

  if (err.statusCode && typeof err.statusCode === "number") {
    statusCode = err.statusCode;
    message = err.message || message;
  } else if (err.status && typeof err.status === "number") {
    statusCode = err.status;
    message = err.message || message;
  } else if (err.message) {
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
      error: err,
    }),
  });
});

const PORT = config.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
});

export default app;
