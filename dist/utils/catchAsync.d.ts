import { Request, Response, NextFunction } from "express";
/**
 * Wraps an async route handler to catch any errors and pass them to Express error handler
 * @param fn - The async route handler function
 * @returns A wrapped function that catches errors
 */
export declare const catchAsync: (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => void;
export default catchAsync;
//# sourceMappingURL=catchAsync.d.ts.map