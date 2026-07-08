// src/routes/users.routes.ts
import express, { Request, Response, Router } from "express";
import userService from "../services/userService.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { UserRole } from "../models/User.models.js";

const router: Router = express.Router();

// ============ Helper Functions ============

// ✅ Helper for params (string | string[])
const getStringParam = (param: string | string[] | undefined): string => {
  if (!param) return "";
  if (Array.isArray(param)) {
    return param[0] || "";
  }
  return param;
};

// ✅ Helper for query parameters
const getStringQueryParam = (value: any): string | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value[0]?.toString();
  }
  if (typeof value === "object" && value !== null) {
    return value.toString();
  }
  return value.toString();
};

// ✅ Helper for number query parameters
const getNumberQueryParam = (value: any, defaultValue: number): number => {
  const str = getStringQueryParam(value);
  if (!str) return defaultValue;
  const num = parseInt(str, 10);
  return isNaN(num) ? defaultValue : num;
};

// ✅ Helper for boolean query parameters
const getBooleanQueryParam = (value: any): boolean | undefined => {
  const str = getStringQueryParam(value);
  if (str === undefined) return undefined;
  return str === "true" || str === "1";
};

// ✅ Helper to get user ID from request
const getUserId = (req: Request): string | null => {
  const user = (req as any).user;
  if (!user) return null;
  return user.id?.toString() || null;
};

// ============ Public Routes ============

// Check if email is available
router.get(
  "/check-email",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const email = getStringQueryParam(req.query.email);

      if (!email) {
        res.status(400).json({ error: "Email is required" });
        return;
      }

      const isAvailable = await userService.isEmailAvailable(email);
      res.json({
        success: true,
        data: {
          email,
          isAvailable,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to check email";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// Check if username is available
router.get(
  "/check-username",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const username = getStringQueryParam(req.query.username);

      if (!username) {
        res.status(400).json({ error: "Username is required" });
        return;
      }

      const isAvailable = await userService.isUsernameAvailable(username);
      res.json({
        success: true,
        data: {
          username,
          isAvailable,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to check username";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// ============ Protected Routes ============

// Get current user profile
router.get(
  "/profile",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const user = await userService.getUserById(userId);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to get profile";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// Update current user profile
router.put(
  "/profile",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const { profile } = req.body;

      const user = await userService.updateProfile(userId, profile);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: user,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update profile";
      res.status(400).json({ error: errorMessage });
    }
  },
);

// Change password
router.put(
  "/change-password",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res
          .status(400)
          .json({ error: "Current password and new password are required" });
        return;
      }

      if (newPassword.length < 6) {
        res
          .status(400)
          .json({ error: "New password must be at least 6 characters" });
        return;
      }

      const result = await userService.changePassword(userId, {
        currentPassword,
        newPassword,
      });

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to change password";
      res.status(400).json({ error: errorMessage });
    }
  },
);

// Deactivate own account
router.delete(
  "/deactivate",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const user = await userService.deactivateUser(userId);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        success: true,
        message: "Account deactivated successfully",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to deactivate account";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// Reactivate own account
router.post(
  "/reactivate",
  protect,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const user = await userService.activateUser(userId);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        success: true,
        message: "Account reactivated successfully",
        data: user,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to reactivate account";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// ============ Admin Routes ============

// Get all users (admin only)
router.get(
  "/",
  protect,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const page = getNumberQueryParam(req.query.page, 1);
      const limit = getNumberQueryParam(req.query.limit, 10);
      const role = getStringQueryParam(req.query.role) as UserRole | undefined;
      const isActive = getBooleanQueryParam(req.query.isActive);
      const search = getStringQueryParam(req.query.search);
      const skillsParam = getStringQueryParam(req.query.skills);
      const sortBy = getStringQueryParam(req.query.sortBy) || "createdAt";
      const sortOrder =
        (getStringQueryParam(req.query.sortOrder) as "asc" | "desc") || "desc";

      const skills = skillsParam ? skillsParam.split(",") : undefined;

      const result = await userService.getUsers(
        {
          role,
          isActive,
          search,
          skills,
        },
        {
          page,
          limit,
          sortBy,
          sortOrder,
        },
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to get users";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// Get user by ID (admin only)
router.get(
  "/:id",
  protect,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      // ✅ Use getStringParam for params
      const id = getStringParam(req.params.id);

      if (!id) {
        res.status(400).json({ error: "Invalid user ID" });
        return;
      }

      const user = await userService.getUserById(id);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to get user";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// Update user (admin only)
router.put(
  "/:id",
  protect,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);

      if (!id) {
        res.status(400).json({ error: "Invalid user ID" });
        return;
      }

      const updateData = req.body;
      const user = await userService.updateUser(id, updateData);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        success: true,
        message: "User updated successfully",
        data: user,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update user";
      res.status(400).json({ error: errorMessage });
    }
  },
);

// Update user role (admin only)
router.patch(
  "/:id/role",
  protect,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);

      if (!id) {
        res.status(400).json({ error: "Invalid user ID" });
        return;
      }

      const { role } = req.body;

      if (!role || !Object.values(UserRole).includes(role)) {
        res.status(400).json({ error: "Invalid role" });
        return;
      }

      const user = await userService.updateUser(id, { role });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        success: true,
        message: "User role updated successfully",
        data: user,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update user role";
      res.status(400).json({ error: errorMessage });
    }
  },
);

// Activate user (admin only)
router.patch(
  "/:id/activate",
  protect,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);

      if (!id) {
        res.status(400).json({ error: "Invalid user ID" });
        return;
      }

      const user = await userService.activateUser(id);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        success: true,
        message: "User activated successfully",
        data: user,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to activate user";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// Deactivate user (admin only)
router.patch(
  "/:id/deactivate",
  protect,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);

      if (!id) {
        res.status(400).json({ error: "Invalid user ID" });
        return;
      }

      const user = await userService.deactivateUser(id);

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        success: true,
        message: "User deactivated successfully",
        data: user,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to deactivate user";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// Delete user (admin only)
router.delete(
  "/:id",
  protect,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);

      if (!id) {
        res.status(400).json({ error: "Invalid user ID" });
        return;
      }

      const deleted = await userService.deleteUser(id);

      if (!deleted) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete user";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// Bulk update user roles (admin only)
router.patch(
  "/bulk/roles",
  protect,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userIds, role } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({ error: "User IDs array is required" });
        return;
      }

      if (!role || !Object.values(UserRole).includes(role)) {
        res.status(400).json({ error: "Invalid role" });
        return;
      }

      const result = await userService.bulkUpdateRoles(userIds, role);

      res.json({
        success: true,
        message: `Updated ${result.updated} users, ${result.failed.length} failed`,
        data: result,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to bulk update roles";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// Bulk deactivate users (admin only)
router.patch(
  "/bulk/deactivate",
  protect,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userIds } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({ error: "User IDs array is required" });
        return;
      }

      const result = await userService.bulkDeactivateUsers(userIds);

      res.json({
        success: true,
        message: `Deactivated ${result.deactivated} users, ${result.failed.length} failed`,
        data: result,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to bulk deactivate users";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// Get user statistics (admin only)
router.get(
  "/stats/overview",
  protect,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await userService.getUserStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to get user statistics";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// Search users by skills (admin only)
router.get(
  "/search/skills",
  protect,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const skillsParam = getStringQueryParam(req.query.skills);

      if (!skillsParam) {
        res.status(400).json({ error: "Skills parameter is required" });
        return;
      }

      const skillArray = skillsParam.split(",");
      const users = await userService.searchBySkills(skillArray);

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to search users by skills";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// Get users by role (admin only)
router.get(
  "/role/:role",
  protect,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const role = getStringParam(req.params.role);

      if (!role || !Object.values(UserRole).includes(role as UserRole)) {
        res.status(400).json({ error: "Invalid role" });
        return;
      }

      const page = getNumberQueryParam(req.query.page, 1);
      const limit = getNumberQueryParam(req.query.limit, 10);

      const result = await userService.getUsersByRole(role as UserRole, {
        page,
        limit,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to get users by role";
      res.status(500).json({ error: errorMessage });
    }
  },
);

// Get active users (admin only)
router.get(
  "/active/all",
  protect,
  authorize(UserRole.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const page = getNumberQueryParam(req.query.page, 1);
      const limit = getNumberQueryParam(req.query.limit, 10);

      const result = await userService.getActiveUsers({
        page,
        limit,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to get active users";
      res.status(500).json({ error: errorMessage });
    }
  },
);

export default router;
