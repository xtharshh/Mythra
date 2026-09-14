// Simple email login (skills.md G10): no backend, no password.
// Flow: enter email → demo "magic code" issued → enter code → session.
// Session namespaces saves + checkpoints per explorer. Pending codes and
// sessions live in localStorage; all validators are pure and unit-tested.

export interface AuthSession {
  /** verified email — or Discord display name for OAuth sign-ins */
  email: string;
  verifiedAt: string;
  avatar?: string;
  /** Discord profile (present only for Sign in with Discord) */
  discordId?: string;
  /** Discord unique handle, e.g. "ivan" */
  discordUsername?: string;
  /** Discord display/global name, e.g. "Ivan R" */
  displayName?: string;
}

interface PendingCode {
  email: string;
  code: string;
  expiresAt: number;
}

const SESSION_KEY = "lumen-auth-v1";
const PENDING_KEY = "lumen-auth-pending-v1";
export const CODE_TTL_MS = 10 * 60 * 1000;

/** Trim + lowercase; returns "" for non-strings. */
export function normalizeEmail(input: unknown): string {
  return typeof input === "string" ? input.trim().toLowerCase() : "";
}

/** Pragmatic RFC-5322-lite check: one @, dot in domain, no spaces, sane length. */
export function isValidEmail(input: unknown): boolean {
  const email = normalizeEmail(input);
  if (email.length < 5 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AuthSession;
    // sessions are validated at write time (email OR Discord display name)
    if (!s || typeof s.email !== "string" || s.email.length === 0) return null;
    const clean: AuthSession = { email: s.email, verifiedAt: typeof s.verifiedAt === "string" ? s.verifiedAt : "" };
    if (typeof s.avatar === "string" && s.avatar) clean.avatar = s.avatar;
    if (typeof s.discordId === "string" && s.discordId) clean.discordId = s.discordId;
    if (typeof s.discordUsername === "string" && s.discordUsername) clean.discordUsername = s.discordUsername;
    if (typeof s.displayName === "string" && s.displayName) clean.displayName = s.displayName;
    return clean;
  } catch {
    return null;
  }
}

/** True when this session came from Sign in with Discord. Pure. */
export function isDiscordSession(s: AuthSession | null): boolean {
  return !!s && typeof s.discordId === "string" && s.discordId.length > 0;
}

export function saveSession(s: AuthSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  notifySessionChanged();
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  notifySessionChanged();
}

export function saveOwner(): string {
  return loadSession()?.email ?? "guest";
}

/** Per-username storage key so every explorer's game data (library, voice
 *  lists, plays, …) files under their own login. Signed-out guests keep the
 *  bare legacy key (existing guest data is preserved as-is); logins get
 *  `base:sanitized-owner`. Pure. */
export function ownerKey(base: string, owner?: string): string {
  let who = owner ?? "guest";
  try {
    who = owner ?? saveOwner();
  } catch {
    who = owner ?? "guest";
  }
  const trimmed = who.trim();
  if (!trimmed || trimmed.toLowerCase() === "guest") return base;
  const safe = trimmed.toLowerCase().replace(/[^a-z0-9@._-]+/g, "_").slice(0, 80) || "guest";
  return `${base}:${safe}`;
}

/** Fired (same-tab) whenever the session changes — login, logout, OAuth
 *  landing — so the UI can hot-swap the explorer's data without reloading. */
export const SESSION_EVENT = "mythra-session";

export function notifySessionChanged(): void {
  try {
    window.dispatchEvent(new Event(SESSION_EVENT));
  } catch {
    /* headless */
  }
}

export type EntryMode = "offline" | "online";
const ENTRY_KEY = "mythra-entry-v1";

/** First-run gate choice. Null = never picked (show the gate). */
export function loadEntryChoice(): EntryMode | null {
  try {
    const raw = localStorage.getItem(ENTRY_KEY);
    return raw === "offline" || raw === "online" ? raw : null;
  } catch {
    return null;
  }
}

export function saveEntryChoice(mode: EntryMode): void {
  try {
    localStorage.setItem(ENTRY_KEY, mode);
  } catch {
    /* ignore */
  }
}

function readPending(): PendingCode | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingCode;
  } catch {
    return null;
  }
}

function writePending(p: PendingCode): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function mintCode(): string {
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return String(100000 + (buf[0] % 900000));
  } catch {
    return String(100000 + Math.floor(Math.random() * 900000));
  }
}

/**
 * Issue a login code for a valid email. Returns the code so the demo can
 * display it (no mail server in MVP). Throws on invalid email.
 */
export function requestLoginCode(email: string, now = Date.now()): string {
  const clean = normalizeEmail(email);
  if (!isValidEmail(clean)) throw new Error("Enter a valid email address.");
  const pending: PendingCode = { email: clean, code: mintCode(), expiresAt: now + CODE_TTL_MS };
  writePending(pending);
  return pending.code;
}

/** For tests/diagnostics only: which email has a live pending code. */
export function pendingEmail(now = Date.now()): string | null {
  const p = readPending();
  if (!p || p.expiresAt <= now) return null;
  return p.email;
}

/**
 * Verify a code. On success stores the session and returns it.
 * Throws on mismatch/expiry so the UI can show inline errors.
 */
export function verifyLoginCode(email: string, code: string, now = Date.now()): AuthSession {
  const clean = normalizeEmail(email);
  const p = readPending();
  if (!p || p.email !== clean) throw new Error("No code requested for this email — send one first.");
  if (p.expiresAt <= now) throw new Error("Code expired — request a fresh one.");
  if (p.code !== code.trim()) throw new Error("Wrong code — check the 6 digits and retry.");
  const session: AuthSession = { email: clean, verifiedAt: new Date(now).toISOString() };
  saveSession(session);
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
  return session;
}
