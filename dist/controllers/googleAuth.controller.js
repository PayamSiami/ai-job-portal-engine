import { catchAsync } from "../utils/catchAsync.js";
import { AppError } from "../utils/errorHandler.js";
import googleAuthService from "../services/googleAuth.service.js";
import { UserRole } from "../models/User.models.js";
export class GoogleAuthController {
    /**
     * Handle Google OAuth login/signup
     * Expects { idToken: string, role?: string } in body
     */
    googleAuth = catchAsync(async (req, res) => {
        const { idToken, role } = req.body;
        if (!idToken) {
            throw new AppError("Google ID token is required", 400);
        }
        // Validate role if provided
        const userRole = role && Object.values(UserRole).includes(role)
            ? role
            : UserRole.JOB_SEEKER;
        const result = await googleAuthService.authenticate(idToken, userRole);
        res.status(200).json({
            success: true,
            data: result,
            message: "Google authentication successful",
        });
    });
    /**
     * Link Google account to existing user
     * Requires authentication
     */
    linkGoogleAccount = catchAsync(async (req, res) => {
        const { idToken } = req.body;
        const userId = req.user?.id;
        if (!idToken) {
            throw new AppError("Google ID token is required", 400);
        }
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        // Verify Google token
        const googleData = await googleAuthService.verifyGoogleToken(idToken);
        // Check if Google account is already linked to another user
        const existingUser = await googleAuthService.findUserByGoogleId(googleData.googleId);
        if (existingUser && existingUser._id.toString() !== userId) {
            throw new AppError("This Google account is already linked to another user", 400);
        }
        // Update current user with Google data
        const user = await googleAuthService.linkGoogleToUser(userId, googleData);
        res.status(200).json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    authProvider: user.authProvider,
                },
            },
            message: "Google account linked successfully",
        });
    });
    /**
     * Unlink Google account from user
     * Requires authentication
     */
    unlinkGoogleAccount = catchAsync(async (req, res) => {
        const userId = req.user?.id;
        if (!userId) {
            throw new AppError("User not authenticated", 401);
        }
        const user = await googleAuthService.unlinkGoogleFromUser(userId);
        if (!user) {
            throw new AppError("User not found", 404);
        }
        res.status(200).json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    authProvider: user.authProvider,
                },
            },
            message: "Google account unlinked successfully",
        });
    });
}
export default new GoogleAuthController();
