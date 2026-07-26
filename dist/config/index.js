import dotenv from "dotenv";
dotenv.config({});
class Config {
    GEMINI_API_KEY;
    JWT_SECRET;
    JWT_EXPIRE;
    DB_HOST;
    DB_PORT;
    DB_NAME;
    PORT;
    NODE_ENV;
    GEMINI_MODEL;
    GEMINI_TEMPERATURE;
    GEMINI_TOP_K;
    GEMINI_TOP_P;
    GROQ_MODEL;
    GROQ_API_KEY;
    constructor() {
        this.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
        this.JWT_SECRET = process.env.JWT_SECRET || "";
        this.JWT_EXPIRE = process.env.JWT_EXPIRE || "";
        this.DB_HOST = process.env.DB_HOST || "";
        this.DB_PORT = process.env.DB_PORT || "";
        this.DB_NAME = process.env.DB_NAME || "";
        this.PORT = process.env.PORT || "";
        this.NODE_ENV = process.env.NODE_ENV || "";
        this.GEMINI_MODEL = process.env.GEMINI_MODEL || "";
        this.GEMINI_TEMPERATURE = parseFloat(process.env.GEMINI_TEMPERATURE || "0.3");
        this.GEMINI_TOP_K = parseInt(process.env.GEMINI_TOP_K || "1", 10);
        this.GEMINI_TOP_P = parseFloat(process.env.GEMINI_TOP_P || "0.8");
        this.GROQ_API_KEY = process.env.GROQ_API_KEY || "";
        this.GROQ_MODEL = process.env.GROQ_MODEL || "";
    }
}
export const config = new Config();
