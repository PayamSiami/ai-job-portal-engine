// src/middleware/validationMiddleware.ts
import { Request, Response, NextFunction } from "express";
import { body, ValidationChain, validationResult } from "express-validator";
import { AppError } from "../utils/errorHandler.js";

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
    .isIn(["admin", "job-seeker", "employer"])
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

/**
 * Validate request with express-validator
 */
export const validate = (validations: ValidationChain[]) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const errorMessages = errors.array().map((err) => err.msg);
    throw new AppError(errorMessages.join(", "), 400);
  };
};

/**
 * Validate required fields in request body
 */
export const validateRequired = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missingFields = fields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      throw new AppError(
        `Missing required fields: ${missingFields.join(", ")}`,
        400,
      );
    }

    next();
  };
};