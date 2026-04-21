// Lightweight round-trip tests for the HMAC token helper. Run with:
//   node --test apps/web/src/lib/__tests__/estimate-token.test.ts
// (TypeScript via ts-node or after tsc compilation). These are not wired into
// CI yet — the smoke suite covers the routes that depend on this — but the
// module is simple enough that these serve as living documentation.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signEstimateToken,
  verifyEstimateToken,
  assertEstimateToken,
} from "../estimate-token.ts";

process.env.ESTIMATE_SIGNING_SECRET = "a".repeat(32);

test("signs and verifies a round-trip token", () => {
  const id = "0670894f-2a9e-443b-8c81-b98730918c2b";
  const tok = signEstimateToken(id);
  const v = verifyEstimateToken(tok);
  assert.ok(v, "token should verify");
  assert.equal(v?.estimate_id, id);
  assert.ok(v!.expires_at.getTime() > Date.now());
});

test("rejects a token bound to a different estimate", () => {
  const tok = signEstimateToken("estimate-a");
  assert.equal(assertEstimateToken(tok, "estimate-a"), true);
  assert.equal(assertEstimateToken(tok, "estimate-b"), false);
});

test("rejects tampered signature", () => {
  const tok = signEstimateToken("x");
  const parts = tok.split(".");
  // flip the last char of the sig segment
  const sig = parts[3];
  const tampered = parts.slice(0, 3).concat([sig.slice(0, -1) + (sig.at(-1) === "A" ? "B" : "A")]).join(".");
  assert.equal(verifyEstimateToken(tampered), null);
});

test("rejects expired token", () => {
  const tok = signEstimateToken("x", -1); // already expired
  assert.equal(verifyEstimateToken(tok), null);
});

test("rejects malformed tokens", () => {
  assert.equal(verifyEstimateToken(""), null);
  assert.equal(verifyEstimateToken(null), null);
  assert.equal(verifyEstimateToken(undefined), null);
  assert.equal(verifyEstimateToken("garbage"), null);
  assert.equal(verifyEstimateToken("v2.a.b.c"), null); // wrong version
  assert.equal(verifyEstimateToken("a.b.c"), null); // 3 parts, not 4
});

test("rejects overlong tokens (DoS guard)", () => {
  const huge = "v1." + "a".repeat(600);
  assert.equal(verifyEstimateToken(huge), null);
});

test("rejects expiry with trailing garbage", () => {
  // Craft a token with "123abc" as the expiry segment; must be rejected.
  // Easiest way: sign a valid token, then swap the exp segment.
  const tok = signEstimateToken("x");
  const parts = tok.split(".");
  // b64url("9999999999abc")
  const bad = Buffer.from("9999999999abc", "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const tampered = [parts[0], parts[1], bad, parts[3]].join(".");
  assert.equal(verifyEstimateToken(tampered), null);
});

test("assertEstimateToken rejects empty expected id", () => {
  const tok = signEstimateToken("real-id");
  assert.equal(assertEstimateToken(tok, ""), false);
});

test("tokens signed with a different secret don't verify", async () => {
  // Freeze current secret, issue a token
  const originalSecret = process.env.ESTIMATE_SIGNING_SECRET;
  process.env.ESTIMATE_SIGNING_SECRET = "a".repeat(32);
  const tok1 = signEstimateToken("id-x");

  // Rotate secret — old token must no longer verify. We import fresh because
  // getSecret() re-reads process.env on every call.
  process.env.ESTIMATE_SIGNING_SECRET = "b".repeat(32);
  assert.equal(verifyEstimateToken(tok1), null);

  process.env.ESTIMATE_SIGNING_SECRET = originalSecret;
});

test("dev fallback only usable with ALLOW_DEV_SECRET", () => {
  const originalSecret = process.env.ESTIMATE_SIGNING_SECRET;
  const originalAllow = process.env.ALLOW_DEV_SECRET;
  delete process.env.ESTIMATE_SIGNING_SECRET;
  delete process.env.ALLOW_DEV_SECRET;
  assert.throws(() => signEstimateToken("x"), /ESTIMATE_SIGNING_SECRET/);

  process.env.ALLOW_DEV_SECRET = "1";
  const tok = signEstimateToken("x");
  assert.ok(verifyEstimateToken(tok));

  process.env.ESTIMATE_SIGNING_SECRET = originalSecret;
  process.env.ALLOW_DEV_SECRET = originalAllow;
});
