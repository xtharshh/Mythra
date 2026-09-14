// Party invites (multiplayer): one link carries the tale + the race room.
// `${origin}/play?invite=<base64url({v:1, room, code})>` — the joiner imports
// the world, lands on the Surface, and appears in your sky. Pure + tested.

import { exportWorldCode } from "./share";
import type { World } from "../types";

export interface InvitePayload {
  v: 1;
  /** race room id (empty = same story, solo flight) */
  room: string;
  /** full world share code */
  code: string;
}

interface NodeBuffer {
  from(s: string, enc: string): { toString(enc: string): string };
}

function nodeBuffer(): NodeBuffer | null {
  try {
    const g = globalThis as unknown as { Buffer?: NodeBuffer };
    return g.Buffer ?? null;
  } catch {
    return null;
  }
}

function b64urlEncode(json: string): string {
  const Buf = nodeBuffer();
  const b64 = Buf
    ? Buf.from(json, "utf8").toString("base64")
    : (() => {
        const bytes = new TextEncoder().encode(json);
        let bin = "";
        for (const b of bytes) bin += String.fromCharCode(b);
        return btoa(bin);
      })();
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(payload: string): string {
  let s = payload.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4 !== 0) s += "=";
  const Buf = nodeBuffer();
  if (Buf) return Buf.from(s, "base64").toString("utf8");
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Build a join link for this tale + room. Needs window (browser only). */
export function buildInviteLink(roomId: string, world: World): string {
  const payload: InvitePayload = { v: 1, room: roomId, code: exportWorldCode(world) };
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/play?invite=${b64urlEncode(JSON.stringify(payload))}`;
}

/** Short join link: the tale lives on the API under the room, so the URL
 *  stays pocket-sized (~40 chars) and survives every chat app. Needs the
 *  API + a stored room snapshot (see POST /api/rooms). */
export function buildShortInviteLink(roomId: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/play?room=${roomId}`;
}

/** Validate `?room=` (server ids are 6 hex chars). Throws readable errors. */
export function parseRoomId(raw: string): string {
  const id = (raw ?? "").trim().toLowerCase();
  if (/^[0-9a-f]{6}$/.test(id)) return id;
  throw new Error("That race link is corrupted — ask the host to resend it.");
}

/** Parse `?invite=` back. Throws human-readable errors. */
export function parseInvite(raw: string): InvitePayload {
  let json: string;
  try {
    json = b64urlDecode(raw);
  } catch {
    throw new Error("That invite link is corrupted — ask the host to resend it.");
  }
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("That invite link is corrupted — ask the host to resend it.");
  }
  const p = data as Partial<InvitePayload>;
  if (p.v !== 1 || typeof p.code !== "string" || typeof p.room !== "string") {
    throw new Error("That invite link isn't a MYTHRA party — ask the host to resend it.");
  }
  return { v: 1, room: p.room, code: p.code };
}

export interface Racer {
  user: string;
  missions: number;
  clues: number;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
}

/** Speed ranking: missions → clues → finished earliest → started earliest. Pure. */
export function rankRacers(racers: Racer[]): Racer[] {
  return racers.slice().sort((a, b) => {
    if (b.missions !== a.missions) return b.missions - a.missions;
    if (b.clues !== a.clues) return b.clues - a.clues;
    const fa = a.finishedAt ?? "";
    const fb = b.finishedAt ?? "";
    if (fa && fb && fa !== fb) return fa < fb ? -1 : 1;
    if (fa && !fb) return -1;
    if (fb && !fa) return 1;
    return a.startedAt < b.startedAt ? -1 : 1;
  });
}
