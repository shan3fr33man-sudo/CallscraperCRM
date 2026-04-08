import "server-only";
import { crmClient, DEFAULT_ORG_ID } from "./crmdb";

const PRICE_IN = 0.000003;
const PRICE_OUT = 0.000015;

export async function logAiUsage(tool: string, tokens_in: number, tokens_out: number) {
  try {
    const sb = crmClient();
    const cost_estimate = tokens_in * PRICE_IN + tokens_out * PRICE_OUT;
    await sb.from("ai_usage").insert({
      org_id: DEFAULT_ORG_ID,
      tool,
      tokens_in,
      tokens_out,
      cost_estimate,
    });
  } catch {
    // swallow — never fail user action on logging
  }
}
