// src/utils/routeHelpers.ts
import { Request } from "express";

/**
 * Safely get a string parameter from req.params
 */
export const getStringParam = (
  param: string | string[] | undefined,
): string => {
  if (!param) return "";
  if (Array.isArray(param)) {
    return param[0] || "";
  }
  return param;
};

/**
 * Safely get user ID from request
 */
export const getUserId = (req: Request): string | null => {
  const user = (req as any).user;
  if (!user) return null;
  return user.id?.toString() || null;
};

/**
 * Safely get a string query parameter
 */
export const getQueryParam = (
  value: string | string[] | undefined,
): string | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

/**
 * Safely get a number query parameter
 */
export const getNumberQueryParam = (
  value: string | string[] | undefined,
  defaultValue: number = 0,
): number => {
  const str = getQueryParam(value);
  if (!str) return defaultValue;
  const num = parseInt(str, 10);
  return isNaN(num) ? defaultValue : num;
};
