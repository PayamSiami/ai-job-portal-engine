import jwt from "jsonwebtoken";
import { AppError } from "../utils/errorHandler.js";
import User from "../models/User.models.js";
/**
 * Protect route - verify JWT token
 */
export const protect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization?.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        }
        if (!token) {
            throw new AppError("You are not logged in. Please log in to access this resource.", 401);
        }
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
        const user = await User.findById(decoded.id).select("-password");
        if (!user) {
            res.status(401).json({ error: "Not authorized, user not found" });
            return;
        }
        // Attach user ID to request
        req.userId = decoded.id;
        req.user = user;
        next();
    }
    catch (error) {
        if (error instanceof AppError) {
            next(error);
        }
        else {
            next(new AppError("Invalid token. Please log in again.", 401));
        }
    }
};
/**
 * Authorize based on user role
 */
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            throw new AppError("User role not found", 403);
        }
        if (!roles.includes(req.user.role)) {
            throw new AppError(`Access denied. Required role: ${roles.join(" or ")}`, 403);
        }
        next();
    };
};
