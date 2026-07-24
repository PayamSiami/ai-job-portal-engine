import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/errorHandler.js";
import { getUserId } from "../utils/routeHelpers.js";
import User from "../models/User.models.js";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: any;
    }
  }
}

/**
 * Protect route - verify JWT token
 */
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw new AppError(
        "You are not logged in. Please log in to access this resource.",
        401,
      );
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key",
    ) as { id: string };

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      res.status(401).json({ error: "Not authorized, user not found" });
      return;
    }

    // Attach user ID to request
    req.userId = decoded.id;
    req.user = user;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError("Invalid token. Please log in again.", 401));
    }
  }
};

/**
 * Authorize based on user role
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.role) {
      throw new AppError("User role not found", 403);
    }

    if (!roles.includes(req.user.role)) {
      throw new AppError(
        `Access denied. Required role: ${roles.join(" or ")}`,
        403,
      );
    }

    next();
  };
};
