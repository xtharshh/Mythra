// Premium icon set (skills.md §11.1): single-stroke SVG dossier icons.
// One style: 1.8px stroke, round caps, currentColor — no emojis in UI.
// Usage: <Icon name="search" size={16} />
import type { CSSProperties } from "react";

export type IconName =
  | "search" | "puzzle" | "wrench" | "rocket" | "note" | "mic" | "speaker"
  | "play" | "save" | "fly" | "pin" | "book" | "check" | "plus" | "arrow"
  | "planet" | "signal" | "close" | "spark" | "voice" | "log" | "fork"
  | "warn" | "idea" | "stop";

const PATHS: Record<IconName, string> = {
  search: "M11 4a7 7 0 1 0 4.9 12L21 21l-1.4 1.4-5.1-5.1A7 7 0 0 0 11 4Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z",
  puzzle: "M10 3h4v3h3v4h-3v2h3v4h-4v3h-2v-2H7v2H5v-3H2v-4h2V8H2V4h3V2h2v2h3V3Z",
  wrench: "M21 6.5a5.5 5.5 0 0 1-7.4 5.1L7 18.2a2.1 2.1 0 0 1-3-3l6.6-6.6A5.5 5.5 0 0 1 17.5 1l-2.6 2.6 2.5 2.5L20 3.5l1 3ZM8.5 15.5l1 1-2.6 2.6-1-1 2.6-2.6Z",
  rocket: "M12 2c4 2 6 6 6 10l3 3-3 1c-1 2-3 4-6 5-3-1-5-3-6-5l-3-1 3-3c0-4 2-8 6-10Zm0 4a4 4 0 0 0-2 7.4L12 15l2-1.6A4 4 0 0 0 12 6Zm-1 9 1 4 1-4h-2Z",
  note: "M6 2h9l5 5v15H6V2Zm8 1v6h6M9 13h8M9 17h8",
  mic: "M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Zm-7 10h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.9V22h-2v-3.1A7 7 0 0 1 5 12Z",
  speaker: "M4 9v6h4l5 4V5L8 9H4Zm13 3a3.5 3.5 0 0 0-2-3.2v6.4a3.5 3.5 0 0 0 2-3.2ZM15 5.6v2.1a5.5 5.5 0 0 1 0 8.6v2.1a7.5 7.5 0 0 0 0-12.8Z",
  play: "M7 4l13 8-13 8V4Z",
  save: "M5 2h12l4 4v16H5V2Zm3 2v5h8V4M8 13h8v7H8v-7Z",
  fly: "M2 12l20-7-7 20-2.5-8.5L2 12Zm5 1l6 1-1 6-5-7Z",
  pin: "M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7Zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  book: "M5 2h13a1 1 0 0 1 1 1v19l-7-4-7 4V3a1 1 0 0 1 1-1Zm2 4v12l5-3 5 3V6H7Z",
  check: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z",
  plus: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z",
  arrow: "M4 11h13l-5-5 1.4-1.4L21.8 12l-8.4 7.4L12 18l5-5H4v-2Z",
  planet: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1 2.2A8 8 0 0 1 17.8 11H11V4.2ZM4.2 13A8 8 0 0 1 11 6v7H4.2Zm1.6 2h12.4a8 8 0 0 1-12.4 0Z",
  signal: "M4 18h2v2H4v-2Zm5 0h2v2H9v-2Zm-2.5-4h2v4h-2v-4Zm5 0h2v4h-2v-4Zm-2.5-4h2v6h-2V8Zm5 0h2v6h-2V8Zm-2.5-4h2v8h-2V4Z",
  close: "M6 4.6 10.4 9 6 13.4 7.4 14.8 11.8 10.4 16.2 14.8 17.6 13.4 13.2 9l4.4-4.4L16.2 3.2 11.8 7.6 7.4 3.2 6 4.6Z",
  spark: "M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4L12 2Z",
  voice: "M12 1a4 4 0 0 1 4 4v5a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Zm-8 11h3a5 5 0 0 0 10 0h3a8 8 0 0 1-7 7.9V23h-2v-3.1A8 8 0 0 1 4 12Zm3-1a1 1 0 0 1 0-2 1 1 0 0 1 0 2Z",
  log: "M4 2h16v20H4V2Zm3 4v2h10V6H7Zm0 5v2h10v-2H7Zm0 5v2h7v-2H7Z",
  fork: "M7 3a2 2 0 0 1 2 2v4a4 4 0 0 0 4 4h4v-2l4 3-4 3v-2h-4a6 6 0 0 1-6-6V5a2 2 0 0 1 0 0Zm-2 14a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm12 4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  warn: "M12 2 23 22H1L12 2Zm0 4.5L4.5 19h15L12 6.5ZM11 10v5h2v-5h-2Zm0 6v2h2v-2h-2Z",
  idea: "M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2ZM9 20h6v2H9v-2Z",
  stop: "M5 5h14v14H5V5Z",
};

export function Icon({ name, size = 16, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      style={{ flex: "none", verticalAlign: "-2px", ...style }}
    >
      <path d={PATHS[name]} fillRule="evenodd" clipRule="evenodd" />
    </svg>
  );
}
