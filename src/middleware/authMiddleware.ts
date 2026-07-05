// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User.models.js";
import { config } from "../config/index.js";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

interface DecodedToken {
  id: string;
  iat: number;
  exp: number;
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  let token: string | undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      if (!token) {
        res.status(401).json({ error: "Not authorized, no token" });
        return;
      }

      const decoded = jwt.verify(
        token,
        config.JWT_SECRET as string,
      ) as DecodedToken;

      const user = await User.findById(decoded.id).select("-password");

      if (!user) {
        res.status(401).json({ error: "Not authorized, user not found" });
        return;
      }

      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({ error: "Not authorized, token failed" });
    }
  } else {
    res.status(401).json({ error: "Not authorized, no token" });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Not authorized, user not found" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `User role ${req.user.role} is not authorized to access this route`,
      });
      return;
    }

    next();
  };
};
