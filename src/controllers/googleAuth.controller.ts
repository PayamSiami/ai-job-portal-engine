import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/errorHandler";
import googleAuthService from "../services/googleAuth.service";
import { UserRole } from "../models/User.models";
import { sendSuccess } from "../utils/responseFormatter";

export class GoogleAuthController {
  /**
   * Handle Google OAuth login/signup
   * Expects { idToken: string, role?: string } in body
   */
  googleAuth = catchAsync(async (req: Request, res: Response) => {
    const { idToken, role } = req.body;

    if (!idToken) {
      throw new AppError("Google ID token is required", 400);
    }

    // Validate role if provided
    const userRole = role && Object.values(UserRole).includes(role as UserRole)
      ? (role as UserRole)
      : UserRole.JOB_SEEKER;

    const result = await googleAuthService.authenticate(idToken, userRole);

    sendSuccess(res, result, "Google authentication successful");
  });

  /**
   * Link Google account to existing user
   * Requires authentication
   */
  linkGoogleAccount = catchAsync(async (req: Request, res: Response) => {
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

    sendSuccess(res, { user }, "Google account linked successfully");
  });

  /**
   * Unlink Google account from user
   * Requires authentication
   */
  unlinkGoogleAccount = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError("User not authenticated", 401);
    }

    const user = await googleAuthService.unlinkGoogleFromUser(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    sendSuccess(res, { user }, "Google account unlinked successfully");
  });
}

export default new GoogleAuthController();