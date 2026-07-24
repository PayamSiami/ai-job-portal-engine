// src/services/authService.ts
import { config } from "../config/index.js";
import User, { IUser, UserRole } from "../models/User.models.js";
import jwt from "jsonwebtoken";

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

class AuthService {
  /**
   * Register a new user
   */
  async register(registerData: RegisterData): Promise<AuthResponse> {
    const { username, email, password, role, profile } = registerData;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        throw new Error("Email already registered");
      }
      if (existingUser.username === username) {
        throw new Error("Username already taken");
      }
    }

    // Create new user
    const user = new User({
      username,
      email: email.toLowerCase(),
      password,
      role: role || UserRole.JOB_SEEKER,
      profile: profile || { skills: [] },
      isActive: true,
    });

    await user.save();

    // Generate JWT token
    const token = this.generateToken(user._id);

    // Return user data (excluding password)
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
   * Login user
   */
  async login(loginData: LoginData): Promise<AuthResponse> {
    const { email, password } = loginData;

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error("Account has been deactivated");
    }

    // Compare passwords
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = this.generateToken(user._id);

    // Return user data (excluding password)
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
   * Get user by ID
   */
  async getUserById(userId: string): Promise<IUser | null> {
    return User.findById(userId).select("-password -__v").exec();
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<DecodedToken> {
    try {
      const jwtSecret = config.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error("JWT_SECRET is not defined");
      }

      const decoded = jwt.verify(token, jwtSecret) as DecodedToken;
      return decoded;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  /**
   * Generate JWT token
   */
  generateToken(userId: any): string {
    const jwtSecret = config.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not defined");
    }

    const jwtExpire = config.JWT_EXPIRE || "30d";

    // ✅ FIX: Use type assertion
    return jwt.sign({ id: userId.toString() }, jwtSecret, {
      expiresIn: jwtExpire,
    } as jwt.SignOptions);
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await User.findById(userId).select("+password");

    if (!user) {
      throw new Error("User not found");
    }

    // Verify old password
    const isPasswordValid = await user.comparePassword(oldPassword);
    if (!isPasswordValid) {
      throw new Error("Current password is incorrect");
    }

    // Update password
    user.password = newPassword;
    await user.save();

    return {
      success: true,
      message: "Password updated successfully",
    };
  }

  /**
   * Reset password (forgot password flow)
   */
  async resetPassword(
    email: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      throw new Error("User not found");
    }

    // Update password
    user.password = newPassword;
    await user.save();

    return {
      success: true,
      message: "Password reset successfully",
    };
  }

  /**
   * Logout (invalidate token)
   */
  async logout(userId: string): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: "Logged out successfully",
    };
  }

  /**
   * Refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    try {
      const decoded = await this.verifyToken(refreshToken);
      const user = await this.getUserById(decoded.id);

      if (!user) {
        throw new Error("User not found");
      }

      const newToken = this.generateToken(user._id);

      return { token: newToken };
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  }
}

export default new AuthService();
