// Node-only module: imports `node:crypto`, which cannot resolve in the browser,
// so accidental client-side imports fail at bundle time. Do not re-export
// anything from this file in shared client components.
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless HMAC-SHA256 signed tokens for public estimate endpoints.
 *
 * Format: `v1.<b64url(estimateId)>.<b64url(expiresAt)>.<b64url(sig)>`
 *   where sig = HMAC_SHA256(`${estimateId}.${expiresAt}`, secret).
 *
 * Tokens are verified with constant-time comparison. They cannot be revoked
 * without rotating the secret — acceptable for 30-day estimate windows. If
 * revocation is ever needed, add a denylist table and check it in verify().
 *
 * Secret source: ESTIMATE_SIGNING_SECRET env var. In development, falls back
 * to a deterministic dev secret with a console warning so local work isn't
 * blocked. Production deployments MUST set the env var (the /api/health route
 * will flag this once it exists).
 */

const DEV_FALLBACK_SECRET = "dev-estimate-token-secret-do-not-use-in-production";
const DEFAULT_EXPIRY_DAYS = 14;
const MAX_TOKEN_LENGTH = 512; // DoS cap; real tokens are ~120 chars
const CURRENT_VERSION = "v1";

/**
 * Resolve the signing secret. In production we ALWAYS require an explicit
 * ESTIMATE_SIGNING_SECRET env var (>= 32 chars). The dev fallback only kicks
 * in when ALLOW_DEV_SECRET=1 is set — never just because NODE_ENV isn't
 * "production". This prevents staging/preview/demo deploys that happen to
 * omit NODE_ENV from silently using the source-checked-in fallback.
 */
function getSecret(): string {
  const s = process.env.ESTIMATE_SIGNING_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.ALLOW_DEV_SECRET === "1") {
    if (!(globalThis as { __estimateTokenWarned?: boolean }).__estimateTokenWarned) {
      console.warn("[estimate-token] Using DEV_FALLBACK_SECRET (ALLOW_DEV_SECRET=1). Do NOT deploy this way.");
      (globalThis as { __estimateTokenWarned?: boolean }).__estimateTokenWarned = true;
    }
    return DEV_FALLBACK_SECRET;
  }
  throw new Error(
    "ESTIMATE_SIGNING_SECRET must be set to a 32+ char secret (or ALLOW_DEV_SECRET=1 for local dev only)",
  );
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function hmacSig(estimateId: string, expiresAt: number, secret: string): Buffer {
  return createHmac("sha256", secret).update(`${estimateId}.${expiresAt}`).digest();
}

/** Sign a new token for `estimateId`, valid for `expiresInDays` days (default 30). */
export function signEstimateToken(
  estimateId: string,
  expiresInDays: number = DEFAULT_EXPIRY_DAYS,
): string {
  if (!estimateId) throw new Error("estimateId required");
  const secret = getSecret();
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
  const sig = hmacSig(estimateId, expiresAt, secret);
  return [CURRENT_VERSION, b64url(estimateId), b64url(String(expiresAt)), b64url(sig)].join(".");
}

export interface VerifiedToken {
  estimate_id: string;
  expires_at: Date;
}

/** Return the decoded token if valid, null otherwise. Constant-time comparison. */
export function verifyEstimateToken(token: string | null | undefined): VerifiedToken | null {
  if (!token) return null;
  if (token.length > MAX_TOKEN_LENGTH) return null; // DoS guard
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [version, idPart, expPart, sigPart] = parts;
  if (version !== CURRENT_VERSION) return null;

  let estimateId: string;
  let expiresAt: number;
  let sig: Buffer;
  try {
    estimateId = b64urlDecode(idPart).toString("utf8");
    const expRaw = b64urlDecode(expPart).toString("utf8");
    // Strict numeric parse — reject "123abc" style inputs so the decoded value
    // canonically matches what was signed.
    if (!/^\d+$/.test(expRaw)) return null;
    expiresAt = Number(expRaw);
    sig = b64urlDecode(sigPart);
  } catch {
    return null;
  }
  if (!estimateId || !Number.isFinite(expiresAt)) return null;
  if (expiresAt < Math.floor(Date.now() / 1000)) return null; // expired

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null; // production missing secret — fail closed, don't leak
  }
  const expected = hmacSig(estimateId, expiresAt, secret);
  if (expected.length !== sig.length) return null;
  if (!timingSafeEqual(expected, sig)) return null;

  return { estimate_id: estimateId, expires_at: new Date(expiresAt * 1000) };
}

/**
 * Verify a token and assert it matches the expected estimate id. Returns
 * true iff the token is valid AND decodes to exactly that id. Use this in
 * route handlers as: `if (!assertToken(token, id)) return 401`.
 */
export function assertEstimateToken(token: string | null | undefined, expectedId: string): boolean {
  const verified = verifyEstimateToken(token);
  return Boolean(verified && verified.estimate_id === expectedId);
}
