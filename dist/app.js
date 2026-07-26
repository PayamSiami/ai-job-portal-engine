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
app.use(cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
}));
app.use(helmet({
    contentSecurityPolicy: config.NODE_ENV === "production" ? undefined : false,
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many requests from this IP, please try again later." },
});
app.use("/api/", apiLimiter);
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
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
}));
const MONGODB_URI = `mongodb://${config.DB_HOST || "mongodb"}:${config.DB_PORT || "27017"}/${config.DB_NAME || "jobportal"}`;
mongoose
    .connect(MONGODB_URI)
    .then(() => logger.info("✅ MongoDB connected"))
    .catch((err) => logger.error("⚠️ MongoDB not connected:", err.message));
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/company", companyRoutes);
app.use("/api", dashboardRoutes);
app.get("/health", async (req, res) => {
    try {
        const health = await healthService.checkLiveness();
        res.json(health);
    }
    catch (error) {
        res.status(503).json({
            status: "error",
            timestamp: new Date().toISOString(),
        });
    }
});
app.get("/health/detailed", async (req, res) => {
    try {
        const health = await healthService.checkHealth();
        const statusCode = health.status === "healthy"
            ? 200
            : health.status === "degraded"
                ? 200
                : 503;
        res.status(statusCode).json(health);
    }
    catch (error) {
        res.status(503).json({
            status: "unhealthy",
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
app.get("/health/ready", async (req, res) => {
    try {
        const readiness = await healthService.checkReadiness();
        const statusCode = readiness.status === "ready" ? 200 : 503;
        res.status(statusCode).json(readiness);
    }
    catch (error) {
        res.status(503).json({
            status: "not ready",
            checks: {},
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});
app.use((err, req, res, next) => {
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
    }
    else if (err.status && typeof err.status === "number") {
        statusCode = err.status;
        message = err.message || message;
    }
    else if (err.message) {
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
