/**
 * Send a successful response
 * @param res - Express Response object
 * @param data - Response payload (can be any value, including null)
 * @param message - Success message
 * @param statusCode - HTTP status code (default: 200)
 * @param meta - Optional metadata (pagination, additional info, etc.)
 */
export const sendSuccess = (res, data, message, statusCode = 200, meta) => {
    const response = {
        success: true,
        data,
    };
    if (message) {
        response.message = message;
    }
    if (meta) {
        response.meta = meta;
    }
    return res.status(statusCode).json(response);
};
/**
 * Send an error response
 * @param res - Express Response object
 * @param error - Error message or Error instance
 * @param statusCode - HTTP status code (default: 500)
 * @param meta - Optional metadata
 */
export const sendError = (res, error, statusCode = 500, meta) => {
    const message = error instanceof Error ? error.message : "An error occurred";
    const response = {
        success: false,
        error: message,
    };
    if (meta) {
        response.meta = meta;
    }
    return res.status(statusCode).json(response);
};
