// Simple email login UI (skills.md G10): dossier-styled sign-in modal.
// No password — 6-digit code. Uses the Mythio API when connected,
// otherwise fully local. Either way the session namespaces saves.
import { useEffect, useState } from "react";
import { clearSession, isDiscordSession, isValidEmail, loadEntryChoice, loadSession, normalizeEmail, requestLoginCode, saveEntryChoice, SESSION_EVENT, verifyLoginCode } from "../auth/auth";
import type { AuthSession, EntryMode } from "../auth/auth";
import { api, apiOn, discordLoginUrl, pingApi, setApiToken } from "../api/client";
import { t, useLang } from "../i18n/lang";
import { useLumen } from "../state/store";
import { Icon } from "./icons";

export function useAuthSession(): { session: AuthSession | null; refresh: () => void } {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());
  return { session, refresh: () => setSession(loadSession()) };
}

/** First-run gate: offline solo flight, or online party via Discord. */
export function EntryModal({ onPick, onClose }: { onPick: (mode: EntryMode) => void; onClose: () => void }) {
  const { lang } = useLang();
  // online works against same-origin or configured APIs and degrades
  // gracefully offline — no gatekeeping here, the flows explain themselves
  const online = () => {
    saveEntryChoice("online");
    onPick("online");
  };
  const offline = () => {
    saveEntryChoice("offline");
    onPick("offline");
  };
  return (
    <div className="modal-back">
      <div className="modal card" style={{ width: "min(560px, 94vw)", textAlign: "center", position: "relative" }}>
        <button className="btn-ghost" style={{ position: "absolute", top: 22, right: 10, padding: "0 8px" }} title={t("entry.close", lang)} onClick={onClose}>✕</button>
        <div className="case-kicker">{t("entry.kicker", lang)}</div>
        <h2 className="case-title" style={{ fontSize: 32 }}>{t("entry.titleA", lang)} <em>{t("entry.titleB", lang)}</em></h2>
        <p className="muted">{t("entry.sub", lang)}</p>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
          <button className="btn btn-big" onClick={offline}>
            <Icon name="planet" size={16} /> {t("entry.offline", lang)}
          </button>
          <button className="btn btn-big" onClick={online} style={{ background: "linear-gradient(180deg, #7289da, #5865F2)" }}>
            <Icon name="discord" size={16} /> {t("entry.online", lang)}
          </button>
        </div>
        <div className="dossier-meta" style={{ marginTop: 8 }}>{t("entry.offHint", lang)} · {t("entry.onHint", lang)}</div>
      </div>
    </div>
  );
}

export function LoginModal({ onClose }: { onClose: () => void }) {
  const { pushLog, loadCheckpoints } = useLumen();
  const { lang } = useLang();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [viaApi, setViaApi] = useState(false);
  const [apiLive, setApiLive] = useState<boolean | null>(null);

  // same-origin backends answer; pure-offline machines don't — probe once
  useEffect(() => {
    let alive = true;
    void pingApi().then((ms) => {
      if (alive) setApiLive(ms !== null);
    });
    return () => {
      alive = false;
    };
  }, []);

  const recheckApi = () => {
    setApiLive(null);
    void pingApi().then((ms) => setApiLive(ms !== null)).catch(() => setApiLive(false));
  };

  const send = async () => {
    setErr("");
    if (!isValidEmail(email)) {
      setErr("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      if (apiOn()) {
        try {
          const r = await api.requestCode(normalizeEmail(email));
          if (r) {
            setSentTo(r.email);
            setDemoCode(r.code);
            setViaApi(true);
            setApiLive(true);
            pushLog(`Sign-in code sent to ${r.email} (via Mythio API).`);
            return;
          }
        } catch {
          /* unreachable — fall through to the local code below */
        }
        pushLog("API unreachable — issuing the code locally instead.");
      }
      const c = requestLoginCode(email);
      setSentTo(normalizeEmail(email));
      setDemoCode(c); // demo: no mail server, show the code
      setViaApi(false);
      pushLog(`Sign-in code sent to ${normalizeEmail(email)}.`);
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
      if (viaApi) {
        const r = await api.verifyCode(sentTo, code.trim());
        if (!r) throw new Error("API unreachable — press Send code again.");
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
        <div className="case-kicker">{t("login.kicker", lang)}</div>
        <h3 style={{ margin: "8px 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>{t("login.title", lang)}</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          {t("login.sub", lang)}
        </p>
        <label>{t("login.email", lang)}</label>
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
            <Icon name="arrow" /> {busy ? t("login.sending", lang) : t("login.send", lang)}
          </button>
          <button className="btn-ghost" onClick={onClose}>{t("login.cancel", lang)}</button>
        </div>
        {sentTo && (
          <>
            <label>{t("login.code", lang)} (sent to {sentTo})</label>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" inputMode="numeric" />
            {demoCode && (
              <div className="dossier-meta" style={{ marginTop: 6 }}>
                Demo uplink — no mail server here, your code is <b style={{ color: "var(--th-accent)" }}>{demoCode}</b>
              </div>
            )}
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={confirm}><Icon name="check" /> {t("login.verify", lang)}</button>
              <button className="btn-ghost" onClick={send}>{t("login.resend", lang)}</button>
            </div>
          </>
        )}
        {err && <div style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <div className="dossier-meta" style={{ marginBottom: 6 }}>{t("login.skip", lang)}</div>
          {apiLive === false ? (
            <div>
              <div className="muted" style={{ fontSize: 12 }}>{t("login.offlineNote", lang)}</div>
              <div className="row" style={{ marginTop: 6 }}>
                <button className="btn-ghost" style={{ padding: "2px 10px" }} onClick={recheckApi}>{t("login.retry", lang)}</button>
              </div>
            </div>
          ) : (
            <a className="btn" style={{ display: "inline-flex", gap: 8, alignItems: "center", background: "#5865F2", color: "#fff", borderColor: "#2b2f6b" }} href={discordLoginUrl()!} title="Sign in with Discord — username shows everywhere">
              <Icon name="discord" size={15} /> {t("login.discord", lang)}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function AuthButton({ onSignIn }: { onSignIn: () => void }) {
  const { pushLog, loadCheckpoints } = useLumen();
  const { lang } = useLang();
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());
  const [profileOpen, setProfileOpen] = useState(false);
  // follow logins/logouts live (same tab event + other tabs), no reload
  useEffect(() => {
    const refresh = () => {
      setSession(loadSession());
      setProfileOpen(false);
    };
    window.addEventListener(SESSION_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SESSION_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  // logged out → no button here (the Online flow already signs explorers in)
  if (!session) {
    return (
      <button className="btn-ghost" title="Sign in with email — saves file under you" onClick={onSignIn} style={{ display: "none" }}>
        {t("nav.signin", lang)}
      </button>
    );
  }
  const logout = () => {
    clearSession();
    setApiToken(null);
    setSession(null);
    setProfileOpen(false);
    pushLog("Signed out — filing as guest.");
    loadCheckpoints();
  };
  const label = session.displayName || session.email.split("@")[0];
  const open = () => {
    setSession(loadSession());
    setProfileOpen(true);
  };
  return (
    <>
      <button className="btn-ghost nav-user" title={`${label} — view profile`} onClick={open} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        {session.avatar
          ? <img src={session.avatar} alt="" width={18} height={18} style={{ borderRadius: "50%" }} />
          : <Icon name="check" />}
        {label}
      </button>
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} onLogout={logout} />}
    </>
  );
}

/** Clicking the navbar username shows who is signed in — Discord data when
 *  present, session facts always — with a way back out (logout). */
function ProfileModal({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  const [session] = useState<AuthSession | null>(() => loadSession());
  if (!session) return null;
  const discord = isDiscordSession(session);
  let mode = "offline";
  try {
    mode = loadEntryChoice() ?? "offline";
  } catch {
    /* headless */
  }
  let signedIn = session.verifiedAt;
  try {
    const d = new Date(session.verifiedAt);
    if (!Number.isNaN(d.getTime())) signedIn = d.toLocaleString();
  } catch {
    /* keep raw */
  }
  const title = session.displayName || session.email;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
        <button className="btn-ghost" style={{ position: "absolute", top: 22, right: 10, padding: "0 8px" }} title="Close profile" onClick={onClose}>✕</button>
        <div className="case-kicker">{discord ? "Discord explorer · signed in" : "Explorer · signed in"}</div>
        <div className="row" style={{ marginTop: 8, gap: 12 }}>
          {session.avatar
            ? <img src={session.avatar} alt="" width={52} height={52} style={{ borderRadius: "50%", border: "2px solid var(--th-accent)" }} />
            : <span style={{ color: "var(--th-accent)", display: "inline-flex" }}><Icon name="check" size={28} /></span>}
          <div>
            <h3 style={{ margin: 0 }}>{title}</h3>
            {discord && session.discordUsername && <div className="dossier-meta">@{session.discordUsername}</div>}
            <div className="row" style={{ gap: 6, marginTop: 4 }}>
              <span className="pill cyan">{mode}</span>
              {discord && <span className="pill">discord</span>}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
          {discord && session.discordId && (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">Discord ID</span><span className="dossier-meta">{session.discordId}</span>
            </div>
          )}
          {discord && session.discordUsername && (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">Handle</span><span className="dossier-meta">@{session.discordUsername}</span>
            </div>
          )}
          {!discord && (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">Email</span><span className="dossier-meta">{session.email}</span>
            </div>
          )}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">Saves filed under</span><span className="dossier-meta">{session.email}</span>
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">Signed in</span><span className="dossier-meta">{signedIn}</span>
          </div>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn-ghost" onClick={onLogout}>Sign out</button>
          <button className="btn" onClick={onClose}>Back to surface</button>
        </div>
      </div>
    </div>
  );
}
