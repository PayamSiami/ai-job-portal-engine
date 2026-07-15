// src/services/healthService.ts
import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";
import os from "os";

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: HealthCheck;
    ai: HealthCheck;
    memory: HealthCheck;
    system: HealthCheck;
  };
  metrics: SystemMetrics;
}

export interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  message: string;
  latencyMs?: number;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  loadAverage: number[];
  platform: string;
  nodeVersion: string;
  pid: number;
}

class HealthService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private lastAiCheck: { status: HealthCheck["status"]; timestamp: number } | null = null;
  private readonly AI_CHECK_CACHE_MS = 60000; // Cache AI check for 1 minute

  constructor() {
    this.initAI();
  }

  private initAI(): void {
    if (config.GEMINI_API_KEY) {
      try {
        this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: config.GEMINI_MODEL || "gemini-1.5-flash" });
      } catch (error) {
        logger.warn("Failed to initialize AI for health checks", { error });
      }
    }
  }

  /**
   * Comprehensive health check for all dependencies
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    // Run all checks in parallel
    const [database, ai, memory, system] = await Promise.all([
      this.checkDatabase(),
      this.checkAI(),
      this.checkMemory(),
      this.checkSystem(),
    ]);

    const checks = { database, ai, memory, system };
    const overallStatus = this.calculateOverallStatus(checks);

    const metrics = this.getSystemMetrics();

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
      environment: config.NODE_ENV || "development",
      checks,
      metrics,
    };
  }

  /**
   * Lightweight health check for load balancers
   */
  async checkLiveness(): Promise<{ status: string; timestamp: string }> {
    return {
      status: "alive",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness check - verifies all critical dependencies
   */
  async checkReadiness(): Promise<{ status: "ready" | "not ready"; checks: Record<string, HealthCheck> }> {
    const [database, memory] = await Promise.all([
      this.checkDatabase(),
      this.checkMemory(),
    ]);

    const isReady = database.status === "healthy" && memory.status !== "unhealthy";

    return {
      status: isReady ? "ready" : "not ready",
      checks: { database, memory },
    };
  }

  /**
   * Check MongoDB connection
   */
  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const state = mongoose.connection.readyState;
      const stateMap: Record<number, string> = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting",
      };

      const latencyMs = Date.now() - startTime;

      if (state === 1) {
        // Ping database to verify it's responsive
        await mongoose.connection.db?.admin().ping();

        return {
          status: "healthy",
          message: "Database connected and responsive",
          latencyMs,
          details: {
            state: stateMap[state],
            host: mongoose.connection.host,
            name: mongoose.connection.name,
            models: Object.keys(mongoose.connection.models).length,
          },
        };
      }

      return {
        status: "unhealthy",
        message: `Database ${stateMap[state] || "unknown state"}`,
        latencyMs,
        details: { state: stateMap[state] },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: "Database connection failed",
        latencyMs: Date.now() - startTime,
        details: { error: error instanceof Error ? error.message : "Unknown error" },
      };
    }
  }

  /**
   * Check AI service availability
   */
  private async checkAI(): Promise<HealthCheck> {
    const startTime = Date.now();

    // Return cached result if recent
    if (this.lastAiCheck && Date.now() - this.lastAiCheck.timestamp < this.AI_CHECK_CACHE_MS) {
      return {
        status: this.lastAiCheck.status,
        message: this.lastAiCheck.status === "healthy" ? "AI service available (cached)" : "AI service unavailable (cached)",
        latencyMs: 0,
        details: { cached: true },
      };
    }

    if (!this.genAI || !this.model) {
      const result: HealthCheck = {
        status: "unhealthy",
        message: "AI service not configured (GEMINI_API_KEY missing)",
        latencyMs: Date.now() - startTime,
        details: { configured: false },
      };
      this.lastAiCheck = { status: result.status, timestamp: Date.now() };
      return result;
    }

    try {
      // Simple test generation to verify API key and quota
      const result = await this.model.generateContent("Health check");
      const text = result.response.text();

      const checkResult: HealthCheck = {
        status: text ? "healthy" : "degraded",
        message: text ? "AI service responding normally" : "AI service returned empty response",
        latencyMs: Date.now() - startTime,
        details: {
          configured: true,
          model: config.GEMINI_MODEL || "gemini-1.5-flash",
          responseLength: text?.length || 0,
        },
      };

      this.lastAiCheck = { status: checkResult.status, timestamp: Date.now() };
      return checkResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const isRateLimit = errorMessage.includes("429") || errorMessage.includes("quota");
      const isAuth = errorMessage.includes("401") || errorMessage.includes("403");

      const checkResult: HealthCheck = {
        status: isAuth ? "unhealthy" : isRateLimit ? "degraded" : "unhealthy",
        message: isRateLimit
          ? "AI service rate limited"
          : isAuth
          ? "AI service authentication failed"
          : "AI service error",
        latencyMs: Date.now() - startTime,
        details: {
          configured: true,
          error: errorMessage,
          isRateLimit,
          isAuth,
        },
      };

      this.lastAiCheck = { status: checkResult.status, timestamp: Date.now() };
      return checkResult;
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<HealthCheck> {
    const mem = process.memoryUsage();
    const totalMemory = mem.heapTotal + mem.external;
    const usedMemory = mem.heapUsed;
    const percentage = (usedMemory / totalMemory) * 100;

    let status: HealthCheck["status"] = "healthy";
    if (percentage > 90) status = "unhealthy";
    else if (percentage > 75) status = "degraded";

    return {
      status,
      message: `Memory usage at ${percentage.toFixed(1)}%`,
      details: {
        heapUsed: this.formatBytes(mem.heapUsed),
        heapTotal: this.formatBytes(mem.heapTotal),
        external: this.formatBytes(mem.external),
        rss: this.formatBytes(mem.rss),
        percentage: Math.round(percentage * 100) / 100,
      },
    };
  }

  /**
   * Check system resources
   */
  private async checkSystem(): Promise<HealthCheck> {
    const cpuUsage = process.cpuUsage();
    const loadAvg = process.platform !== "win32" ? os.loadavg() : [0, 0, 0];
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const sysMemPercent = ((totalMem - freeMem) / totalMem) * 100;

    let status: HealthCheck["status"] = "healthy";
    if (sysMemPercent > 90) status = "unhealthy";
    else if (sysMemPercent > 80) status = "degraded";

    return {
      status,
      message: `System memory at ${sysMemPercent.toFixed(1)}%`,
      details: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        pid: process.pid,
        cpuUsage: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        loadAverage: loadAvg,
        systemMemory: {
          free: this.formatBytes(freeMem),
          total: this.formatBytes(totalMem),
          percentage: Math.round(sysMemPercent * 100) / 100,
        },
      },
    };
  }

  /**
   * Calculate overall status from individual checks
   */
  private calculateOverallStatus(checks: Record<string, HealthCheck>): HealthCheckResult["status"] {
    const statuses = Object.values(checks).map((c) => c.status);

    if (statuses.some((s) => s === "unhealthy")) return "unhealthy";
    if (statuses.some((s) => s === "degraded")) return "degraded";
    return "healthy";
  }

  /**
   * Get detailed system metrics
   */
  private getSystemMetrics(): SystemMetrics {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();

    return {
      uptime: process.uptime(),
      memory: {
        used: mem.heapUsed,
        total: mem.heapTotal,
        percentage: (mem.heapUsed / mem.heapTotal) * 100,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
      },
      cpu: {
        user: cpu.user,
        system: cpu.system,
      },
      loadAverage: os.platform() !== "win32" ? os.loadavg() : [0, 0, 0],
      platform: os.platform(),
      nodeVersion: process.version,
      pid: process.pid,
    };
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}

export default new HealthService();