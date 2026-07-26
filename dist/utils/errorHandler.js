export class AppError extends Error {
    statusCode;
    status;
    isOperational;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
export const errorHandler = (err, req, res, next) => {
    const statusCode = typeof err.statusCode === "number" ? err.statusCode : 500;
    const message = err.message || "Something went wrong";
    const status = statusCode >= 400 && statusCode < 500 ? "fail" : "error";
    console.error("❌ Error:", {
        statusCode,
        status,
        message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });
    if (process.env.NODE_ENV === "development") {
        res.status(statusCode).json({
            success: false,
            status,
            message,
            stack: err.stack,
            path: req.path,
            method: req.method,
        });
    }
    else {
        if (err.isOperational) {
            res.status(statusCode).json({
                success: false,
                message,
            });
        }
        else {
            console.error("💥 Unhandled error:", err);
            res.status(500).json({
                success: false,
                message: "Something went wrong",
            });
        }
    }
};
export default { AppError, errorHandler };
