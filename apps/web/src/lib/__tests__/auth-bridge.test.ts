// Unit tests for the callscraper → CRM auth bridge.
// Run with: node --experimental-strip-types --test apps/web/src/lib/__tests__/auth-bridge.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  signBridgeToken,
  verifyBridgeToken,
  assertBridgeToken,
} from "../auth-bridge.ts";

process.env.BRIDGE_SIGNING_SECRET = "a".repeat(32);
delete process.env.ALLOW_DEV_SECRET;

function validClaims(overrides: Record<string, unknown> = {}) {
  return {
    sub: "user-123",
    email: "user@example.com",
    company_id: "co-abc",
    ...overrides,
  };
}

test("round-trips a valid token", () => {
  const tok = signBridgeToken(validClaims());
  const out = verifyBridgeToken(tok);
  assert.equal(out.ok, true);
  if (out.ok) {
    assert.equal(out.claims.sub, "user-123");
    assert.equal(out.claims.email, "user@example.com");
    assert.equal(out.claims.company_id, "co-abc");
    assert.ok(out.claims.exp > Math.floor(Date.now() / 1000));
  }
});

test("includes optional call_id when present", () => {
  const tok = signBridgeToken({ ...validClaims(), call_id: "call-xyz" });
  const claims = assertBridgeToken(tok);
  assert.equal(claims?.call_id, "call-xyz");
});

test("omits call_id when absent", () => {
  const tok = signBridgeToken(validClaims());
  const claims = assertBridgeToken(tok);
  assert.equal(claims?.call_id, undefined);
});

test("rejects missing token", () => {
  assert.deepEqual(verifyBridgeToken(null), { ok: false, reason: "missing" });
  assert.deepEqual(verifyBridgeToken(undefined), { ok: false, reason: "missing" });
  assert.deepEqual(verifyBridgeToken(""), { ok: false, reason: "missing" });
});

test("rejects overlong token (DoS guard)", () => {
  const huge = "v1b." + "a".repeat(2000);
  const out = verifyBridgeToken(huge);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, "too_long");
});

test("rejects malformed (wrong part count)", () => {
  const out = verifyBridgeToken("v1b.only-two-parts");
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, "malformed");
});

test("rejects wrong version prefix", () => {
  const tok = signBridgeToken(validClaims());
  const tampered = tok.replace(/^v1b\./, "v2b.");
  const out = verifyBridgeToken(tampered);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, "wrong_version");
});

test("rejects estimate-token-style prefix (cross-protocol domain separation)", () => {
  // Critical: a token that looks like an estimate-token (v1 prefix) must
  // NOT validate in the bridge verifier even if an engineer reused the
  // same secret across both env vars. The `v1b` vs `v1` split is the
  // domain separator.
  const tok = signBridgeToken(validClaims());
  const wrongPrefix = tok.replace(/^v1b\./, "v1.");
  const out = verifyBridgeToken(wrongPrefix);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, "wrong_version");
});

test("rejects tampered signature", () => {
  const tok = signBridgeToken(validClaims());
  const parts = tok.split(".");
  const sig = parts[2];
  const tampered = [parts[0], parts[1], sig.slice(0, -1) + (sig.at(-1) === "A" ? "B" : "A")].join(".");
  const out = verifyBridgeToken(tampered);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, "bad_signature");
});

test("rejects tampered payload (signature invalidates)", () => {
  const tok = signBridgeToken(validClaims());
  const parts = tok.split(".");
  // Swap the payload for one claiming a different company_id
  const newPayload = Buffer.from(
    JSON.stringify({ ...validClaims(), company_id: "co-evil", iat: 0, exp: 9e9, jti: "x" }),
    "utf8",
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const tampered = [parts[0], newPayload, parts[2]].join(".");
  const out = verifyBridgeToken(tampered);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, "bad_signature");
});

test("rejects expired token", () => {
  const now = Math.floor(Date.now() / 1000);
  const tok = signBridgeToken({
    ...validClaims(),
    iat: now - 120,
    exp: now - 60, // expired 60s ago
  });
  const out = verifyBridgeToken(tok);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, "expired");
});

test("rejects future-dated token beyond clock-skew window", () => {
  const now = Math.floor(Date.now() / 1000);
  const tok = signBridgeToken({
    ...validClaims(),
    iat: now + 300, // 5 minutes in the future
    exp: now + 360,
  });
  const out = verifyBridgeToken(tok);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, "future_iat");
});

test("tolerates small clock skew on iat (60s window)", () => {
  const now = Math.floor(Date.now() / 1000);
  const tok = signBridgeToken({
    ...validClaims(),
    iat: now + 30, // 30s ahead — within tolerance
    exp: now + 120,
  });
  const out = verifyBridgeToken(tok);
  assert.equal(out.ok, true);
});

test("rejects tokens with TTL > 5 minutes", () => {
  const now = Math.floor(Date.now() / 1000);
  const tok = signBridgeToken({
    ...validClaims(),
    iat: now,
    exp: now + 60 * 60, // 1 hour — too long
  });
  const out = verifyBridgeToken(tok);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, "ttl_too_long");
});

test("rejects tokens missing required claims", () => {
  const now = Math.floor(Date.now() / 1000);
  // Hand-craft a payload missing `email`
  const payload = Buffer.from(
    JSON.stringify({ sub: "u", company_id: "c", iat: now, exp: now + 60, jti: "x" }),
    "utf8",
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  // We need to sign this ourselves since signBridgeToken enforces the claim shape
  const sig = createHmac("sha256", "a".repeat(32)).update(`v1b.${payload}`).digest();
  const sigB64 = sig.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const tok = `v1b.${payload}.${sigB64}`;
  const out = verifyBridgeToken(tok);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, "missing_claim");
});

test("tokens signed with a different secret fail verification", () => {
  const original = process.env.BRIDGE_SIGNING_SECRET;
  process.env.BRIDGE_SIGNING_SECRET = "a".repeat(32);
  const tok = signBridgeToken(validClaims());
  // Rotate secret
  process.env.BRIDGE_SIGNING_SECRET = "b".repeat(32);
  const out = verifyBridgeToken(tok);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, "bad_signature");
  process.env.BRIDGE_SIGNING_SECRET = original;
});

test("dev fallback requires ALLOW_DEV_SECRET=1", () => {
  const original = process.env.BRIDGE_SIGNING_SECRET;
  const originalAllow = process.env.ALLOW_DEV_SECRET;
  delete process.env.BRIDGE_SIGNING_SECRET;
  delete process.env.ALLOW_DEV_SECRET;
  assert.throws(() => signBridgeToken(validClaims()), /BRIDGE_SIGNING_SECRET/);

  process.env.ALLOW_DEV_SECRET = "1";
  const tok = signBridgeToken(validClaims());
  const out = verifyBridgeToken(tok);
  assert.equal(out.ok, true);

  process.env.BRIDGE_SIGNING_SECRET = original;
  process.env.ALLOW_DEV_SECRET = originalAllow;
});

test("assertBridgeToken convenience wrapper", () => {
  const tok = signBridgeToken(validClaims());
  assert.ok(assertBridgeToken(tok));
  assert.equal(assertBridgeToken("garbage"), null);
  assert.equal(assertBridgeToken(null), null);
});

test("rejects non-string call_id (type confusion)", () => {
  // Hand-craft a payload with call_id as a number — must fail validation
  // because the /launch page uses it directly in a SQL predicate.
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: "u",
      email: "a@b",
      company_id: "c",
      iat: now,
      exp: now + 60,
      jti: "x",
      call_id: 12345, // number instead of string
    }),
    "utf8",
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const sig = createHmac("sha256", "a".repeat(32)).update(`v1b.${payload}`).digest();
  const sigB64 = sig.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const tok = `v1b.${payload}.${sigB64}`;
  const out = verifyBridgeToken(tok);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, "missing_claim");
});

test("rejects overlong company_id (defense in depth)", () => {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      sub: "u",
      email: "a@b",
      company_id: "x".repeat(200), // > 128 cap
      iat: now,
      exp: now + 60,
      jti: "j",
    }),
    "utf8",
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const sig = createHmac("sha256", "a".repeat(32)).update(`v1b.${payload}`).digest();
  const sigB64 = sig.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const tok = `v1b.${payload}.${sigB64}`;
  const out = verifyBridgeToken(tok);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, "missing_claim");
});
