import { IUser, UserRole } from "../models/User.models.js";
export interface RegisterData {
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
export interface LoginData {
    email: string;
    password: string;
}
export interface AuthResponse {
    user: {
        _id: any;
        username: string;
        email: string;
        role: UserRole;
    };
    token: string;
}
export interface DecodedToken {
    id: string;
    iat: number;
    exp: number;
}
declare class AuthService {
    /**
     * Register a new user
     */
    register(registerData: RegisterData): Promise<AuthResponse>;
    /**
     * Login user
     */
    login(loginData: LoginData): Promise<AuthResponse>;
    /**
     * Get user by ID
     */
    getUserById(userId: string): Promise<IUser | null>;
    /**
     * Verify JWT token
     */
    verifyToken(token: string): Promise<DecodedToken>;
    /**
     * Generate JWT token
     */
    generateToken(userId: any): string;
    /**
     * Change user password
     */
    changePassword(userId: string, oldPassword: string, newPassword: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Reset password (forgot password flow)
     */
    resetPassword(email: string, newPassword: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Logout (invalidate token)
     */
    logout(userId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Refresh token
     */
    refreshToken(refreshToken: string): Promise<{
        token: string;
    }>;
}
declare const _default: AuthService;
export default _default;
//# sourceMappingURL=auth.service.d.ts.map