export interface GroqResponse {
    content: string;
    success: boolean;
    error?: string;
}
export declare const generateWithGroq: (prompt: string) => Promise<GroqResponse>;
export declare const testGroqConnection: () => Promise<{
    success: boolean;
    message: string;
}>;
//# sourceMappingURL=groq.service.d.ts.map