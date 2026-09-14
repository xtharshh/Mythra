// RacePanel — who is solving faster, live. Invite link in, ranked wall out.
// Needs the API for shared rooms; offline it still explains the solo path.
import { useEffect, useState } from "react";
import { api, apiOn, apiToken, formatPing, pingApi } from "../api/client";
import { loadSession } from "../auth/auth";
import { rankRacers } from "../game/invite";
import type { Racer } from "../game/invite";
import { Icon } from "./icons";

export function RacePanel({ worldId, worldName, roomId, inviteLink, onInvite }: {
  worldId: string;
  worldName: string;
  roomId: string | null;
  inviteLink: string | null;
  onInvite: () => void;
}) {
  const [board, setBoard] = useState<Racer[]>([]);
  const [copied, setCopied] = useState(false);
  const [ping, setPing] = useState<number | null>(null);
  const connected = apiOn();
  const session = (() => {
    try {
      return loadSession();
    } catch {
      return null;
    }
  })();
  const authed = connected && !!apiToken();

  useEffect(() => {
    if (!connected) return;
    let alive = true;
    void pingApi().then((ms) => {
      if (alive) setPing(ms);
    });
    return () => {
      alive = false;
    };
  }, [connected]);

  useEffect(() => {
    if (!apiOn() || !roomId) {
      setBoard([]);
      return;
    }
    let alive = true;
    const poll = async () => {
      const r = await api.raceRoom(roomId);
      if (!alive || !r) return;
      setBoard(rankRacers((r.board ?? []) as Racer[]));
    };
    void poll();
    const id = window.setInterval(() => void poll(), 5000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [roomId, worldId]);

  const copy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="hud-panel">
      <div className="row"><b><Icon name="spark" size={14} /> Race</b><span className="pill cyan">{worldName}</span></div>
      <div className="dossier-meta" style={{ marginTop: 4 }}>
        API: {connected ? (ping === null ? "connecting…" : `connected (${formatPing(ping, true)})`) : "local-only"} ·
        {session ? ` signed in as ${session.email.split("@")[0]}${authed ? "" : " (relink needed ↓)"}` : " guest"}
      </div>
      {!roomId ? (
        <div style={{ marginTop: 6 }}>
          <div className="muted" style={{ fontSize: 13 }}>
            {!connected
              ? "No API: set VITE_API_URL=http://localhost:4000 in mythra/.env, restart npm run dev. The link below still carries the tale itself."
              : !authed
                ? "API reachable, but this session has no API token — sign OUT and sign back IN once, then invite."
                : "Send a join link — solvers land in YOUR story, live on the speed board, visible in your sky."}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={onInvite}><Icon name="plus" size={12} /> Invite solvers</button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 6 }}>
          <label>Join link — send it, they land in this race</label>
          <div className="row">
            <input readOnly value={inviteLink ?? ""} onFocus={(e) => e.target.select()} style={{ flex: 1, fontSize: 11 }} />
            <button className="btn-ghost" style={{ padding: "2px 10px" }} onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</button>
          </div>
          {board.length === 0 ? (
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Room open — waiting for the first solver (that could be you).</div>
          ) : (
            <div style={{ marginTop: 6 }}>
              {board.map((r, i) => (
                <div key={r.user} className="row" style={{ fontSize: 13, padding: "4px 0", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
                  <span className={`pill ${i === 0 ? "cyan" : ""}`}>{i + 1}</span>
                  <b>{r.user}</b>
                  {r.finishedAt && <span className="pill green">finished</span>}
                  <span className="dossier-meta">{r.missions} missions · {r.clues} clues</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
