import { Response } from "express";

/**
 * Standardized API response format.
 * All responses now consistently use: { success, data, message, meta? }
 */

export interface ApiResponseOptions {
  meta?: Record<string, any>;
  statusCode?: number;
}

/**
 * Send a successful response
 * @param res - Express Response object
 * @param data - Response payload (can be any value, including null)
 * @param message - Success message
 * @param statusCode - HTTP status code (default: 200)
 * @param meta - Optional metadata (pagination, additional info, etc.)
 */
export const sendSuccess = (
  res: Response,
  data: any,
  message?: string,
  statusCode = 200,
  meta?: Record<string, any>,
) => {
  const response: { success: boolean; data: any; message?: string; meta?: any } = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send an error response
 * @param res - Express Response object
 * @param error - Error message or Error instance
 * @param statusCode - HTTP status code (default: 500)
 * @param meta - Optional metadata
 */
export const sendError = (
  res: Response,
  error: any,
  statusCode = 500,
  meta?: Record<string, any>,
) => {
  const message = error instanceof Error ? error.message : "An error occurred";

  const response: { success: boolean; error: string; message?: string; meta?: any } = {
    success: false,
    error: message,
  };

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};