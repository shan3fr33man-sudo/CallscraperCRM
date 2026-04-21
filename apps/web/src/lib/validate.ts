import { NextResponse } from "next/server";
import { z, type ZodSchema, type ZodError } from "zod";

/**
 * Parse a JSON request body against a Zod schema. On success returns the
 * validated data. On failure returns a NextResponse with a 400 body shaped
 * like { error, details: { fieldErrors, formErrors } } so the UI can highlight
 * specific fields.
 *
 * Usage:
 *   const parsed = await parseBody(req, createTariffSchema);
 *   if (parsed instanceof Response) return parsed;
 *   const body = parsed;
 */
export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<T | Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: (result.error as ZodError).flatten(),
      },
      { status: 400 },
    );
  }
  return result.data;
}

/** Convenience alias so routes can import just one symbol. */
export { z };

/**
 * Remove keys with `undefined` values. Use before passing a PATCH body to
 * Supabase so omitted fields stay at their current value instead of being
 * set to null.
 */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}
