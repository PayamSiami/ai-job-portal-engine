import { Request, Response, NextFunction } from "express";
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            user?: any;
        }
    }
}
/**
 * Protect route - verify JWT token
 */
export declare const protect: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Authorize based on user role
 */
export declare const authorize: (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=authMiddleware.d.ts.map