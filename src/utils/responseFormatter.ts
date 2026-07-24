import { Response } from "express";

export const sendSuccess = (
  res: Response,
  data: any,
  message?: string,
  statusCode = 200,
) => {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
  });
};

export const sendError = (res: Response, error: any, statusCode = 500) => {
  const message = error instanceof Error ? error.message : "An error occurred";
  return res.status(statusCode).json({
    success: false,
    error: message,
  });
};
