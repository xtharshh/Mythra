// Remappable game controls (skills.md G9): every playable action can hold
// MULTIPLE keys, rebound by the player at runtime. Strict PC/browser keys
// (Tab, Alt, OS/Meta, F1–F12, Escape, Backspace…) can never be captured —
// the binder rejects them and any chord with Ctrl/Alt/Meta modifiers.
// Pure logic + localStorage; unit-tested.

export type GameAction =
  | "forward" | "back" | "left" | "right"
  | "jump" | "interact" | "flyToggle" | "flyUp" | "flyDown" | "sprint";

export const ACTIONS: { id: GameAction; label: string; hint: string }[] = [
  { id: "forward", label: "Move forward", hint: "walk / fly" },
  { id: "back", label: "Move back", hint: "walk / fly" },
  { id: "left", label: "Strafe left", hint: "walk / fly" },
  { id: "right", label: "Strafe right", hint: "walk / fly" },
  { id: "jump", label: "Jump", hint: "grounded only" },
  { id: "interact", label: "Interact", hint: "inspect · collect · talk" },
  { id: "flyToggle", label: "Toggle flight suit", hint: "needs suit" },
  { id: "flyUp", label: "Ascend", hint: "while flying" },
  { id: "flyDown", label: "Descend", hint: "while flying" },
  { id: "sprint", label: "Sprint", hint: "hold" },
];

export type Binds = Record<GameAction, string[]>;

export const DEFAULT_BINDS: Binds = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  jump: ["Space"],
  interact: ["KeyE"],
  flyToggle: ["KeyF"],
  flyUp: ["Space"],
  flyDown: ["KeyC", "ControlLeft"],
  sprint: ["ShiftLeft", "ShiftRight"],
};

const BINDS_KEY = "lumen-binds-v1";
export const MAX_KEYS_PER_ACTION = 3;

/** e.codes the game must never swallow (browser / OS territory). */
const RESERVED_CODES = new Set([
  "Tab", "Escape", "CapsLock", "NumLock", "ScrollLock", "ContextMenu",
  "PrintScreen", "Pause", "MetaLeft", "MetaRight", "AltLeft", "AltRight",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
  "Backspace", "Delete", "Insert", "Home", "End", "PageUp", "PageDown",
]);

export function isReservedCode(code: string): boolean {
  return RESERVED_CODES.has(code);
}

/** Validate a candidate bind from a real KeyboardEvent. Pure. */
export function checkBindable(e: { code: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): { ok: true } | { ok: false; reason: string } {
  if (!e.code) return { ok: false, reason: "No key detected — try again." };
  if (isReservedCode(e.code)) return { ok: false, reason: `${prettyCode(e.code)} is reserved for the browser/OS — pick a game key.` };
  if (e.ctrlKey || e.metaKey) return { ok: false, reason: "Ctrl/Windows chords belong to the browser — press the key alone." };
  if (e.altKey) return { ok: false, reason: "Alt chords belong to the OS — press the key alone." };
  return { ok: true };
}

/** Human label for an e.code. Pure. */
export function prettyCode(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const map: Record<string, string> = {
    Space: "Space", ShiftLeft: "L-Shift", ShiftRight: "R-Shift",
    ControlLeft: "L-Ctrl", ControlRight: "R-Ctrl",
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
    Enter: "Enter", Semicolon: ";", Quote: "'", Comma: ",", Period: ".",
    Slash: "/", BracketLeft: "[", BracketRight: "]", Backquote: "`",
    Minus: "-", Equal: "=",
  };
  return map[code] ?? code;
}

function sanitize(list: unknown): string[] | null {
  if (!Array.isArray(list)) return null;
  const out = list.filter((c): c is string => typeof c === "string" && c.length > 0 && !isReservedCode(c));
  return out.length > 0 ? [...new Set(out)].slice(0, MAX_KEYS_PER_ACTION) : null;
}

export function loadBinds(): Binds {
  const fallback = structuredClone(DEFAULT_BINDS);
  try {
    const raw = localStorage.getItem(BINDS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Record<GameAction, unknown>>;
    const next = { ...fallback };
    for (const a of Object.keys(DEFAULT_BINDS) as GameAction[]) {
      const clean = sanitize(parsed[a]);
      if (clean) next[a] = clean;
    }
    return next;
  } catch {
    return fallback;
  }
}

export function saveBinds(b: Binds): void {
  try {
    localStorage.setItem(BINDS_KEY, JSON.stringify(b));
  } catch {
    /* ignore */
  }
}

/** True when any bound key for the action is currently held. */
export function isDown(action: GameAction, held: Set<string>, binds: Binds): boolean {
  const list = binds[action] ?? [];
  for (const c of list) if (held.has(c)) return true;
  return false;
}
