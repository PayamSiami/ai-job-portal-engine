// backend/src/scripts/test-groq.ts
import dotenv from 'dotenv';
dotenv.config();

import { testGroqConnection, generateWithGroq } from '../services/ai/groq.service.js';

async function testGroq() {
  console.log('🔍 Testing Groq Service...');
  console.log('📍 Country: AZ (Azerbaijan)');
  
  // Check API Key
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.log('❌ GROQ_API_KEY not found in .env');
    console.log('💡 Add GROQ_API_KEY=gsk_xxxx to your .env file');
    return;
  }
  console.log('🔑 API Key:', apiKey.substring(0, 10) + '...');

  // Test 1: Connection
  console.log('\n🔗 Testing connection...');
  const connection = await testGroqConnection();
  
  if (connection.success) {
    console.log('✅ Connection successful!');
    console.log('📝 Response:', connection.message);
  } else {
    console.log('❌ Connection failed:', connection.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Check your internet connection');
    console.log('   2. Verify VPN is connected');
    console.log('   3. Check GROQ_API_KEY in .env (should start with gsk_)');
    console.log('   4. Try getting a new API key from console.groq.com');
    return;
  }

  // Test 2: Generate Content
  console.log('\n🤖 Testing content generation...');
  const result = await generateWithGroq('Write a short professional summary for a software engineer with 5 years of experience.');
  
  if (result.success) {
    console.log('✅ Content generated successfully!');
    console.log('📝 Response:', result.content);
  } else {
    console.log('❌ Content generation failed:', result.error);
  }
}

testGroq();