export interface Activity {
    id: string;
    title: string;
    description?: string;
    score?: number | null;
    status: "pending" | "in-progress" | "completed";
    time: string;
    type: "application" | "screening" | "generation" | "analytics" | "interview" | "status_change" | "job";
    link?: string;
    user?: {
        name: string;
        avatar?: string;
    };
    timestamp: Date;
    jobTitle?: string;
    companyName?: string;
    metadata?: Record<string, any>;
}
export interface ActivityFilters {
    type?: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    page?: number;
}
export interface ActivityStats {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    recentCount: number;
    pendingCount: number;
}
declare class ActivityService {
    /**
     * Get activities for an employer with filters and pagination
     * Merged version that handles both company-based and direct job-based queries
     */
    getActivities(employerId: string, filters?: {
        type?: string;
        status?: string;
        dateFrom?: Date;
        dateTo?: Date;
        limit?: number;
        page?: number;
    }): Promise<{
        activities: Activity[];
        pagination: any;
    }>;
    /**
     * Get activity statistics
     */
    getActivityStats(employerId: string): Promise<ActivityStats>;
    private getTimeAgo;
    private mapApplicationStatus;
    private matchesFilters;
    private matchesTimestamp;
    private getApplicationActivities;
    private getScreeningActivities;
    private getGenerationActivities;
    private getAnalyticsActivities;
    private getInterviewActivities;
    private getStatusChangeActivities;
    private getJobCreationActivities;
}
declare const _default: ActivityService;
export default _default;
//# sourceMappingURL=activity.service.d.ts.map