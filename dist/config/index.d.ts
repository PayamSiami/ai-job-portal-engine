declare class Config {
    GEMINI_API_KEY: string | undefined;
    JWT_SECRET: string | undefined;
    JWT_EXPIRE: string | undefined;
    DB_HOST: string | undefined;
    DB_PORT: string | undefined;
    DB_NAME: string | undefined;
    PORT: string | undefined;
    NODE_ENV: string | undefined;
    GEMINI_MODEL: string;
    GEMINI_TEMPERATURE: number;
    GEMINI_TOP_K: number;
    GEMINI_TOP_P: number;
    GROQ_MODEL: string;
    GROQ_API_KEY: string;
    constructor();
}
export declare const config: Config;
export {};
//# sourceMappingURL=index.d.ts.map