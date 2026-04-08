// Phone normalization + matching helpers.
// SELF-TEST: uncomment + run with: npx ts-node src/lib/phone.ts
// console.assert(normalizePhone("(425) 555-1234") === "4255551234")
// console.assert(normalizePhone("+14255551234") === "14255551234")
// console.assert(phoneMatch("+14255551234", "425-555-1234") === true)
// console.assert(phoneMatch("", "4255551234") === false)

export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  return digits;
}

export function phoneMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  const la = na.slice(-10);
  const lb = nb.slice(-10);
  return la.length === 10 && la === lb;
}
