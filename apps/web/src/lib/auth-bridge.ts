// Node-only module: imports `node:crypto`. Do NOT re-export into client bundles.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * Cross-product auth bridge for callscraper.com → CallscraperCRM.
 *
 * Architecture:
 *   Callscraper.com signs a short-lived JWT with a shared HMAC secret when a
 *   user clicks "Open in CRM". The token carries the minimum claims needed
 *   to resolve the correct CRM org and optionally pre-select a record:
 *
 *     {
 *       sub: string,               // callscraper user.id (stable)
 *       email: string,             // user email
 *       company_id: string,        // callscraper workspace/company id
 *       iat: number,               // issued-at (epoch seconds)
 *       exp: number,               // expires-at (epoch seconds)
 *       jti: string,               // nonce (UUID)
 *       // Optional deep-link context:
 *       call_id?: string,          // callscraper call UUID
 *     }
 *
 * CRM validates the token via HMAC-SHA256 + constant-time compare and looks
 * up the matching `organizations.upstream_company_id`. Tokens are NOT re-
 * playable across sessions because we cap the `exp` at 5 minutes from issue.
 *
 * This module is the authoritative JWT validator; no other code should
 * parse bridge tokens by hand.
 *
 * Secret management:
 *   - `BRIDGE_SIGNING_SECRET` env var must be ≥ 32 chars in production.
 *   - Dev mode requires `ALLOW_DEV_SECRET=1` + will log a warning once.
 *   - Secret rotation: change env on both products simultaneously; any in-
 *     flight tokens signed with the old secret will fail validation and
 *     users will be redirected to re-auth.
 *
 * Format is a 3-part envelope:
 *   v1b.<base64url(JSON payload)>.<base64url(HMAC-SHA256 of "v1b.<payload>"))>
 *
 * The `v1b` prefix (bridge) is domain-separated from the `v1` prefix used
 * by estimate-token.ts so tokens from one system can NEVER accidentally
 * validate in the other — even if an engineer reuses the same secret
 * across both env vars in a dev environment.
 *
 * We use our own compact JWT-ish format instead of the full RFC 7519 to
 * keep the parser surface minimal and avoid pulling in a JWT library.
 */

const DEV_FALLBACK_SECRET = "dev-bridge-signing-secret-do-not-use-in-production";
const MAX_TOKEN_LENGTH = 1024; // DoS guard; real tokens are ~200-400 chars
const MAX_COMPANY_ID_LENGTH = 128; // Defense in depth on the DB lookup input
const MAX_EMAIL_LENGTH = 320; // RFC 5321 upper bound
const MAX_EXPIRY_SECONDS = 5 * 60; // 5-minute max TTL; longer TTLs rejected
// Domain-separated version prefix. `v1b` (bridge) distinguishes this token
// format from `v1` estimate tokens in estimate-token.ts so a token minted
// for one system can never accidentally validate in the other, even if an
// engineer mixes up the env vars.
const CURRENT_VERSION = "v1b";

export interface BridgeClaims {
  sub: string; // callscraper user id
  email: string;
  company_id: string; // callscraper workspace id
  iat: number; // issued-at epoch seconds
  exp: number; // expires-at epoch seconds
  jti: string; // nonce
  call_id?: string; // optional deep-link context
}

export interface VerifyResult {
  ok: true;
  claims: BridgeClaims;
}

export interface VerifyFailure {
  ok: false;
  reason:
    | "missing"
    | "too_long"
    | "malformed"
    | "wrong_version"
    | "bad_encoding"
    | "bad_signature"
    | "expired"
    | "future_iat"
    | "ttl_too_long"
    | "missing_claim"
    | "no_secret";
}

export type VerifyOutcome = VerifyResult | VerifyFailure;

function getSecret(): string {
  const s = process.env.BRIDGE_SIGNING_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.ALLOW_DEV_SECRET === "1") {
    if (!(globalThis as { __bridgeTokenWarned?: boolean }).__bridgeTokenWarned) {
      console.warn("[auth-bridge] Using DEV_FALLBACK_SECRET (ALLOW_DEV_SECRET=1). Do NOT deploy this way.");
      (globalThis as { __bridgeTokenWarned?: boolean }).__bridgeTokenWarned = true;
    }
    return DEV_FALLBACK_SECRET;
  }
  throw new Error(
    "BRIDGE_SIGNING_SECRET must be set to a 32+ char secret (or ALLOW_DEV_SECRET=1 for local dev only)",
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

function hmacSig(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

/**
 * Mint a bridge token. Callscraper.com uses this (or its own equivalent) to
 * sign tokens when a user clicks "Open in CRM". Exposed in the CRM for
 * round-trip testing and potentially for admin-generated magic links.
 *
 * Default TTL: 60 seconds. Max allowed TTL: 5 minutes (enforced by verifier).
 */
export function signBridgeToken(
  claims: Omit<BridgeClaims, "iat" | "exp" | "jti"> & {
    iat?: number;
    exp?: number;
    jti?: string;
    ttl_seconds?: number;
  },
): string {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const iat = claims.iat ?? now;
  const exp = claims.exp ?? iat + (claims.ttl_seconds ?? 60);
  const jti = claims.jti ?? randomUUID();
  const payload: BridgeClaims = {
    sub: claims.sub,
    email: claims.email,
    company_id: claims.company_id,
    iat,
    exp,
    jti,
    ...(claims.call_id ? { call_id: claims.call_id } : {}),
  };
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = b64url(payloadJson);
  const signingInput = `${CURRENT_VERSION}.${payloadB64}`;
  const sig = hmacSig(signingInput, secret);
  return `${signingInput}.${b64url(sig)}`;
}

/**
 * Verify a bridge token. Returns a tagged outcome so callers can log specific
 * failure modes for observability. Use `assertBridgeToken()` if you just need
 * a yes/no.
 */
export function verifyBridgeToken(token: string | null | undefined): VerifyOutcome {
  if (!token) return { ok: false, reason: "missing" };
  if (token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "too_long" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [version, payloadB64, sigB64] = parts;
  if (version !== CURRENT_VERSION) return { ok: false, reason: "wrong_version" };

  let payloadJson: string;
  let sig: Buffer;
  try {
    payloadJson = b64urlDecode(payloadB64).toString("utf8");
    sig = b64urlDecode(sigB64);
  } catch {
    return { ok: false, reason: "bad_encoding" };
  }

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return { ok: false, reason: "no_secret" };
  }

  const expected = hmacSig(`${version}.${payloadB64}`, secret);
  if (expected.length !== sig.length) return { ok: false, reason: "bad_signature" };
  if (!timingSafeEqual(expected, sig)) return { ok: false, reason: "bad_signature" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadJson);
  } catch {
    return { ok: false, reason: "bad_encoding" };
  }

  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "malformed" };
  const p = parsed as Partial<BridgeClaims>;

  // Required-claim checks with length caps (defense in depth for the DB lookup)
  if (typeof p.sub !== "string" || p.sub.length === 0 || p.sub.length > 256) {
    return { ok: false, reason: "missing_claim" };
  }
  if (typeof p.email !== "string" || p.email.length === 0 || p.email.length > MAX_EMAIL_LENGTH) {
    return { ok: false, reason: "missing_claim" };
  }
  if (
    typeof p.company_id !== "string" ||
    p.company_id.length === 0 ||
    p.company_id.length > MAX_COMPANY_ID_LENGTH
  ) {
    return { ok: false, reason: "missing_claim" };
  }
  if (typeof p.iat !== "number" || typeof p.exp !== "number") return { ok: false, reason: "missing_claim" };
  if (typeof p.jti !== "string" || p.jti.length === 0 || p.jti.length > 256) {
    return { ok: false, reason: "missing_claim" };
  }
  // call_id must be a string if present — reject type confusion (numbers, etc)
  if (p.call_id !== undefined && (typeof p.call_id !== "string" || p.call_id.length > 256)) {
    return { ok: false, reason: "missing_claim" };
  }

  const now = Math.floor(Date.now() / 1000);

  // Expiry check
  if (p.exp < now) return { ok: false, reason: "expired" };

  // Reject tokens with a future iat (clock skew tolerance: 60s)
  if (p.iat > now + 60) return { ok: false, reason: "future_iat" };

  // Enforce max TTL — token lifetimes > MAX_EXPIRY_SECONDS are a misuse.
  // This prevents callers from minting long-lived session-replacement tokens.
  if (p.exp - p.iat > MAX_EXPIRY_SECONDS) return { ok: false, reason: "ttl_too_long" };

  const claims: BridgeClaims = {
    sub: p.sub,
    email: p.email,
    company_id: p.company_id,
    iat: p.iat,
    exp: p.exp,
    jti: p.jti,
    ...(typeof p.call_id === "string" && p.call_id.length > 0 ? { call_id: p.call_id } : {}),
  };

  return { ok: true, claims };
}

/** Convenience: returns claims on success, null on any failure. */
export function assertBridgeToken(token: string | null | undefined): BridgeClaims | null {
  const out = verifyBridgeToken(token);
  return out.ok ? out.claims : null;
}
