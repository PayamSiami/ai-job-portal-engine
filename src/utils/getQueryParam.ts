export const getStringQueryParam = (value: any): string | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value[0]?.toString();
  }
  if (typeof value === "object" && value !== null) {
    return value.toString();
  }
  return value.toString();
};

// ✅ Helper for number query parameters
export const getNumberQueryParam = (
  value: any,
  defaultValue: number,
): number => {
  const str = getStringQueryParam(value);
  if (!str) return defaultValue;
  const num = parseInt(str, 10);
  return isNaN(num) ? defaultValue : num;
};

// ✅ Helper for boolean query parameters
export const getBooleanQueryParam = (value: any): boolean | undefined => {
  const str = getStringQueryParam(value);
  if (str === undefined) return undefined;
  return str === "true" || str === "1";
};
