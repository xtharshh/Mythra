// Share codes (discovery): a published story travels as portable text.
// Export → base64(JSON) the solver pastes into any deployment's Archive.
// Pure + unit-tested; validation reuses the Zod world schema on import.
import { worldSchema } from "../schemas";
import type { World } from "../types";

function nodeBuffer(): { from(s: string, enc: string): { toString(enc: string): string } } | null {
  try {
    const g = globalThis as unknown as { Buffer?: { from(s: string, enc: string): { toString(enc: string): string } } };
    return g.Buffer ?? null;
  } catch {
    return null;
  }
}

function toB64(json: string): string {
  const Buf = nodeBuffer();
  if (Buf) return Buf.from(json, "utf8").toString("base64");
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(code: string): string {
  const clean = code.trim().replace(/\s+/g, "");
  const Buf = nodeBuffer();
  if (Buf) return Buf.from(clean, "base64").toString("utf8");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Portable share code for a world (compact JSON, no whitespace). */
export function exportWorldCode(world: World): string {
  return toB64(JSON.stringify(world));
}

/** Parse + schema-check a share code. Throws a human-readable error. */
export function importWorldCode(code: string): World {
  let json: string;
  try {
    json = fromB64(code);
  } catch {
    throw new Error("That code doesn't decode — copy the full Export text.");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("That code isn't a world — copy the full Export text.");
  }
  return importWorldObject(raw);
}

/** Schema-check an already-decoded world object (room snapshots, API tales).
 *  Throws a human-readable error. */
export function importWorldObject(data: unknown): World {
  const parsed = worldSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`That world failed checks: ${parsed.error.issues[0]?.message ?? "invalid shape"}`);
  }
  const world = parsed.data as unknown as World;
  // imported copies arrive as drafts until their new owner publishes them
  return { ...world, status: "draft" };
}
