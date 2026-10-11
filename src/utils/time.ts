/** ISO-8601 UTC timestamp for "now", the canonical format for record timestamps. */
export function nowIso(): string {
  return new Date().toISOString();
}
