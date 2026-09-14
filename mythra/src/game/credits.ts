// Credits (attribution): every story, clue, chapter, and recording shows
// WHO made it. Pure helpers — unit-tested.
import { loadSession } from "../auth/auth";

/** Signed-in explorer name, or guest fallback. */
export function explorerName(): string {
  try {
    const email = loadSession()?.email;
    if (email) return email.split("@")[0];
  } catch {
    /* ignore */
  }
  return "guest explorer";
}

/** Human label for a world ownerId (`creator-lumen` → `lumen`). */
export function ownerLabel(ownerId: string): string {
  const clean = (ownerId ?? "").trim();
  for (const prefix of ["creator-", "author-", "user-"]) {
    if (clean.toLowerCase().startsWith(prefix)) return clean.slice(prefix.length) || clean;
  }
  return clean || "unknown";
}

/** Verb for a clue discovery method, for journal hints. Pure. */
export function discoverVerb(method: string): string {
  switch (method) {
    case "inspect": return "Inspect";
    case "collect": return "Collect from";
    case "solve": return "Solve";
    case "talk": return "Talk at";
    case "activate": return "Activate";
    case "combine": return "Combine at";
    case "observe": return "Find near";
    default: return "Discover at";
  }
}
