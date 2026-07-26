import { Request, Response, NextFunction } from "express";
export declare class AppError extends Error {
    statusCode: number;
    status: string;
    isOperational: boolean;
    constructor(message: string, statusCode: number);
}
export declare const errorHandler: (err: any, req: Request, res: Response, next: NextFunction) => void;
declare const _default: {
    AppError: typeof AppError;
    errorHandler: typeof errorHandler;
};
export default _default;
//# sourceMappingURL=errorHandler.d.ts.map