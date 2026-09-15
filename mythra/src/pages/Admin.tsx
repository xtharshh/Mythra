// Admin panel — allowlisted login + analytics dashboard.
// Login exchanges the server admin key for a Bearer token (the key itself
// is never stored). Stats come from /api/admin/stats; without a backend
// the page says so instead of pretending.
import { useCallback, useEffect, useState } from "react";
import { adminLogin, clearAdmin, fetchAdminStats, loadAdmin } from "../admin/admin";
import type { AdminSession, AdminStats } from "../admin/admin";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card" style={{ flex: "1 1 140px", padding: "14px 16px" }}>
      <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function Login({ onDone }: { onDone: (s: AdminSession) => void }) {
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr("");
    try {
      onDone(await adminLogin(email, key));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="layout" style={{ maxWidth: 520 }}>
      <div className="card">
        <div className="case-kicker">Restricted · site operators</div>
        <h2 className="case-title" style={{ fontSize: 28 }}>Admin <em>login.</em></h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Uses the allowlisted email + <span className="dossier-meta">ADMIN_KEY</span> from the
          server env. Nothing here works without the backend running.
        </p>
        <div className="field">
          <label htmlFor="admin-email">Admin email</label>
          <input
            id="admin-email" type="email" autoComplete="username"
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" style={{ width: "100%" }}
          />
        </div>
        <div className="field">
          <label htmlFor="admin-key">Admin key</label>
          <input
            id="admin-key" type="password" autoComplete="current-password"
            value={key} onChange={(e) => setKey(e.target.value)}
            placeholder="••••••••" style={{ width: "100%" }}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
          />
        </div>
        {err && <p style={{ color: "var(--th-danger, #ff6b6b)", fontSize: 13 }}>{err}</p>}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" disabled={busy} onClick={() => void submit()}>
            {busy ? "Checking…" : "Sign in as admin"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [session, setSession] = useState<AdminSession | null>(() => loadAdmin());
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (token: string) => {
    setBusy(true); setErr("");
    try {
      setStats(await fetchAdminStats(token));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't load stats.";
      setErr(msg);
      if (/admin only|not an admin|401|403/i.test(msg)) {
        clearAdmin();
        setSession(null);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load(session.token);
  }, [session, load]);

  if (!session) return <Login onDone={setSession} />;

  const logout = () => {
    clearAdmin();
    setSession(null);
    setStats(null);
  };

  return (
    <div className="layout">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="case-kicker">Site analytics · {session.email}</div>
          <h2 className="case-title" style={{ fontSize: 30 }}>Admin <em>dashboard.</em></h2>
        </div>
        <div className="row">
          <button className="btn-ghost" disabled={busy} onClick={() => void load(session.token)}>
            {busy ? "Loading…" : "Refresh"}
          </button>
          <button className="btn-ghost" onClick={logout}>Log out</button>
        </div>
      </div>
      {err && <p style={{ color: "var(--th-danger, #ff6b6b)" }}>{err}</p>}
      {!stats && !err && <p className="muted">{busy ? "Pulling numbers…" : "No stats yet."}</p>}
      {stats && (
        <>
          <div className="row" style={{ alignItems: "stretch" }}>
            <StatCard label="Worlds" value={stats.totals.worlds} />
            <StatCard label="Owners" value={stats.totals.owners} />
            <StatCard label="Plays" value={stats.totals.plays} />
            <StatCard label="Solvers" value={stats.totals.solvers} />
            <StatCard label="Missions solved" value={stats.totals.missionsSolved} />
            <StatCard label="Clues found" value={stats.totals.cluesFound} />
          </div>
          <div className="row" style={{ alignItems: "flex-start", marginTop: 4 }}>
            <div className="card" style={{ flex: "1 1 260px" }}>
              <b>Worlds by theme</b>
              {Object.keys(stats.byTheme).length === 0 && <p className="muted">None yet.</p>}
              {Object.entries(stats.byTheme).sort((a, b) => b[1] - a[1]).map(([theme, n]) => (
                <div className="row" key={theme} style={{ justifyContent: "space-between" }}>
                  <span className="dossier-meta">{theme}</span><b>{n}</b>
                </div>
              ))}
              <b style={{ display: "block", marginTop: 12 }}>By difficulty</b>
              {Object.entries(stats.byDifficulty).sort((a, b) => b[1] - a[1]).map(([d, n]) => (
                <div className="row" key={d} style={{ justifyContent: "space-between" }}>
                  <span className="dossier-meta">{d}</span><b>{n}</b>
                </div>
              ))}
            </div>
            <div className="card" style={{ flex: "1 1 260px" }}>
              <b>Top players</b>
              {stats.topPlayers.length === 0 && <p className="muted">No scores yet.</p>}
              {stats.topPlayers.map((p) => (
                <div className="row" key={p.user} style={{ justifyContent: "space-between" }}>
                  <span>{p.user}</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {p.worlds} worlds · {p.missions} missions · {p.clues} clues
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ marginTop: 4, overflowX: "auto" }}>
            <b>Top worlds</b>
            {stats.topWorlds.length === 0 && <p className="muted">Nothing published yet.</p>}
            {stats.topWorlds.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 }}>
                <thead>
                  <tr className="muted" style={{ textAlign: "left" }}>
                    <th style={{ padding: "6px 8px" }}>World</th>
                    <th style={{ padding: "6px 8px" }}>Theme</th>
                    <th style={{ padding: "6px 8px" }}>Owner</th>
                    <th style={{ padding: "6px 8px" }}>Plays</th>
                    <th style={{ padding: "6px 8px" }}>Solvers</th>
                    <th style={{ padding: "6px 8px" }}>Missions</th>
                    <th style={{ padding: "6px 8px" }}>Clues</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topWorlds.map((w) => (
                    <tr key={w.id} style={{ borderTop: "1px solid var(--th-line, #333)" }}>
                      <td style={{ padding: "6px 8px" }}>{w.name}</td>
                      <td style={{ padding: "6px 8px" }}><span className="dossier-meta">{w.theme}</span></td>
                      <td style={{ padding: "6px 8px" }}>{w.owner}</td>
                      <td style={{ padding: "6px 8px" }}>{w.plays}</td>
                      <td style={{ padding: "6px 8px" }}>{w.solvers}</td>
                      <td style={{ padding: "6px 8px" }}>{w.missions}</td>
                      <td style={{ padding: "6px 8px" }}>{w.clues}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Generated {new Date(stats.generatedAt).toLocaleString()} · plays count leaderboard entries per world.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
