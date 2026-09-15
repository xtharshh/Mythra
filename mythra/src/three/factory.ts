// Realistic procedural builders — every object is a detailed multi-part model,
// not a primitive. Dispatches on modelId (falls back to type).
import * as THREE from "three";
import type { WorldObject } from "../types";
import { Astronaut } from "./effects";

export type TickFn = (t: number, dt?: number) => void;

export function colorFor(type: WorldObject["type"]): number {
  switch (type) {
    case "resource_node": return 0xfb923c;
    case "machine": return 0x22d3ee;
    case "terminal": return 0x7c3aed;
    case "vehicle": return 0xfacc15;
    case "artifact": return 0xf472b6;
    case "door": return 0xef4444;
    case "landmark": return 0xa78bfa;
    case "container": return 0x84cc16;
    case "map": return 0x38bdf8;
    default: return 0xe2e8f0;
  }
}

/* ---------------- helpers ---------------- */
function part(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const BOX = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh =>
  part(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const CYL = (rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 14): THREE.Mesh =>
  part(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);
const SPH = (r: number, mat: THREE.Material, x = 0, y = 0, z = 0, w = 14, h = 10): THREE.Mesh =>
  part(new THREE.SphereGeometry(r, w, h), mat, x, y, z);

function strut(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  return m;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- shared materials ---------------- */
const hull = new THREE.MeshStandardMaterial({ color: 0xb9bec7, metalness: 0.75, roughness: 0.35 });
const dark = new THREE.MeshStandardMaterial({ color: 0x333943, metalness: 0.6, roughness: 0.5 });
const rust = new THREE.MeshStandardMaterial({ color: 0x7c3f26, metalness: 0.2, roughness: 0.95 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.95 });
const frame = new THREE.MeshStandardMaterial({ color: 0x707a88, metalness: 0.8, roughness: 0.3 });
const cell = new THREE.MeshStandardMaterial({ color: 0x14418f, metalness: 0.85, roughness: 0.25, emissive: 0x0a2470, emissiveIntensity: 0.4 });
const crystal = new THREE.MeshStandardMaterial({ color: 0x7df3ff, emissive: 0x22d3ee, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92, flatShading: true });
const crystalV = new THREE.MeshStandardMaterial({ color: 0xc4b5fd, emissive: 0x8b5cf6, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92, flatShading: true });
const rock = new THREE.MeshStandardMaterial({ color: 0x6e3b2a, roughness: 1, flatShading: true });
const suitM = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.55 });
const paper = new THREE.MeshStandardMaterial({ color: 0xe9ddc2, roughness: 0.9 });
const glass = new THREE.MeshStandardMaterial({ color: 0x0b1020, metalness: 1, roughness: 0.08, emissive: 0x164e63, emissiveIntensity: 0.5 });
const lampW = new THREE.MeshBasicMaterial({ color: 0xfff3c0 });
const lampR = new THREE.MeshBasicMaterial({ color: 0xff3333 });
const lampC = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
const lampA = new THREE.MeshBasicMaterial({ color: 0xffb020 });
const lampG = new THREE.MeshBasicMaterial({ color: 0x22ff88 });
const paneGlass = new THREE.MeshStandardMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.4 });

const screenTexCache = new Map<string, THREE.CanvasTexture>();
function getScreenTexture(station: string): THREE.CanvasTexture {
  const key = (station || "FIELD BASE").toUpperCase().slice(0, 24);
  const hit = screenTexCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 256; c.height = 160;
  const g = c.getContext("2d")!;
  g.fillStyle = "#03140c"; g.fillRect(0, 0, 256, 160);
  g.fillStyle = "#34ff9e"; g.font = "bold 19px monospace";
  g.fillText(key, 12, 26);
  g.font = "12px monospace";
  const rows = ["O2 ......... 62%", "PWR ... RST 4213", `${key.slice(0, 12)} ... OK`, "UPLINK .... LIVE", "SECTOR .. -24,-8", "> listen_"];
  rows.forEach((r, i) => g.fillText(r, 12, 50 + i * 14));
  g.fillStyle = "rgba(0,0,0,0.35)";
  for (let y = 0; y < 160; y += 3) g.fillRect(0, y, 256, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  screenTexCache.set(key, tex);
  // tiny LRU: terminals never need more than a few station faces
  if (screenTexCache.size > 8) {
    const oldest = screenTexCache.keys().next().value;
    if (oldest !== undefined && oldest !== key) {
      screenTexCache.get(oldest)?.dispose();
      screenTexCache.delete(oldest);
    }
  }
  return tex;
}

/* ---------------- builders ---------------- */
function buildConsole(g: THREE.Group, add: (t: TickFn) => void, station: string): void {
  g.add(BOX(0.9, 0.5, 0.6, dark, 0, 0.25, 0));
  g.add(BOX(0.95, 0.55, 0.55, hull, 0, 0.75, 0));
  g.add(BOX(0.7, 0.06, 0.28, dark, 0, 0.98, 0.32));
  for (let i = 0; i < 3; i++) g.add(BOX(0.62, 0.02, 0.05, frame, 0, 1.0, 0.24 + i * 0.08));
  const scr = new THREE.MeshBasicMaterial({ map: getScreenTexture(station) });
  const frameM = BOX(0.86, 0.56, 0.05, dark, 0, 1.32, -0.12);
  frameM.rotation.x = -0.32;
  const screen = BOX(0.78, 0.48, 0.055, scr, 0, 1.32, -0.115);
  screen.rotation.x = -0.32;
  g.add(frameM, screen);
  const phase = Math.random() * 6;
  add((t) => (screen.material as THREE.MeshBasicMaterial).color.setScalar(0.88 + 0.12 * Math.sin(t * 7 + phase)));
}

function buildSolar(g: THREE.Group, w: number, d: number): void {
  g.add(BOX(0.7, 0.3, 0.7, dark, 0, 0.15, 0));
  g.add(CYL(0.1, 0.14, 1.1, frame, 0, 0.8, 0));
  const pg = new THREE.Group();
  pg.position.set(0, 1.45, 0);
  pg.rotation.x = -0.55;
  pg.add(BOX(w, 0.07, d, frame, 0, 0, 0));
  const nx = 6, nz = 4;
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      pg.add(BOX(w / nx - 0.05, 0.025, d / nz - 0.05, cell,
        -w / 2 + (ix + 0.5) * (w / nx), 0.05, -d / 2 + (iz + 0.5) * (d / nz)));
    }
  }
  pg.add(BOX(w * 0.9, 0.05, 0.08, dark, 0, -0.07, 0));
  g.add(pg);
  g.add(strut(new THREE.Vector3(0, 0.4, 0), new THREE.Vector3(w * 0.32, 1.32, 0), 0.03, frame));
  g.add(strut(new THREE.Vector3(0, 0.4, 0), new THREE.Vector3(-w * 0.32, 1.32, 0), 0.03, frame));
}

function buildRover(g: THREE.Group, add: (t: TickFn) => void): void {
  for (const x of [-1.15, 0, 1.15]) {
    for (const z of [-0.85, 0.85]) {
      const wheel = CYL(0.36, 0.36, 0.28, rubber, x, 0.36, z, 18);
      wheel.rotation.x = Math.PI / 2;
      const hub = CYL(0.14, 0.14, 0.3, frame, x, 0.36, z, 10);
      hub.rotation.x = Math.PI / 2;
      g.add(wheel, hub);
    }
  }
  g.add(BOX(2.9, 0.45, 1.5, hull, 0, 0.78, 0));
  g.add(BOX(2.2, 0.3, 1.1, dark, 0, 0.5, 0));
  g.add(BOX(1.1, 0.55, 1.2, hull, 0.7, 1.25, 0));
  const shield = BOX(0.08, 0.45, 1.05, glass, 1.28, 1.22, 0);
  shield.rotation.z = -0.18;
  g.add(shield);
  g.add(BOX(1.2, 0.15, 1.3, dark, -0.8, 1.05, 0));
  g.add(BOX(0.5, 0.4, 0.5, rust, -0.9, 1.32, 0.2));
  g.add(CYL(0.05, 0.06, 1.0, frame, -0.2, 1.7, 0));
  const cam = new THREE.Group();
  cam.position.set(-0.2, 2.25, 0);
  cam.add(BOX(0.35, 0.18, 0.18, dark, 0, 0, 0));
  cam.add(BOX(0.06, 0.1, 0.1, lampC, 0.2, 0, 0));
  g.add(cam);
  add((t) => { cam.rotation.y = Math.sin(t * 0.5) * 0.7; });
  const dish = CYL(0.02, 0.35, 0.25, frame, -0.9, 2.0, -0.4, 12);
  dish.rotation.x = 0.6;
  g.add(dish);
  g.add(CYL(0.012, 0.012, 1.4, dark, -1.3, 1.9, 0.6, 6));
  for (const z of [-0.5, 0.5]) g.add(BOX(0.12, 0.12, 0.18, lampW, 1.5, 0.85, z));
  for (const z of [-0.5, 0.5]) g.add(BOX(0.1, 0.1, 0.12, lampR, -1.5, 0.85, z));
}

function buildHatch(g: THREE.Group, add: (t: TickFn) => void): void {
  g.add(BOX(0.25, 2.3, 0.3, dark, -0.95, 1.15, 0));
  g.add(BOX(0.25, 2.3, 0.3, dark, 0.95, 1.15, 0));
  g.add(BOX(2.15, 0.3, 0.3, dark, 0, 2.42, 0));
  const door = BOX(1.7, 2.1, 0.14, hull, 0, 1.1, 0);
  g.add(door);
  for (const y of [0.5, 1.1, 1.7]) g.add(BOX(1.7, 0.08, 0.04, frame, 0, y, 0.09));
  const ring = part(new THREE.TorusGeometry(0.28, 0.05, 10, 24), frame, 0, 1.55, 0.09);
  const portGlass = part(new THREE.CircleGeometry(0.26, 24), glass, 0, 1.55, 0.085);
  g.add(ring, portGlass);
  g.add(BOX(0.28, 0.42, 0.1, dark, 1.18, 1.2, 0.12));
  const keys: THREE.Mesh[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      const key = BOX(0.08, 0.06, 0.03, r === 2 && c === 1 ? lampG : frame, 1.12 + c * 0.12, 1.3 - r * 0.1, 0.18);
      keys.push(key);
      g.add(key);
    }
  }
  const top = SPH(0.07, lampR.clone(), 0, 2.62, 0.1, 10, 8);
  g.add(top);
  for (const x of [-0.82, 0.82]) g.add(BOX(0.08, 2.1, 0.02, lampA, x, 1.1, 0.1));
  add((t) => (top.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(t * 5) > 0 ? 0xff3333 : 0x440000));
  // correct sealed-hatch behavior: pressure rattle — rare, brief shudder
  add((t) => {
    const k = Math.pow(Math.max(0, Math.sin(t * 0.45 + 1.2)), 24);
    door.position.z = 0.12 + (k > 0 ? (Math.sin(t * 61) * 0.008) : 0);
  });
}

function buildBeacon(g: THREE.Group, add: (t: TickFn) => void): void {
  g.add(BOX(0.7, 0.25, 0.7, dark, 0, 0.12, 0));
  g.add(CYL(0.09, 0.13, 2.4, frame, 0, 1.4, 0));
  g.add(BOX(1.2, 0.06, 0.06, frame, 0, 2.0, 0));
  g.add(BOX(0.06, 0.06, 1.2, frame, 0, 2.0, 0));
  g.add(BOX(0.4, 0.3, 0.4, hull, 0, 2.7, 0));
  for (const [x, z] of [[0.22, 0], [-0.22, 0], [0, 0.22], [0, -0.22]] as const) {
    g.add(SPH(0.07, lampC, x, 2.7, z, 8, 6));
  }
  const tip = SPH(0.06, lampR.clone(), 0, 3.15, 0, 8, 6);
  g.add(CYL(0.02, 0.02, 0.35, dark, 0, 2.95, 0, 6));
  g.add(tip);
  const top = new THREE.Vector3(0, 2.55, 0);
  for (const a of [0, 2.1, 4.2]) {
    g.add(strut(top, new THREE.Vector3(Math.cos(a) * 1.3, 0.05, Math.sin(a) * 1.3), 0.015, frame));
  }
  add((t) => (tip.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(t * 4) > 0 ? 0xff3333 : 0x440000));
  // correct beacon behavior: rotating double sweep, like a real airfield beacon
  const sweep = new THREE.Group();
  sweep.position.y = 2.7;
  for (const a of [0, Math.PI]) {
    const blade = BOX(0.85, 0.05, 0.12, lampC, Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
    blade.rotation.y = -a;
    sweep.add(blade);
  }
  g.add(sweep);
  add((_t, dt) => {
    sweep.rotation.y += (dt ?? 0.016) * 2.4;
  });
}

function buildDrone(g: THREE.Group, id: string, add: (t: TickFn) => void): void {
  const tilt = new THREE.Group();
  tilt.rotation.z = 0.14;
  tilt.rotation.x = -0.08;
  const body = SPH(0.45, dark, 0, 0.5, 0, 14, 10);
  body.scale.set(1, 0.62, 1);
  tilt.add(body);
  tilt.add(BOX(0.5, 0.18, 0.4, rust, 0, 0.32, 0));
  const ends: [number, number][] = [[0.75, 0.75], [-0.75, 0.75], [0.75, -0.75], [-0.75, -0.75]];
  // correct broken-drone behavior: surviving rotors cough in short spin-up bursts,
  // the snapped arm (i===3) and bent rotor (i===1) never move.
  const spinners: { m: THREE.Mesh; phase: number }[] = [];
  ends.forEach(([x, z], i) => {
    if (i === 3) {
      tilt.add(strut(new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(x * 0.5, 0.42, z * 0.5), 0.045, frame));
      return; // snapped arm
    }
    tilt.add(strut(new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(x, 0.62, z), 0.045, frame));
    tilt.add(CYL(0.09, 0.11, 0.14, dark, x, 0.66, z, 10));
    const rotor = CYL(0.34, 0.34, 0.02, rubber, x, 0.76, z, 16);
    if (i === 1) { rotor.rotation.z = 0.5; rotor.position.y = 0.5; }
    else spinners.push({ m: rotor, phase: i * 2.1 });
    tilt.add(rotor);
  });
  tilt.add(SPH(0.07, lampR, 0, 0.52, 0.44, 8, 6));
  tilt.add(BOX(0.7, 0.08, 0.12, dark, 0, 0.12, 0.2));
  g.add(tilt);
  add((t, dt) => {
    for (const s of spinners) {
      const gate = Math.pow(Math.max(0, Math.sin(t * 0.6 + s.phase)), 8);
      s.m.rotation.y += (dt ?? 0.016) * 34 * gate;
    }
  });
  void id;
}

function buildLocker(g: THREE.Group, add: (t: TickFn) => void): void {
  g.add(BOX(1.0, 2.0, 0.8, hull, 0, 1.0, 0));
  g.add(BOX(0.9, 1.9, 0.06, dark, 0, 1.0, 0.38));
  const pane = BOX(0.62, 1.45, 0.03, paneGlass, 0, 1.02, 0.4);
  g.add(pane);
  const torso = part(new THREE.CapsuleGeometry(0.18, 0.7, 4, 10), suitM, 0, 0.95, 0.12);
  const helm = SPH(0.16, hull, 0, 1.62, 0.12, 12, 10);
  g.add(torso, helm);
  g.add(BOX(0.7, 0.12, 0.04, lampC, 0, 1.88, 0.4));
  for (let i = 0; i < 3; i++) g.add(BOX(0.04, 0.3, 0.5, dark, -0.52, 0.6 + i * 0.4, 0));
  g.add(BOX(1.1, 0.1, 0.9, dark, 0, 0.05, 0));
  // correct locker behavior: charge LED breathes while the suit sits ready
  const charge = BOX(0.5, 0.05, 0.03, new THREE.MeshBasicMaterial({ color: 0x22ff88 }), -0.1, 1.68, 0.42);
  g.add(charge);
  add((t) => (charge.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(t * 2.2) > 0 ? 0x22ff88 : 0x0a4d22));
}

function buildCore(g: THREE.Group, add: (t: TickFn) => void): void {
  g.add(CYL(0.42, 0.52, 0.9, dark, 0, 0.45, 0, 18));
  const trim = part(new THREE.TorusGeometry(0.44, 0.04, 10, 28), lampC, 0, 0.92, 0);
  trim.rotation.x = Math.PI / 2;
  g.add(trim);
  const gem = part(new THREE.OctahedronGeometry(0.34), crystal, 0, 1.6, 0);
  gem.scale.y = 1.5;
  g.add(gem);
  for (const [x, z] of [[0.3, 0.2], [-0.28, 0.24]] as const) {
    g.add(strut(new THREE.Vector3(x * 0.5, 0.1, z * 0.5), new THREE.Vector3(x, 0.9, z), 0.03, frame));
  }
  add((t, dt) => {
    gem.rotation.y += (dt ?? 0.016) * 1.2;
    gem.position.y = 1.6 + Math.sin(t * 2) * 0.12;
  });
}

function buildHelmet(g: THREE.Group): void {
  g.add(part(new THREE.TorusGeometry(0.3, 0.07, 10, 20), dark, 0, 0.08, 0)).children;
  const dome = SPH(0.3, hull, 0, 0.35, 0, 18, 14);
  const visor = SPH(0.24, glass, 0, 0.38, 0.12, 18, 14);
  visor.scale.set(1, 0.75, 0.6);
  g.add(dome, visor);
  g.add(BOX(0.08, 0.08, 0.1, lampW, 0.28, 0.42, 0.1));
}

function buildRecorder(g: THREE.Group, add: (t: TickFn) => void): void {
  g.add(BOX(0.34, 0.22, 0.24, dark, 0, 0.35, 0));
  g.add(BOX(0.3, 0.02, 0.2, frame, 0, 0.47, 0));
  const ant = CYL(0.015, 0.015, 0.5, frame, 0.12, 0.65, -0.06, 6);
  ant.rotation.z = -0.2;
  g.add(ant);
  const led = SPH(0.035, lampG.clone(), -0.1, 0.48, 0.05, 8, 6);
  g.add(led);
  g.add(BOX(0.12, 0.05, 0.16, rust, 0, 0.12, 0));
  add((t) => (led.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(t * 6) > 0 ? 0x22ff88 : 0x063300));
  // correct tape-recorder behavior: reels turn while the message plays
  const reelM = new THREE.MeshStandardMaterial({ color: 0x9aa3b2, metalness: 0.85, roughness: 0.3 });
  const reelL = part(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12), reelM, -0.07, 0.42, 0.065);
  const reelR = part(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12), reelM, 0.07, 0.42, 0.065);
  reelL.rotation.x = reelR.rotation.x = Math.PI / 2;
  g.add(reelL, reelR);
  add((_t, dt) => {
    reelL.rotation.z += (dt ?? 0.016) * 5;
    reelR.rotation.z += (dt ?? 0.016) * 3.4;
  });
}

function buildGlyphWall(g: THREE.Group, add: (t: TickFn) => void): void {
  g.add(BOX(1.9, 1.5, 0.25, new THREE.MeshStandardMaterial({ color: 0x4a2c1c, roughness: 0.95 }), 0, 0.75, 0));
  g.add(BOX(2.0, 0.12, 0.3, dark, 0, 1.56, 0));
  const glyphMat = new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.9 });
  const glyphMeshes: THREE.Mesh[] = [];
  const sun = part(new THREE.TorusGeometry(0.17, 0.035, 8, 20), glyphMat, -0.58, 1.0, 0.14);
  g.add(sun);
  glyphMeshes.push(sun);
  for (let i = 0; i < 4; i++) {
    const b = BOX(0.12, 0.07, 0.02, glyphMat, -0.12 + i * 0.13, 0.92 + (i % 2) * 0.1, 0.14);
    glyphMeshes.push(b);
    g.add(b);
  }
  const eye = SPH(0.14, glyphMat, 0.62, 1.0, 0.13, 12, 10);
  eye.scale.set(1.3, 0.8, 0.4);
  const pupil = SPH(0.05, dark, 0.62, 1.0, 0.2, 8, 6);
  g.add(eye, pupil);
  glyphMeshes.push(eye);
  add((t) => {
    const o = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.8));
    for (const m of glyphMeshes) (m.material as THREE.MeshBasicMaterial).opacity = o;
  });
}

function buildMapTable(g: THREE.Group, add: (t: TickFn) => void): void {
  g.add(BOX(1.4, 0.08, 1.0, dark, 0, 0.85, 0));
  for (const [x, z] of [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]] as const) {
    g.add(BOX(0.08, 0.85, 0.08, frame, x, 0.42, z));
  }
  const sheet = BOX(0.95, 0.02, 0.68, paper, 0, 0.92, 0);
  sheet.rotation.y = 0.15;
  g.add(sheet);
  const x1 = BOX(0.3, 0.015, 0.06, lampR, 0.15, 0.94, 0.05);
  x1.rotation.y = 0.6;
  const x2 = BOX(0.3, 0.015, 0.06, lampR, 0.15, 0.94, 0.05);
  x2.rotation.y = -0.6 + 0.15;
  g.add(x1, x2);
  g.add(SPH(0.05, rock, -0.35, 0.96, -0.2, 8, 6));
  g.add(SPH(0.05, rock, 0.35, 0.96, 0.22, 8, 6));
  const route: [number, number][] = [[-0.3, 0.15], [-0.1, 0.05], [0.05, 0.12], [0.15, 0.05]];
  for (let i = 0; i < route.length - 1; i++) {
    g.add(strut(
      new THREE.Vector3(route[i][0], 0.945, route[i][1]),
      new THREE.Vector3(route[i + 1][0], 0.945, route[i + 1][1]),
      0.012, lampA
    ));
  }
  // correct field-desk behavior: work lamp breathes, never fully steady
  const bulb = SPH(0.05, new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), -0.5, 1.25, -0.3, 8, 6);
  g.add(CYL(0.02, 0.03, 0.45, dark, -0.5, 1.0, -0.3, 8));
  g.add(bulb);
  add((t) => (bulb.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(t * 13) * Math.sin(t * 3.7) > -0.92 ? 0xffe9a8 : 0x8a6f3a));
}

function buildSkyChime(g: THREE.Group, add: (t: TickFn) => void): void {
  const shard = part(new THREE.DodecahedronGeometry(0.55, 0), rock, 0, 0.1, 0);
  shard.scale.y = 0.6;
  g.add(shard);
  const gems: THREE.Mesh[] = [];
  const specs: [number, number, number, number, THREE.Material][] = [
    [0, 1.15, 0, 0.5, crystal],
    [0.45, 0.8, 0.2, 0.34, crystalV],
    [-0.42, 0.85, -0.15, 0.38, crystal],
  ];
  for (const [x, y, z, s, m] of specs) {
    const gem = part(new THREE.OctahedronGeometry(s), m, x, y, z);
    gem.scale.y = 2.1;
    gems.push(gem);
    g.add(gem);
  }
  add((t) => {
    gems.forEach((gem, i) => {
      gem.rotation.y += 0.008 * (i % 2 === 0 ? 1 : -1);
      const m = gem.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.75 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 2));
    });
  });
}

function buildScrap(g: THREE.Group, id: string): void {
  const r = mulberry(hashStr(id));
  const mats = [rust, dark, hull];
  for (let i = 0; i < 5; i++) {
    const w = 0.35 + r() * 0.75;
    const plate = BOX(w, 0.1 + r() * 0.35, 0.3 + r() * 0.5, mats[Math.floor(r() * 3)],
      (r() - 0.5) * 1.8, 0.15 + r() * 0.5, (r() - 0.5) * 1.8);
    plate.rotation.set(r() * 0.9, r() * Math.PI, r() * 0.9);
    g.add(plate);
  }
  const beam = BOX(0.18, 1.6, 0.18, rust, 0.7, 0.8, -0.4);
  beam.rotation.z = 0.35;
  g.add(beam);
}

function buildSurvivor(g: THREE.Group, add: (t: TickFn) => void): void {
  const astro = new Astronaut(0xd8d2c4, 0x2a9d8f);
  astro.state.waving = true;
  g.add(astro.group);
  add((t, dt) => astro.update(t, dt ?? 0.016));
}

function buildCrate(g: THREE.Group): void {
  g.add(BOX(0.9, 0.7, 0.9, hull, 0, 0.35, 0));
  g.add(BOX(0.94, 0.12, 0.94, dark, 0, 0.72, 0));
  g.add(BOX(0.94, 0.12, 0.94, dark, 0, 0.12, 0));
  g.add(BOX(0.6, 0.5, 0.62, rust, 0.15, 1.0, -0.1));
  g.add(BOX(0.5, 0.06, 0.03, lampC, -0.1, 0.45, 0.46));
}

function buildObelisk(g: THREE.Group): void {
  g.add(CYL(0.7, 0.85, 0.3, rock, 0, 0.15, 0, 8));
  const shaft = BOX(0.7, 2.6, 0.7, new THREE.MeshStandardMaterial({ color: 0x5b6570, metalness: 0.6, roughness: 0.5 }), 0, 1.6, 0);
  g.add(shaft);
  g.add(BOX(0.74, 0.2, 0.74, lampC, 0, 2.4, 0));
  g.add(part(new THREE.ConeGeometry(0.5, 0.5, 4), frame, 0, 3.15, 0));
}

function buildOrb(g: THREE.Group, add: (t: TickFn) => void): void {
  g.add(CYL(0.35, 0.45, 0.5, dark, 0, 0.25, 0, 12));
  const orb = SPH(0.3, crystalV, 0, 1.0, 0, 16, 12);
  g.add(orb);
  add((t, dt) => {
    orb.rotation.y += (dt ?? 0.016) * 0.8;
    orb.position.y = 1.0 + Math.sin(t * 1.6) * 0.1;
  });
}

/* ---------------- any-genre builders: the engine speaks every story ---- */
/* No canvas textures here, so these also run headless (covered by tests). */

const leaf = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.95, flatShading: true });
const leafDark = new THREE.MeshStandardMaterial({ color: 0x27400b, roughness: 1, flatShading: true });
const canvasM = new THREE.MeshStandardMaterial({ color: 0xa88f62, roughness: 0.9 });
const logM = new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 1 });

function buildCampfire(g: THREE.Group, add: (t: TickFn) => void): void {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stone = part(new THREE.DodecahedronGeometry(0.12, 0), rock, Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55);
    stone.rotation.set(a, a * 2, 0);
    g.add(stone);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    const log = CYL(0.06, 0.06, 0.8, logM, 0, 0.12, 0, 8);
    log.rotation.z = Math.PI / 2 - 0.25;
    log.rotation.y = a;
    g.add(log);
  }
  // correct fire behavior: layered flames lick + light breathes with them
  const outer = part(new THREE.ConeGeometry(0.22, 0.7, 10), new THREE.MeshBasicMaterial({ color: 0xff5a00, transparent: true, opacity: 0.9 }), 0, 0.5, 0);
  const inner = part(new THREE.ConeGeometry(0.12, 0.45, 8), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95 }), 0, 0.42, 0);
  const glow = new THREE.PointLight(0xff8a2a, 10, 12, 1.8);
  glow.position.y = 0.7;
  g.add(outer, inner, glow);
  const seed = Math.random() * 10;
  add((t) => {
    const f = 0.85 + 0.15 * Math.sin(t * 13 + seed) * Math.sin(t * 5.3 + seed * 2);
    outer.scale.set(f, 1 + (f - 0.85) * 2.2, f);
    inner.scale.set(2 - f, 1 + (f - 0.85) * 1.6, 2 - f);
    glow.intensity = 8 + 4 * (f - 0.85) * 6;
  });
}

function buildTent(g: THREE.Group): void {
  // correct tent behavior: none — canvas stays put; guy lines hold it down
  for (const s of [-1, 1]) {
    const wall = BOX(0.06, 1.5, 1.8, canvasM, s * 0.55, 0.65, 0);
    wall.rotation.z = s * -0.62;
    g.add(wall);
  }
  g.add(CYL(0.04, 0.04, 2.0, logM, 0, 1.28, 0, 8).rotateX(Math.PI / 2));
  for (const sx of [-1, 1]) {
    for (const sz of [-0.8, 0.8]) {
      g.add(strut(new THREE.Vector3(sx * 0.9, 1.1, sz), new THREE.Vector3(sx * 1.5, 0.02, sz * 1.3), 0.012, dark));
      g.add(BOX(0.1, 0.16, 0.1, logM, sx * 1.5, 0.06, sz * 1.3));
    }
  }
  g.add(BOX(0.5, 0.7, 0.04, dark, 0, 0.35, 0.93));
}

function buildTree(g: THREE.Group, add: (t: TickFn) => void): void {
  g.add(CYL(0.14, 0.2, 1.2, logM, 0, 0.6, 0, 8));
  const tiers: [number, number, number][] = [[1.1, 1.3, 1.2], [0.85, 1.1, 2.0], [0.55, 0.9, 2.7]];
  const tops: THREE.Mesh[] = [];
  tiers.forEach(([r, h, y], i) => {
    const cone = part(new THREE.ConeGeometry(r, h, 8), i % 2 === 0 ? leaf : leafDark, 0, y, 0);
    tops.push(cone);
    g.add(cone);
  });
  // correct tree behavior: crown sways in wind, trunk never moves
  const phase = Math.random() * 6;
  add((t) => {
    const sway = Math.sin(t * 1.1 + phase) * 0.03 + Math.sin(t * 2.3 + phase * 2) * 0.012;
    tops[2].rotation.z = sway;
    tops[2].position.x = sway * 2;
  });
}

function buildTorch(g: THREE.Group, add: (t: TickFn) => void): void {
  g.add(CYL(0.05, 0.07, 1.6, logM, 0, 0.8, 0, 8));
  g.add(CYL(0.09, 0.07, 0.18, dark, 0, 1.65, 0, 8));
  const flame = part(new THREE.ConeGeometry(0.11, 0.34, 8), new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.95 }), 0, 1.9, 0);
  g.add(flame);
  const seed = Math.random() * 10;
  add((t) => {
    const f = 1 + 0.18 * Math.sin(t * 15 + seed);
    flame.scale.set(1 / Math.sqrt(f), f, 1 / Math.sqrt(f));
    flame.rotation.y = t * 3 + seed;
  });
}

function buildCrystalCluster(g: THREE.Group, add: (t: TickFn) => void): void {
  const shards: THREE.Mesh[] = [];
  const specs: [number, number, number, THREE.Material][] = [
    [0, 0.55, 0, crystal],
    [0.35, 0.32, 0.15, crystalV],
    [-0.33, 0.36, -0.12, crystal],
    [0.05, 0.25, -0.34, crystalV],
  ];
  for (const [x, y, z, m] of specs) {
    const shard = part(new THREE.OctahedronGeometry(0.22), m, x, y, z);
    shard.scale.y = 2.2;
    shard.rotation.y = x * 4;
    shards.push(shard);
    g.add(shard);
  }
  g.add(part(new THREE.DodecahedronGeometry(0.5, 0), rock, 0, 0.1, 0));
  // correct crystal behavior: slow breathe of inner light, stone stays dead
  add((t) => {
    shards.forEach((s, i) => {
      (s.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.8 + i * 1.7));
    });
  });
}

/* ---------------- everyday builders: streets, rides, homes, cities ---- */
/* No canvas textures here — every one runs headless (covered by tests). */

const asphalt = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.95 });
const tire = new THREE.MeshStandardMaterial({ color: 0x141519, roughness: 1 });
const wood = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.85 });
const white = new THREE.MeshStandardMaterial({ color: 0xe8e6df, roughness: 0.5 });
const fabricR = new THREE.MeshStandardMaterial({ color: 0xb23b3b, roughness: 0.9 });
const fabricB = new THREE.MeshStandardMaterial({ color: 0x2b5fa6, roughness: 0.9 });
const waterM = new THREE.MeshStandardMaterial({ color: 0x2aa5c4, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.8 });
const flowerM = new THREE.MeshStandardMaterial({ color: 0xff6fa5, roughness: 0.7 });
const curbM = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.9 });
const lineM = new THREE.MeshBasicMaterial({ color: 0xf5d020 });

function wheel(r: number, x: number, y: number, z: number): THREE.Group {
  const w = new THREE.Group();
  w.add(part(new THREE.TorusGeometry(r, r * 0.42, 8, 16), tire, 0, 0, 0));
  const hub = CYL(r * 0.5, r * 0.5, r * 0.55, frame, 0, 0, 0, 10);
  hub.rotation.x = Math.PI / 2;
  w.add(hub);
  w.position.set(x, y, z);
  return w;
}

function buildRoad(g: THREE.Group): void {
  g.add(BOX(4.4, 0.1, 6, asphalt, 0, 0.05, 0));
  g.add(BOX(0.3, 0.16, 6, curbM, -2.35, 0.08, 0));
  g.add(BOX(0.3, 0.16, 6, curbM, 2.35, 0.08, 0));
  g.add(BOX(0.14, 0.02, 5.6, lineM, -1.9, 0.11, 0));
  g.add(BOX(0.14, 0.02, 5.6, lineM, 1.9, 0.11, 0));
  for (let i = 0; i < 4; i++) g.add(BOX(0.16, 0.02, 0.7, lineM, 0, 0.11, -2.1 + i * 1.4));
  // zebra crossing at the near end
  for (let i = 0; i < 5; i++) g.add(BOX(0.55, 0.02, 0.32, white, -1.6 + i * 0.8, 0.11, 2.45));
}

function buildStreetlamp(g: THREE.Group, add: (t: TickFn) => void): void {
  g.add(CYL(0.22, 0.28, 0.25, dark, 0, 0.12, 0, 10));
  g.add(CYL(0.07, 0.09, 3.4, frame, 0, 1.9, 0, 8));
  g.add(strut(new THREE.Vector3(0, 3.5, 0), new THREE.Vector3(0.9, 3.75, 0), 0.05, frame));
  g.add(BOX(0.5, 0.16, 0.3, dark, 0.95, 3.72, 0));
  const bulb = BOX(0.34, 0.06, 0.2, new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), 0.95, 3.63, 0);
  g.add(bulb);
  const phase = Math.random() * 6;
  add((t) => (bulb.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(t * 9 + phase) > -0.97 ? 0xffe9a8 : 0x8a6f3a));
}

function buildTrafficLight(g: THREE.Group, add: (t: TickFn) => void): void {
  g.add(CYL(0.25, 0.3, 0.3, dark, 0, 0.15, 0, 10));
  g.add(CYL(0.08, 0.1, 3.2, dark, 0, 1.8, 0, 8));
  g.add(BOX(0.5, 1.3, 0.4, dark, 0, 3.9, 0));
  const mk = (y: number, color: number) => {
    const lamp = BOX(0.3, 0.3, 0.06, new THREE.MeshBasicMaterial({ color }), 0, y, 0.2);
    g.add(lamp);
    return lamp;
  };
  const r = mk(4.25, 0xff3333), y = mk(3.9, 0x554411), gr = mk(3.55, 0x113322);
  g.add(BOX(0.56, 0.08, 0.44, dark, 0, 4.6, 0));
  const lampMat = (mesh: THREE.Mesh): THREE.MeshBasicMaterial => mesh.material as THREE.MeshBasicMaterial;
  add((t) => {
    const ph = Math.floor(t / 3) % 3;
    lampMat(r).color.setHex(ph === 0 ? 0xff3333 : 0x440000);
    lampMat(y).color.setHex(ph === 1 ? 0xffb020 : 0x554411);
    lampMat(gr).color.setHex(ph === 2 ? 0x22ff88 : 0x113322);
  });
}

function buildBench(g: THREE.Group): void {
  for (const s of [-0.8, 0.8]) {
    g.add(BOX(0.12, 0.45, 0.5, dark, s, 0.22, 0));
    g.add(BOX(0.12, 0.6, 0.12, dark, s, 0.75, -0.22));
  }
  for (let i = 0; i < 3; i++) g.add(BOX(1.9, 0.06, 0.13, wood, 0, 0.47, -0.16 + i * 0.16));
  g.add(BOX(1.9, 0.14, 0.06, wood, 0, 0.85, -0.26));
  g.add(BOX(1.9, 0.14, 0.06, wood, 0, 1.05, -0.28));
}

function buildTrashBin(g: THREE.Group): void {
  g.add(CYL(0.32, 0.26, 0.9, dark, 0, 0.45, 0, 12));
  g.add(CYL(0.34, 0.34, 0.08, frame, 0, 0.92, 0, 12));
  g.add(CYL(0.3, 0.34, 0.14, rust, 0, 1.02, 0, 12));
  g.add(BOX(0.1, 0.08, 0.12, frame, 0, 1.12, 0));
  g.add(BOX(0.2, 0.3, 0.02, new THREE.MeshBasicMaterial({ color: 0x111111 }), 0, 0.6, 0.3));
}

function buildMailbox(g: THREE.Group): void {
  g.add(CYL(0.05, 0.06, 1.0, wood, 0, 0.5, 0, 8));
  g.add(BOX(0.5, 0.34, 0.34, frame, 0, 1.15, 0));
  g.add(BOX(0.04, 0.3, 0.3, dark, 0.26, 1.15, 0));
  g.add(BOX(0.06, 0.5, 0.04, lampR, -0.15, 1.45, 0.1));
  g.add(BOX(0.24, 0.04, 0.04, lampR, -0.15, 1.68, 0.1));
}

function buildHydrant(g: THREE.Group): void {
  g.add(CYL(0.3, 0.34, 0.18, fabricR, 0, 0.09, 0, 12));
  g.add(CYL(0.2, 0.24, 0.7, fabricR, 0, 0.5, 0, 12));
  g.add(SPH(0.2, fabricR, 0, 0.92, 0, 12, 8));
  g.add(CYL(0.09, 0.09, 0.22, frame, -0.26, 0.55, 0, 8).rotateZ(Math.PI / 2));
  g.add(CYL(0.09, 0.09, 0.22, frame, 0.26, 0.55, 0, 8).rotateZ(Math.PI / 2));
  g.add(CYL(0.11, 0.11, 0.2, frame, 0, 0.5, 0.28, 8).rotateX(Math.PI / 2));
}

function buildBusStop(g: THREE.Group): void {
  for (const s of [-1.2, 1.2]) g.add(BOX(0.12, 2.4, 0.12, frame, s, 1.2, -0.5));
  g.add(BOX(2.8, 0.1, 1.4, fabricB, 0, 2.5, 0));
  g.add(BOX(2.4, 0.5, 0.06, paneGlass, 0, 1.4, -0.5));
  g.add(BOX(2.2, 0.08, 0.4, wood, 0, 0.55, -0.3));
  for (const s of [-1.2, 1.2]) g.add(BOX(0.08, 0.55, 0.35, dark, s, 0.28, -0.3));
  g.add(BOX(0.5, 0.3, 0.06, lampC, 0, 2.2, 0.62));
}

function buildCar(g: THREE.Group): void {
  g.add(BOX(1.1, 0.5, 2.6, fabricR, 0, 0.55, 0));
  g.add(BOX(0.95, 0.45, 1.4, paneGlass, 0, 1.0, -0.1));
  g.add(BOX(1.12, 0.12, 2.62, dark, 0, 0.28, 0));
  for (const [x, z] of [[-0.62, 0.85], [0.62, 0.85], [-0.62, -0.85], [0.62, -0.85]]) g.add(wheel(0.3, x, 0.3, z));
  g.add(BOX(0.5, 0.14, 0.1, lampW, -0.25, 0.6, 1.32));
  g.add(BOX(0.5, 0.14, 0.1, lampW, 0.25, 0.6, 1.32));
  g.add(BOX(0.9, 0.12, 0.08, lampR, 0, 0.62, -1.32));
}

function buildTruck(g: THREE.Group): void {
  g.add(BOX(1.3, 1.3, 1.6, fabricB, 0, 1.15, 1.6));
  g.add(BOX(1.1, 0.5, 0.1, paneGlass, 0, 1.4, 2.42));
  g.add(BOX(1.4, 1.6, 3.4, white, 0, 1.3, -0.9));
  g.add(BOX(1.42, 0.2, 3.42, dark, 0, 0.45, -0.9));
  for (const [x, z] of [[-0.7, 1.6], [0.7, 1.6], [-0.7, -0.4], [0.7, -0.4], [-0.7, -1.8], [0.7, -1.8]]) g.add(wheel(0.34, x, 0.34, z));
  g.add(BOX(1.0, 0.16, 0.1, lampW, 0, 0.6, 2.42));
  g.add(CYL(0.06, 0.06, 0.9, dark, -0.6, 1.9, 1.2, 8));
}

function buildBus(g: THREE.Group): void {
  g.add(BOX(1.4, 1.5, 4.2, fabricB, 0, 1.15, 0));
  g.add(BOX(1.42, 0.5, 3.6, paneGlass, 0, 1.5, 0));
  g.add(BOX(1.42, 0.18, 4.22, dark, 0, 0.42, 0));
  g.add(BOX(0.7, 1.1, 0.08, dark, 0.3, 0.95, 2.12));
  for (const [x, z] of [[-0.75, 1.4], [0.75, 1.4], [-0.75, -1.4], [0.75, -1.4]]) g.add(wheel(0.36, x, 0.36, z));
  g.add(BOX(1.1, 0.16, 0.08, lampW, 0, 0.7, 2.12));
  g.add(BOX(1.1, 0.14, 0.08, lampR, 0, 0.72, -2.12));
}

function buildMotorcycle(g: THREE.Group): void {
  g.add(wheel(0.32, 0, 0.32, 0.9));
  g.add(wheel(0.32, 0, 0.32, -0.9));
  g.add(strut(new THREE.Vector3(0, 0.32, -0.9), new THREE.Vector3(0, 0.75, 0.1), 0.05, frame));
  g.add(BOX(0.28, 0.22, 0.7, fabricR, 0, 0.72, -0.1));
  g.add(BOX(0.24, 0.1, 0.4, dark, 0, 0.86, -0.55));
  g.add(strut(new THREE.Vector3(0, 0.75, 0.1), new THREE.Vector3(0, 1.0, 0.75), 0.04, frame));
  g.add(BOX(0.4, 0.05, 0.08, dark, 0, 1.0, 0.78));
  g.add(SPH(0.09, lampW, 0, 0.85, 0.95, 8, 6));
}

function buildBicycle(g: THREE.Group): void {
  const w1 = wheel(0.34, 0, 0.34, 0.75), w2 = wheel(0.34, 0, 0.34, -0.75);
  w1.rotation.y = Math.PI / 2; w2.rotation.y = Math.PI / 2;
  g.add(w1, w2);
  g.add(strut(new THREE.Vector3(0, 0.34, -0.75), new THREE.Vector3(0, 0.85, 0.05), 0.03, frame));
  g.add(strut(new THREE.Vector3(0, 0.34, 0.75), new THREE.Vector3(0, 0.85, 0.05), 0.03, frame));
  g.add(strut(new THREE.Vector3(0, 0.85, 0.05), new THREE.Vector3(0, 0.85, -0.5), 0.03, frame));
  g.add(BOX(0.24, 0.07, 0.24, dark, 0, 0.92, -0.55));
  g.add(BOX(0.4, 0.05, 0.08, dark, 0, 1.0, 0.6));
}

function buildBoat(g: THREE.Group): void {
  g.add(BOX(1.4, 0.6, 3.0, wood, 0, 0.4, 0));
  const bow = BOX(1.4, 0.6, 0.9, wood, 0, 0.4, 1.8);
  bow.rotation.x = -0.5;
  g.add(bow);
  g.add(BOX(1.2, 0.12, 2.6, dark, 0, 0.75, -0.1));
  g.add(CYL(0.06, 0.08, 2.6, wood, 0, 2.0, 0, 8));
  const sail = BOX(0.06, 1.6, 1.4, canvasM, 0.1, 2.2, -0.8);
  sail.rotation.z = 0.1;
  g.add(sail);
  g.add(BOX(0.5, 0.4, 0.5, dark, 0, 1.0, -1.0));
}

function buildHouse(g: THREE.Group): void {
  g.add(BOX(3.0, 1.8, 2.6, white, 0, 0.9, 0));
  const roof = part(new THREE.ConeGeometry(2.4, 1.2, 4), fabricR, 0, 2.4, 0);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  g.add(BOX(0.7, 1.2, 0.1, wood, -0.5, 0.6, 1.32));
  // warm lit windows read at dusk and on night worlds
  const lit = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb45e, emissiveIntensity: 1.4 });
  g.add(BOX(0.6, 0.6, 0.08, lit, 0.7, 1.1, 1.32));
  g.add(BOX(0.6, 0.6, 0.08, lit, -1.0, 1.1, -1.32));
  g.add(BOX(0.4, 1.0, 0.4, rust, 0.9, 2.6, -0.5));
}

/* City tower: the `building` type in street stories — concrete slab block
 * with a lit window grid, entrance canopy, and a blinking roof beacon. */
function buildCityTower(g: THREE.Group, add: (t: TickFn) => void): void {
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8d929c, roughness: 0.85 });
  const concreteD = new THREE.MeshStandardMaterial({ color: 0x5a606b, roughness: 0.9 });
  g.add(BOX(4.2, 0.3, 4.2, concreteD, 0, 0.15, 0));
  g.add(BOX(3.4, 7.5, 3.4, concrete, 0, 4.05, 0));
  g.add(BOX(3.7, 0.35, 3.7, concreteD, 0, 7.95, 0));
  // lit window grid, front + back faces
  const lit = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffb45e, emissiveIntensity: 1.6 });
  const darkWin = new THREE.MeshStandardMaterial({ color: 0x1a2433, roughness: 0.2, metalness: 0.5 });
  const rand = mulberry(1234);
  for (let floor = 0; floor < 4; floor++) {
    for (let col = 0; col < 3; col++) {
      const on = rand() > 0.35;
      g.add(BOX(0.55, 0.7, 0.06, on ? lit : darkWin, -1.05 + col * 1.05, 1.9 + floor * 1.55, 1.72));
      g.add(BOX(0.55, 0.7, 0.06, on ? lit : darkWin, -1.05 + col * 1.05, 1.9 + floor * 1.55, -1.72));
    }
  }
  // entrance canopy + door glow
  g.add(BOX(1.6, 0.12, 0.9, concreteD, 0, 2.3, 2.0));
  g.add(BOX(1.1, 1.9, 0.1, lit, 0, 1.15, 1.72));
  // roof beacon blinks like an aircraft warning light
  g.add(CYL(0.06, 0.08, 1.0, dark, 0, 8.6, 0, 8));
  const beacon = SPH(0.12, new THREE.MeshBasicMaterial({ color: 0xff3333 }), 0, 9.2, 0, 10, 8);
  g.add(beacon);
  const phase = Math.random() * 6;
  add((t) => {
    (beacon.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(t * 4 + phase) > 0 ? 0xff3333 : 0x550000);
  });
}

function buildBed(g: THREE.Group): void {
  for (const [x, z] of [[-0.9, -0.5], [0.9, -0.5], [-0.9, 0.5], [0.9, 0.5]]) g.add(BOX(0.12, 0.4, 0.12, wood, x, 0.2, z * 2.4));
  g.add(BOX(2.0, 0.18, 2.6, wood, 0, 0.45, 0));
  g.add(BOX(1.9, 0.22, 2.5, white, 0, 0.65, 0));
  g.add(BOX(1.9, 0.1, 2.5, fabricB, 0, 0.72, -0.3));
  g.add(BOX(0.7, 0.16, 0.5, white, -0.5, 0.82, 0.9));
  g.add(BOX(0.7, 0.16, 0.5, white, 0.5, 0.82, 0.9));
  g.add(BOX(2.0, 0.7, 0.12, wood, 0, 0.75, 1.32));
}

function buildTable(g: THREE.Group): void {
  g.add(BOX(1.8, 0.1, 1.0, wood, 0, 0.75, 0));
  for (const [x, z] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]]) g.add(BOX(0.1, 0.75, 0.1, wood, x, 0.37, z));
  g.add(BOX(1.6, 0.06, 0.8, dark, 0, 0.2, 0));
}

function buildChair(g: THREE.Group): void {
  g.add(BOX(0.5, 0.08, 0.5, wood, 0, 0.45, 0));
  g.add(BOX(0.5, 0.7, 0.08, wood, 0, 0.85, -0.25));
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.add(BOX(0.07, 0.45, 0.07, wood, x, 0.22, z));
  g.add(BOX(0.44, 0.05, 0.44, fabricR, 0, 0.52, 0));
}

function buildSofa(g: THREE.Group): void {
  g.add(BOX(2.0, 0.5, 0.9, fabricB, 0, 0.35, 0));
  g.add(BOX(2.0, 0.7, 0.25, fabricB, 0, 0.85, -0.35));
  g.add(BOX(0.25, 0.4, 0.9, fabricB, -1.0, 0.7, 0));
  g.add(BOX(0.25, 0.4, 0.9, fabricB, 1.0, 0.7, 0));
  g.add(BOX(0.85, 0.18, 0.7, fabricR, -0.45, 0.68, 0.05));
  g.add(BOX(0.85, 0.18, 0.7, fabricR, 0.45, 0.68, 0.05));
}

function buildFloorLamp(g: THREE.Group): void {
  g.add(CYL(0.25, 0.3, 0.08, dark, 0, 0.04, 0, 12));
  g.add(CYL(0.04, 0.04, 1.6, frame, 0, 0.85, 0, 8));
  g.add(CYL(0.3, 0.22, 0.4, fabricR, 0, 1.8, 0, 12));
  g.add(SPH(0.09, lampW, 0, 1.68, 0, 8, 6));
  g.add(CYL(0.008, 0.008, 0.3, dark, 0.2, 1.55, 0, 6));
}

function buildBookshelf(g: THREE.Group): void {
  g.add(BOX(0.08, 2.0, 0.4, wood, -0.55, 1.0, 0));
  g.add(BOX(0.08, 2.0, 0.4, wood, 0.55, 1.0, 0));
  g.add(BOX(1.2, 0.08, 0.42, wood, 0, 1.96, 0));
  g.add(BOX(1.2, 0.08, 0.42, wood, 0, 0.08, 0));
  const cols = [fabricR, fabricB, lampG, white, rust, frame];
  for (let s = 0; s < 3; s++) {
    g.add(BOX(1.04, 0.06, 0.38, wood, 0, 0.68 + s * 0.6, 0));
    for (let b = 0; b < 6; b++) {
      g.add(BOX(0.12, 0.42, 0.3, cols[(s * 6 + b) % cols.length], -0.42 + b * 0.17, 0.92 + s * 0.6, 0));
    }
  }
}

function buildTV(g: THREE.Group, add: (t: TickFn) => void): void {
  g.add(BOX(1.2, 0.7, 0.12, dark, 0, 1.0, 0));
  const scr = new THREE.MeshBasicMaterial({ color: 0x1a3a55 });
  const scrMesh = BOX(1.05, 0.55, 0.13, scr, 0, 1.0, 0);
  g.add(scrMesh);
  g.add(BOX(0.4, 0.25, 0.2, dark, 0, 0.5, 0));
  g.add(strut(new THREE.Vector3(-0.2, 1.35, 0), new THREE.Vector3(-0.45, 1.9, 0), 0.015, frame));
  g.add(strut(new THREE.Vector3(0.2, 1.35, 0), new THREE.Vector3(0.45, 1.9, 0), 0.015, frame));
  const phase = Math.random() * 6;
  add((t) => (scrMesh.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(t * 11 + phase) > 0 ? 0x1a3a55 : 0x274e6d));
}

function buildFridge(g: THREE.Group): void {
  g.add(BOX(0.9, 1.9, 0.8, white, 0, 0.95, 0));
  g.add(BOX(0.92, 0.06, 0.82, frame, 0, 1.25, 0));
  g.add(BOX(0.06, 0.4, 0.06, frame, -0.3, 1.5, 0.42));
  g.add(BOX(0.06, 0.3, 0.06, frame, -0.3, 0.8, 0.42));
  g.add(BOX(0.5, 0.3, 0.02, paneGlass, 0.1, 1.55, 0.41));
}

function buildDesk(g: THREE.Group): void {
  g.add(BOX(1.6, 0.08, 0.8, wood, 0, 0.74, 0));
  g.add(BOX(0.08, 0.74, 0.75, wood, -0.76, 0.37, 0));
  g.add(BOX(0.08, 0.74, 0.75, wood, 0.76, 0.37, 0));
  g.add(BOX(0.6, 0.35, 0.6, dark, 0.4, 0.5, 0));
  g.add(BOX(0.5, 0.3, 0.02, lampC, -0.3, 0.95, -0.2));
}

function buildWaterCooler(g: THREE.Group): void {
  g.add(BOX(0.4, 1.0, 0.4, white, 0, 0.5, 0));
  const jug = CYL(0.22, 0.22, 0.5, paneGlass, 0, 1.3, 0, 12);
  g.add(jug);
  g.add(CYL(0.08, 0.08, 0.12, dark, 0, 1.6, 0, 8));
  g.add(BOX(0.08, 0.1, 0.06, lampR, -0.08, 0.85, 0.21));
  g.add(BOX(0.08, 0.1, 0.06, lampC, 0.08, 0.85, 0.21));
  g.add(BOX(0.3, 0.04, 0.2, dark, 0, 0.72, 0.22));
}

function buildPrinter(g: THREE.Group): void {
  g.add(BOX(0.7, 0.3, 0.6, white, 0, 0.35, 0));
  g.add(BOX(0.72, 0.06, 0.62, dark, 0, 0.53, 0));
  g.add(BOX(0.5, 0.02, 0.4, paper, 0, 0.57, 0.3));
  g.add(BOX(0.6, 0.12, 0.1, dark, 0, 0.28, 0.32));
  g.add(SPH(0.04, lampG, 0.25, 0.45, 0.31, 8, 6));
}

function buildBush(g: THREE.Group): void {
  g.add(SPH(0.5, leaf, 0, 0.45, 0, 10, 8));
  g.add(SPH(0.35, leafDark, 0.4, 0.3, 0.15, 8, 6));
  g.add(SPH(0.32, leaf, -0.38, 0.32, -0.1, 8, 6));
  g.add(CYL(0.06, 0.08, 0.3, logM, 0, 0.12, 0, 6));
  g.add(part(new THREE.DodecahedronGeometry(0.14, 0), rock, 0.55, 0.07, -0.3));
}

function buildFlower(g: THREE.Group): void {
  g.add(CYL(0.025, 0.035, 0.7, leafDark, 0, 0.35, 0, 6));
  g.add(BOX(0.2, 0.02, 0.1, leaf, 0.1, 0.25, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(SPH(0.09, flowerM, Math.cos(a) * 0.12, 0.75, Math.sin(a) * 0.12, 8, 6));
  }
  g.add(SPH(0.08, lampW, 0, 0.75, 0, 8, 6));
}

function buildCactus(g: THREE.Group): void {
  g.add(CYL(0.22, 0.26, 1.6, leafDark, 0, 0.8, 0, 10));
  const armL = CYL(0.14, 0.16, 0.7, leafDark, -0.35, 0.9, 0, 8);
  armL.rotation.z = 0.5;
  const armR = CYL(0.14, 0.16, 0.55, leafDark, 0.35, 1.15, 0, 8);
  armR.rotation.z = -0.5;
  g.add(armL, armR);
  g.add(SPH(0.09, flowerM, 0, 1.65, 0, 8, 6));
  g.add(CYL(0.5, 0.6, 0.12, rock, 0, 0.06, 0, 10));
}

function buildPalmTree(g: THREE.Group, add: (t: TickFn) => void): void {
  const segs: [number, number][] = [[0, 0.5], [0.12, 1.4], [0.3, 2.3]];
  let px = 0;
  for (const [dx, y] of segs) {
    g.add(CYL(0.13, 0.17, 1.0, logM, px + dx / 2, y, 0, 8));
    px += dx;
  }
  const fronds: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const f = BOX(1.3, 0.04, 0.35, leaf, 0.3 + Math.cos(a) * 0.6, 2.85, Math.sin(a) * 0.6);
    f.rotation.y = -a;
    f.rotation.z = -0.25;
    fronds.push(f);
    g.add(f);
  }
  g.add(SPH(0.12, wood, 0.3, 2.6, 0.1, 8, 6));
  g.add(SPH(0.12, wood, 0.15, 2.6, -0.15, 8, 6));
  const phase = Math.random() * 6;
  add((t) => {
    fronds.forEach((f, i) => {
      f.rotation.z = -0.25 + Math.sin(t * 1.4 + phase + i) * 0.06;
    });
  });
}

function buildPond(g: THREE.Group): void {
  g.add(CYL(1.4, 1.5, 0.12, waterM, 0, 0.06, 0, 20));
  g.add(CYL(1.55, 1.65, 0.1, rock, 0, 0.03, 0, 20));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(part(new THREE.DodecahedronGeometry(0.16, 0), rock, Math.cos(a) * 1.6, 0.08, Math.sin(a) * 1.6));
  }
  g.add(CYL(0.25, 0.25, 0.03, leaf, 0.5, 0.13, 0.3, 10));
  g.add(SPH(0.07, flowerM, 0.5, 0.18, 0.3, 8, 6));
}

function buildFountain(g: THREE.Group, add: (t: TickFn) => void): void {
  g.add(CYL(1.1, 1.25, 0.5, curbM, 0, 0.25, 0, 16));
  g.add(CYL(0.95, 0.95, 0.42, waterM, 0, 0.3, 0, 16));
  g.add(CYL(0.14, 0.2, 1.3, curbM, 0, 1.0, 0, 10));
  g.add(CYL(0.5, 0.35, 0.25, curbM, 0, 1.7, 0, 12));
  const jet = CYL(0.09, 0.16, 1.1, waterM, 0, 2.3, 0, 8);
  g.add(jet);
  add((t) => {
    const s = 1 + 0.12 * Math.sin(t * 6);
    jet.scale.set(s, 1, s);
  });
}

function buildStatue(g: THREE.Group): void {
  g.add(BOX(1.0, 0.5, 1.0, rock, 0, 0.25, 0));
  g.add(CYL(0.35, 0.42, 0.5, frame, 0, 0.9, 0, 8));
  g.add(CYL(0.22, 0.3, 0.8, frame, 0, 1.55, 0, 8));
  g.add(SPH(0.2, frame, 0, 2.2, 0, 10, 8));
  g.add(strut(new THREE.Vector3(-0.15, 1.7, 0), new THREE.Vector3(-0.55, 1.1, 0.1), 0.07, frame));
  g.add(strut(new THREE.Vector3(0.15, 1.7, 0), new THREE.Vector3(0.5, 2.3, -0.1), 0.07, frame));
}

function buildBillboard(g: THREE.Group): void {
  for (const s of [-1.4, 1.4]) g.add(CYL(0.09, 0.11, 3.4, dark, s, 1.7, 0, 8));
  g.add(BOX(3.8, 1.6, 0.15, frame, 0, 4.0, 0));
  g.add(BOX(3.5, 1.3, 0.17, white, 0, 4.0, 0));
  g.add(BOX(3.5, 0.35, 0.18, lampC, 0, 4.4, 0));
  g.add(BOX(0.5, 0.2, 0.1, lampW, -1.2, 4.9, 0));
  g.add(BOX(0.5, 0.2, 0.1, lampW, 1.2, 4.9, 0));
}

function buildWindmill(g: THREE.Group, add: (t: TickFn) => void): void {
  for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
    g.add(strut(new THREE.Vector3(x * 1.6, 0, z * 1.6), new THREE.Vector3(x * 0.3, 4.2, z * 0.3), 0.06, frame));
  }
  g.add(BOX(0.5, 0.5, 0.6, white, 0, 4.3, 0));
  const rotor = new THREE.Group();
  rotor.position.set(0, 4.3, 0.45);
  for (let i = 0; i < 4; i++) {
    const blade = BOX(0.28, 1.6, 0.06, white, 0, 0.95, 0);
    const holder = new THREE.Group();
    holder.rotation.z = (i / 4) * Math.PI * 2;
    holder.add(blade);
    rotor.add(holder);
  }
  rotor.add(SPH(0.16, dark, 0, 0, 0, 8, 6));
  g.add(rotor);
  add((t, dt) => {
    rotor.rotation.z += (dt ?? 0.016) * 1.2;
    void t;
  });
}

function buildWaterTower(g: THREE.Group): void {
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) g.add(BOX(0.14, 3.0, 0.14, rust, x, 1.5, z));
  g.add(CYL(1.2, 1.2, 1.6, fabricR, 0, 3.8, 0, 14));
  g.add(part(new THREE.ConeGeometry(1.35, 0.7, 14), dark, 0, 4.95, 0));
  g.add(CYL(0.12, 0.12, 3.0, dark, 1.05, 1.5, 0, 8));
  for (let i = 0; i < 4; i++) g.add(BOX(0.5, 0.05, 0.05, dark, 0, 0.6 + i * 0.7, 0.95));
}

function buildGasPump(g: THREE.Group): void {
  g.add(BOX(0.8, 0.2, 0.6, dark, 0, 0.1, 0));
  g.add(BOX(0.7, 1.3, 0.55, fabricR, 0, 0.85, 0));
  g.add(BOX(0.5, 0.4, 0.03, paneGlass, 0, 1.1, 0.29));
  g.add(BOX(0.3, 0.2, 0.02, lampW, 0, 0.7, 0.29));
  g.add(BOX(0.08, 0.5, 0.08, dark, 0.42, 0.85, 0));
  g.add(BOX(0.12, 0.25, 0.1, dark, 0.42, 0.6, 0.1));
}

function buildBarrel(g: THREE.Group): void {
  g.add(CYL(0.35, 0.35, 1.0, fabricB, 0, 0.5, 0, 14));
  g.add(CYL(0.37, 0.37, 0.08, dark, 0, 0.75, 0, 14));
  g.add(CYL(0.37, 0.37, 0.08, dark, 0, 0.25, 0, 14));
  g.add(CYL(0.36, 0.36, 0.04, dark, 0, 1.0, 0, 14));
  g.add(CYL(0.05, 0.05, 0.06, frame, 0.15, 1.02, 0, 8));
}

function buildLadder(g: THREE.Group): void {
  for (const s of [-0.3, 0.3]) g.add(BOX(0.08, 3.0, 0.08, wood, s, 1.5, 0));
  for (let i = 0; i < 5; i++) g.add(BOX(0.6, 0.07, 0.07, wood, 0, 0.4 + i * 0.55, 0));
}

function buildTelescope(g: THREE.Group): void {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(strut(new THREE.Vector3(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5), new THREE.Vector3(0, 1.0, 0), 0.04, dark));
  }
  const tube = CYL(0.16, 0.2, 1.1, hull, 0, 1.25, 0, 12);
  tube.rotation.z = 0.6;
  g.add(tube);
  g.add(CYL(0.06, 0.06, 0.25, dark, -0.55, 1.0, 0, 8).rotateZ(0.6));
  g.add(CYL(0.04, 0.04, 0.3, frame, 0.3, 1.5, 0, 6).rotateZ(0.6));
  g.add(SPH(0.05, lampC, 0.42, 1.55, 0, 8, 6));
}

function buildRadio(g: THREE.Group): void {
  g.add(BOX(0.6, 0.35, 0.25, fabricR, 0, 0.35, 0));
  g.add(BOX(0.3, 0.25, 0.02, dark, -0.12, 0.35, 0.13));
  g.add(CYL(0.015, 0.015, 0.6, frame, 0.2, 0.8, 0, 6));
  g.add(CYL(0.05, 0.05, 0.05, dark, 0.15, 0.3, 0.14, 8).rotateX(Math.PI / 2));
  g.add(CYL(0.05, 0.05, 0.05, dark, 0.15, 0.18, 0.14, 8).rotateX(Math.PI / 2));
  g.add(BOX(0.64, 0.06, 0.29, dark, 0, 0.12, 0));
}

function buildPhoneBooth(g: THREE.Group): void {
  for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) g.add(BOX(0.09, 2.3, 0.09, fabricR, x, 1.15, z));
  g.add(BOX(1.0, 0.12, 1.0, fabricR, 0, 2.36, 0));
  g.add(BOX(1.0, 0.3, 0.1, lampC, 0, 2.1, 0.46));
  g.add(BOX(0.86, 1.8, 0.02, paneGlass, 0, 1.15, -0.45));
  g.add(BOX(0.02, 1.8, 0.86, paneGlass, -0.45, 1.15, 0));
  g.add(BOX(0.02, 1.8, 0.86, paneGlass, 0.45, 1.15, 0));
  g.add(BOX(0.3, 0.4, 0.15, dark, 0, 1.3, -0.35));
  g.add(BOX(1.0, 0.08, 1.0, dark, 0, 0.04, 0));
}

/* ---------------- metro pack: stations, trains, tunnels ---------------- */

function buildTrain(g: THREE.Group, add: (t: TickFn) => void): void {
  // metro carriage: steel body, window band, bogies, glowing headlight
  g.add(BOX(2.2, 1.5, 6.0, hull, 0, 1.35, 0));
  g.add(BOX(2.24, 0.55, 5.2, paneGlass, 0, 1.65, 0));
  g.add(BOX(2.26, 0.14, 6.02, fabricR, 0, 0.85, 0));
  g.add(BOX(2.0, 0.5, 0.3, dark, 0, 1.2, 3.0));
  g.add(BOX(1.6, 0.5, 0.08, paneGlass, 0, 1.45, 3.16));
  g.add(BOX(0.35, 0.22, 0.1, lampW, -0.6, 0.7, 3.02));
  g.add(BOX(0.35, 0.22, 0.1, lampW, 0.6, 0.7, 3.02));
  g.add(BOX(2.0, 0.14, 0.08, lampR, 0, 0.75, -3.02));
  for (const z of [1.8, -1.8]) {
    g.add(BOX(1.6, 0.4, 1.0, dark, 0, 0.4, z));
    for (const [x, dz] of [[-0.85, -0.3], [0.85, -0.3], [-0.85, 0.3], [0.85, 0.3]]) {
      g.add(wheel(0.28, x, 0.28, z + dz));
    }
  }
  // roof vent hums with power
  const vent = BOX(0.8, 0.12, 1.6, new THREE.MeshStandardMaterial({ color: 0x707a88, metalness: 0.8, roughness: 0.3, emissive: 0x1a2b1a, emissiveIntensity: 0.4 }), 0, 2.16, 0);
  g.add(vent);
  const phase = Math.random() * 6;
  add((t) => {
    (vent.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + 0.2 * Math.sin(t * 2 + phase);
  });
}

function buildRails(g: THREE.Group): void {
  // twin steel rails + wooden sleepers on a gravel bed, 6-unit section
  g.add(BOX(2.6, 0.12, 6.0, dark, 0, 0.06, 0));
  for (const x of [-0.75, 0.75]) g.add(BOX(0.12, 0.14, 6.0, frame, x, 0.19, 0));
  for (let i = 0; i < 7; i++) g.add(BOX(2.0, 0.08, 0.3, wood, 0, 0.1, -2.6 + i * 0.87));
}

function buildPlatform(g: THREE.Group): void {
  // station platform: slab, yellow safety edge, canopy, bench
  g.add(BOX(3.4, 0.5, 6.0, curbM, 0, 0.25, 0));
  g.add(BOX(0.3, 0.02, 6.0, lineM, -1.45, 0.51, 0));
  for (const x of [-1.2, 1.2]) {
    g.add(BOX(0.14, 2.6, 0.14, frame, x, 1.8, -2.2));
    g.add(BOX(0.14, 2.6, 0.14, frame, x, 1.8, 2.2));
  }
  g.add(BOX(3.2, 0.12, 5.4, fabricB, 0, 3.15, 0));
  g.add(BOX(3.0, 0.06, 5.2, lampW, 0, 3.08, 0));
  g.add(BOX(1.6, 0.08, 0.45, wood, 0.4, 0.95, 0.8));
  for (const s of [-0.6, 0.6]) g.add(BOX(0.08, 0.45, 0.4, dark, s, 0.72, 0.8));
}

function buildTicketGate(g: THREE.Group): void {
  // entry gate pair: posts, glowing reader, barrier arm
  for (const s of [-0.55, 0.55]) {
    g.add(BOX(0.28, 1.1, 1.4, frame, s, 0.55, 0));
    g.add(BOX(0.3, 0.2, 0.3, lampC, s, 1.0, 0.55));
  }
  const arm = BOX(0.9, 0.07, 0.07, fabricR, 0, 0.85, 0);
  g.add(arm);
  g.add(BOX(1.4, 0.06, 1.6, dark, 0, 0.03, 0));
}

function buildTunnel(g: THREE.Group, add: (t: TickFn) => void): void {
  // tunnel mouth: concrete cheeks + lintel, black throat, warning blinkers
  g.add(BOX(1.0, 3.4, 3.6, curbM, -2.2, 1.7, 0));
  g.add(BOX(1.0, 3.4, 3.6, curbM, 2.2, 1.7, 0));
  g.add(BOX(5.4, 1.0, 3.6, curbM, 0, 3.9, 0));
  g.add(BOX(3.4, 2.9, 0.4, new THREE.MeshBasicMaterial({ color: 0x030304 }), 0, 1.45, -1.2));
  const warn = BOX(3.0, 0.22, 0.12, new THREE.MeshBasicMaterial({ color: 0xffb020 }), 0, 3.28, 1.82);
  g.add(warn);
  const phase = Math.random() * 6;
  add((t) => {
    (warn.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(t * 5 + phase) > 0 ? 0xffb020 : 0x553a08);
  });
}

function buildStationSign(g: THREE.Group): void {
  // hanging station board, glowing cyan face both sides
  g.add(CYL(0.07, 0.09, 3.0, frame, -0.8, 1.5, 0, 8));
  g.add(CYL(0.07, 0.09, 3.0, frame, 0.8, 1.5, 0, 8));
  g.add(BOX(2.2, 0.7, 0.14, dark, 0, 3.1, 0));
  g.add(BOX(2.0, 0.5, 0.02, lampC, 0, 3.1, 0.08));
  g.add(BOX(2.0, 0.5, 0.02, lampC, 0, 3.1, -0.08));
}

function buildShop(g: THREE.Group, add: (t: TickFn) => void): void {
  // market stall: posts, striped awning, counter, goods crates, hanging lamp
  for (const [x, z] of [[-1.1, -0.7], [1.1, -0.7], [-1.1, 0.7], [1.1, 0.7]]) {
    g.add(BOX(0.1, 2.2, 0.1, wood, x, 1.1, z));
  }
  for (let i = 0; i < 6; i++) {
    g.add(BOX(0.42, 0.06, 1.9, i % 2 === 0 ? fabricR : white, -1.05 + i * 0.42, 2.32, 0));
  }
  g.add(BOX(2.4, 0.5, 0.9, wood, 0, 0.75, 0.2));
  g.add(BOX(2.2, 0.08, 0.7, dark, 0, 1.02, 0.2));
  g.add(BOX(0.5, 0.35, 0.5, wood, -0.7, 1.22, 0.2));
  g.add(BOX(0.4, 0.3, 0.4, fabricB, 0.1, 1.2, 0.2));
  g.add(BOX(0.45, 0.28, 0.45, flowerM, 0.75, 1.18, 0.2));
  const lamp = SPH(0.07, new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), 0, 2.05, 0, 8, 6);
  g.add(lamp);
  g.add(strut(new THREE.Vector3(0, 2.3, 0), new THREE.Vector3(0, 2.05, 0), 0.02, dark));
  const phase = Math.random() * 6;
  add((t) => {
    (lamp.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(t * 8 + phase) > -0.9 ? 0xffe9a8 : 0x9a7f45);
  });
}

/* ---------------- heroes & powers pack (original heroes, your stories) --- */

function buildHero(g: THREE.Group, add: (t: TickFn) => void): void {
  // caped champion: cowl, glowing eyes, emblem, billowing cape
  const suitM = new THREE.MeshStandardMaterial({ color: 0x27408b, roughness: 0.5 });
  const capeM = new THREE.MeshStandardMaterial({ color: 0x8b1a1a, roughness: 0.85, side: THREE.DoubleSide });
  for (const s of [-0.13, 0.13]) {
    g.add(BOX(0.16, 0.7, 0.16, dark, s, 0.35, 0));
    g.add(BOX(0.2, 0.1, 0.3, dark, s, 0.05, 0.05));
  }
  g.add(BOX(0.5, 0.75, 0.3, suitM, 0, 1.05, 0));
  const emblem = part(new THREE.OctahedronGeometry(0.09), lampA, 0, 1.2, 0.16);
  emblem.scale.set(1, 1.4, 0.5);
  g.add(emblem);
  for (const s of [-0.34, 0.34]) {
    g.add(BOX(0.12, 0.6, 0.12, suitM, s, 1.05, 0));
    g.add(SPH(0.07, suitM, s, 0.7, 0, 8, 6));
  }
  g.add(SPH(0.19, suitM, 0, 1.72, 0, 14, 10));
  for (const s of [-0.07, 0.07]) g.add(BOX(0.09, 0.05, 0.02, lampW, s, 1.74, 0.18));
  const cape = BOX(0.52, 1.0, 0.04, capeM, 0, 1.0, -0.2);
  cape.rotation.x = 0.12;
  g.add(cape);
  const phase = Math.random() * 6;
  add((t) => {
    cape.rotation.x = 0.12 + Math.sin(t * 1.6 + phase) * 0.06;
  });
}

function buildPowerup(g: THREE.Group, add: (t: TickFn) => void): void {
  // floating ability orb: golden core, twin orbit rings, light pedestal
  g.add(CYL(0.5, 0.65, 0.18, dark, 0, 0.09, 0, 16));
  const core = SPH(0.28, new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb020, emissiveIntensity: 1.8 }), 0, 1.1, 0, 18, 14);
  g.add(core);
  const ringM = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.8 });
  const r1 = part(new THREE.TorusGeometry(0.5, 0.03, 8, 28), ringM, 0, 1.1, 0);
  const r2 = part(new THREE.TorusGeometry(0.68, 0.025, 8, 28), ringM, 0, 1.1, 0);
  r2.rotation.x = Math.PI / 2.4;
  g.add(r1, r2);
  const beam = CYL(0.06, 0.12, 1.0, new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.35 }), 0, 0.6, 0, 8);
  g.add(beam);
  const phase = Math.random() * 6;
  add((t) => {
    core.position.y = 1.1 + Math.sin(t * 1.8 + phase) * 0.15;
    r1.rotation.y += 0.03;
    r2.rotation.z += 0.02;
    (core.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 + 0.5 * Math.sin(t * 3 + phase);
  });
}

/* ---------------- entry ---------------- */
export function createObjectMesh(obj: WorldObject, station = "AURORA BASE"): THREE.Group {
  const g = new THREE.Group();
  const ticks: TickFn[] = [];
  const add = (t: TickFn): void => { ticks.push(t); };
  const model = obj.modelId ?? obj.type;
  switch (model) {
    case "console": buildConsole(g, add, station); break;
    case "solar": buildSolar(g, obj.scale[0] || 3, obj.scale[2] || 2); break;
    case "rover": case "vehicle": buildRover(g, add); break;
    case "hatch": case "door": buildHatch(g, add); break;
    case "beacon": buildBeacon(g, add); break;
    case "drone": buildDrone(g, obj.id, add); break;
    case "locker": buildLocker(g, add); break;
    case "core": buildCore(g, add); break;
    case "helmet": buildHelmet(g); break;
    case "recorder": buildRecorder(g, add); break;
    case "glyphwall": buildGlyphWall(g, add); break;
    case "maptable": buildMapTable(g, add); break;
    case "skychime": buildSkyChime(g, add); break;
    case "campfire": buildCampfire(g, add); break;
    case "tent": buildTent(g); break;
    case "tree": buildTree(g, add); break;
    case "torch": buildTorch(g, add); break;
    case "crystal": buildCrystalCluster(g, add); break;
    case "building": buildCityTower(g, add); break;
    case "creature": buildSurvivor(g, add); break;
    case "portal": buildOrb(g, add); break;
    case "scrap": case "resource_node": buildScrap(g, obj.id); break;
    case "survivor": case "npc": buildSurvivor(g, add); break;
    case "container": buildCrate(g); break;
    case "landmark": buildObelisk(g); break;
    case "artifact": case "map": case "note": buildOrb(g, add); break;
    case "terminal": case "machine": buildConsole(g, add, station); break;
    case "road": buildRoad(g); break;
    case "streetlamp": buildStreetlamp(g, add); break;
    case "trafficlight": buildTrafficLight(g, add); break;
    case "bench": buildBench(g); break;
    case "trashbin": buildTrashBin(g); break;
    case "mailbox": buildMailbox(g); break;
    case "hydrant": buildHydrant(g); break;
    case "busstop": buildBusStop(g); break;
    case "car": buildCar(g); break;
    case "truck": buildTruck(g); break;
    case "bus": buildBus(g); break;
    case "motorcycle": buildMotorcycle(g); break;
    case "bicycle": buildBicycle(g); break;
    case "boat": buildBoat(g); break;
    case "house": buildHouse(g); break;
    case "bed": buildBed(g); break;
    case "table": buildTable(g); break;
    case "chair": buildChair(g); break;
    case "sofa": buildSofa(g); break;
    case "floorlamp": buildFloorLamp(g); break;
    case "bookshelf": buildBookshelf(g); break;
    case "tv": buildTV(g, add); break;
    case "fridge": buildFridge(g); break;
    case "desk": buildDesk(g); break;
    case "watercooler": buildWaterCooler(g); break;
    case "printer": buildPrinter(g); break;
    case "bush": buildBush(g); break;
    case "flower": buildFlower(g); break;
    case "cactus": buildCactus(g); break;
    case "palmtree": buildPalmTree(g, add); break;
    case "pond": buildPond(g); break;
    case "fountain": buildFountain(g, add); break;
    case "statue": buildStatue(g); break;
    case "billboard": buildBillboard(g); break;
    case "windmill": buildWindmill(g, add); break;
    case "watertower": buildWaterTower(g); break;
    case "gaspump": buildGasPump(g); break;
    case "barrel": buildBarrel(g); break;
    case "ladder": buildLadder(g); break;
    case "telescope": buildTelescope(g); break;
    case "radio": buildRadio(g); break;
    case "phonebooth": buildPhoneBooth(g); break;
    case "train": buildTrain(g, add); break;
    case "rails": buildRails(g); break;
    case "platform": buildPlatform(g); break;
    case "ticketgate": buildTicketGate(g); break;
    case "tunnel": buildTunnel(g, add); break;
    case "stationsign": buildStationSign(g); break;
    case "shop": buildShop(g, add); break;
    case "hero": buildHero(g, add); break;
    case "powerup": buildPowerup(g, add); break;
    default: buildCrate(g); break;
  }
  // per-object material copies so highlight/pulse never leaks across objects
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      const mat = m.material as THREE.Material | THREE.Material[];
      m.material = Array.isArray(mat) ? mat.map((x) => x.clone()) : mat.clone();
    }
  });
  g.position.set(obj.position[0], obj.position[1], obj.position[2]);
  g.rotation.set(obj.rotation[0], obj.rotation[1], obj.rotation[2]);
  g.userData.objectId = obj.id;
  if (ticks.length > 0) {
    g.userData.tick = (t: number, dt?: number): void => { for (const f of ticks) f(t, dt); };
  }
  return g;
}
