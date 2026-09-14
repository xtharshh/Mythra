// Support button — fuels MYTHRA via Buy Me a Coffee. External link only.
import { Icon } from "./icons";

export const COFFEE_URL = "https://buymeacoffee.com/xtharshh";

export function SupportButton({ compact }: { compact?: boolean }) {
  return (
    <a
      className="btn-ghost"
      style={{ display: "inline-flex", gap: 6, alignItems: "center", padding: compact ? "4px 10px" : undefined }}
      href={COFFEE_URL}
      target="_blank"
      rel="noreferrer"
      title="Support MYTHRA — buy the explorer a coffee"
    >
      <Icon name="coffee" size={14} /> {compact ? "Coffee" : "Buy me a coffee"}
    </a>
  );
}
