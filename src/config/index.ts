import dotenv from "dotenv";

dotenv.config({});

class Config {
  public GEMINI_API_KEY: string | undefined;
  public JWT_SECRET: string | undefined;
  public JWT_EXPIRE: string | undefined;
  public PORT: string | undefined;
  public NODE_ENV: string | undefined;
  public GEMINI_MODEL: string;
  public GEMINI_TEMPERATURE: number;
  public GEMINI_TOP_K: number;
  public GEMINI_TOP_P: number;
  public GROQ_MODEL: string;
  public GROQ_API_KEY: string;
  public MONGODB_URI: string;

  constructor() {
    this.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
    this.JWT_SECRET = process.env.JWT_SECRET || "";
    this.JWT_EXPIRE = process.env.JWT_EXPIRE || ""
    this.PORT = process.env.PORT || "";
    this.NODE_ENV = process.env.NODE_ENV || "";
    this.GEMINI_MODEL = process.env.GEMINI_MODEL || "";
    this.GEMINI_TEMPERATURE = parseFloat(
      process.env.GEMINI_TEMPERATURE || "0.3",
    );
    this.GEMINI_TOP_K = parseInt(process.env.GEMINI_TOP_K || "1", 10);
    this.GEMINI_TOP_P = parseFloat(process.env.GEMINI_TOP_P || "0.8");
    this.GROQ_API_KEY = process.env.GROQ_API_KEY || "";
    this.GROQ_MODEL = process.env.GROQ_MODEL || "";
    this.MONGODB_URI = process.env.MONGODB_URI || "";
  }
}

export const config: Config = new Config();
