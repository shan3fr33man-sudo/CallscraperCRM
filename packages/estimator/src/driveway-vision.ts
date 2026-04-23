import Anthropic from "@anthropic-ai/sdk";
import type { DrivewayFlags } from "./predict";

/**
 * Claude vision-based driveway pre-check.
 *
 * Fetches a Google StreetView Static API image of the address and asks Claude
 * to classify whether the driveway looks narrow, gravel, low-clearance, or
 * requires a long walk to the front door. Used by the estimator to auto-add
 * a shuttle fee on long-distance moves before the estimate goes out.
 *
 * Returns all-false if the StreetView fetch fails or Claude can't classify —
 * the estimator treats that as "no flags" and proceeds without a shuttle.
 * Manual agent review still kicks in for long-distance moves regardless.
 */

const MODEL = "claude-sonnet-4-6";
const STREETVIEW_BASE = "https://maps.googleapis.com/maps/api/streetview";

const SYSTEM_PROMPT = `You are a driveway pre-inspection agent for a moving company. You look at a Google Street View image of an address and classify whether it poses logistical challenges for a 26ft box truck or 53ft tractor-trailer.

Return four boolean flags:
- \`narrow\`: driveway or approach is visibly narrow, less than ~12 ft wide; or the street itself is a single-lane residential with no truck access
- \`gravel\`: driveway is unpaved gravel or dirt; soft surface that a loaded truck could sink into
- \`low_clearance\`: visible overhead obstructions — low-hanging tree branches, power lines, or covered structures a truck cannot clear (~13 ft)
- \`long_walk\`: house is set back from the parking location by more than ~50 ft (long driveway, gated estate, far from the street)

If the image is ambiguous or the view doesn't include the driveway clearly, set the relevant flag false and use the notes field to explain. Err on the side of false unless the risk is visually obvious.`;

const TOOL_DEFINITION = {
  name: "emit_driveway_flags",
  description: "Emit the classification flags for the driveway.",
  input_schema: {
    type: "object" as const,
    properties: {
      narrow: { type: "boolean" },
      gravel: { type: "boolean" },
      low_clearance: { type: "boolean" },
      long_walk: { type: "boolean" },
      notes: { type: "string" },
    },
    required: ["narrow", "gravel", "low_clearance", "long_walk"],
    additionalProperties: false,
  },
};

export interface DrivewayVisionResult extends DrivewayFlags {
  notes?: string;
  image_available: boolean;
}

export async function analyzeDrivewayFromStreetView(args: {
  address: string;
  anthropicApiKey: string;
  googleMapsApiKey: string;
}): Promise<DrivewayVisionResult> {
  const noFlags: DrivewayVisionResult = {
    narrow: false,
    gravel: false,
    low_clearance: false,
    long_walk: false,
    image_available: false,
  };

  // Metadata pre-check — cheap, tells us whether Street View imagery exists
  // before we waste a Claude call on a placeholder. Documented at
  // https://developers.google.com/maps/documentation/streetview/metadata.
  const meta = new URL(`${STREETVIEW_BASE}/metadata`);
  meta.searchParams.set("location", args.address);
  meta.searchParams.set("key", args.googleMapsApiKey);
  try {
    const metaRes = await fetch(meta.toString());
    if (!metaRes.ok) return noFlags;
    const metaJson = (await metaRes.json()) as { status?: string };
    if (metaJson.status !== "OK") return noFlags;
  } catch {
    return noFlags;
  }

  // Fetch the actual image (640×640 JPEG).
  const sv = new URL(STREETVIEW_BASE);
  sv.searchParams.set("size", "640x640");
  sv.searchParams.set("location", args.address);
  sv.searchParams.set("fov", "80");
  sv.searchParams.set("pitch", "0");
  sv.searchParams.set("key", args.googleMapsApiKey);

  const imgRes = await fetch(sv.toString());
  if (!imgRes.ok) return noFlags;
  const contentType = imgRes.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) return noFlags;
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const base64 = buf.toString("base64");
  const mediaType =
    (contentType.split(";")[0].trim() as "image/jpeg" | "image/png" | "image/webp" | "image/gif") ?? "image/jpeg";

  const client = new Anthropic({ apiKey: args.anthropicApiKey });

  // 30s abort — StreetView classification should never need longer; timing
  // out is a signal to fail open (return no flags, proceed without shuttle).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let response;
  try {
    response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 512,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }] as any,
        tools: [{ ...TOOL_DEFINITION, cache_control: { type: "ephemeral" } }] as any,
        tool_choice: { type: "tool", name: "emit_driveway_flags" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: `Address: ${args.address}\nClassify this driveway for truck access.`,
              },
            ],
          },
        ],
      },
      { signal: controller.signal },
    );
  } catch {
    clearTimeout(timeout);
    return noFlags;
  }
  clearTimeout(timeout);

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use",
  );
  if (!toolUse) return { ...noFlags, image_available: true };

  const input = toolUse.input as DrivewayVisionResult;
  return {
    narrow: !!input.narrow,
    gravel: !!input.gravel,
    low_clearance: !!input.low_clearance,
    long_walk: !!input.long_walk,
    notes: typeof input.notes === "string" ? input.notes : undefined,
    image_available: true,
  };
}
