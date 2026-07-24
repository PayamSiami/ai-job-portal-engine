// src/app.ts
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.routes.js";
import jobRoutes from "./routes/job.routes.js";
import applicationRoutes from "./routes/application.routes.js";
import resumeRoutes from "./routes/resume.routes.js";
import userRoutes from "./routes/user.routes.js";
import { config } from "./config/index.js";
import { swaggerSpec, swaggerUi } from "./config/swagger.js";
import healthService from "./services/health.service.js";
import logger from "./utils/logger.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import candidateRoutes from "./routes/candidates.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import companyRoutes from "./routes/company.routes.js";

const app = express();

// ============ Middleware ============
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  }),
);
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
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
const MONGODB_URI = `mongodb://${config.DB_HOST || "localhost"}:${config.DB_PORT || "27017"}/${config.DB_NAME || "jobportal"}`;

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

// Readiness probe (for Kubernetes)
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
// ✅ FIX: Ensure status is a number before using it
app.use((err: any, req: any, res: any, next: any) => {
  console.error("❌ Error:", {
    message: err.message,
    statusCode: err.statusCode || err.status,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // ✅ Ensure statusCode is a number
  let statusCode = 500;
  let message = "Internal server error";

  // Check if error has a valid status code
  if (err.statusCode && typeof err.statusCode === "number") {
    statusCode = err.statusCode;
    message = err.message || message;
  } else if (err.status && typeof err.status === "number") {
    statusCode = err.status;
    message = err.message || message;
  } else if (
    err.status &&
    typeof err.status === "string" &&
    !isNaN(parseInt(err.status))
  ) {
    statusCode = parseInt(err.status);
    message = err.message || message;
  } else if (err.message) {
    message = err.message;
  }

  // ✅ Send response with numeric status code
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
      error: err,
    }),
  });
});

const PORT = config.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`📄 PDF Routes: http://localhost:${PORT}/api/pdf`);
});

export default app;
