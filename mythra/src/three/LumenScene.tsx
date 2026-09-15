// LumenScene — living Three.js world renderer + first-person controls (§14, §15.1, G9, V1/V2).
// WASD move, drag mouse to look, E interact, F toggles flight suit (if owned),
// Space/C ascend/descend while flying. Everything visible animates via update(t, dt).
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { World, WorldObject } from "../types";
import {
  Astronaut,
  Blinkers,
  Chibi,
  DustStorm,
  Fire,
  Flag,
  Hologram,
  Orbiter,
  ParticleColumn,
  ScanBar,
  TRIGGER_EVENT,
  TRIGGER_POP_SEC,
  WindRush,
  createSky,
  groundHeightAt,
  scatterCraters,
  scatterRocks,
  triggerScale,
} from "./effects";
import type { Updatable } from "./effects";
import type { AvatarBody } from "../game/suits";
import { createObjectMesh } from "./factory";
import type { TickFn } from "./factory";
import { BINDS_EVENT } from "../components/Controls";
import { isDown, loadBinds, prettyCode } from "../game/controls";
import type { Binds, ViewMode } from "../game/controls";

export interface PeerPresence {
  user: string;
  pos: [number, number, number];
  suit: number;
  accent: number;
  body: AvatarBody;
}

interface Props {
  world: World;
  flyMode: boolean;
  hasSuit: boolean;
  onInteractRequest: (obj: WorldObject) => void;
  onReachLocation: (locationId: string) => void;
  onPositionChange: (pos: [number, number, number]) => void;
  onToggleFlyRequest: () => void;
  onTargetChange?: (obj: WorldObject | null) => void;
  peers?: PeerPresence[];
  character: { suit: number; accent: number; body: AvatarBody };
  view: ViewMode;
  onToggleViewRequest: () => void;
  /** Canonical player position (store). The scene snaps to it when it jumps
   *  farther than a frame of movement can explain (restore / load / respawn). */
  home: [number, number, number];
  focusedObjectId?: string | null;
}

const GROUND_Y = 1.7;
const FLY_MAX = 45;
const JUMP_V = 5.6;
const GRAVITY = 13.5;

function turnTo(obj: THREE.Object3D, target: number, dt: number): void {
  let d = target - obj.rotation.y;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  obj.rotation.y += d * Math.min(1, dt * 5);
}

function findRootId(o: THREE.Object3D | null): string | null {
  let c: THREE.Object3D | null = o;
  while (c) {
    const id = (c.userData as { objectId?: string }).objectId;
    if (id) return id;
    c = c.parent;
  }
  return null;
}

function setGlow(root: THREE.Object3D, v: number): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      const mat = m.material as THREE.Material;
      if (mat instanceof THREE.MeshStandardMaterial) mat.emissiveIntensity = v;
    }
  });
}

function firstStd(root: THREE.Object3D): THREE.MeshStandardMaterial | null {  let out: THREE.MeshStandardMaterial | null = null;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!out && m.isMesh) {
      const mat = m.material as THREE.Material;
      if (mat instanceof THREE.MeshStandardMaterial) out = mat;
    }
  });
  return out;
}

/** Controls hint bar that mirrors the player's own bindings. */
function hintHTML(b: Binds): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const k = (a: keyof Binds) => `<span class="key sm">${esc(prettyCode(b[a][0]))}</span>`;
  return `WASD move · drag look · ${k("interact")} interact · Shift sprint · ${k("flyToggle")} fly · ${k("flyUp")}/${k("flyDown")} up/down · Space jump · V view`;
}

/** Floating username plate above a remote explorer. */
function makeNameTag(name: string): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "rgba(5,5,15,0.78)";
  g.fillRect(8, 8, 240, 48);
  g.strokeStyle = "#ffb45e";
  g.lineWidth = 3;
  g.strokeRect(8, 8, 240, 48);
  g.font = "bold 26px monospace";
  g.textAlign = "center";
  g.fillStyle = "#ffd9a8";
  g.fillText(name.slice(0, 14), 128, 43);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.35),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  m.position.y = 2.2;
  return m;
}

export default function LumenScene({ world, flyMode, hasSuit, onInteractRequest, onReachLocation, onPositionChange, onToggleFlyRequest, onTargetChange, peers, character, view, onToggleViewRequest, home }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    keys: new Set<string>(),
    yaw: Math.PI,
    pitch: -0.1,
    pos: new THREE.Vector3(0, GROUND_Y, 6),
    interactObj: null as WorldObject | null,
    lastLocCheck: 0,
    lastTargetId: null as string | null,
    lastPromptId: null as string | null,
    vy: 0,
    grounded: true,
  });
  const bindsRef = useRef(loadBinds());
  const peersRef = useRef<PeerPresence[]>(peers ?? []);
  peersRef.current = peers ?? [];
  const characterRef = useRef(character);
  characterRef.current = character;
  const homeRef = useRef<[number, number, number]>(home);
  homeRef.current = home;
  const viewRef = useRef<ViewMode>(view);
  viewRef.current = view;
  const callbacks = useRef({ onInteractRequest, onReachLocation, onPositionChange, onToggleFlyRequest, onTargetChange, onToggleViewRequest });
  callbacks.current = { onInteractRequest, onReachLocation, onPositionChange, onToggleFlyRequest, onTargetChange, onToggleViewRequest };
  const flags = useRef({ flyMode, hasSuit });
  flags.current = { flyMode, hasSuit };
  const worldRef = useRef(world);
  worldRef.current = world;

  const promptRef = useRef<HTMLDivElement>(null);
  const flightRef = useRef<HTMLDivElement>(null);
  const altRef = useRef<HTMLSpanElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const st = stateRef.current;
    const W = worldRef.current;
    const effects: Updatable[] = [];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(W.environment.skyColor);
    scene.fog = new THREE.Fog(new THREE.Color(W.environment.fogColor), 25, 130);

    const camera = new THREE.PerspectiveCamera(72, mount.clientWidth / mount.clientHeight, 0.1, 700);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    // --- sky dome, sun glow, stars, moon + orbiting satellite
    const sky = createSky(W.environment.skyColor, W.environment.fogColor);
    scene.add(sky);
    const starGeo = new THREE.BufferGeometry();
    {
      const n = 700;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const t = Math.random() * Math.PI * 2, p = Math.random() * Math.PI * 0.48;
        pos[i * 3] = Math.cos(t) * Math.cos(p) * 280;
        pos[i * 3 + 1] = Math.sin(p) * 280 + 5;
        pos[i * 3 + 2] = Math.sin(t) * Math.cos(p) * 280;
      }
      starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xc4b5fd, size: 0.9 }));
      stars.frustumCulled = false;
      scene.add(stars);
    }
    const orbiter = new Orbiter();
    scene.add(orbiter.group);
    effects.push(orbiter);

    // --- cinematic lighting with shadows
    scene.add(new THREE.HemisphereLight(0xfff1d6, 0x3b0f0f, W.environment.ambientIntensity));
    const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
    sun.position.set(-45, 38, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 160;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x8b5cf6, 0.7);
    rim.position.set(40, 20, -35);
    scene.add(rim);

    // --- terrain with relief (same formula the feet and objects use)
    const terrain = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240, 56, 56),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(W.environment.primaryColor), roughness: 1 })
    );
    terrain.rotation.x = -Math.PI / 2;
    const tp = terrain.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < tp.count; i++) {
      tp.setZ(i, groundHeightAt(tp.getX(i), tp.getY(i), W.theme));
    }
    terrain.geometry.computeVertexNormals();
    terrain.receiveShadow = true;
    scene.add(terrain);
    const rocks = scatterRocks(scene, W.settings.worldBounds, 130, W.environment.terrainSeed + 7);
    const craters = scatterCraters(scene, W.environment.terrainSeed + 21);

    // --- weather: drifting dust storm + flight wind rush
    const dust = new DustStorm(900, 75);
    scene.add(dust.object);
    effects.push(dust);
    const rush = new WindRush();
    scene.add(rush.object);

    // --- detailed world models (+ metadata-driven float/spin, per-model ticks)
    const group = new THREE.Group();
    scene.add(group);
    const meshes = new Map<string, THREE.Object3D>();
    const tickers: TickFn[] = [];
    const floaters: { mesh: THREE.Object3D; baseY: number; phase: number }[] = [];
    const spinners: { mesh: THREE.Object3D; speed: number }[] = [];
    const beaconMats: THREE.MeshBasicMaterial[] = [];
    const glints: { mat: THREE.MeshStandardMaterial; phase: number }[] = [];
    const trackers: { mesh: THREE.Object3D; base: number }[] = [];
    const byId = (id: string): THREE.Object3D | undefined => meshes.get(id);
    const rebuild = () => {
      group.clear();
      meshes.clear();
      tickers.length = 0;
      const liftAt = (x: number, z: number): number => groundHeightAt(x, z, W.theme);
      for (const o of W.objects) {
        const mesh = createObjectMesh(o, W.branding?.station ?? W.name);
        // sit the model ON the terrain instead of inside it
        mesh.position.y += Math.max(0, liftAt(mesh.position.x, mesh.position.z));
        group.add(mesh);
        meshes.set(o.id, mesh);
        const tick = (mesh.userData as { tick?: TickFn }).tick;
        if (tick) tickers.push(tick);
        const meta = o.metadata as { float?: boolean; spin?: boolean } | undefined;
        if (meta?.float) floaters.push({ mesh, baseY: mesh.position.y, phase: Math.random() * Math.PI * 2 });
        if (meta?.spin) spinners.push({ mesh, speed: 0.4 + Math.random() * 0.4 });
      }
      for (const l of W.locations) {
        const h = Math.max(0, liftAt(l.position[0], l.position[2]));
        const mat = new THREE.MeshBasicMaterial({ color: l.locked ? 0xef4444 : 0x22d3ee, transparent: true, opacity: 0.5 });
        const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 8), mat);
        beacon.position.set(l.position[0], 3 + h, l.position[2]);
        group.add(beacon);
        beaconMats.push(mat);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(l.radius - 0.3, l.radius, 40),
          new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(l.position[0], 0.05 + h, l.position[2]);
        group.add(ring);
      }
    };
    rebuild();

    // --- interact trigger FX: scale pop + shockwave ring + light flash,
    // --- so the exact object you hit visibly answers back.
    const pulses: { root: THREE.Object3D; base: THREE.Vector3; startMs: number }[] = [];
    const rings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; startMs: number }[] = [];
    const flash = new THREE.PointLight(0xffb45e, 0, 22, 1.8);
    scene.add(flash);
    const fireTrigger = (id: string) => {
      const root = meshes.get(id);
      if (!root) return;
      const wp = new THREE.Vector3();
      root.getWorldPosition(wp);
      pulses.push({ root, base: root.scale.clone(), startMs: performance.now() });
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffb45e, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 40), mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(wp.x, 0.08, wp.z);
      scene.add(ring);
      rings.push({ mesh: ring, mat, startMs: performance.now() });
      flash.position.set(wp.x, wp.y + 1.6, wp.z);
      flash.intensity = 30;
    };
    const onTrigger = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (typeof id === "string") fireTrigger(id);
    };
    window.addEventListener(TRIGGER_EVENT, onTrigger);

    const objPos = (id: string): THREE.Vector3 | null => {
      const o = W.objects.find((x) => x.id === id);
      return o ? new THREE.Vector3(o.position[0], o.position[1], o.position[2]) : null;
    };

    // --- machine life: blinking status lights on consoles + rover hazard
    const consoleSpots: [number, number, number][] = [[-0.3, 1.06, 0.3], [0, 1.1, 0.32], [0.3, 1.06, 0.3]];
    for (const id of ["obj_panel", "obj_terminal", "obj_controller", "obj_nav"]) {
      const m = byId(id);
      if (m) effects.push(new Blinkers(m, 3, [0x22ff88, 0xffaa00, 0xff3344], consoleSpots));
    }
    if (byId("obj_rover")) {
      effects.push(new Blinkers(byId("obj_rover")!, 2, [0xff3333, 0xff3333], [[-1.2, 1.62, 0], [1.2, 1.62, 0]]));
      const rp = objPos("obj_rover");
      if (rp) {
        const spot = new THREE.SpotLight(0xfff2c0, 120, 30, 0.5, 0.6, 1.4);
        spot.position.set(rp.x, rp.y + 1.6, rp.z);
        spot.target.position.set(rp.x + 6, 0, rp.z + 6);
        scene.add(spot, spot.target);
      }
    }

    // --- fire: habitat beacon pilot flame + landing memorial flame
    const beaconP = objPos("obj_beacon");
    if (beaconP) {
      const fire = new Fire(0.7, 10);
      fire.group.position.set(beaconP.x + 0.9, 0, beaconP.z + 0.6);
      scene.add(fire.group);
      effects.push(fire);
    }
    const memorial = new Fire(1.1, 16);
    memorial.group.position.set(3, 0, -3.5);
    scene.add(memorial.group);
    effects.push(memorial);

    // --- steam vent at the water station
    const water = W.locations.find((l) => l.id === "loc_water");
    if (water) {
      const steam = new ParticleColumn({
        count: 70, width: 0.9, height: 5.5, rise: 1.7, size: 0.55,
        startColor: 0xd7dee6, endColor: 0x2c313a, opacity: 0.45, drift: 0.8,
      });
      steam.group.position.set(water.position[0], 0.4, water.position[2]);
      scene.add(steam.group);
      effects.push(steam);
    }

    // --- hologram over the lab data core + slow core rotation
    const coreP = objPos("obj_datacore");
    if (coreP) {
      const holo = new Hologram(1);
      holo.group.position.set(coreP.x, 0.35, coreP.z);
      scene.add(holo.group);
      effects.push(holo);
      const core = byId("obj_datacore");
      if (core) spinners.push({ mesh: core, speed: 0.5 });
    }

    // --- lab door scan bar sweeping the hatch
    const doorP = objPos("obj_labdoor");
    if (doorP) {
      const scan = new ScanBar(1.4);
      scan.mesh.position.set(doorP.x, 1, doorP.z + 0.35);
      scene.add(scan.mesh);
      effects.push(scan);
    }

    // --- solar array tracks the sun (turret-style)
    const array = byId("obj_array");
    if (array) trackers.push({ mesh: array, base: array.rotation.y });

    // --- resource glint pulse
    for (const id of ["obj_metal_1", "obj_metal_2", "obj_circuit"]) {
      const m = byId(id);
      const std = m ? firstStd(m) : null;
      if (std) glints.push({ mat: std, phase: Math.random() * 6 });
    }

    // --- mission flag rippling at the landing zone
    const flag = new Flag(0xea580c);
    flag.group.position.set(-3, groundHeightAt(-3, -3, W.theme), -3);
    scene.add(flag.group);
    effects.push(flag);

    // --- you: third-person explorer in your picked body + suit, always visible
    let me: Astronaut | Chibi | null = null;
    let meSuit = -1;
    let meAccent = -1;
    let meBody: AvatarBody | "" = "";
    const dressMe = () => {
      const c = characterRef.current;
      if (me && meSuit === c.suit && meAccent === c.accent && meBody === c.body) return;
      if (me) {
        scene.remove(me.group);
        const idx = effects.indexOf(me);
        if (idx >= 0) effects.splice(idx, 1);
        me.dispose();
      }
      me = c.body === "chibi" ? new Chibi(c.suit, c.accent) : new Astronaut(c.suit, c.accent);
      meSuit = c.suit;
      meAccent = c.accent;
      meBody = c.body;
      scene.add(me.group);
      effects.push(me);
    };
    dressMe();
    // --- patrol astronaut: walks waypoints, waves when you approach
    const astro = new Astronaut();
    astro.group.position.set(2, 0, 4);
    scene.add(astro.group);
    effects.push(astro);
    // remote explorers (multiplayer presence), keyed by username
    const peerMap = new Map<string, { astro: Astronaut | Chibi; tag: THREE.Mesh; lastSeen: number; prevX: number; prevZ: number; body: AvatarBody }>();
    const patrol: [number, number][] = [[2, 4], [9, -3], [15, 3], [18, 7], [10, 11], [1, 9]];
    let wpIdx = 1;

    const raycaster = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0);
    let glowRoot: THREE.Object3D | null = null;

    const onReloadBinds = () => {
      bindsRef.current = loadBinds();
      if (hintRef.current) hintRef.current.innerHTML = hintHTML(bindsRef.current);
    };
    window.addEventListener(BINDS_EVENT, onReloadBinds);
    const onKeyDown = (e: KeyboardEvent) => {
      // don't hijack typing anywhere (journal, planner, login, contribute…)
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const typing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (el?.isContentEditable ?? false);
      if (typing && e.code !== "Escape") return;
      if (e.code === "Space") e.preventDefault();
      // Space must never re-trigger a focused button instead of the game
      if (el?.tagName === "BUTTON") el.blur();
      st.keys.add(e.code);
      const B = bindsRef.current;
      const flyingNow = flags.current.flyMode && flags.current.hasSuit;
      if (isDown("flyToggle", st.keys, B) && !e.repeat) callbacks.current.onToggleFlyRequest();
      if (e.code === "KeyV" && !e.repeat) callbacks.current.onToggleViewRequest();
      const interactKey = isDown("interact", st.keys, B) || e.key === "e" || e.key === "E";
      // ignore key-repeat for interact so holding E can't silently multi-fire
      if (interactKey && !e.repeat && st.interactObj) callbacks.current.onInteractRequest(st.interactObj);
      if (isDown("jump", st.keys, B) && !e.repeat && !flyingNow && st.grounded) {
        st.vy = JUMP_V;
        st.grounded = false;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => st.keys.delete(e.code);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let dragging = false, lx = 0, ly = 0, downAt = 0;
    const onDown = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; downAt = performance.now(); };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      // treat as look-drag only after a small movement threshold so clicks still interact
      if (Math.hypot(e.clientX - lx, e.clientY - ly) < 2) return;
      st.yaw -= (e.clientX - lx) * 0.004;
      st.pitch = Math.max(-1.2, Math.min(1.2, st.pitch - (e.clientY - ly) * 0.003));
      lx = e.clientX; ly = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      // click (not drag) on the 3D canvas = interact with current target (E fallback).
      // Scoped to the canvas so sidebar/modal clicks never misfire interactions.
      const onCanvas = e.target === renderer.domElement;
      const quick = performance.now() - downAt < 400;
      const still = Math.hypot((e as PointerEvent).clientX - lx, (e as PointerEvent).clientY - ly) < 6;
      dragging = false;
      if (onCanvas && quick && still && st.interactObj) callbacks.current.onInteractRequest(st.interactObj);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Timer();
    let raf = 0;
    const bounds = () => worldRef.current.settings.worldBounds;
    let snappedCam = false;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      clock.update();
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.getElapsed();
      const B = bindsRef.current;
      // flight suit (locker find) unlocks the sky — earn it in-world
      const flying = flags.current.flyMode && flags.current.hasSuit;
      const sprinting = isDown("sprint", st.keys, B);
      const speed = flying ? (sprinting && worldRef.current.settings.sprintEnabled ? 14 : 8) : (sprinting && worldRef.current.settings.sprintEnabled ? 9 : 4.5);
      const fwd = new THREE.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const move = new THREE.Vector3();
      if (isDown("forward", st.keys, B)) move.add(fwd);
      if (isDown("back", st.keys, B)) move.sub(fwd);
      if (isDown("left", st.keys, B)) move.sub(right);
      if (isDown("right", st.keys, B)) move.add(right);
      let vertical = 0;
      if (flying) {
        if (isDown("flyUp", st.keys, B)) vertical += 1;
        if (isDown("flyDown", st.keys, B)) vertical -= 1;
      }
      const moving = move.lengthSq() > 0 || vertical !== 0;
      if (moving) {
        if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);
        move.y = vertical * (sprinting ? 10 : 7) * dt;
        st.pos.add(move);
        const b = bounds();
        st.pos.x = Math.max(-b, Math.min(b, st.pos.x));
        st.pos.z = Math.max(-b, Math.min(b, st.pos.z));
        // feet ride the terrain: eye height above the local ground surface
        const floorNow = groundHeightAt(st.pos.x, st.pos.z, worldRef.current.theme) + GROUND_Y;
        st.pos.y = flying ? Math.max(floorNow + 0.3, Math.min(FLY_MAX, st.pos.y)) : st.pos.y;
        callbacks.current.onPositionChange([st.pos.x, st.pos.y, st.pos.z]);
      }
      const floorY = groundHeightAt(st.pos.x, st.pos.z, worldRef.current.theme) + GROUND_Y;
      if (!flying) {
        if (st.grounded) {
          if (st.pos.y > floorY + 0.05) {
            // suit just cut out mid-air (or a shove): fall, don't snap
            st.grounded = false;
            st.vy = 0;
          } else {
            st.pos.y = floorY;
          }
        }
        if (!st.grounded) {
          st.vy -= GRAVITY * dt;
          st.pos.y += st.vy * dt;
          if (st.pos.y <= floorY) {
            st.pos.y = floorY;
            st.vy = 0;
            st.grounded = true;
          }
          callbacks.current.onPositionChange([st.pos.x, st.pos.y, st.pos.z]);
        }
      } else {
        st.grounded = st.pos.y <= floorY + 0.01;
        if (st.grounded) st.vy = 0;
      }
      // restore / load teleports the canonical position — snap to it
      {
        const hp = homeRef.current;
        if (
          Math.abs(hp[0] - st.pos.x) > 1.5 ||
          Math.abs(hp[1] - st.pos.y) > 1.5 ||
          Math.abs(hp[2] - st.pos.z) > 1.5
        ) {
          st.pos.set(hp[0], hp[1], hp[2]);
          st.vy = 0;
          st.grounded = hp[1] <= groundHeightAt(hp[0], hp[2], worldRef.current.theme) + GROUND_Y + 0.01;
          snappedCam = false;
          callbacks.current.onPositionChange([st.pos.x, st.pos.y, st.pos.z]);
        }
      }
      // --- you, visible: avatar rides your position, camera floats above-behind
      // --- (third person) or sits at your eyes (first person, avatar hidden)
      dressMe();
      const third = viewRef.current === "third";
      if (me) {
        me.group.visible = third;
        if (third) {
          me.group.position.set(st.pos.x, st.pos.y - GROUND_Y, st.pos.z);
          me.group.rotation.y = st.yaw + Math.PI;
          me.state.moving = moving || !st.grounded;
          me.state.waving = false;
        }
      }
      if (!third) {
        camera.position.copy(st.pos);
        camera.rotation.set(0, 0, 0);
        camera.rotateY(st.yaw);
        camera.rotateX(st.pitch);
        snappedCam = false;
      } else {
        const back = 3.6;
        const desired = new THREE.Vector3(
          st.pos.x + Math.sin(st.yaw) * back,
          st.pos.y + 1.5 - st.pitch * 2.2,
          st.pos.z + Math.cos(st.yaw) * back,
        );
        if (!snappedCam) {
          camera.position.copy(desired);
          snappedCam = true;
        } else {
          camera.position.lerp(desired, 1 - Math.pow(0.0001, dt));
        }
        camera.lookAt(st.pos.x, st.pos.y - 0.15, st.pos.z);
      }
      const targetFov = flying ? 84 : 72;
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
        camera.updateProjectionMatrix();
      }
      rush.setFlight(camera.position, flying ? (moving ? 1 : 0.35) : 0);
      rush.update(t, dt);

      // --- everything alive
      for (const e of effects) e.update(t, dt);
      for (const tk of tickers) tk(t, dt);
      for (const f of floaters) f.mesh.position.y = f.baseY + Math.sin(t * 1.4 + f.phase) * 0.25;
      for (const s of spinners) s.mesh.rotation.y += s.speed * dt;
      for (let i = 0; i < beaconMats.length; i++) beaconMats[i].opacity = 0.35 + 0.2 * Math.sin(t * 2 + i);
      for (const gl of glints) gl.mat.emissiveIntensity = 0.25 + 0.22 * (0.5 + 0.5 * Math.sin(t * 3 + gl.phase));
      for (const tr of trackers) tr.mesh.rotation.y = tr.base + Math.sin(t * 0.08) * 0.5;

      // --- trigger pops + shockwave rings + flash decay
      {
        const nowMs = performance.now();
        for (let i = pulses.length - 1; i >= 0; i--) {
          const p = pulses[i];
          const age = (nowMs - p.startMs) / 1000;
          if (age > TRIGGER_POP_SEC + 0.05) {
            p.root.scale.copy(p.base);
            pulses.splice(i, 1);
            continue;
          }
          p.root.scale.copy(p.base).multiplyScalar(triggerScale(age));
        }
        for (let i = rings.length - 1; i >= 0; i--) {
          const r = rings[i];
          const age = (nowMs - r.startMs) / 1000;
          if (age > 0.8) {
            scene.remove(r.mesh);
            r.mesh.geometry.dispose();
            r.mat.dispose();
            rings.splice(i, 1);
            continue;
          }
          const s = 0.6 + age * 3.2;
          r.mesh.scale.set(s, s, s);
          r.mat.opacity = 0.85 * (1 - age / 0.8);
        }
        if (flash.intensity > 0) flash.intensity = Math.max(0, flash.intensity - dt * 90);
      }

      // --- astronaut patrol + greet (feet on the terrain like everyone)
      {
        const ap = astro.group.position;
        ap.y = groundHeightAt(ap.x, ap.z, worldRef.current.theme);
        const pdx = st.pos.x - ap.x, pdz = st.pos.z - ap.z;
        if (Math.hypot(pdx, pdz) < 5) {
          astro.state.waving = true;
          astro.state.moving = false;
          turnTo(astro.group, Math.atan2(pdx, pdz), dt);
        } else {
          astro.state.waving = false;
          const wp = patrol[wpIdx];
          const ddx = wp[0] - ap.x, ddz = wp[1] - ap.z;
          const dist = Math.hypot(ddx, ddz);
          if (dist < 0.6) {
            wpIdx = (wpIdx + 1) % patrol.length;
            astro.state.moving = false;
          } else {
            astro.state.moving = true;
            ap.x += (ddx / dist) * 1.4 * dt;
            ap.z += (ddz / dist) * 1.4 * dt;
            turnTo(astro.group, Math.atan2(ddx, ddz), dt);
          }
        }
      }

      // --- fellow explorers: remote presence in scenario suits + name tags
      {
        const nowMs = performance.now();
        for (const p of peersRef.current.slice(0, 12)) {
          let rec = peerMap.get(p.user);
          if (rec && rec.body !== p.body) {
            // peer swapped bodies — rebuild their explorer
            scene.remove(rec.astro.group);
            const idx = effects.indexOf(rec.astro);
            if (idx >= 0) effects.splice(idx, 1);
            rec.astro.dispose();
            peerMap.delete(p.user);
            rec = undefined;
          }
          if (!rec) {
            const astro = p.body === "chibi" ? new Chibi(p.suit, p.accent) : new Astronaut(p.suit, p.accent);
            const tag = makeNameTag(p.user);
            astro.group.add(tag);
            astro.group.position.set(p.pos[0], groundHeightAt(p.pos[0], p.pos[2], worldRef.current.theme), p.pos[2]);
            scene.add(astro.group);
            effects.push(astro);
            rec = { astro, tag, lastSeen: nowMs, prevX: p.pos[0], prevZ: p.pos[2], body: p.body };
            peerMap.set(p.user, rec);
          }
          rec.lastSeen = nowMs;
          const gx = rec.astro.group.position.x, gz = rec.astro.group.position.z;
          const dx = p.pos[0] - gx, dz = p.pos[2] - gz;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.15) {
            const step = Math.min(dist, 3.2 * dt);
            rec.astro.group.position.x += (dx / dist) * step;
            rec.astro.group.position.z += (dz / dist) * step;
            rec.astro.group.position.y = groundHeightAt(rec.astro.group.position.x, rec.astro.group.position.z, worldRef.current.theme);
            rec.astro.state.moving = true;
            turnTo(rec.astro.group, Math.atan2(dx, dz), dt);
          } else {
            rec.astro.state.moving = false;
          }
          rec.tag.lookAt(camera.position);
        }
        for (const [user, rec] of [...peerMap]) {
          if (nowMs - rec.lastSeen > 20000) {
            scene.remove(rec.astro.group);
            const idx = effects.indexOf(rec.astro);
            if (idx >= 0) effects.splice(idx, 1);
            rec.astro.dispose();
            peerMap.delete(user);
          }
        }
      }

      // interaction raycast (center of screen, recursive into detailed models)
      raycaster.setFromCamera(center, camera);
      raycaster.far = 7;
      const hits = raycaster.intersectObjects([...meshes.values()], true);
      const w = worldRef.current;
      if (glowRoot) { setGlow(glowRoot, 0.25); glowRoot = null; }
      if (hits.length > 0) {
        const id = findRootId(hits[0].object);
        const obj = w.objects.find((o) => o.id === id) ?? null;
        st.interactObj = obj;
        if (obj) {
          const root = meshes.get(obj.id);
          if (root) { setGlow(root, 0.9); glowRoot = root; }
        }
      } else {
        // generous proximity fallback so small ground items (scrap/drone) still prompt
        let best: WorldObject | null = null; let bestD = 4.5;
        for (const o of w.objects) {
          const d = Math.hypot(o.position[0] - st.pos.x, o.position[2] - st.pos.z);
          if (d < bestD) { bestD = d; best = o; }
        }
        st.interactObj = best;
        if (best) {
          const root = meshes.get(best.id);
          if (root) { setGlow(root, 0.9); glowRoot = root; }
        }
      }
      // gaming target popup — DOM updates only on target change, pop replays
      {
        const obj = st.interactObj;
        const pid = obj ? `t:${obj.id}` : null;
        if (pid !== st.lastPromptId) {
          st.lastPromptId = pid;
          const el = promptRef.current;
          if (el) {
            if (!obj) {
              el.style.display = "none";
            } else {
              el.style.display = "block";
              const name = obj.name.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
              const prompt = (obj.interaction?.prompt ?? `Inspect ${obj.name}`).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
              el.innerHTML = `<span class="th-name">${name}</span><span class="th-prompt">${prompt}</span><span class="key">E</span>`;
              el.classList.remove("th-pop");
              void el.offsetWidth;
              el.classList.add("th-pop");
            }
          }
        }
      }
      // voice-command target mirror (Play mic says "collect" -> uses this)
      {
        const curId = st.interactObj?.id ?? null;
        if (curId !== st.lastTargetId) {
          st.lastTargetId = curId;
          callbacks.current.onTargetChange?.(st.interactObj);
        }
      }

      if (flightRef.current) {
        flightRef.current.style.display = flags.current.hasSuit ? "block" : "none";
        if (altRef.current) altRef.current.textContent = flying ? `${st.pos.y.toFixed(0)}m · FLYING` : !st.grounded ? `${st.pos.y.toFixed(0)}m · descending` : "grounded";
      }

      // location check (throttled)
      const now = performance.now();
      if (now - st.lastLocCheck > 500) {
        st.lastLocCheck = now;
        for (const l of w.locations) {
          const d = Math.hypot(l.position[0] - st.pos.x, l.position[2] - st.pos.z);
          if (d < l.radius) callbacks.current.onReachLocation(l.id);
        }
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener(TRIGGER_EVENT, onTrigger);
      window.removeEventListener(BINDS_EVENT, onReloadBinds);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onResize);
      for (const r of rings) {
        scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mat.dispose();
      }
      for (const e of effects) e.dispose();
      for (const [, rec] of peerMap) rec.astro.dispose();
      peerMap.clear();
      rush.dispose();
      rocks.dispose();
      craters.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        }
      });
      sky.geometry.dispose();
      (sky.material as THREE.Material).dispose();
      starGeo.dispose();
      terrain.geometry.dispose();
      (terrain.material as THREE.Material).dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={mountRef} style={{ width: "100%", height: "100%", position: "relative", cursor: "crosshair" }}>
      <div className="reticle" />
      <div ref={promptRef} className="target-hud" style={{ display: "none" }} />
      <div ref={flightRef} className="suit-chip" style={{ display: "none", top: 52 }}>
        SUIT <span ref={altRef} style={{ color: "var(--th-accent)", fontWeight: 700 }}>grounded</span>
      </div>
      <div ref={hintRef} className="controls-hint" dangerouslySetInnerHTML={{ __html: hintHTML(loadBinds()) }} />
    </div>
  );
}
