#!/usr/bin/env node
/**
 * Deployment Verification Script
 *
 * This script verifies that the application is ready for deployment
 * by checking environment variables, database connection, and storage configuration.
 */

import { query } from "../lib/db.js";
import { validateEnv, getDatabaseUrl, isProduction, getEnv } from "../lib/env.js";
import { getStorageAdapter } from "../lib/storage.js";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(message: string, color: "green" | "red" | "yellow" | "blue" = "blue"): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string): void {
  log(`✓ ${message}`, "green");
}

function logError(message: string): void {
  log(`✗ ${message}`, "red");
}

function logWarning(message: string): void {
  log(`⚠ ${message}`, "yellow");
}

async function checkEnvironment(): Promise<boolean> {
  log("\n=== Environment Variables ===", "blue");

  try {
    validateEnv();
    logSuccess("All required environment variables are set");

    // Check optional variables
    const blobToken = getEnv("BLOB_READ_WRITE_TOKEN");
    if (isProduction() && !blobToken) {
      logWarning("BLOB_READ_WRITE_TOKEN not set - file uploads will use local storage");
    } else if (blobToken) {
      logSuccess("BLOB_READ_WRITE_TOKEN is set");
    }

    return true;
  } catch (error) {
    logError(`Environment validation failed: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function checkDatabase(): Promise<boolean> {
  log("\n=== Database Connection ===", "blue");

  try {
    const dbUrl = getDatabaseUrl();
    const isNeon = dbUrl.includes("neon.tech");
    const isLocal = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");

    if (isNeon) {
      logSuccess("Using Neon PostgreSQL (production)");
    } else if (isLocal) {
      logWarning("Using local PostgreSQL (development mode)");
    } else {
      logWarning(`Using database: ${dbUrl.split("@")[1] || "unknown"}`);
    }

    // Test connection with a simple query
    const result = await query(`SELECT NOW() as current_time`);
    logSuccess(`Database connection successful (server time: ${result.rows[0].current_time})`);

    // Check if tables exist
    const tables = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tableNames = tables.rows.map((row) => row.table_name);
    const requiredTables = [
      "users",
      "sessions",
      "user_profiles",
      "clients",
      "projects",
      "time_entries",
      "custom_tags",
    ];

    const missingTables = requiredTables.filter((t) => !tableNames.includes(t));
    if (missingTables.length > 0) {
      logWarning(`Missing tables: ${missingTables.join(", ")}`);
      logWarning("Run initSchema() to create missing tables");
      return false;
    }

    logSuccess(`All required tables exist (${tableNames.length} total tables)`);

    return true;
  } catch (error) {
    logError(`Database connection failed: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function checkStorage(): Promise<boolean> {
  log("\n=== Storage Configuration ===", "blue");

  try {
    const storage = getStorageAdapter();
    const storageType = storage.constructor.name;

    if (storageType === "LocalStorageAdapter") {
      logWarning("Using local filesystem storage");
      logWarning("This is suitable for development but not production");
    } else if (storageType === "BlobStorageAdapter") {
      logSuccess("Using Vercel Blob storage (production-ready)");
    }

    return true;
  } catch (error) {
    logError(`Storage initialization failed: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function checkBuild(): Promise<boolean> {
  log("\n=== Build Check ===", "blue");

  try {
    // Check if .next directory exists
    const { existsSync } = await import("fs");
    const path = await import("path");

    const nextDir = path.join(process.cwd(), ".next");
    if (!existsSync(nextDir)) {
      logWarning("Build directory (.next) not found");
      logWarning("Run 'npm run build' to create production build");
      return false;
    }

    logSuccess("Production build exists");
    return true;
  } catch (error) {
    logError(`Build check failed: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function main(): Promise<void> {
  console.log("\n" + "=".repeat(50));
  console.log("Clock-Bill Deployment Verification");
  console.log("=".repeat(50));

  const results = {
    environment: await checkEnvironment(),
    database: await checkDatabase(),
    storage: await checkStorage(),
    build: await checkBuild(),
  };

  console.log("\n" + "=".repeat(50));
  console.log("Summary");
  console.log("=".repeat(50));

  let allPassed = true;
  for (const [name, passed] of Object.entries(results)) {
    if (passed) {
      logSuccess(`${name.charAt(0).toUpperCase() + name.slice(1)} check passed`);
    } else {
      logError(`${name.charAt(0).toUpperCase() + name.slice(1)} check failed`);
      allPassed = false;
    }
  }

  console.log("=".repeat(50) + "\n");

  if (allPassed) {
    logSuccess("All checks passed! Ready for deployment.");
    process.exit(0);
  } else {
    logError("Some checks failed. Please fix the issues above.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Verification script error:", error);
  process.exit(1);
});
