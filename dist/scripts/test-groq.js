// backend/src/scripts/test-groq.ts
import dotenv from 'dotenv';
dotenv.config();
import { testGroqConnection, generateWithGroq } from '../services/ai/groq.service.js';
import logger from '../utils/logger.js';
async function testGroq() {
    logger.debug('🔍 Testing Groq Service...');
    logger.debug('📍 Country: AZ (Azerbaijan)');
    // Check API Key
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        logger.debug('❌ GROQ_API_KEY not found in .env');
        logger.debug('💡 Add GROQ_API_KEY=gsk_xxxx to your .env file');
        return;
    }
    logger.debug('🔑 API Key:', apiKey.substring(0, 10) + '...');
    // Test 1: Connection
    logger.debug('\n🔗 Testing connection...');
    const connection = await testGroqConnection();
    if (connection.success) {
        logger.debug('✅ Connection successful!');
        logger.debug('📝 Response:', connection.message);
    }
    else {
        logger.debug('❌ Connection failed:', connection.message);
        logger.debug('\n💡 Troubleshooting:');
        logger.debug('   1. Check your internet connection');
        logger.debug('   2. Verify VPN is connected');
        logger.debug('   3. Check GROQ_API_KEY in .env (should start with gsk_)');
        logger.debug('   4. Try getting a new API key from logger.debugq.com');
        return;
    }
    // Test 2: Generate Content
    logger.debug('\n🤖 Testing content generation...');
    const result = await generateWithGroq('Write a short professional summary for a software engineer with 5 years of experience.');
    if (result.success) {
        logger.debug('✅ Content generated successfully!');
        logger.debug('📝 Response:', result.content);
    }
    else {
        logger.debug('❌ Content generation failed:', result.error);
    }
}
testGroq();
