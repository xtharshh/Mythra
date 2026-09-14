// Puzzle ciphers (skills.md G4): answers are NEVER printed in the open —
// they arrive as binary, Roman, mixed tongues, or riddles, and every tale
// ships the decode path (decoder ring + hint ladder). Pure + unit-tested.

const ROMAN: [string, number][] = [
  ["M", 1000], ["CM", 900], ["D", 500], ["CD", 400],
  ["C", 100], ["XC", 90], ["L", 50], ["XL", 40],
  ["X", 10], ["IX", 9], ["V", 5], ["IV", 4], ["I", 1],
];

/** I..MMM → int. Returns NaN on garbage. Pure. */
export function romanToInt(s: string): number {
  const t = s.trim().toUpperCase();
  if (!/^[MDCLXVI]+$/.test(t)) return NaN;
  let i = 0;
  let n = 0;
  for (const [sym, val] of ROMAN) {
    while (t.startsWith(sym, i)) {
      n += val;
      i += sym.length;
    }
  }
  return i === t.length ? n : NaN;
}

/** Binary string → int. Returns NaN on garbage. Pure. */
export function binaryToInt(s: string): number {
  const t = s.trim();
  if (!/^[01]{1,12}$/.test(t)) return NaN;
  return Number.parseInt(t, 2);
}

/** int → Roman (1..3999). Pure. */
export function intToRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return "";
  let out = "";
  let rest = n;
  for (const [sym, val] of ROMAN) {
    while (rest >= val) {
      out += sym;
      rest -= val;
    }
  }
  return out;
}

/** int → binary, no padding. Pure. */
export function intToBinary(n: number): string {
  return Number.isInteger(n) && n >= 0 ? n.toString(2) : "";
}

/** Decode one mixed token: binary runs vs Roman numerals. Pure. */
export function decodeToken(token: string): number {
  const t = token.trim();
  if (/^[01]+$/.test(t)) return binaryToInt(t);
  return romanToInt(t);
}

/**
 * Decode a mixed-tongue line like "VII · 11 · IV · 1001" into "7349".
 * Tokens split on anything that isn't alphanumerics. NaN if any token fails.
 */
export function decodeMixed(line: string): string {
  const tokens = line.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (tokens.length === 0) return "";
  let out = "";
  for (const tok of tokens) {
    const n = decodeToken(tok);
    if (!Number.isFinite(n) || n < 0 || n > 9) return "";
    out += String(n);
  }
  return out;
}

/** Author helper: render digits alternating Roman/binary ("VII · 11 · IV · 1001"). Pure. */
export function encodeMixed(digits: string): string {
  return digits
    .split("")
    .map((d, i) => {
      const n = Number.parseInt(d, 10);
      if (!Number.isInteger(n)) return "";
      return i % 2 === 0 ? intToRoman(n) : intToBinary(n);
    })
    .join(" · ");
}

/** Decoder-ring tables for the PuzzleModal (digits 0–9 both ways). Pure. */
export function decoderTables(): { digit: number; roman: string; binary: string }[] {
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => ({
    digit: d,
    roman: d === 0 ? "— (nulla)" : intToRoman(d),
    binary: intToBinary(d),
  }));
}
