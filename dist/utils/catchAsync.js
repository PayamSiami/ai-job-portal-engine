/**
 * Wraps an async route handler to catch any errors and pass them to Express error handler
 * @param fn - The async route handler function
 * @returns A wrapped function that catches errors
 */
export const catchAsync = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};
// For backward compatibility with CommonJS
export default catchAsync;
