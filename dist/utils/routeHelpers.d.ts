import { Request } from "express";
/**
 * Safely get a string parameter from req.params
 */
export declare const getStringParam: (param: string | string[] | undefined) => string;
/**
 * Safely get user ID from request
 */
export declare const getUserId: (req: Request) => string | null;
/**
 * Safely get a string query parameter
 */
export declare const getQueryParam: (value: string | string[] | undefined) => string | undefined;
/**
 * Safely get a number query parameter
 */
export declare const getNumberQueryParam: (value: string | string[] | undefined, defaultValue?: number) => number;
//# sourceMappingURL=routeHelpers.d.ts.map