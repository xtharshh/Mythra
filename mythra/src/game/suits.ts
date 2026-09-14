// Scenario suits (multiplayer): every explorer inside a story wears the
// suit that story demands — palette from world theme, trim from username.
// Pure + unit-tested; LumenScene dresses remote Astronauts with it.

export interface SuitSpec {
  suit: number;
  accent: number;
  label: string;
}

const THEME_SUITS: Record<string, { suits: number[]; label: string }> = {
  mars: { suits: [0xea580c, 0xdc2626, 0xe8e4da, 0xb45309], label: "dust ops" },
  ocean: { suits: [0x0ea5e9, 0x0d9488, 0x164e63, 0x67e8f9], label: "dive rig" },
  forest: { suits: [0x4d7c0f, 0x166534, 0xa3a380, 0x65a30d], label: "trail gear" },
  fantasy: { suits: [0x7c3aed, 0x2563eb, 0x9d174d, 0x475569], label: "ward mail" },
  cyberpunk: { suits: [0xec4899, 0x22d3ee, 0x111827, 0xa3e635], label: "neon shell" },
  space: { suits: [0xe8e4da, 0x94a3b8, 0x1e3a8a, 0xea580c], label: "void suit" },
  desert: { suits: [0xd6a35c, 0x92400e, 0xe7d8b7, 0x78716c], label: "sand wrap" },
};

const ACCENTS = [0x22d3ee, 0xfbbf24, 0x34d399, 0xf472b6, 0xa78bfa];

export function hashUser(user: string): number {
  let h = 2166136261;
  for (let i = 0; i < user.length; i++) {
    h ^= user.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Suit the scenario demands for this explorer in this theme. */
export function suitForUser(user: string, theme: string): SuitSpec {
  const t = THEME_SUITS[theme] ?? { suits: [0x51606f, 0x8b5cf6, 0xe8e4da], label: "field kit" };
  const h = hashUser(user.toLowerCase());
  return {
    suit: t.suits[h % t.suits.length],
    accent: ACCENTS[(h >> 3) % ACCENTS.length],
    label: t.label,
  };
}

/* ---------------- selectable characters (your explorer, your look) ---- */

export interface CharacterSpec {
  id: string;
  label: string;
  suit: number;
  accent: number;
  blurb: string;
}

export const CHARACTERS: CharacterSpec[] = [
  { id: "aurora", label: "Aurora", suit: 0xea580c, accent: 0x22d3ee, blurb: "Dust-ops orange, standard issue" },
  { id: "void", label: "Voidwalker", suit: 0xe8e4da, accent: 0x8b5cf6, blurb: "Clean whites for station duty" },
  { id: "abyss", label: "Abyss", suit: 0x0ea5e9, accent: 0xfbbf24, blurb: "Dive-rig teal" },
  { id: "warden", label: "Warden", suit: 0x4d7c0f, accent: 0xfbbf24, blurb: "Trail green" },
  { id: "neon", label: "Neon", suit: 0x23262f, accent: 0xec4899, blurb: "Night ops + pink trim" },
  { id: "ember", label: "Ember", suit: 0x7c2d12, accent: 0xffb45e, blurb: "Forge red" },
];

const CHAR_KEY = "lumen-character-v1";

export function loadCharacter(): CharacterSpec {
  try {
    const id = localStorage.getItem(CHAR_KEY);
    const found = CHARACTERS.find((c) => c.id === id);
    if (found) return found;
  } catch {
    /* ignore */
  }
  return CHARACTERS[0];
}

export function saveCharacter(id: string): void {
  try {
    if (CHARACTERS.some((c) => c.id === id)) localStorage.setItem(CHAR_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Encode a picked suit for the presence wire (`suitHex:accentHex`). Pure. */
export function encodeSuit(suit: number, accent: number): string {
  return `${suit.toString(16)}:${accent.toString(16)}`;
}

/** Decode a presence suit, falling back to the scenario suit. Pure. */
export function decodeSuit(raw: unknown, fallbackUser: string, fallbackTheme: string): { suit: number; accent: number } {
  if (typeof raw === "string") {
    const [s, a] = raw.split(":");
    const suit = Number.parseInt(s ?? "", 16);
    const accent = Number.parseInt(a ?? "", 16);
    if (Number.isFinite(suit) && Number.isFinite(accent)) return { suit, accent };
  }
  const fb = suitForUser(fallbackUser, fallbackTheme);
  return { suit: fb.suit, accent: fb.accent };
}
