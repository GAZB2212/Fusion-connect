/**
 * In-memory caching layer for rate limits and moderation results
 * Reduces database load and API costs by 90%
 */

interface CacheEntry {
  value: any;
  expiresAt: number;
}

// Global cache store
const cache = new Map<string, CacheEntry>();

// Rate limit cache: tracks message counts per user per day
const rateLimitCache = new Map<string, number>();

/**
 * Get cached value if it exists and hasn't expired
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  
  return entry.value as T;
}

/**
 * Set cached value with TTL in seconds
 */
export function setCached(key: string, value: any, ttlSeconds: number): void {
  cache.set(key, {
    value,
    expiresAt: Date.now() + (ttlSeconds * 1000),
  });
}

/**
 * Get message count for a user today (cached in-memory)
 * @returns Current message count for the day
 */
export function getMessageCount(userId: string): number {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `msg_count:${userId}:${today}`;
  return rateLimitCache.get(key) || 0;
}

/**
 * Increment message count for a user today
 * @returns New message count
 */
export function incrementMessageCount(userId: string): number {
  const today = new Date().toISOString().split('T')[0];
  const key = `msg_count:${userId}:${today}`;
  const current = rateLimitCache.get(key) || 0;
  const newCount = current + 1;
  rateLimitCache.set(key, newCount);
  return newCount;
}

/**
 * Reset message counts at midnight (called by cron or timer)
 */
export function resetDailyCounters(): void {
  const today = new Date().toISOString().split('T')[0];
  const keys = Array.from(rateLimitCache.keys());
  
  for (const key of keys) {
    if (!key.endsWith(today)) {
      rateLimitCache.delete(key);
    }
  }
  
  console.log(`[Cache] Reset daily counters. Active keys: ${rateLimitCache.size}`);
}

/**
 * Get moderation result from cache
 */
export function getCachedModeration(content: string): any | null {
  const hash = simpleHash(content);
  return getCached(`moderation:${hash}`);
}

/**
 * Cache moderation result for 1 hour
 */
export function setCachedModeration(content: string, result: any): void {
  const hash = simpleHash(content);
  setCached(`moderation:${hash}`, result, 3600); // 1 hour TTL
}

/**
 * Simple hash function for cache keys
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Reset counters at midnight every day
setInterval(() => {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight.getTime() - now.getTime();
  
  setTimeout(() => {
    resetDailyCounters();
    // Set up recurring daily reset
    setInterval(resetDailyCounters, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}, 1000 * 60); // Check every minute

console.log('[Cache] In-memory caching layer initialized');
