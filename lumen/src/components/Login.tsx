// Simple email login UI (skills.md G10): dossier-styled sign-in modal.
// No password, no backend — 6-digit demo code, session in localStorage.
import { useState } from "react";
import { clearSession, isValidEmail, loadSession, normalizeEmail, requestLoginCode, verifyLoginCode } from "../auth/auth";
import type { AuthSession } from "../auth/auth";
import { useLumen } from "../state/store";
import { Icon } from "./icons";

export function useAuthSession(): { session: AuthSession | null; refresh: () => void } {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());
  return { session, refresh: () => setSession(loadSession()) };
}

export function LoginModal({ onClose }: { onClose: () => void }) {
  const { pushLog, loadCheckpoints } = useLumen();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const send = () => {
    setErr("");
    if (!isValidEmail(email)) {
      setErr("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const c = requestLoginCode(email);
      setSentTo(normalizeEmail(email));
      setDemoCode(c); // demo: no mail server, show the code
      pushLog(`Sign-in code sent to ${normalizeEmail(email)}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send code.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
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
      const s = verifyLoginCode(sentTo, code);
      pushLog(`Signed in as ${s.email}. Saves + checkpoints are now yours.`);
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
    setSession(null);
    pushLog("Signed out — filing as guest.");
    loadCheckpoints();
  };
  return (
    <button className="btn-ghost" title={`Signed in as ${session.email} — click to sign out`} onClick={logout}>
      <Icon name="check" /> {session.email.split("@")[0]}
    </button>
  );
}
