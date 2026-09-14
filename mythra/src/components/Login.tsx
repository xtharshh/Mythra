// Simple email login UI (skills.md G10): dossier-styled sign-in modal.
// No password — 6-digit code. Uses the MYTHRA API when connected,
// otherwise fully local. Either way the session namespaces saves.
import { useState } from "react";
import { clearSession, isValidEmail, loadSession, normalizeEmail, requestLoginCode, saveEntryChoice, verifyLoginCode } from "../auth/auth";
import type { AuthSession, EntryMode } from "../auth/auth";
import { api, apiOn, discordLoginUrl, setApiToken } from "../api/client";
import { useLumen } from "../state/store";
import { Icon } from "./icons";

export function useAuthSession(): { session: AuthSession | null; refresh: () => void } {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());
  return { session, refresh: () => setSession(loadSession()) };
}

/** First-run gate: offline solo flight, or online party via Discord. */
export function EntryModal({ onPick }: { onPick: (mode: EntryMode) => void }) {
  const [err, setErr] = useState("");
  const online = () => {
    if (!apiOn()) {
      setErr("Online needs the API: start it (npm run dev:api) and set VITE_API_URL, then restart the game.");
      return;
    }
    saveEntryChoice("online");
    onPick("online");
  };
  const offline = () => {
    saveEntryChoice("offline");
    onPick("offline");
  };
  return (
    <div className="modal-back">
      <div className="modal card" style={{ width: "min(560px, 94vw)", textAlign: "center" }}>
        <div className="case-kicker">Welcome to MYTHRA · first descent</div>
        <h2 className="case-title" style={{ fontSize: 32 }}>How do you <em>fly?</em></h2>
        <p className="muted">Solo expedition on this machine — or online party with Discord sign-in, races, and shared skies.</p>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
          <button className="btn btn-big" onClick={offline}>
            <Icon name="planet" size={16} /> Play offline
          </button>
          <button className="btn btn-big" onClick={online} style={{ background: "linear-gradient(180deg, #7289da, #5865F2)" }}>
            <Icon name="discord" size={16} /> Play online
          </button>
        </div>
        <div className="dossier-meta" style={{ marginTop: 8 }}>offline = solo + local saves · online = Discord sign-in + races + leaderboard</div>
        {err && <div style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{err}</div>}
      </div>
    </div>
  );
}

export function LoginModal({ onClose }: { onClose: () => void }) {
  const { pushLog, loadCheckpoints } = useLumen();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setErr("");
    if (!isValidEmail(email)) {
      setErr("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      if (apiOn()) {
        const r = await api.requestCode(normalizeEmail(email));
        if (!r) throw new Error("API unreachable — playing local. Code issued locally instead.");
        setSentTo(r.email);
        setDemoCode(r.code);
        pushLog(`Sign-in code sent to ${r.email} (via MYTHRA API).`);
      } else {
        const c = requestLoginCode(email);
        setSentTo(normalizeEmail(email));
        setDemoCode(c); // demo: no mail server, show the code
        pushLog(`Sign-in code sent to ${normalizeEmail(email)}.`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send code.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setErr("");
    if (!sentTo) {
      setErr("Send a code first.");
      return;
    }
    if (code.trim().length < 4) {
      setErr("Enter the 6-digit code.");
      return;
    }
    try {
      if (apiOn()) {
        const r = await api.verifyCode(sentTo, code.trim());
        if (!r) throw new Error("API unreachable — verify locally instead.");
        setApiToken(r.token);
        const { saveSession } = await import("../auth/auth");
        saveSession({ email: r.email, verifiedAt: new Date().toISOString() });
        pushLog(`Signed in as ${r.email} (online). Saves + checkpoints are now yours.`);
      } else {
        const s = verifyLoginCode(sentTo, code);
        pushLog(`Signed in as ${s.email}. Saves + checkpoints are now yours.`);
      }
      loadCheckpoints();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Verification failed.");
    }
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="case-kicker">Explorer sign-in · no password</div>
        <h3 style={{ margin: "8px 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>File under your name</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Enter your email, confirm the 6-digit code, and progress saves + checkpoints file under you instead of guest.
        </p>
        <label>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="explorer@aurorabase.mars"
          inputMode="email"
          autoComplete="email"
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" disabled={busy || !email.trim()} onClick={send}>
            <Icon name="arrow" /> {busy ? "Sending…" : "Send code"}
          </button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
        {sentTo && (
          <>
            <label>6-digit code (sent to {sentTo})</label>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" inputMode="numeric" />
            {demoCode && (
              <div className="dossier-meta" style={{ marginTop: 6 }}>
                Demo uplink — no mail server here, your code is <b style={{ color: "var(--th-accent)" }}>{demoCode}</b>
              </div>
            )}
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={confirm}><Icon name="check" /> Verify + sign in</button>
              <button className="btn-ghost" onClick={send}>Resend</button>
            </div>
          </>
        )}
        {err && <div style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <div className="dossier-meta" style={{ marginBottom: 6 }}>or skip the code —</div>
          {discordLoginUrl() ? (
            <a className="btn" style={{ display: "inline-flex", gap: 8, alignItems: "center", background: "#5865F2", color: "#fff", borderColor: "#2b2f6b" }} href={discordLoginUrl()!} title="Sign in with Discord — username shows everywhere">
              <Icon name="discord" size={15} /> Sign in with Discord
            </a>
          ) : (
            <div className="muted" style={{ fontSize: 12 }}>Discord sign-in needs the API connected (VITE_API_URL).</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AuthButton({ onSignIn }: { onSignIn: () => void }) {
  const { pushLog, loadCheckpoints } = useLumen();
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());
  if (!session) {
    return (
      <button className="btn-ghost" title="Sign in with email — saves file under you" onClick={onSignIn}>
        Sign in
      </button>
    );
  }
  const logout = () => {
    clearSession();
    setApiToken(null);
    setSession(null);
    pushLog("Signed out — filing as guest.");
    loadCheckpoints();
  };
  return (
    <button className="btn-ghost" title={`Signed in as ${session.email} — click to sign out`} onClick={logout} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      {session.avatar
        ? <img src={session.avatar} alt="" width={18} height={18} style={{ borderRadius: "50%" }} />
        : <Icon name="check" />}
      {session.email.split("@")[0]}
    </button>
  );
}
