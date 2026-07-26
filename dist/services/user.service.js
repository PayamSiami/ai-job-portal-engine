import User, { UserRole } from "../models/User.models";
import mongoose from "mongoose";
import logger from "../utils/logger";
class UserService {
    async createUser(data) {
        try {
            logger.info("Creating new user", {
                username: data.username,
                email: data.email,
            });
            const existingEmail = await User.findOne({
                email: data.email.toLowerCase(),
            });
            if (existingEmail) {
                throw new Error("Email already registered");
            }
            const existingUsername = await User.findOne({ username: data.username });
            if (existingUsername) {
                throw new Error("Username already taken");
            }
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
        }
        catch (error) {
            logger.error("Failed to create user", {
                error: error instanceof Error ? error.message : "Unknown error",
                data,
            });
            throw error;
        }
    }
    async getUserById(userId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                throw new Error("Invalid user ID");
            }
            return User.findById(userId).select("-password -__v").exec();
        }
        catch (error) {
            logger.error("Failed to get user", {
                error: error instanceof Error ? error.message : "Unknown error",
                userId,
            });
            throw error;
        }
    }
    async getUserByEmail(email) {
        try {
            return User.findOne({ email: email.toLowerCase() })
                .select("-password -__v")
                .exec();
        }
        catch (error) {
            logger.error("Failed to get user by email", {
                error: error instanceof Error ? error.message : "Unknown error",
                email,
            });
            throw error;
        }
    }
    async getUserByUsername(username) {
        try {
            return User.findOne({ username }).select("-password -__v").exec();
        }
        catch (error) {
            logger.error("Failed to get user by username", {
                error: error instanceof Error ? error.message : "Unknown error",
                username,
            });
            throw error;
        }
    }
    async getUsers(filters = {}, options = {}) {
        try {
            const { page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", } = options;
            const skip = (page - 1) * limit;
            const query = {};
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
            const sort = {};
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
        }
        catch (error) {
            logger.error("Failed to get users", {
                error: error instanceof Error ? error.message : "Unknown error",
                filters,
                options,
            });
            throw error;
        }
    }
    async updateUser(userId, data) {
        try {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                throw new Error("Invalid user ID");
            }
            const user = await User.findById(userId);
            if (!user) {
                throw new Error("User not found");
            }
            if (data.email && data.email !== user.email) {
                const existing = await User.findOne({
                    email: data.email.toLowerCase(),
                });
                if (existing) {
                    throw new Error("Email already taken");
                }
                data.email = data.email.toLowerCase();
            }
            if (data.username && data.username !== user.username) {
                const existing = await User.findOne({ username: data.username });
                if (existing) {
                    throw new Error("Username already taken");
                }
            }
            const updated = await User.findByIdAndUpdate(userId, { ...data, updatedAt: new Date() }, { new: true, runValidators: true }).select("-password -__v");
            logger.info("User updated", { userId });
            return updated;
        }
        catch (error) {
            logger.error("Failed to update user", {
                error: error instanceof Error ? error.message : "Unknown error",
                userId,
                data,
            });
            throw error;
        }
    }
    async updateProfile(userId, profileData) {
        try {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                throw new Error("Invalid user ID");
            }
            const user = await User.findById(userId);
            if (!user) {
                throw new Error("User not found");
            }
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
            if (profileData.bio !== undefined)
                user.profile.bio = profileData.bio;
            await user.save();
            logger.info("User profile updated", { userId });
            return user.toPublicJSON();
        }
        catch (error) {
            logger.error("Failed to update user profile", {
                error: error instanceof Error ? error.message : "Unknown error",
                userId,
                profileData,
            });
            throw error;
        }
    }
    async changePassword(userId, data) {
        try {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                throw new Error("Invalid user ID");
            }
            const user = await User.findById(userId).select("+password");
            if (!user) {
                throw new Error("User not found");
            }
            const isMatch = await user.comparePassword(data.currentPassword);
            if (!isMatch) {
                throw new Error("Current password is incorrect");
            }
            user.password = data.newPassword;
            await user.save();
            logger.info("Password changed", { userId });
            return {
                success: true,
                message: "Password updated successfully",
            };
        }
        catch (error) {
            logger.error("Failed to change password", {
                error: error instanceof Error ? error.message : "Unknown error",
                userId,
            });
            throw error;
        }
    }
    async deactivateUser(userId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                throw new Error("Invalid user ID");
            }
            const user = await User.findByIdAndUpdate(userId, { isActive: false }, { new: true }).select("-password -__v");
            if (user) {
                logger.info("User deactivated", { userId });
            }
            return user;
        }
        catch (error) {
            logger.error("Failed to deactivate user", {
                error: error instanceof Error ? error.message : "Unknown error",
                userId,
            });
            throw error;
        }
    }
    async activateUser(userId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                throw new Error("Invalid user ID");
            }
            const user = await User.findByIdAndUpdate(userId, { isActive: true }, { new: true }).select("-password -__v");
            if (user) {
                logger.info("User activated", { userId });
            }
            return user;
        }
        catch (error) {
            logger.error("Failed to activate user", {
                error: error instanceof Error ? error.message : "Unknown error",
                userId,
            });
            throw error;
        }
    }
    async deleteUser(userId) {
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
        }
        catch (error) {
            logger.error("Failed to delete user", {
                error: error instanceof Error ? error.message : "Unknown error",
                userId,
            });
            throw error;
        }
    }
    async getUserStats() {
        try {
            const [total, active, inactive, byRoleAgg, recentRegistrations, withResume,] = await Promise.all([
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
            const byRole = {
                [UserRole.ADMIN]: 0,
                [UserRole.JOB_SEEKER]: 0,
                [UserRole.EMPLOYER]: 0,
            };
            byRoleAgg.forEach((item) => {
                byRole[item._id] = item.count;
            });
            return {
                total,
                active,
                inactive,
                byRole,
                recentRegistrations,
                withResume,
            };
        }
        catch (error) {
            logger.error("Failed to get user statistics", {
                error: error instanceof Error ? error.message : "Unknown error",
            });
            throw error;
        }
    }
    async searchBySkills(skills) {
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
        }
        catch (error) {
            logger.error("Failed to search users by skills", {
                error: error instanceof Error ? error.message : "Unknown error",
                skills,
            });
            throw error;
        }
    }
    async getUsersByRole(role, options = {}) {
        return this.getUsers({ role }, options);
    }
    async getActiveUsers(options = {}) {
        return this.getUsers({ isActive: true }, options);
    }
    async isEmailAvailable(email) {
        try {
            const user = await User.findOne({ email: email.toLowerCase() });
            return !user;
        }
        catch (error) {
            logger.error("Failed to check email availability", {
                error: error instanceof Error ? error.message : "Unknown error",
                email,
            });
            throw error;
        }
    }
    async isUsernameAvailable(username) {
        try {
            const user = await User.findOne({ username });
            return !user;
        }
        catch (error) {
            logger.error("Failed to check username availability", {
                error: error instanceof Error ? error.message : "Unknown error",
                username,
            });
            throw error;
        }
    }
    async bulkUpdateRoles(userIds, role) {
        try {
            const failed = [];
            let updated = 0;
            for (const id of userIds) {
                try {
                    const result = await User.findByIdAndUpdate(id, { role }, { new: true });
                    if (result) {
                        updated++;
                    }
                    else {
                        failed.push(id);
                    }
                }
                catch (error) {
                    failed.push(id);
                    logger.error("Failed to update user role", {
                        error: error instanceof Error ? error.message : "Unknown error",
                        userId: id,
                        role,
                    });
                }
            }
            return { updated, failed };
        }
        catch (error) {
            logger.error("Failed to bulk update user roles", {
                error: error instanceof Error ? error.message : "Unknown error",
                userIds,
                role,
            });
            throw error;
        }
    }
    async bulkDeactivateUsers(userIds) {
        try {
            const failed = [];
            let deactivated = 0;
            for (const id of userIds) {
                try {
                    const result = await this.deactivateUser(id);
                    if (result) {
                        deactivated++;
                    }
                    else {
                        failed.push(id);
                    }
                }
                catch (error) {
                    failed.push(id);
                    logger.error("Failed to deactivate user", {
                        error: error instanceof Error ? error.message : "Unknown error",
                        userId: id,
                    });
                }
            }
            return { deactivated, failed };
        }
        catch (error) {
            logger.error("Failed to bulk deactivate users", {
                error: error instanceof Error ? error.message : "Unknown error",
                userIds,
            });
            throw error;
        }
    }
    async validateCredentials(email, password) {
        try {
            const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
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
        }
        catch (error) {
            logger.error("Failed to validate credentials", {
                error: error instanceof Error ? error.message : "Unknown error",
                email,
            });
            throw error;
        }
    }
    async updateUserResume(userId, resumeId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(userId) ||
                !mongoose.Types.ObjectId.isValid(resumeId)) {
                throw new Error("Invalid ID format");
            }
            const user = await User.findByIdAndUpdate(userId, { resumeId }, { new: true }).select("-password -__v");
            if (user) {
                logger.info("User resume updated", { userId, resumeId });
            }
            return user;
        }
        catch (error) {
            logger.error("Failed to update user resume", {
                error: error instanceof Error ? error.message : "Unknown error",
                userId,
                resumeId,
            });
            throw error;
        }
    }
    async getUserByResumeId(resumeId) {
        try {
            if (!mongoose.Types.ObjectId.isValid(resumeId)) {
                throw new Error("Invalid resume ID");
            }
            return User.findOne({ resumeId }).select("-password -__v").exec();
        }
        catch (error) {
            logger.error("Failed to get user by resume ID", {
                error: error instanceof Error ? error.message : "Unknown error",
                resumeId,
            });
            throw error;
        }
    }
}
export default new UserService();
