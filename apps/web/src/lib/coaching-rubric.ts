// Pure TypeScript call-coaching classifier. Zero LLM cost.
// scoreCall() runs against a plain JS object — safe to call from sync contexts,
// worker crons, and unit tests alike.

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface CoachingFlag {
  category: "greeting" | "discovery" | "objection_handling" | "closing" | "duration" | "outcome" | "follow_up";
  message: string;
  impact: "positive" | "negative" | "neutral";
  points: number;
}

export interface CoachingScore {
  call_id: string;
  score: number;
  grade: Grade;
  flags: CoachingFlag[];
  strengths: string[];
  improvements: string[];
}

export interface ScoreInput {
  call_id?: string;
  transcript?: string | null;
  duration_seconds: number;
  call_outcome: string | null;
  lead_quality?: string | null;
  intent?: string | null;
  action_items?: unknown;
}

function countMatches(haystack: string, needles: string[]): number {
  const lower = haystack.toLowerCase();
  let n = 0;
  for (const w of needles) {
    const re = new RegExp(w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const m = lower.match(re);
    if (m) n += m.length;
  }
  return n;
}

function distinctMatches(haystack: string, needles: string[]): number {
  const lower = haystack.toLowerCase();
  let n = 0;
  for (const w of needles) if (lower.includes(w.toLowerCase())) n += 1;
  return n;
}

const GREETING_WORDS = ["thank you for calling", "how can i help", "good morning", "good afternoon"];
const DISCOVERY_WORDS = ["how many", "bedrooms", "when", "move date", "from where", "to where", "how far", "stairs", "elevator", "storage"];
const CLOSING_WORDS = ["book", "schedule", "confirm", "credit card", "deposit"];

function gradeFor(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

export function scoreCall(input: ScoreInput): CoachingScore {
  const flags: CoachingFlag[] = [];
  let score = 50; // baseline

  const transcript = (input.transcript ?? "") || "";
  const duration = Number(input.duration_seconds ?? 0);
  const outcome = (input.call_outcome ?? "").toLowerCase();
  const lq = (input.lead_quality ?? "").toLowerCase();

  // Duration (20 points)
  if (duration < 60 && !/voicemail/.test(outcome)) {
    flags.push({ category: "duration", message: "Call too short (under 60s)", impact: "negative", points: -15 });
    score -= 15;
  } else if (duration <= 180) {
    flags.push({ category: "duration", message: "Good call length", impact: "positive", points: 5 });
    score += 5;
  } else if (duration <= 600) {
    flags.push({ category: "duration", message: "Thorough discovery (3–10 min)", impact: "positive", points: 20 });
    score += 20;
  } else {
    flags.push({ category: "duration", message: "Detailed consultation (10+ min)", impact: "positive", points: 10 });
    score += 10;
  }

  // Outcome (25 points)
  if (/booked|appointment|scheduled/.test(outcome)) {
    flags.push({ category: "outcome", message: "Booked / appointment set", impact: "positive", points: 25 });
    score += 25;
  } else if (/callback|follow/.test(outcome)) {
    flags.push({ category: "outcome", message: "Follow-up queued", impact: "positive", points: 15 });
    score += 15;
  } else if (/quote|estimate/.test(outcome)) {
    flags.push({ category: "outcome", message: "Estimate provided", impact: "positive", points: 15 });
    score += 15;
  } else if (/not interested|hung up/.test(outcome)) {
    flags.push({ category: "outcome", message: "Prospect declined", impact: "neutral", points: 0 });
  } else if (!outcome) {
    flags.push({ category: "outcome", message: "No outcome recorded", impact: "negative", points: -5 });
    score -= 5;
  }

  // Lead quality (20 points)
  if (lq === "hot") {
    flags.push({ category: "discovery", message: "Hot lead identified", impact: "positive", points: 20 });
    score += 20;
  } else if (lq === "warm") {
    flags.push({ category: "discovery", message: "Warm lead identified", impact: "positive", points: 12 });
    score += 12;
  } else if (lq === "cold") {
    flags.push({ category: "discovery", message: "Cold lead", impact: "positive", points: 5 });
    score += 5;
  }

  // Transcript keyword scoring (35 points max)
  if (transcript && transcript.length > 0) {
    const greetingHits = Math.min(distinctMatches(transcript, GREETING_WORDS) * 5, 10);
    if (greetingHits > 0) {
      flags.push({ category: "greeting", message: `Professional greeting (${greetingHits} pts)`, impact: "positive", points: greetingHits });
      score += greetingHits;
    } else {
      flags.push({ category: "greeting", message: "No standard greeting detected", impact: "negative", points: 0 });
    }

    const discoveryHits = Math.min(distinctMatches(transcript, DISCOVERY_WORDS) * 5, 15);
    if (discoveryHits >= 10) {
      flags.push({ category: "discovery", message: `Strong discovery questions (${discoveryHits} pts)`, impact: "positive", points: discoveryHits });
      score += discoveryHits;
    } else if (discoveryHits > 0) {
      flags.push({ category: "discovery", message: `Some discovery (${discoveryHits} pts)`, impact: "positive", points: discoveryHits });
      score += discoveryHits;
    } else {
      flags.push({ category: "discovery", message: "Weak discovery — no move-size or date questions", impact: "negative", points: 0 });
    }

    const closingHits = Math.min(distinctMatches(transcript, CLOSING_WORDS) * 5, 10);
    if (closingHits > 0) {
      flags.push({ category: "closing", message: `Closing attempt detected (${closingHits} pts)`, impact: "positive", points: closingHits });
      score += closingHits;
    } else {
      flags.push({ category: "closing", message: "No closing attempt detected", impact: "negative", points: 0 });
    }

    const holdCount = countMatches(transcript, ["hold on"]);
    if (holdCount > 3) {
      flags.push({ category: "objection_handling", message: "Excessive hold time", impact: "negative", points: -5 });
      score -= 5;
    }
    const unsureCount = countMatches(transcript, ["i don't know", "i dont know"]);
    if (unsureCount > 2) {
      flags.push({ category: "objection_handling", message: "Uncertain responses", impact: "negative", points: -5 });
      score -= 5;
    }
    if (transcript.length < 200 && duration > 120) {
      flags.push({ category: "discovery", message: "Short transcript despite long call", impact: "negative", points: -10 });
      score -= 10;
    }
  } else {
    flags.push({ category: "discovery", message: "No transcript available for deep scoring", impact: "neutral", points: 0 });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const strengths = flags.filter((f) => f.impact === "positive").map((f) => f.message);
  const improvements = flags.filter((f) => f.impact === "negative").map((f) => f.message);

  if (strengths.length === 0) strengths.push("Call was recorded and tracked");
  if (improvements.length === 0) improvements.push("Keep up current performance");

  return {
    call_id: String(input.call_id ?? ""),
    score,
    grade: gradeFor(score),
    flags,
    strengths,
    improvements,
  };
}
