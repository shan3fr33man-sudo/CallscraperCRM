import Anthropic from "@anthropic-ai/sdk";
import type { InventoryItem } from "./types";

/**
 * Claude-powered extractor that converts a Call Scraper transcript (free text,
 * agent walks customer through room-by-room) into a structured InventoryItem[].
 *
 * Uses Sonnet 4.6 — plenty of capability for structured extraction, much
 * cheaper than Opus for a workload that runs per-call. Prompt caching on the
 * system prompt amortizes the schema/instructions across every call on a
 * single workspace's Anthropic key.
 *
 * Tool use guarantees well-formed JSON — we don't parse natural language
 * output. If the model can't produce any items, it returns an empty array
 * with low confidence rather than inventing.
 */

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are an inventory extraction agent for a moving company's estimator.

You receive a phone-call transcript where a sales agent walked the customer through their home room-by-room collecting an inventory. Your job is to produce a clean, structured inventory the estimator can price.

Rules:
1. Preserve the customer's own words for item names where possible.
2. If the customer said a room but no items, still emit an empty room entry (so the estimator knows about stairs/levels).
3. Infer \`level\` from phrasing ("upstairs bedroom", "basement garage") — normalize to one of: "ground", "upper", "lower", "attic", "basement".
4. If the customer gives dimensions (e.g. "about three feet by two by six"), put them in \`lwh_ft\` as "3x2x6". If only one dimension or vague ("kind of big"), leave \`lwh_ft\` empty.
5. For box estimates like "six cubic foot totes, maybe 15 of them", emit as a row with \`name\` describing the container size and set \`box_size_cu_ft\` accordingly.
6. Flag \`disassemble\` true only when the agent or customer explicitly mentioned it needs disassembly.
7. Do not invent items the transcript does not support. If the transcript is vague about a room, emit a minimal entry with a note in \`name\` like "unspecified boxes" rather than hallucinating a sofa.
8. Set the overall \`confidence\` between 0 and 1 based on how completely the transcript covered every room with clear quantities. 0.9+ only when every room had explicit item names and counts.`;

/** Tool schema. Using strict JSON schema so Claude returns exactly this shape. */
const TOOL_DEFINITION = {
  name: "emit_inventory",
  description: "Emit the structured inventory extracted from the transcript.",
  input_schema: {
    type: "object" as const,
    properties: {
      confidence: { type: "number", minimum: 0, maximum: 1 },
      rooms: {
        type: "array",
        items: {
          type: "object",
          properties: {
            room: { type: "string" },
            level: {
              type: "string",
              enum: ["ground", "upper", "lower", "attic", "basement", "unknown"],
            },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  qty: { type: "integer", minimum: 1 },
                  lwh_ft: { type: "string" },
                  disassemble: { type: "boolean" },
                  box_size_cu_ft: { type: "number" },
                },
                required: ["name", "qty"],
                additionalProperties: false,
              },
            },
          },
          required: ["room", "items"],
          additionalProperties: false,
        },
      },
    },
    required: ["confidence", "rooms"],
    additionalProperties: false,
  },
};

export interface TranscriptExtractionResult {
  items: InventoryItem[];
  confidence: number;
  rooms_identified: number;
  raw_extraction: unknown;
}

export async function extractInventoryFromTranscript(args: {
  transcript: string;
  summary?: string;
  apiKey: string;
}): Promise<TranscriptExtractionResult> {
  const client = new Anthropic({ apiKey: args.apiKey });

  const userContent = args.summary
    ? `Call summary (for context):\n${args.summary}\n\n---\n\nFull transcript:\n${args.transcript}`
    : args.transcript;

  // 30s abort — transcripts can be long but extraction should never stall
  // the estimator path. Fail open on timeout (caller gets zero items).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let response;
  try {
    response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 4096,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ] as any,
        tools: [
          {
            ...TOOL_DEFINITION,
            cache_control: { type: "ephemeral" },
          },
        ] as any,
        tool_choice: { type: "tool", name: "emit_inventory" },
        messages: [{ role: "user", content: userContent }],
      },
      { signal: controller.signal },
    );
  } catch {
    clearTimeout(timeout);
    return { items: [], confidence: 0, rooms_identified: 0, raw_extraction: null };
  }
  clearTimeout(timeout);

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use",
  );
  if (!toolUse) {
    return { items: [], confidence: 0, rooms_identified: 0, raw_extraction: null };
  }

  const parsed = toolUse.input as {
    confidence: number;
    rooms: Array<{
      room: string;
      level?: string;
      items: Array<{
        name: string;
        qty: number;
        lwh_ft?: string;
        disassemble?: boolean;
        box_size_cu_ft?: number;
      }>;
    }>;
  };

  const items: InventoryItem[] = [];
  for (const r of parsed.rooms) {
    for (const it of r.items) {
      items.push({
        room: r.room,
        level: r.level,
        name: it.name,
        qty: it.qty,
        lwh_ft: it.lwh_ft,
        disassemble: it.disassemble,
        box_size_cu_ft: it.box_size_cu_ft,
      });
    }
  }

  return {
    items,
    confidence: parsed.confidence,
    rooms_identified: parsed.rooms.length,
    raw_extraction: parsed,
  };
}
