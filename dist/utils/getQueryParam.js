export const getStringQueryParam = (value) => {
    if (!value)
        return undefined;
    if (Array.isArray(value)) {
        return value[0]?.toString();
    }
    if (typeof value === "object" && value !== null) {
        return value.toString();
    }
    return value.toString();
};
export const getNumberQueryParam = (value, defaultValue) => {
    const str = getStringQueryParam(value);
    if (!str)
        return defaultValue;
    const num = parseInt(str, 10);
    return isNaN(num) ? defaultValue : num;
};
export const getBooleanQueryParam = (value) => {
    const str = getStringQueryParam(value);
    if (str === undefined)
        return undefined;
    return str === "true" || str === "1";
};
