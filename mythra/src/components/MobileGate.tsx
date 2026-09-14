// Mobile gate: the Surface is a desktop expedition (3D + keyboard). Handheld
// screens get a gamified transmission instead — open on a PC browser
// (copy-link included) or continue anyway. Dismissal lasts the session.
import { useState } from "react";
import { Icon } from "./icons";
import { t, useLang } from "../i18n/lang";

const GATE_KEY = "mythra-mobile-gate";

export function mobileGateDismissed(): boolean {
  try {
    return sessionStorage.getItem(GATE_KEY) === "1";
  } catch {
    return true;
  }
}

export function dismissMobileGate(): void {
  try {
    sessionStorage.setItem(GATE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Handheld layout: mobile UA, or coarse pointer on a narrow screen. Pure-ish. */
export function isMobileDevice(): boolean {
  try {
    const w = window as unknown as {
      navigator?: { userAgent?: string };
      matchMedia?: (q: string) => { matches: boolean };
      innerWidth?: number;
    };
    const ua = w.navigator?.userAgent ?? "";
    if (/android|iphone|ipad|ipod|mobile|tablet|touch/i.test(ua)) return true;
    const coarse = w.matchMedia?.("(pointer: coarse)").matches ?? false;
    return coarse && (w.innerWidth ?? 1024) < 820;
  } catch {
    return false;
  }
}

export function MobileGate({ onContinue }: { onContinue: () => void }) {
  const { lang } = useLang();
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="veil" role="dialog" aria-label="Desktop required">
      <div className="cine-bar top" />
      <div className="intro-card card cine-frame">
        <div className="row">
          <span className="eq"><i /><i /><i /><i /></span>
          <span className="pill amber">{t("gate.pill", lang)}</span>
        </div>
        <div className="case-kicker" style={{ marginTop: 8 }}>{t("gate.kicker", lang)}</div>
        <h1 className="intro-title" style={{ fontSize: 32 }}>{t("gate.titleA", lang)} <em>{t("gate.titleB", lang)}</em></h1>
        <p className="intro-text" style={{ minHeight: 0 }}>
          {t("gate.text", lang)}
        </p>
        <div className="row" style={{ marginTop: 6 }}>
          <span style={{ color: "var(--th-accent)", display: "inline-flex" }}><Icon name="planet" size={16} /></span>
          <span className="dossier-meta">{t("gate.keys", lang)}</span>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => void copyLink()}>
            <Icon name="signal" size={13} /> {copied ? t("gate.copied", lang) : t("gate.copy", lang)}
          </button>
          <button className="btn-ghost" onClick={onContinue}>{t("gate.continue", lang)}</button>
        </div>
        <div className="dossier-meta" style={{ marginTop: 8 }}>{t("gate.soon", lang)}</div>
      </div>
      <div className="cine-bar bottom" />
    </div>
  );
}
