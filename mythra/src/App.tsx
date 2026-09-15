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
import { Tutorial, tutorialSeen } from "./components/Tutorial";
import { LandingTutorial, landingOnboardingSeen } from "./components/LandingTutorial";
import { MobileGate, dismissMobileGate, isMobileDevice, mobileGateDismissed } from "./components/MobileGate";
import { LANGS, t, useLang } from "./i18n/lang";
import type { LangId } from "./i18n/lang";
import { Logo } from "./components/Logo";
import { SupportButton } from "./components/Support";
import { Watermark } from "./components/Watermark";
import { useLumen } from "./state/store";
import { setApiToken } from "./api/client";
import { loadEntryChoice, loadSession, saveSession, SESSION_EVENT } from "./auth/auth";
import type { EntryMode } from "./auth/auth";
import { applyTheme, themeForWorld } from "./theme/theme";
import demo from "./data/demo-world.json";
import type { World } from "./types";

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

function AppContent() {
  const switchUser = useLumen((s) => s.switchUser);
  const activeWorld = useLumen((s) => s.world);
  const [loginOpen, setLoginOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  // Cinematic reels stay as the fallback briefing; the mouse-moving onboarding
  // (same tour first-time explorers get on the home page) opens on demand.
  // Skip the reels on first run — the Landing tour covers it and marks them seen.
  const [tutorialOpen, setTutorialOpen] = useState(() => loadEntryChoice() !== null && landingOnboardingSeen() && !tutorialSeen());
  const [tourOpen, setTourOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode | null>(() => loadEntryChoice());
  const [signedIn, setSignedIn] = useState(() => loadSession() !== null);
  const [gateOpen, setGateOpen] = useState(() => isMobileDevice() && !mobileGateDismissed());
  const { lang, setLang } = useLang();

  useEffect(() => {
    switchUser();
    const onSession = () => {
      useLumen.getState().switchUser();
      const session = loadSession();
      setSignedIn(!!session);
      setEntryMode(loadEntryChoice());
    };
    const onResize = () => {
      if (!mobileGateDismissed()) setGateOpen(isMobileDevice());
    };
    window.addEventListener(SESSION_EVENT, onSession);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener(SESSION_EVENT, onSession);
      window.removeEventListener("resize", onResize);
    };
  }, [switchUser]);

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
        const did = q.get("did");
        const uname = q.get("uname");
        saveSession({
          email: user,
          verifiedAt: new Date().toISOString(),
          avatar: q.get("avatar") ?? undefined,
          ...(did ? { discordId: did } : {}),
          ...(uname ? { discordUsername: uname } : {}),
          displayName: user,
        });
        useLumen.getState().pushLog(`Signed in with Discord as ${user}.`);
      }
      if (token || authError) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const theme = useMemo(
    () => themeForWorld(activeWorld ?? (demo as unknown as World)),
    [activeWorld],
  );
  useEffect(() => { applyTheme(theme); }, [theme]);

  return (
    <Router>
      <nav className="nav">
        <b className="nav-brand"><Logo size={30} /> Mythio</b>
        <div className="nav-center">
          <Link id="nav-dossier" to="/" title={t("nav.what.dossier", lang)}>{t("nav.dossier", lang)}</Link>
          <Link id="nav-archive" to="/explore" data-tour="nav-archive" title={t("nav.what.archive", lang)}>{t("nav.archive", lang)}</Link>
          <Link id="nav-surface" to="/play" data-tour="nav-surface" title={t("nav.what.surface", lang)}>{t("nav.surface", lang)}</Link>
          <Link id="nav-planner" to="/create" data-tour="nav-planner" title={t("nav.what.planner", lang)}>{t("nav.planner", lang)}</Link>
          <Link id="nav-control" to="/studio" title={t("nav.what.control", lang)}>{t("nav.control", lang)}</Link>
        </div>
        <div className="nav-right">
          {!signedIn && (
            <button
              className="btn-ghost"
              style={{ padding: "4px 10px" }}
              title={t("nav.modeTitle", lang)}
              onClick={() => setEntryOpen(true)}
            >
              {entryMode === "online" ? t("nav.online", lang) : t("nav.offline", lang)}
            </button>
          )}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as LangId)}
            title={t("nav.language", lang)}
            className="nav-select"
          >
            {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <SupportButton compact />
          <button
            className="btn-ghost"
            style={{ padding: "4px 10px" }}
            title={t("nav.tutTitle", lang)}
            onClick={() => setTourOpen(true)}
          >
            {t("nav.tutorial", lang)}
          </button>
          <AuthButton onSignIn={() => setLoginOpen(true)} />
        </div>
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
      <footer className="footer">
        <span className="footer-brand"><Logo size={22} /> Mythio</span>
        <span className="footer-status"><span className="blink" />All systems nominal</span>
        <span className="footer-tag">Forge any story into a playable world</span>
        <span style={{ flex: 1 }} />
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
        <a href="https://buymeacoffee.com/xtharshh" target="_blank" rel="noreferrer">Support</a>
        <a href="https://instagram.com/xt.harshh" target="_blank" rel="noreferrer" title="xtharshh on Instagram">@xt.harshh</a>
        <span className="muted">© 2026 xtharshh</span>
      </footer>
      <Watermark />
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      {gateOpen && <MobileGate onContinue={() => { dismissMobileGate(); setGateOpen(false); }} />}
      {tutorialOpen && <Tutorial onClose={() => setTutorialOpen(false)} />}
      {tourOpen && <LandingTutorial onClose={() => setTourOpen(false)} />}
      {entryOpen && (
        <EntryModal
          onPick={(mode) => {
            setEntryMode(mode);
            setEntryOpen(false);
            if (!tutorialSeen()) setTutorialOpen(true);
            if (mode === "online") setLoginOpen(true);
          }}
          onClose={() => setEntryOpen(false)}
        />
      )}
    </Router>
  );
}

export default AppContent;