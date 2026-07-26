/**
 * Safely get a string parameter from req.params
 */
export const getStringParam = (param) => {
    if (!param)
        return "";
    if (Array.isArray(param)) {
        return param[0] || "";
    }
    return param;
};
/**
 * Safely get user ID from request
 */
export const getUserId = (req) => {
    const user = req.user;
    if (!user)
        return null;
    return user.id?.toString() || null;
};
/**
 * Safely get a string query parameter
 */
export const getQueryParam = (value) => {
    if (!value)
        return undefined;
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
};
/**
 * Safely get a number query parameter
 */
export const getNumberQueryParam = (value, defaultValue = 0) => {
    const str = getQueryParam(value);
    if (!str)
        return defaultValue;
    const num = parseInt(str, 10);
    return isNaN(num) ? defaultValue : num;
};
//# sourceMappingURL=routeHelpers.js.map