// src/services/userService.ts
import User, { IUser, UserRole } from "../models/User.models.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import logger from "../utils/logger.js";

// ============ Type Definitions ============

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

// ============ Service Class ============

class UserService {
  /**
   * Create a new user
   */
  async createUser(data: CreateUserData): Promise<IUser> {
    try {
      logger.info("Creating new user", {
        username: data.username,
        email: data.email,
      });

      // Check if email already exists
      const existingEmail = await User.findOne({
        email: data.email.toLowerCase(),
      });
      if (existingEmail) {
        throw new Error("Email already registered");
      }

      // Check if username already exists
      const existingUsername = await User.findOne({ username: data.username });
      if (existingUsername) {
        throw new Error("Username already taken");
      }

      // Create user
      const user = new User({
        username: data.username,
        email: data.email.toLowerCase(),
        password: data.password,
        role: data.role || UserRole.JOB_SEEKER,
        profile: {
          firstName: data.profile?.firstName || "",
          lastName: data.profile?.lastName || "",
          headline: data.profile?.headline || "",
          location: data.profile?.location || "",
          skills: data.profile?.skills || [],
          experience: data.profile?.experience || 0,
          education: data.profile?.education || "",
          bio: data.profile?.bio || "",
        },
        isActive: true,
      });

      await user.save();

      logger.info("User created successfully", { userId: user._id });
      return user;
    } catch (error) {
      logger.error("Failed to create user", {
        error: error instanceof Error ? error.message : "Unknown error",
        data,
      });
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<IUser | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid user ID");
      }

      return User.findById(userId).select("-password -__v").exec();
    } catch (error) {
      logger.error("Failed to get user", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<IUser | null> {
    try {
      return User.findOne({ email: email.toLowerCase() })
        .select("-password -__v")
        .exec();
    } catch (error) {
      logger.error("Failed to get user by email", {
        error: error instanceof Error ? error.message : "Unknown error",
        email,
      });
      throw error;
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<IUser | null> {
    try {
      return User.findOne({ username }).select("-password -__v").exec();
    } catch (error) {
      logger.error("Failed to get user by username", {
        error: error instanceof Error ? error.message : "Unknown error",
        username,
      });
      throw error;
    }
  }

  /**
   * Get users with filters and pagination
   */
  async getUsers(
    filters: UserFilters = {},
    options: PaginationOptions = {},
  ): Promise<UserPaginationResult> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;
      const skip = (page - 1) * limit;

      // Build query
      const query: any = {};

      if (filters.role) {
        query.role = filters.role;
      }

      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }

      if (filters.search) {
        query.$or = [
          { username: { $regex: filters.search, $options: "i" } },
          { email: { $regex: filters.search, $options: "i" } },
          { "profile.firstName": { $regex: filters.search, $options: "i" } },
          { "profile.lastName": { $regex: filters.search, $options: "i" } },
        ];
      }

      if (filters.skills && filters.skills.length > 0) {
        query["profile.skills"] = { $in: filters.skills };
      }

      const sort: any = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      const [users, total] = await Promise.all([
        User.find(query)
          .select("-password -__v")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        User.countDocuments(query),
      ]);

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to get users", {
        error: error instanceof Error ? error.message : "Unknown error",
        filters,
        options,
      });
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(
    userId: string,
    data: UpdateUserData,
  ): Promise<IUser | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid user ID");
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Check if email is being updated and is not taken
      if (data.email && data.email !== user.email) {
        const existing = await User.findOne({
          email: data.email.toLowerCase(),
        });
        if (existing) {
          throw new Error("Email already taken");
        }
        data.email = data.email.toLowerCase();
      }

      // Check if username is being updated and is not taken
      if (data.username && data.username !== user.username) {
        const existing = await User.findOne({ username: data.username });
        if (existing) {
          throw new Error("Username already taken");
        }
      }

      // Update user
      const updated = await User.findByIdAndUpdate(
        userId,
        { ...data, updatedAt: new Date() },
        { new: true, runValidators: true },
      ).select("-password -__v");

      logger.info("User updated", { userId });
      return updated;
    } catch (error) {
      logger.error("Failed to update user", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
        data,
      });
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    profileData: {
      firstName?: string;
      lastName?: string;
      headline?: string;
      location?: string;
      skills?: string[];
      experience?: number;
      education?: string;
      bio?: string;
    },
  ): Promise<IUser | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid user ID");
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Update profile fields
      if (profileData.firstName !== undefined)
        user.profile.firstName = profileData.firstName;
      if (profileData.lastName !== undefined)
        user.profile.lastName = profileData.lastName;
      if (profileData.headline !== undefined)
        user.profile.headline = profileData.headline;
      if (profileData.location !== undefined)
        user.profile.location = profileData.location;
      if (profileData.skills !== undefined)
        user.profile.skills = profileData.skills;
      if (profileData.experience !== undefined)
        user.profile.experience = profileData.experience;
      if (profileData.education !== undefined)
        user.profile.education = profileData.education;
      if (profileData.bio !== undefined) user.profile.bio = profileData.bio;

      await user.save();

      logger.info("User profile updated", { userId });
      return user.toPublicJSON() as IUser;
    } catch (error) {
      logger.error("Failed to update user profile", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
        profileData,
      });
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    data: ChangePasswordData,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid user ID");
      }

      const user = await User.findById(userId).select("+password");
      if (!user) {
        throw new Error("User not found");
      }

      // Verify current password
      const isMatch = await user.comparePassword(data.currentPassword);
      if (!isMatch) {
        throw new Error("Current password is incorrect");
      }

      // Update password
      user.password = data.newPassword;
      await user.save();

      logger.info("Password changed", { userId });
      return {
        success: true,
        message: "Password updated successfully",
      };
    } catch (error) {
      logger.error("Failed to change password", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });
      throw error;
    }
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(userId: string): Promise<IUser | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid user ID");
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { isActive: false },
        { new: true },
      ).select("-password -__v");

      if (user) {
        logger.info("User deactivated", { userId });
      }

      return user;
    } catch (error) {
      logger.error("Failed to deactivate user", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });
      throw error;
    }
  }

  /**
   * Activate user
   */
  async activateUser(userId: string): Promise<IUser | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid user ID");
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { isActive: true },
        { new: true },
      ).select("-password -__v");

      if (user) {
        logger.info("User activated", { userId });
      }

      return user;
    } catch (error) {
      logger.error("Failed to activate user", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });
      throw error;
    }
  }

  /**
   * Delete user (permanent)
   */
  async deleteUser(userId: string): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error("Invalid user ID");
      }

      const result = await User.findByIdAndDelete(userId);

      if (result) {
        logger.info("User permanently deleted", { userId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error("Failed to delete user", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<UserStats> {
    try {
      const [
        total,
        active,
        inactive,
        byRoleAgg,
        recentRegistrations,
        withResume,
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ isActive: false }),
        User.aggregate([
          {
            $group: {
              _id: "$role",
              count: { $sum: 1 },
            },
          },
        ]),
        User.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        }),
        User.countDocuments({ resumeId: { $exists: true, $ne: null } }),
      ]);

      const byRole: Record<UserRole, number> = {
        [UserRole.ADMIN]: 0,
        [UserRole.JOB_SEEKER]: 0,
        [UserRole.EMPLOYER]: 0,
      };

      byRoleAgg.forEach((item: any) => {
        byRole[item._id as UserRole] = item.count;
      });

      return {
        total,
        active,
        inactive,
        byRole,
        recentRegistrations,
        withResume,
      };
    } catch (error) {
      logger.error("Failed to get user statistics", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Search users by skills
   */
  async searchBySkills(skills: string[]): Promise<IUser[]> {
    try {
      if (!skills || skills.length === 0) {
        throw new Error("Skills array is required");
      }

      return User.find({
        isActive: true,
        "profile.skills": { $in: skills },
      })
        .select("-password -__v")
        .sort({ "profile.experience": -1 })
        .exec();
    } catch (error) {
      logger.error("Failed to search users by skills", {
        error: error instanceof Error ? error.message : "Unknown error",
        skills,
      });
      throw error;
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(
    role: UserRole,
    options: PaginationOptions = {},
  ): Promise<UserPaginationResult> {
    return this.getUsers({ role }, options);
  }

  /**
   * Get active users
   */
  async getActiveUsers(
    options: PaginationOptions = {},
  ): Promise<UserPaginationResult> {
    return this.getUsers({ isActive: true }, options);
  }

  /**
   * Check if email is available
   */
  async isEmailAvailable(email: string): Promise<boolean> {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      return !user;
    } catch (error) {
      logger.error("Failed to check email availability", {
        error: error instanceof Error ? error.message : "Unknown error",
        email,
      });
      throw error;
    }
  }

  /**
   * Check if username is available
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    try {
      const user = await User.findOne({ username });
      return !user;
    } catch (error) {
      logger.error("Failed to check username availability", {
        error: error instanceof Error ? error.message : "Unknown error",
        username,
      });
      throw error;
    }
  }

  /**
   * Bulk update user roles
   */
  async bulkUpdateRoles(
    userIds: string[],
    role: UserRole,
  ): Promise<{ updated: number; failed: string[] }> {
    try {
      const failed: string[] = [];
      let updated = 0;

      for (const id of userIds) {
        try {
          const result = await User.findByIdAndUpdate(
            id,
            { role },
            { new: true },
          );
          if (result) {
            updated++;
          } else {
            failed.push(id);
          }
        } catch (error) {
          failed.push(id);
          logger.error("Failed to update user role", {
            error: error instanceof Error ? error.message : "Unknown error",
            userId: id,
            role,
          });
        }
      }

      return { updated, failed };
    } catch (error) {
      logger.error("Failed to bulk update user roles", {
        error: error instanceof Error ? error.message : "Unknown error",
        userIds,
        role,
      });
      throw error;
    }
  }

  /**
   * Bulk deactivate users
   */
  async bulkDeactivateUsers(
    userIds: string[],
  ): Promise<{ deactivated: number; failed: string[] }> {
    try {
      const failed: string[] = [];
      let deactivated = 0;

      for (const id of userIds) {
        try {
          const result = await this.deactivateUser(id);
          if (result) {
            deactivated++;
          } else {
            failed.push(id);
          }
        } catch (error) {
          failed.push(id);
          logger.error("Failed to deactivate user", {
            error: error instanceof Error ? error.message : "Unknown error",
            userId: id,
          });
        }
      }

      return { deactivated, failed };
    } catch (error) {
      logger.error("Failed to bulk deactivate users", {
        error: error instanceof Error ? error.message : "Unknown error",
        userIds,
      });
      throw error;
    }
  }

  /**
   * Validate user credentials
   */
  async validateCredentials(
    email: string,
    password: string,
  ): Promise<IUser | null> {
    try {
      const user = await User.findOne({ email: email.toLowerCase() }).select(
        "+password",
      );

      if (!user) {
        return null;
      }

      if (!user.isActive) {
        throw new Error("Account is deactivated");
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return null;
      }

      return user;
    } catch (error) {
      logger.error("Failed to validate credentials", {
        error: error instanceof Error ? error.message : "Unknown error",
        email,
      });
      throw error;
    }
  }

  /**
   * Update user resume association
   */
  async updateUserResume(
    userId: string,
    resumeId: string,
  ): Promise<IUser | null> {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(userId) ||
        !mongoose.Types.ObjectId.isValid(resumeId)
      ) {
        throw new Error("Invalid ID format");
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { resumeId },
        { new: true },
      ).select("-password -__v");

      if (user) {
        logger.info("User resume updated", { userId, resumeId });
      }

      return user;
    } catch (error) {
      logger.error("Failed to update user resume", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
        resumeId,
      });
      throw error;
    }
  }

  /**
   * Get user by resume ID
   */
  async getUserByResumeId(resumeId: string): Promise<IUser | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(resumeId)) {
        throw new Error("Invalid resume ID");
      }

      return User.findOne({ resumeId }).select("-password -__v").exec();
    } catch (error) {
      logger.error("Failed to get user by resume ID", {
        error: error instanceof Error ? error.message : "Unknown error",
        resumeId,
      });
      throw error;
    }
  }
}

export default new UserService();
