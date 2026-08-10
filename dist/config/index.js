import dotenv from "dotenv";
import logger from "../utils/logger.js";
dotenv.config();
class Config {
    GEMINI_API_KEY;
    JWT_SECRET;
    JWT_EXPIRE;
    PORT;
    NODE_ENV;
    GEMINI_MODEL;
    GEMINI_TEMPERATURE;
    GEMINI_TOP_K;
    GEMINI_TOP_P;
    GROQ_MODEL;
    GROQ_API_KEY;
    MONGODB_URI;
    CORS_ORIGIN;
    CORS_CREDENTIALS;
    CORS_METHODS;
    CORS_ALLOWED_HEADERS;
    RATE_LIMIT_WINDOW_MS;
    RATE_LIMIT_MAX;
    // Google OAuth
    GOOGLE_CLIENT_ID;
    GOOGLE_CLIENT_SECRET;
    constructor() {
        this.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
        this.JWT_SECRET = process.env.JWT_SECRET || "";
        this.JWT_EXPIRE = process.env.JWT_EXPIRE || "";
        this.PORT = process.env.PORT || "";
        this.NODE_ENV = process.env.NODE_ENV || "";
        this.GEMINI_MODEL = process.env.GEMINI_MODEL || "";
        this.GEMINI_TEMPERATURE = parseFloat(process.env.GEMINI_TEMPERATURE || "0.3");
        this.GEMINI_TOP_K = parseInt(process.env.GEMINI_TOP_K || "1", 10);
        this.GEMINI_TOP_P = parseFloat(process.env.GEMINI_TOP_P || "0.8");
        this.GROQ_API_KEY = process.env.GROQ_API_KEY || "";
        this.GROQ_MODEL = process.env.GROQ_MODEL || "";
        this.MONGODB_URI = process.env.MONGODB_URI || "";
        this.CORS_ORIGIN = process.env.CORS_ORIGIN || "";
        this.CORS_CREDENTIALS = process.env.CORS_CREDENTIALS === "true";
        this.CORS_METHODS = process.env.CORS_METHODS || "";
        this.CORS_ALLOWED_HEADERS = process.env.CORS_ALLOWED_HEADERS || "";
        this.RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10);
        this.RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "50", 10);
        // Google OAuth
        this.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
        this.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
    }
}
const config = new Config();
/**
 * Validate that all required environment variables are present.
 * Throws an error listing missing keys so the server fails fast at startup
 * instead of crashing at runtime with an opaque error.
 */
const validateConfig = () => {
    const requiredKeys = [
        { key: "MONGODB_URI", value: config.MONGODB_URI },
        { key: "JWT_SECRET", value: config.JWT_SECRET },
    ];
    const missing = requiredKeys.filter(({ value }) => !value);
    if (missing.length > 0) {
        const missingKeys = missing.map(({ key }) => key).join(", ");
        const error = new Error(`Configuration error: missing required environment variables: ${missingKeys}`);
        // eslint-disable-next-line no-throw-literal -- logging before throw for visibility
        logger.error(error.message);
        throw error;
    }
    if (config.JWT_SECRET && config.JWT_SECRET.length < 16) {
        logger.warn("JWT_SECRET is shorter than 16 characters — use a strong secret in production.");
    }
    logger.info("Configuration validated successfully");
};
validateConfig();
export { config };
