import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;
neonConfig.fetchConnectionCache = true; // Enable connection caching for better performance

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool with optimized settings for 10K+ users
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum 20 connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout if connection takes > 10s
});

export const db = drizzle({ client: pool, schema });
