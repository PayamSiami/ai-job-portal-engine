export const getStringParam = (param) => {
    if (!param)
        return "";
    if (Array.isArray(param)) {
        return param[0] || "";
    }
    return param;
};
export const getUserId = (req) => {
    const user = req.user;
    if (!user)
        return null;
    return user.id?.toString() || null;
};
export const getQueryParam = (value) => {
    if (!value)
        return undefined;
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
};
export const getNumberQueryParam = (value, defaultValue = 0) => {
    const str = getQueryParam(value);
    if (!str)
        return defaultValue;
    const num = parseInt(str, 10);
    return isNaN(num) ? defaultValue : num;
};
