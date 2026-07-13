// backend/src/utils/errorHandler.ts
import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // ✅ Ensure statusCode is a number - THIS IS THE KEY FIX
  const statusCode = typeof err.statusCode === "number" ? err.statusCode : 500;
  const message = err.message || "Something went wrong";

  // ✅ Use statusCode, NOT err.status
  const status = statusCode >= 400 && statusCode < 500 ? "fail" : "error";

  console.error("❌ Error:", {
    statusCode,
    status,
    message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Development error response
  if (process.env.NODE_ENV === "development") {
    res.status(statusCode).json({
      success: false,
      status,
      message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  } else {
    // Production error response
    if (err.isOperational) {
      res.status(statusCode).json({
        success: false,
        message,
      });
    } else {
      // Programming or other unknown error: don't leak error details
      console.error("💥 Unhandled error:", err);
      res.status(500).json({
        success: false,
        message: "Something went wrong",
      });
    }
  }
};

export default { AppError, errorHandler };
