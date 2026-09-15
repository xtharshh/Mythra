// Support button — fuels Mythio via Buy Me a Coffee. External link only.
// Compact stays a quiet ghost (nav); the full button wears the official
// Buy Me a Coffee yellow so it reads instantly as "fuel the mission".
import { Icon } from "./icons";
import { t, useLang } from "../i18n/lang";

export const COFFEE_URL = "https://buymeacoffee.com/xtharshh";

export function SupportButton({ compact }: { compact?: boolean }) {
  const { lang } = useLang();
  if (compact) {
    return (
      <a
        className="btn-ghost"
        style={{ display: "inline-flex", gap: 6, alignItems: "center", padding: "4px 10px" }}
        href={COFFEE_URL}
        target="_blank"
        rel="noreferrer"
        title="Support Mythio — buy the explorer a coffee"
      >
        <Icon name="coffee" size={14} /> {t("nav.coffee", lang)}
      </a>
    );
  }
  return (
    <a
      className="btn"
      style={{
        display: "inline-flex",
        gap: 8,
        alignItems: "center",
        background: "#FFDD00",
        borderColor: "#c9a800",
        color: "#1a1a1a",
        fontWeight: 800,
        boxShadow: "0 4px 0 #8a6d00, 0 0 22px rgba(255, 221, 0, 0.45)",
      }}
      href={COFFEE_URL}
      target="_blank"
      rel="noreferrer"
      title="Support Mythio — buy the explorer a coffee"
    >
      <Icon name="coffee" size={16} /> Buy me a coffee
    </a>
  );
}
