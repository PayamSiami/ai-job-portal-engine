// backend/src/scripts/diagnose-gemini.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config/index.js";

async function diagnose() {
  console.log("🔍 Starting Gemini API Diagnosis...");
  console.log("📡 IP Address:", await getIP());
  console.log("🔑 API Key:", config.GEMINI_API_KEY ? "✅ Set" : "❌ Missing");
  console.log("🤖 Model:", config.GEMINI_MODEL);

  // Test 1: Basic API Call
  try {
    const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: config.GEMINI_MODEL });
    const result = await model.generateContent('Say "Hello"');
    console.log("✅ Test 1 Passed: API Key and Model are working!");
  } catch (error: any) {
    console.log("❌ Test 1 Failed:", error.message);
    if (error.message.includes("403")) {
      console.log("   → Problem: API key invalid or region blocked");
      console.log("   → Check: VPN connection or API key validity");
    }
    if (error.message.includes("404")) {
      console.log("   → Problem: Model not found");
      console.log("   → Try: gemini-1.0-pro or gemini-pro");
    }
  }

  // Test 2: Check Internet Connection
  try {
    const response = await fetch("https://www.google.com");
    console.log("✅ Test 2 Passed: Internet connection is working");
  } catch {
    console.log("❌ Test 2 Failed: No internet connection");
  }

  // Test 3: Check if Google is reachable
  try {
    const response = await fetch("https://generativelanguage.googleapis.com");
    console.log("✅ Test 3 Passed: Google API endpoint is reachable");
  } catch {
    console.log("❌ Test 3 Failed: Cannot reach Google API endpoint");
    console.log("   → Problem: VPN/DNS/Network blocking");
  }

  console.log("📊 Diagnosis Complete");
}

async function getIP() {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch {
    return "Unknown";
  }
}

diagnose();
