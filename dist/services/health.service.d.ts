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
declare class HealthService {
    private genAI;
    private model;
    private lastAiCheck;
    private readonly AI_CHECK_CACHE_MS;
    constructor();
    private initAI;
    /**
     * Comprehensive health check for all dependencies
     */
    checkHealth(): Promise<HealthCheckResult>;
    /**
     * Lightweight health check for load balancers
     */
    checkLiveness(): Promise<{
        status: string;
        timestamp: string;
    }>;
    /**
     * Readiness check - verifies all critical dependencies
     */
    checkReadiness(): Promise<{
        status: "ready" | "not ready";
        checks: Record<string, HealthCheck>;
    }>;
    /**
     * Check MongoDB connection
     */
    private checkDatabase;
    /**
     * Check AI service availability
     */
    private checkAI;
    /**
     * Check memory usage
     */
    private checkMemory;
    /**
     * Check system resources
     */
    private checkSystem;
    /**
     * Calculate overall status from individual checks
     */
    private calculateOverallStatus;
    /**
     * Get detailed system metrics
     */
    private getSystemMetrics;
    /**
     * Format bytes to human readable string
     */
    private formatBytes;
}
declare const _default: HealthService;
export default _default;
//# sourceMappingURL=health.service.d.ts.map