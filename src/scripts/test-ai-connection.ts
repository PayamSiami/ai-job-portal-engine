// src/scripts/test-ai-connection.ts
// Verifies the unified AI client reaches the configured 9router endpoint.
import dotenv from "dotenv";
dotenv.config();

import { config } from "../config/index";
import { completePrompt, testAIConnection } from "../services/ai/aiClient";
import logger from "../utils/logger";

async function testAI() {
  logger.info(
    `AI provider: ${config.AI_PROVIDER} | endpoint: ${config.AI_BASE_URL} | model: ${config.AI_MODEL}`,
  );

  logger.info("🔗 Testing connection...");
  const connection = await testAIConnection();
  if (connection.success) {
    logger.info("✅ Connection successful!");
    logger.info(`📝 Response: ${connection.message}`);
  } else {
    logger.info(`❌ Connection failed: ${connection.message}`);
    return;
  }

  logger.info("🤖 Testing content generation...");
  const result = await completePrompt(
    "You are a professional resume writer.",
    "Write a one-line professional summary for a React developer with 3 years of experience.",
    { maxTokens: 150 },
  );
  if (result.success) {
    logger.info("✅ Content generated successfully!");
    logger.info(`📝 Response: ${result.content}`);
  } else {
    logger.info(`❌ Content generation failed: ${result.error}`);
  }
}

testAI();
