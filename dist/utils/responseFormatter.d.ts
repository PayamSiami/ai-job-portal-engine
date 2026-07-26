import { Response } from "express";
export declare const sendSuccess: (res: Response, data: any, message?: string, statusCode?: number) => Response<any, Record<string, any>>;
export declare const sendError: (res: Response, error: any, statusCode?: number) => Response<any, Record<string, any>>;
//# sourceMappingURL=responseFormatter.d.ts.map