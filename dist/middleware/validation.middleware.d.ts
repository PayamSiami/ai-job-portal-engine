import { Request, Response, NextFunction } from "express";
import { ValidationChain } from "express-validator";
export declare const validateRegistration: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => void))[];
export declare const validateLogin: (ValidationChain | ((req: Request, res: Response, next: NextFunction) => void))[];
/**
 * Validate request with express-validator
 */
export declare const validate: (validations: ValidationChain[]) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Validate required fields in request body
 */
export declare const validateRequired: (fields: string[]) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validation.middleware.d.ts.map