// Support button — fuels Mythio via Buy Me a Coffee. External link only.
import { Icon } from "./icons";
import { t, useLang } from "../i18n/lang";

export const COFFEE_URL = "https://buymeacoffee.com/xtharshh";

export function SupportButton({ compact }: { compact?: boolean }) {
  const { lang } = useLang();
  return (
    <a
      className="btn-ghost"
      style={{ display: "inline-flex", gap: 6, alignItems: "center", padding: compact ? "4px 10px" : undefined }}
      href={COFFEE_URL}
      target="_blank"
      rel="noreferrer"
      title="Support Mythio — buy the explorer a coffee"
    >
      <Icon name="coffee" size={14} /> {compact ? t("nav.coffee", lang) : "Buy me a coffee"}
    </a>
  );
}
