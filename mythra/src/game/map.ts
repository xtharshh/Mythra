// Location-map math (pure, tested): world XZ → minimap px.
export interface MapPt {
  x: number;
  y: number;
}

/** Project a world position onto a square canvas. Bounds = world half-extent. */
export function project(x: number, z: number, bounds: number, size: number, pad = 14): MapPt {
  const span = Math.max(1, bounds * 2 + 12);
  const px = pad + ((x + bounds + 6) / span) * (size - pad * 2);
  const py = pad + ((z + bounds + 6) / span) * (size - pad * 2);
  return { x: Math.min(size - 2, Math.max(2, px)), y: Math.min(size - 2, Math.max(2, py)) };
}

export type LocState = "reached" | "locked" | "open";

/** Ring state for a location circle. */
export function locationState(locked: boolean, reached: boolean): LocState {
  if (reached) return "reached";
  if (locked) return "locked";
  return "open";
}
