import { neonConfig, Pool as NeonPool } from '@neondatabase/serverless';
import { drizzle as drizzleNeon, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { Pool as PgPool } from 'pg';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Neon's serverless driver speaks a WebSocket proxy protocol that plain
// PostgreSQL servers don't understand. For local development and tests
// (localhost URLs) use the standard node-postgres driver instead.
const isLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL);

type Db = NeonDatabase<typeof schema>;

function createDb(): { db: Db; pool: NeonPool | PgPool } {
  if (isLocalDatabase) {
    const pool = new PgPool({ connectionString: process.env.DATABASE_URL });
    // The query-builder API is identical across pg drivers; the cast keeps
    // one type flowing through the app regardless of driver.
    return { db: drizzleNodePg({ client: pool, schema }) as unknown as Db, pool };
  }

  neonConfig.webSocketConstructor = ws;
  neonConfig.fetchConnectionCache = true; // Enable connection caching for better performance

  // Configure connection pool with optimized settings for 10K+ users
  const pool = new NeonPool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Maximum 20 connections in pool
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 10000, // Timeout if connection takes > 10s
  });
  return { db: drizzleNeon({ client: pool, schema }), pool };
}

const created = createDb();
export const db = created.db;
export const pool = created.pool;
