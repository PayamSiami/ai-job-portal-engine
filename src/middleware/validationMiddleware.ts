// src/middleware/validationMiddleware.ts
import { Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";

// Validation for registration
export const validateRegistration = [
  body("username")
    .trim()
    .isLength({ min: 3 })
    .withMessage("Username must be at least 3 characters"),

  body("email").isEmail().withMessage("Please include a valid email"),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),

  body("role")
    .isIn(["admin", "job_seeker", "employer"])
    .withMessage("Invalid role"),

  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    next();
  },
];

// Validation for login
export const validateLogin = [
  body("email").isEmail().withMessage("Please include a valid email"),

  body("password").exists().withMessage("Password is required"),

  (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    next();
  },
];
