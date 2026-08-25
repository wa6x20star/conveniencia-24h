import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("request_too_large");
  }
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(CONTROL_CHARS, "").trim().slice(0, maxLength);
}

export function digitsOnly(value: unknown, maxLength = 20) {
  return String(value ?? "").replace(/\D/g, "").slice(0, maxLength);
}

export function sameOriginOrNoOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost || request.headers.get("host") || "").split(",")[0].trim().toLowerCase();
  if (!host) return false;

  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

export async function readJsonBody<T = any>(request: NextRequest, maxBytes = 24_000): Promise<T> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new RequestBodyTooLargeError();

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new RequestBodyTooLargeError();
  return JSON.parse(text) as T;
}

function clientAddress(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return (forwarded || real || "unknown").slice(0, 80);
}

export function requestFingerprint(request: NextRequest, scope: string) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("server_secret_missing");
  const ua = (request.headers.get("user-agent") || "unknown").slice(0, 240);
  return createHmac("sha256", secret)
    .update(`${scope}|${clientAddress(request)}|${ua}`)
    .digest("hex");
}

export async function checkRateLimit(
  request: NextRequest,
  scope: string,
  limit: number,
  windowSeconds: number,
  blockSeconds: number,
) {
  const supabase = createAdminClient();
  const fingerprint = requestFingerprint(request, scope);
  const { data, error } = await supabase.rpc("check_rate_limit_v64", {
    p_scope: scope,
    p_fingerprint_hash: fingerprint,
    p_limit: limit,
    p_window_seconds: windowSeconds,
    p_block_seconds: blockSeconds,
  });

  if (error) throw error;
  const result = (data ?? {}) as { allowed?: boolean; retry_after_seconds?: number; remaining?: number };
  return {
    allowed: result.allowed !== false,
    retryAfter: Math.max(1, Number(result.retry_after_seconds ?? 1)),
    remaining: Math.max(0, Number(result.remaining ?? 0)),
  };
}

export async function expireStaleReservationsBestEffort() {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("expire_stale_orders_v64");
    if (error) console.error("expire_stale_orders_v64", error.message);
  } catch (error) {
    console.error("expire_stale_orders_v64", error);
  }
}
