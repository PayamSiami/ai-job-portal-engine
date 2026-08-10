// backend/src/services/ai/groq.service.ts
import Groq from "groq-sdk";
import { config } from "../../config/index.js";
import logger from "../../utils/logger.js";
const groq = new Groq({
    apiKey: config.GROQ_API_KEY,
});
// backend/src/services/ai/groq.service.ts
export const generateWithGroq = async (prompt) => {
    try {
        const response = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a professional career coach and resume expert. 
          Provide detailed, actionable feedback. 
          Return ONLY valid JSON without any additional text, markdown, or explanations.
          Your response must be a single JSON object.
          Do not wrap the response in code blocks.`,
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            model: config.GROQ_MODEL || "llama-3.3-70b-versatile",
            temperature: 0.3, // Lower temperature for more consistent JSON output
            max_tokens: 800,
        });
        const content = response.choices[0]?.message?.content || "";
        logger.debug("Groq response preview", {
            content: content.substring(0, 200) + "...",
        });
        return {
            content,
            success: true,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("Groq API error:", { error: message });
        return {
            content: "",
            success: false,
            error: message,
        };
    }
};
export const testGroqConnection = async () => {
    try {
        const response = await groq.chat.completions.create({
            messages: [{ role: "user", content: 'Say "Groq is working!"' }],
            model: config.GROQ_MODEL || "llama-3.3-70b-versatile", // ✅ Updated
            max_tokens: 20,
        });
        const content = response.choices[0]?.message?.content || "";
        return {
            success: true,
            message: content,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("Groq test failed:", { error: message });
        return {
            success: false,
            message,
        };
    }
};
