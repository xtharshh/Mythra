// WorldMap — live top-down location map: sites, radii, solver dot, targets.
// Canvas 2D, redrawn on props change. Display-only (no teleport).
import { useEffect, useRef } from "react";
import { locationState, project } from "../game/map";
import type { World } from "../types";

const COLORS = {
  reached: "#7ddf9a",
  locked: "#ff5a5a",
  open: "#ffb45e",
  player: "#fff3e0",
  object: "#67e8f9",
  text: "#c9a98a",
};

export function WorldMap({ world, playerPos, reached }: {
  world: World;
  playerPos: [number, number, number];
  reached: string[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = 264;
  const bounds = world.settings.worldBounds;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const g = canvas.getContext("2d")!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, size, size);

    // dust backdrop
    g.fillStyle = "rgba(0,0,0,0.5)";
    g.fillRect(0, 0, size, size);
    g.strokeStyle = "rgba(255,180,94,0.25)";
    g.strokeRect(4.5, 4.5, size - 9, size - 9);

    // location radii + markers
    for (const l of world.locations) {
      const p = project(l.position[0], l.position[2], bounds, size);
      const state = locationState(l.locked, reached.includes(l.id));
      const r = Math.max(4, (l.radius / (bounds * 2 + 12)) * size);
      g.beginPath();
      g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.fillStyle = state === "reached" ? "rgba(125,223,154,0.12)" : state === "locked" ? "rgba(255,90,90,0.10)" : "rgba(255,180,94,0.12)";
      g.fill();
      g.strokeStyle = COLORS[state];
      g.lineWidth = state === "locked" ? 1.5 : 1;
      if (state === "locked") g.setLineDash([4, 3]);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = COLORS[state];
      g.beginPath();
      g.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = COLORS.text;
      g.font = "9px monospace";
      g.fillText(l.name.slice(0, 14), p.x + 5, p.y - 4);
    }

    // interactable objects
    g.fillStyle = COLORS.object;
    for (const o of world.objects) {
      if (!o.interaction) continue;
      const p = project(o.position[0], o.position[2], bounds, size);
      g.fillRect(p.x - 1, p.y - 1, 2, 2);
    }

    // solver dot + ring
    const me = project(playerPos[0], playerPos[2], bounds, size);
    g.strokeStyle = COLORS.player;
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(me.x, me.y, 6, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = COLORS.player;
    g.beginPath();
    g.arc(me.x, me.y, 2.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = COLORS.text;
    g.font = "9px monospace";
    g.fillText("YOU", me.x + 9, me.y + 3);
  }, [world, playerPos, reached, bounds]);

  return (
    <div className="hud-panel">
      <div className="row"><b>Location map</b><span className="pill">{reached.length}/{world.locations.length}</span></div>
      <canvas ref={ref} style={{ width: size, height: size, maxWidth: "100%", marginTop: 8, borderRadius: 6 }} />
      <div className="dossier-meta" style={{ marginTop: 6 }}>
        <span style={{ color: COLORS.reached }}>●</span> reached{" "}
        <span style={{ color: COLORS.open }}>●</span> open{" "}
        <span style={{ color: COLORS.locked }}>●</span> sealed{" "}
        <span style={{ color: COLORS.object }}>▪</span> interactable
      </div>
    </div>
  );
}
