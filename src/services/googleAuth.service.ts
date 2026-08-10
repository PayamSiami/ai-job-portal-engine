// src/services/googleAuth.service.ts
import User, { IUser, UserRole } from "../models/User.models";
import { config } from "../config/index";
import jwt from "jsonwebtoken";
import https from "https";

export interface GoogleUserData {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
}

export interface GoogleAuthResponse {
  user: {
    _id: any;
    username: string;
    email: string;
    role: UserRole;
  };
  token: string;
}

// Simple response interface for Google's tokeninfo endpoint
interface GoogleTokenInfo {
  sub: string;
  email: string;
  email_verified: string | boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
  aud: string;
  exp: number;
  iat: number;
  azp?: string;
}

class GoogleAuthService {
  /**
   * Verify Google ID token using tokeninfo endpoint
   * Uses native https module for better compatibility
   */
  async verifyGoogleToken(idToken: string): Promise<GoogleUserData> {
    return new Promise((resolve, reject) => {
      const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;

      const req = https.get(url, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`Google tokeninfo error: ${res.statusCode} - ${data}`));
              return;
            }

            const payload: GoogleTokenInfo = JSON.parse(data);

            // Verify the token is for our client ID
            if (payload.aud !== config.GOOGLE_CLIENT_ID) {
              reject(new Error("Token audience mismatch - invalid client ID"));
              return;
            }

            // Verify token hasn't expired
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp < now) {
              reject(new Error("Token expired"));
              return;
            }

            // Verify email is verified
            if (payload.email_verified !== "true" && payload.email_verified !== true) {
              reject(new Error("Google email not verified"));
              return;
            }

            resolve({
              googleId: payload.sub,
              email: payload.email,
              firstName: payload.given_name || "",
              lastName: payload.family_name || "",
              profileImage: payload.picture,
            });
          } catch (error) {
            reject(new Error(`Failed to parse Google response: ${error instanceof Error ? error.message : "Unknown error"}`));
          }
        });
      });

      req.on("error", (error) => {
        reject(new Error(`Network error calling Google: ${error.message}`));
      });

      // Timeout after 10 seconds
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error("Request to Google timed out"));
      });
    });
  }

  /**
   * Find or create user from Google data
   */
  async findOrCreateUser(googleData: GoogleUserData, role: UserRole = UserRole.JOB_SEEKER): Promise<IUser> {
    // First, try to find by googleId
    let user = await User.findOne({ googleId: googleData.googleId });

    if (user) {
      // Update last login
      user.lastLogin = new Date();
      await user.save();
      return user;
    }

    // Try to find by email (in case user registered locally first)
    user = await User.findOne({ email: googleData.email.toLowerCase() });

    if (user) {
      // Link Google account to existing user
      user.googleId = googleData.googleId;
      user.authProvider = "google";
      user.profile.profileImage = user.profile.profileImage || googleData.profileImage;
      user.lastLogin = new Date();
      await user.save();
      return user;
    }

    // Create new user with Google data
    // Generate username from email
    const baseUsername = googleData.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    let username = baseUsername;
    let counter = 1;

    // Ensure unique username
    while (await User.findOne({ username })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    user = new User({
      username,
      email: googleData.email.toLowerCase(),
      // No password for Google users
      role,
      authProvider: "google",
      googleId: googleData.googleId,
      profile: {
        firstName: googleData.firstName,
        lastName: googleData.lastName,
        profileImage: googleData.profileImage,
        skills: [],
      },
      isActive: true,
      lastLogin: new Date(),
    });

    await user.save();
    return user;
  }

  /**
   * Generate JWT token for user
   */
  generateToken(userId: any): string {
    const jwtSecret = config.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not defined");
    }

    const jwtExpire = config.JWT_EXPIRE || "30d";

    return jwt.sign({ id: userId.toString() }, jwtSecret, {
      expiresIn: jwtExpire,
    } as jwt.SignOptions);
  }

  /**
   * Complete Google authentication flow
   */
  async authenticate(idToken: string, role: UserRole = UserRole.JOB_SEEKER): Promise<GoogleAuthResponse> {
    const googleData = await this.verifyGoogleToken(idToken);
    const user = await this.findOrCreateUser(googleData, role);

    const token = this.generateToken(user._id);

    return {
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      token,
    };
  }

  /**
   * Find user by Google ID
   */
  async findUserByGoogleId(googleId: string): Promise<IUser | null> {
    return User.findOne({ googleId }).select("-password -__v").exec();
  }

  /**
   * Link Google account to existing user
   */
  async linkGoogleToUser(userId: string, googleData: GoogleUserData): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.googleId = googleData.googleId;
    user.authProvider = "google";
    user.profile.profileImage = user.profile.profileImage || googleData.profileImage;
    user.lastLogin = new Date();
    await user.save();

    return user;
  }

  /**
   * Unlink Google account from user
   */
  async unlinkGoogleFromUser(userId: string): Promise<IUser | null> {
    const user = await User.findById(userId);
    if (!user) {
      return null;
    }

    user.googleId = undefined;
    user.authProvider = "local";
    await user.save();

    return user;
  }
}

export default new GoogleAuthService();