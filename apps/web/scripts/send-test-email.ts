#!/usr/bin/env node
/**
 * Standalone Resend sanity check. Zero npm deps — uses global fetch.
 * Usage: RESEND_API_KEY=... npx tsx apps/web/scripts/send-test-email.ts
 * Exits 0 on success (prints provider message id), 1 on failure.
 */

const TO = "shan3fr33man@gmail.com";
const SUBJECT = "CallscraperCRM: resend sanity test";
const BODY = "If you can read this, Resend is wired correctly.";

async function main(): Promise<number> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("ERROR: RESEND_API_KEY is not set in the environment.");
    return 1;
  }

  const from =
    process.env.RESEND_FROM_EMAIL ?? "CallscraperCRM <onboarding@resend.dev>";

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: TO,
        subject: SUBJECT,
        text: BODY,
      }),
    });
  } catch (err) {
    console.error("ERROR: network/fetch failure:", (err as Error).message);
    return 1;
  }

  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    name?: string;
  };

  if (!res.ok) {
    const detail = json.message ?? json.name ?? `HTTP ${res.status}`;
    console.error(`ERROR: Resend rejected the request: ${detail}`);
    return 1;
  }

  if (!json.id) {
    console.error("ERROR: Resend returned 2xx but no message id.");
    return 1;
  }

  console.log(`OK: sent to ${TO} (provider_id=${json.id})`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("ERROR: unhandled exception:", err);
    process.exit(1);
  });
