import dotenv from "dotenv";
import logger from "../utils/logger.js";
dotenv.config();
class Config {
    JWT_SECRET;
    JWT_EXPIRE;
    PORT;
    NODE_ENV;
    GEMINI_MODEL;
    GEMINI_TEMPERATURE;
    GEMINI_TOP_K;
    GEMINI_TOP_P;
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
    // Unified AI provider (OpenAI-compatible). Defaults to a local 9router-style endpoint.
    AI_PROVIDER;
    AI_BASE_URL;
    AI_API_KEY;
    AI_MODEL;
    constructor() {
        this.JWT_SECRET = process.env.JWT_SECRET || "";
        this.JWT_EXPIRE = process.env.JWT_EXPIRE || "";
        this.PORT = process.env.PORT || "";
        this.NODE_ENV = process.env.NODE_ENV || "";
        this.GEMINI_MODEL = process.env.GEMINI_MODEL || "";
        this.GEMINI_TEMPERATURE = parseFloat(process.env.GEMINI_TEMPERATURE || "0.3");
        this.GEMINI_TOP_K = parseInt(process.env.GEMINI_TOP_K || "1", 10);
        this.GEMINI_TOP_P = parseFloat(process.env.GEMINI_TOP_P || "0.8");
        this.AI_PROVIDER = process.env.AI_PROVIDER || "openai";
        // OpenAI-compatible base URL (e.g. 9router at http://localhost:20128/v1)
        this.AI_BASE_URL =
            process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || "http://localhost:20128/v1";
        this.AI_API_KEY =
            process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
        this.AI_MODEL =
            process.env.AI_MODEL || process.env.OPENAI_MODEL || "";
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
