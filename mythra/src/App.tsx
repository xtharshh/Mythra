import { Component, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Create from "./pages/Create";
import Explore from "./pages/Explore";
import Landing from "./pages/Landing";
import Play from "./pages/Play";
import Studio from "./pages/Studio";
import { Privacy, Terms } from "./pages/Legal";
import { AuthButton, EntryModal, LoginModal } from "./components/Login";
import { Logo } from "./components/Logo";
import { SupportButton } from "./components/Support";
import { apiOn, formatPing, pingApi } from "./api/client";
import { useLumen } from "./state/store";
import { setApiToken } from "./api/client";
import { loadEntryChoice, saveSession } from "./auth/auth";
import type { EntryMode } from "./auth/auth";
import { applyTheme, themeForWorld } from "./theme/theme";
import demo from "./data/demo-world.json";
import type { World } from "./types";

/** Last-resort safety net: a crashed route shows a message, never a blank page. */
class RouteBoundary extends Component<{ children: ReactNode }, { failed: string | null }> {
  state = { failed: null as string | null };
  static getDerivedStateFromError(e: unknown): { failed: string | null } {
    return { failed: e instanceof Error ? e.message : "Something broke rendering this page." };
  }
  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="layout">
          <div className="card">
            <div className="case-kicker">Field hospital · render crash caught</div>
            <h2 className="case-title" style={{ fontSize: 28 }}>This view <em>crashed.</em></h2>
            <p className="muted">{this.state.failed}</p>
            <p className="muted" style={{ fontSize: 13 }}>
              If you just pulled new code: stop the dev server, delete{" "}
              <span className="dossier-meta">mythra/node_modules/.vite</span>, run{" "}
              <span className="dossier-meta">npm run dev</span> again, then hard-refresh (Ctrl+Shift+R).
            </p>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => window.location.reload()}>Reload</button>
              <Link className="btn-ghost" to="/">Back to Dossier</Link>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {  const loadLibrary = useLumen((s) => s.loadLibrary);
  const loadVoiceNotes = useLumen((s) => s.loadVoiceNotes);
  const loadCheckpoints = useLumen((s) => s.loadCheckpoints);
  const activeWorld = useLumen((s) => s.world);
  const [loginOpen, setLoginOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(() => loadEntryChoice() === null);
  const [entryMode, setEntryMode] = useState<EntryMode | null>(() => loadEntryChoice());
  const [ping, setPing] = useState<number | null>(null);
  const connected = apiOn();
  useEffect(() => { loadLibrary(); loadVoiceNotes(); loadCheckpoints(); }, [loadLibrary, loadVoiceNotes, loadCheckpoints]);

  // Discord OAuth landing: ?session=&user=[&avatar=] → signed in
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const token = q.get("session");
      const user = q.get("user");
      const authError = q.get("authError");
      if (authError) {
        useLumen.getState().pushLog(`Discord sign-in failed: ${authError}`);
      } else if (token && user) {
        setApiToken(token);
        saveSession({ email: user, verifiedAt: new Date().toISOString(), avatar: q.get("avatar") ?? undefined });
        useLumen.getState().pushLog(`Signed in with Discord as ${user}.`);
        useLumen.getState().loadCheckpoints();
      }
      if (token || authError) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // live API ping for the station chip — null = local/offline
  useEffect(() => {
    if (!connected) {
      setPing(null);
      return;
    }
    let alive = true;
    const probe = async () => {
      const ms = await pingApi();
      if (alive) setPing(ms);
    };
    void probe();
    const id = window.setInterval(() => void probe(), 10000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [connected]);

  const theme = useMemo(
    () => themeForWorld(activeWorld ?? (demo as unknown as World)),
    [activeWorld],
  );
  useEffect(() => { applyTheme(theme); }, [theme]);

  return (
    <Router>
      <nav className="nav">
        <b><Logo size={30} /> MYTHRA · {theme.station}</b>
        <Link to="/">Dossier</Link>
        <Link to="/explore">Archive</Link>
        <Link to="/play">Surface</Link>
        <Link to="/create">Planner</Link>
        <Link to="/studio">Control</Link>
        <AuthButton onSignIn={() => setLoginOpen(true)} />
        <button
          className="btn-ghost"
          style={{ padding: "4px 10px" }}
          title="Switch offline / online mode"
          onClick={() => setEntryOpen(true)}
        >
          {entryMode === "online" ? "Online" : "Offline"}
        </button>
        <SupportButton compact />
        <span className="station-sol" title={connected ? "Live link to the MYTHRA API (10s ping)" : "Offline — playing local"}>
          <span className="blink" />{theme.sol} · {theme.tagline} · ping {formatPing(ping, connected)}
        </span>
      </nav>
      <RouteBoundary>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/play" element={<Play />} />
        <Route path="/create" element={<Create />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
      </Routes>
      </RouteBoundary>
      <footer style={{ borderTop: "1px solid var(--border)", padding: "14px 22px", display: "flex", gap: 16, alignItems: "center", fontSize: 12 }} className="muted">
        <span>© 2026 xtharshh · MYTHRA — all rights reserved</span>
        <span style={{ flex: 1 }} />
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
        <a href="https://buymeacoffee.com/xtharshh" target="_blank" rel="noreferrer">Support</a>
      </footer>
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      {entryOpen && (
        <EntryModal
          onPick={(mode) => {
            setEntryMode(mode);
            setEntryOpen(false);
            if (mode === "online") setLoginOpen(true);
          }}
        />
      )}
    </Router>
  );
}
