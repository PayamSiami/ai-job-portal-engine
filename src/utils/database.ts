// src/utils/database.ts
import mongoose from "mongoose";
import logger from "./logger";
import { config } from "../config";

/**
 * Connect to MongoDB with retry logic and buffer timeout settings.
 * If the connection fails, the process exits so that a container orchestrator
 * can restart the service rather than silently serving requests that timeout.
 */
export const connectDB = async (): Promise<void> => {
  mongoose.set("bufferTimeoutMS", 30000);

  const MONGODB_URI = config.MONGODB_URI;

  // Retry up to 5 times with a 2-second backoff
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    try {
      await mongoose.connect(MONGODB_URI);
      logger.info("MongoDB connected successfully");
      return;
    } catch (error) {
      attempts += 1;
      logger.error(`MongoDB connection attempt ${attempts} failed`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      if (attempts >= maxAttempts) {
        logger.error(
          `Failed to connect to MongoDB after ${maxAttempts} attempts. Exiting.`,
        );
        process.exit(1);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
};

/**
 * Gracefully close the MongoDB connection.
 */
export const closeDB = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info("MongoDB connection closed");
  } catch (error) {
    logger.error("Error closing MongoDB connection", { error });
  }
};