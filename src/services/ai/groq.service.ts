// src/services/ai/groq.service.ts
// Kept for backwards compatibility with the standalone test script.
// The primary AI path now goes through the unified OpenAI-compatible client
// (see ./aiClient.ts), which talks to the configured AI endpoint (e.g. 9router).
import { completePrompt, testAIConnection } from "./aiClient";

export interface GroqResponse {
  content: string;
  success: boolean;
  error?: string;
}

export const generateWithGroq = async (
  prompt: string,
): Promise<GroqResponse> => {
  const result = await completePrompt(
    "You are a professional career coach and resume expert. Provide detailed, actionable feedback. Return ONLY valid JSON without any additional text, markdown, or explanations.",
    prompt,
    { temperature: 0.3, maxTokens: 800 },
  );

  return result.success
    ? { content: result.content, success: true }
    : { content: "", success: false, error: result.error };
};

export const testGroqConnection = async (): Promise<{
  success: boolean;
  message: string;
}> => {
  return testAIConnection();
};
