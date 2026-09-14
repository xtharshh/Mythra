import { useEffect, useMemo, useState } from "react";
import { Link, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Create from "./pages/Create";
import Explore from "./pages/Explore";
import Landing from "./pages/Landing";
import Play from "./pages/Play";
import Studio from "./pages/Studio";
import { AuthButton, LoginModal } from "./components/Login";
import { SupportButton } from "./components/Support";
import { useLumen } from "./state/store";
import { applyTheme, themeForWorld } from "./theme/theme";
import demo from "./data/demo-world.json";
import type { World } from "./types";

export default function App() {
  const loadLibrary = useLumen((s) => s.loadLibrary);
  const loadVoiceNotes = useLumen((s) => s.loadVoiceNotes);
  const loadCheckpoints = useLumen((s) => s.loadCheckpoints);
  const activeWorld = useLumen((s) => s.world);
  const [loginOpen, setLoginOpen] = useState(false);
  useEffect(() => { loadLibrary(); loadVoiceNotes(); loadCheckpoints(); }, [loadLibrary, loadVoiceNotes, loadCheckpoints]);

  const theme = useMemo(
    () => themeForWorld(activeWorld ?? (demo as unknown as World)),
    [activeWorld],
  );
  useEffect(() => { applyTheme(theme); }, [theme]);

  return (
    <Router>
      <nav className="nav">
        <b>MYTHRA · {theme.station}</b>
        <Link to="/">Dossier</Link>
        <Link to="/explore">Archive</Link>
        <Link to="/play">Surface</Link>
        <Link to="/create">Planner</Link>
        <Link to="/studio">Control</Link>
        <AuthButton onSignIn={() => setLoginOpen(true)} />
        <SupportButton compact />
        <span className="station-sol"><span className="blink" />{theme.sol} · {theme.tagline}</span>
      </nav>
      <div className="ticker" aria-hidden>
        <span>Welcome to MYTHRA</span>
        {theme.ticker.map((t) => <span key={t}>{t}</span>)}
      </div>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/play" element={<Play />} />
        <Route path="/create" element={<Create />} />
        <Route path="/studio" element={<Studio />} />
      </Routes>
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </Router>
  );
}
