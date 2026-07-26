import { IUser, UserRole } from "../models/User.models.js";
export interface CreateUserData {
    username: string;
    email: string;
    password: string;
    role?: UserRole;
    profile?: {
        firstName?: string;
        lastName?: string;
        headline?: string;
        location?: string;
        skills?: string[];
        experience?: number;
        education?: string;
        bio?: string;
    };
}
export interface UpdateUserData {
    username?: string;
    email?: string;
    profile?: {
        firstName?: string;
        lastName?: string;
        headline?: string;
        location?: string;
        skills?: string[];
        experience?: number;
        education?: string;
        bio?: string;
    };
    isActive?: boolean;
    role?: UserRole;
}
export interface ChangePasswordData {
    currentPassword: string;
    newPassword: string;
}
export interface UserFilters {
    role?: UserRole;
    isActive?: boolean;
    search?: string;
    skills?: string[];
}
export interface PaginationOptions {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}
export interface UserPaginationResult {
    users: IUser[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
export interface UserStats {
    total: number;
    active: number;
    inactive: number;
    byRole: Record<UserRole, number>;
    recentRegistrations: number;
    withResume: number;
}
declare class UserService {
    /**
     * Create a new user
     */
    createUser(data: CreateUserData): Promise<IUser>;
    /**
     * Get user by ID
     */
    getUserById(userId: string): Promise<IUser | null>;
    /**
     * Get user by email
     */
    getUserByEmail(email: string): Promise<IUser | null>;
    /**
     * Get user by username
     */
    getUserByUsername(username: string): Promise<IUser | null>;
    /**
     * Get users with filters and pagination
     */
    getUsers(filters?: UserFilters, options?: PaginationOptions): Promise<UserPaginationResult>;
    /**
     * Update user
     */
    updateUser(userId: string, data: UpdateUserData): Promise<IUser | null>;
    /**
     * Update user profile
     */
    updateProfile(userId: string, profileData: {
        firstName?: string;
        lastName?: string;
        headline?: string;
        location?: string;
        skills?: string[];
        experience?: number;
        education?: string;
        bio?: string;
    }): Promise<IUser | null>;
    /**
     * Change user password
     */
    changePassword(userId: string, data: ChangePasswordData): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Deactivate user (soft delete)
     */
    deactivateUser(userId: string): Promise<IUser | null>;
    /**
     * Activate user
     */
    activateUser(userId: string): Promise<IUser | null>;
    /**
     * Delete user (permanent)
     */
    deleteUser(userId: string): Promise<boolean>;
    /**
     * Get user statistics
     */
    getUserStats(): Promise<UserStats>;
    /**
     * Search users by skills
     */
    searchBySkills(skills: string[]): Promise<IUser[]>;
    /**
     * Get users by role
     */
    getUsersByRole(role: UserRole, options?: PaginationOptions): Promise<UserPaginationResult>;
    /**
     * Get active users
     */
    getActiveUsers(options?: PaginationOptions): Promise<UserPaginationResult>;
    /**
     * Check if email is available
     */
    isEmailAvailable(email: string): Promise<boolean>;
    /**
     * Check if username is available
     */
    isUsernameAvailable(username: string): Promise<boolean>;
    /**
     * Bulk update user roles
     */
    bulkUpdateRoles(userIds: string[], role: UserRole): Promise<{
        updated: number;
        failed: string[];
    }>;
    /**
     * Bulk deactivate users
     */
    bulkDeactivateUsers(userIds: string[]): Promise<{
        deactivated: number;
        failed: string[];
    }>;
    /**
     * Validate user credentials
     */
    validateCredentials(email: string, password: string): Promise<IUser | null>;
    /**
     * Update user resume association
     */
    updateUserResume(userId: string, resumeId: string): Promise<IUser | null>;
    /**
     * Get user by resume ID
     */
    getUserByResumeId(resumeId: string): Promise<IUser | null>;
}
declare const _default: UserService;
export default _default;
//# sourceMappingURL=user.service.d.ts.map