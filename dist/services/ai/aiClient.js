// src/services/ai/aiClient.ts
// Unified OpenAI-compatible AI client.
//
// All AI features talk to a single OpenAI-compatible endpoint (e.g. a local
// "9router" proxy at http://localhost:20128/v1). The endpoint, model and API
// key are read from config so they can be swapped without touching feature code.
import OpenAI from "openai";
import { config } from "../../config/index.js";
import logger from "../../utils/logger.js";
/**
 * Create a single shared OpenAI client for the configured endpoint.
 * Falls back gracefully to the SDK default if no API key is present
 * (some local proxies accept any key).
 */
function createClient() {
    return new OpenAI({
        baseURL: config.AI_BASE_URL || undefined,
        apiKey: config.AI_API_KEY || "not-needed",
    });
}
const client = createClient();
/**
 * Send a chat completion request to the configured AI provider.
 * Used by every AI feature in the app.
 */
export async function completeChat(messages, options = {}) {
    const { temperature = 0.3, maxTokens = 800, topP = 0.8, } = options;
    try {
        const response = await client.chat.completions.create({
            model: config.AI_MODEL,
            messages,
            temperature,
            top_p: topP,
            max_tokens: maxTokens,
        });
        // Some reasoning models put the final answer in `content`, others (or short
        // token budgets) leave it in `reasoning_content`. Prefer content, fall back
        // to reasoning_content so we never silently return empty.
        const raw = response.choices?.[0]?.message;
        const content = raw?.content || raw?.reasoning_content || "";
        return {
            content,
            success: true,
            model: config.AI_MODEL,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown AI error";
        logger.error("AI chat completion failed:", { error: message });
        return {
            content: "",
            success: false,
            error: message,
        };
    }
}
/**
 * Convenience wrapper: send a single user prompt to the configured model.
 */
export async function completePrompt(systemPrompt, userPrompt, options = {}) {
    return completeChat([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
    ], options);
}
/**
 * Verify the AI connection is reachable and returns content.
 */
export async function testAIConnection() {
    try {
        const result = await completePrompt("You are a helpful assistant.", 'Reply with exactly: "AI is working!"', { maxTokens: 100 });
        if (result.success) {
            return { success: true, message: result.content };
        }
        return { success: false, message: result.error || "Unknown error" };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { success: false, message };
    }
}
/**
 * Map a language code to a human-readable name for the AI.
 */
export function aiLanguageName(language) {
    return ({
        fa: "Farsi (Persian)",
        en: "English",
        ar: "Arabic",
        tr: "Turkish",
        de: "German",
        fr: "French",
        es: "Spanish",
        ru: "Russian",
    }[language || "fa"] || "Farsi (Persian)");
}
/**
 * True when an AI model + endpoint are configured, i.e. AI features may run.
 */
export function isAIConfigured() {
    return !!config.AI_MODEL && !!config.AI_BASE_URL;
}
/**
 * Strip markdown fences and extract the JSON object from an AI response.
 * Falls back to the trimmed text when no braces are present.
 */
export function cleanAIJsonResponse(text) {
    const cleaned = text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : cleaned;
}
/**
 * Truncate prompt input to a maximum length, appending an ellipsis marker.
 */
export function truncateForPrompt(text, maxLength, suffix = "...") {
    if (!text)
        return "";
    if (text.length <= maxLength)
        return text;
    return text.substring(0, maxLength) + suffix;
}
/**
 * Retry backoff delay.
 */
export function aiDelay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export default { completeChat, completePrompt, testAIConnection };
