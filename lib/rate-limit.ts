/**
 * Durable per-user / per-IP rate limiting backed by Upstash Redis.
 *
 * Auth credential paths are already throttled by Better Auth's DB-backed limiter;
 * this covers the heavy/abuse-prone business endpoints (reports, exports, etc.).
 *
 * Degrades to ALLOW when Upstash isn't configured (local dev, CI, build) so it
 * never blocks without infrastructure. Configure with UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("rate-limit");

let redis: Redis | null = null;
let redisResolved = false;

function getRedis(): Redis | null {
  if (redisResolved) return redis;
  redisResolved = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

const limiters = new Map<string, Ratelimit>();

function getLimiter(name: string, limit: number, windowSec: number): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const key = `${name}:${limit}:${windowSec}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: `rl:${name}`,
      analytics: false,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}

export interface RateLimitOptions {
  /** Logical bucket name, e.g. "reports". */
  name: string;
  /** Per-user / per-IP key. */
  identifier: string;
  /** Max requests per window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

/**
 * Returns true if the request is within budget. Fails open: on a missing config
 * OR an Upstash error, the request is allowed (availability over enforcement).
 */
export async function checkRateLimit(opts: RateLimitOptions): Promise<boolean> {
  const limiter = getLimiter(opts.name, opts.limit, opts.windowSec);
  if (!limiter) return true;
  try {
    const { success } = await limiter.limit(opts.identifier);
    return success;
  } catch (error) {
    logger.error(`rate-limit check failed for ${opts.name}; allowing`, error);
    return true;
  }
}

/**
 * Convenience guard for route handlers: returns a ready 429 NextResponse when the
 * caller is over budget, or null when allowed.
 */
export async function enforceRateLimit(opts: RateLimitOptions): Promise<NextResponse | null> {
  const allowed = await checkRateLimit(opts);
  if (allowed) return null;
  return NextResponse.json(
    { success: false, error_code: "RATE_LIMITED", message: "יותר מדי בקשות. נסו שוב בעוד רגע." },
    { status: 429 }
  );
}

/** Best-effort client IP for unauthenticated endpoints. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
