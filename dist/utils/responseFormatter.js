export const sendSuccess = (res, data, message, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        data,
        message,
    });
};
export const sendError = (res, error, statusCode = 500) => {
    const message = error instanceof Error ? error.message : "An error occurred";
    return res.status(statusCode).json({
        success: false,
        error: message,
    });
};
//# sourceMappingURL=responseFormatter.js.map