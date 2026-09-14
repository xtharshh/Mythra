// Leaderboard (multiplayer): top solvers per tale, usernames on the wall.
// Reads the MYTHRA API when connected; otherwise points at local play.
import { useEffect, useState } from "react";
import { api, apiOn } from "../api/client";
import type { BoardEntry } from "../api/client";
import { useLumen } from "../state/store";
import { Icon } from "./icons";

export function Leaderboard({ worldId, worldName }: { worldId: string; worldName: string }) {
  const [rows, setRows] = useState<BoardEntry[] | null>(null);
  const plays = useLumen((s) => s.plays);

  useEffect(() => {
    let alive = true;
    setRows(null);
    if (!apiOn()) return;
    void api.board(worldId).then((r) => {
      if (!alive) return;
      setRows(Array.isArray(r) ? r : []);
    });
    return () => {
      alive = false;
    };
  }, [worldId]);

  if (!apiOn()) {
    const local = plays[worldId] ?? 0;
    return (
      <div className="hud-panel">
        <div className="row"><b><Icon name="spark" size={14} /> Leaderboard</b><span className="pill">local</span></div>
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          {local} local {local === 1 ? "run" : "runs"} on this browser. Connect the MYTHRA API
          (<span className="dossier-meta">VITE_API_URL + npm run dev:api</span>) for the shared wall of usernames.
        </div>
      </div>
    );
  }

  return (
    <div className="hud-panel">
      <div className="row"><b><Icon name="spark" size={14} /> Leaderboard</b><span className="pill cyan">{worldName}</span></div>
      {!rows ? (
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Reading the wall…</div>
      ) : rows.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>No solvers yet — finish missions and your name goes up first.</div>
      ) : (
        <div style={{ marginTop: 6 }}>
          {rows.slice(0, 10).map((r, i) => (
            <div key={r.user} className="row" style={{ fontSize: 13, padding: "4px 0", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <span className="pill">{i + 1}</span>
              <b>{r.user}</b>
              <span className="dossier-meta">{r.missions} missions · {r.clues} clues</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
