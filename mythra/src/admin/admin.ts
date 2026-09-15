// Admin session + dashboard data client. The admin login (email + server
// admin key) lives only on the /admin page — the key is never stored, only
// the issued Bearer token, next to the explorer API token.
import { apiBase } from "../api/client";
import type { AdminStats } from "../../server/admin";

export type { AdminStats };

export interface AdminSession {
  email: string;
  token: string;
  at: string;
}

const ADMIN_KEY = "mythra-admin-v1";

export function loadAdmin(): AdminSession | null {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AdminSession;
    if (!s || typeof s.email !== "string" || typeof s.token !== "string") return null;
    if (!s.email || !s.token) return null;
    return { email: s.email, token: s.token, at: typeof s.at === "string" ? s.at : "" };
  } catch {
    return null;
  }
}

export function saveAdmin(s: AdminSession): void {
  try {
    localStorage.setItem(ADMIN_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function clearAdmin(): void {
  try {
    localStorage.removeItem(ADMIN_KEY);
  } catch {
    /* ignore */
  }
}

async function authed<T>(path: string, init: RequestInit, token?: string): Promise<T> {
  const base = apiBase();
  if (!base) throw new Error("API unreachable — run the backend to use the admin panel.");
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch {
    throw new Error("API unreachable — run the backend to use the admin panel.");
  }
  let body: { error?: unknown } | null = null;
  try {
    body = (await res.json()) as { error?: unknown };
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const msg = typeof body?.error === "string" && body.error ? body.error : `Request failed (${res.status}).`;
    throw new Error(msg);
  }
  return (body ?? {}) as T;
}

/** Exchange admin email + key for a Bearer token. Throws with the server message. */
export async function adminLogin(email: string, key: string): Promise<AdminSession> {
  const clean = email.trim().toLowerCase();
  if (!clean) throw new Error("Enter the admin email.");
  if (!key) throw new Error("Enter the admin key.");
  const out = await authed<{ token: string; email: string }>("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: clean, key }),
  });
  if (!out.token) throw new Error("Login failed — no token issued.");
  const session: AdminSession = { email: out.email || clean, token: out.token, at: new Date().toISOString() };
  saveAdmin(session);
  return session;
}

/** Dashboard numbers. Throws (401/403) when the session isn't admin. */
export async function fetchAdminStats(token: string): Promise<AdminStats> {
  return authed<AdminStats>("/api/admin/stats", { method: "GET" }, token);
}
