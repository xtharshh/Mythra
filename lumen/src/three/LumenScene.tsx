// LumenScene — living Three.js world renderer + first-person controls (§14, §15.1, G9, V1/V2).
// WASD move, drag mouse to look, E interact, F toggles flight suit (if owned),
// Space/C ascend/descend while flying. Everything visible animates via update(t, dt).
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { World, WorldObject } from "../types";
import {
  Astronaut,
  Blinkers,
  DustStorm,
  Fire,
  Flag,
  Hologram,
  Orbiter,
  ParticleColumn,
  ScanBar,
  WindRush,
  createSky,
  scatterCraters,
  scatterRocks,
} from "./effects";
import type { Updatable } from "./effects";
import { createObjectMesh } from "./factory";
import type { TickFn } from "./factory";

interface Props {
  world: World;
  flyMode: boolean;
  hasSuit: boolean;
  onInteractRequest: (obj: WorldObject) => void;
  onReachLocation: (locationId: string) => void;
  onPositionChange: (pos: [number, number, number]) => void;
  onToggleFlyRequest: () => void;
  onTargetChange?: (obj: WorldObject | null) => void;
  focusedObjectId?: string | null;
}

const GROUND_Y = 1.7;
const FLY_MIN = 1.2;
const FLY_MAX = 45;

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

function firstStd(root: THREE.Object3D): THREE.MeshStandardMaterial | null {
  let out: THREE.MeshStandardMaterial | null = null;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!out && m.isMesh) {
      const mat = m.material as THREE.Material;
      if (mat instanceof THREE.MeshStandardMaterial) out = mat;
    }
  });
  return out;
}

export default function LumenScene({ world, flyMode, hasSuit, onInteractRequest, onReachLocation, onPositionChange, onToggleFlyRequest, onTargetChange }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    keys: new Set<string>(),
    yaw: Math.PI,
    pitch: -0.1,
    pos: new THREE.Vector3(0, GROUND_Y, 6),
    interactObj: null as WorldObject | null,
    lastLocCheck: 0,
    lastTargetId: null as string | null,
  });
  const callbacks = useRef({ onInteractRequest, onReachLocation, onPositionChange, onToggleFlyRequest, onTargetChange });
  callbacks.current = { onInteractRequest, onReachLocation, onPositionChange, onToggleFlyRequest, onTargetChange };
  const flags = useRef({ flyMode, hasSuit });
  flags.current = { flyMode, hasSuit };
  const worldRef = useRef(world);
  worldRef.current = world;

  const promptRef = useRef<HTMLDivElement>(null);
  const flightRef = useRef<HTMLDivElement>(null);
  const altRef = useRef<HTMLSpanElement>(null);

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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

    // --- terrain with relief
    const terrain = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240, 56, 56),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(W.environment.primaryColor), roughness: 1 })
    );
    terrain.rotation.x = -Math.PI / 2;
    const tp = terrain.geometry.attributes.position as THREE.BufferAttribute;
    let seed = W.environment.terrainSeed;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i), y = tp.getY(i);
      tp.setZ(i, Math.sin(x * 0.15) * Math.cos(y * 0.13) * 1.2 + Math.sin(x * 0.05 + 2) * 0.8 + rand() * 0.35);
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
      for (const o of W.objects) {
        const mesh = createObjectMesh(o);
        group.add(mesh);
        meshes.set(o.id, mesh);
        const tick = (mesh.userData as { tick?: TickFn }).tick;
        if (tick) tickers.push(tick);
        const meta = o.metadata as { float?: boolean; spin?: boolean } | undefined;
        if (meta?.float) floaters.push({ mesh, baseY: o.position[1], phase: Math.random() * Math.PI * 2 });
        if (meta?.spin) spinners.push({ mesh, speed: 0.4 + Math.random() * 0.4 });
      }
      for (const l of W.locations) {
        const mat = new THREE.MeshBasicMaterial({ color: l.locked ? 0xef4444 : 0x22d3ee, transparent: true, opacity: 0.5 });
        const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 8), mat);
        beacon.position.set(l.position[0], 3, l.position[2]);
        group.add(beacon);
        beaconMats.push(mat);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(l.radius - 0.3, l.radius, 40),
          new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(l.position[0], 0.05, l.position[2]);
        group.add(ring);
      }
    };
    rebuild();

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
    flag.group.position.set(-3, 0, -3);
    scene.add(flag.group);
    effects.push(flag);

    // --- astronaut on patrol: walks waypoints, waves when you approach
    const astro = new Astronaut();
    astro.group.position.set(2, 0, 4);
    scene.add(astro.group);
    effects.push(astro);
    const patrol: [number, number][] = [[2, 4], [9, -3], [15, 3], [18, 7], [10, 11], [1, 9]];
    let wpIdx = 1;

    const raycaster = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0);
    let glowRoot: THREE.Object3D | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") e.preventDefault();
      // don't hijack typing in inputs / modals
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.code !== "Escape") return;
      }
      st.keys.add(e.code);
      const isInteract = e.code === "KeyE" || e.key === "e" || e.key === "E";
      // ignore key-repeat for interact so holding E can't silently multi-fire
      if (isInteract && !e.repeat && st.interactObj) callbacks.current.onInteractRequest(st.interactObj);
      if (e.code === "KeyF") callbacks.current.onToggleFlyRequest();
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

    const clock = new THREE.Clock();
    let raf = 0;
    const bounds = () => worldRef.current.settings.worldBounds;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      const flying = flags.current.flyMode && flags.current.hasSuit;
      const sprinting = st.keys.has("ShiftLeft") || st.keys.has("ShiftRight");
      const speed = flying ? (sprinting && worldRef.current.settings.sprintEnabled ? 14 : 8) : (sprinting && worldRef.current.settings.sprintEnabled ? 9 : 4.5);
      const fwd = new THREE.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const move = new THREE.Vector3();
      if (st.keys.has("KeyW")) move.add(fwd);
      if (st.keys.has("KeyS")) move.sub(fwd);
      if (st.keys.has("KeyA")) move.sub(right);
      if (st.keys.has("KeyD")) move.add(right);
      let vertical = 0;
      if (flying) {
        if (st.keys.has("Space")) vertical += 1;
        if (st.keys.has("KeyC") || st.keys.has("ControlLeft")) vertical -= 1;
      }
      const moving = move.lengthSq() > 0 || vertical !== 0;
      if (moving) {
        if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);
        move.y = vertical * (sprinting ? 9 : 6) * dt;
        st.pos.add(move);
        const b = bounds();
        st.pos.x = Math.max(-b, Math.min(b, st.pos.x));
        st.pos.z = Math.max(-b, Math.min(b, st.pos.z));
        st.pos.y = flying ? Math.max(FLY_MIN, Math.min(FLY_MAX, st.pos.y)) : GROUND_Y;
        callbacks.current.onPositionChange([st.pos.x, st.pos.y, st.pos.z]);
      }
      if (!flying && st.pos.y > GROUND_Y) {
        st.pos.y = Math.max(GROUND_Y, st.pos.y - 6 * dt);
        callbacks.current.onPositionChange([st.pos.x, st.pos.y, st.pos.z]);
      }
      camera.position.copy(st.pos);
      camera.rotation.set(0, 0, 0);
      camera.rotateY(st.yaw);
      camera.rotateX(st.pitch);
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

      // --- astronaut patrol + greet
      {
        const ap = astro.group.position;
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
        if (promptRef.current) {
          promptRef.current.style.display = "block";
          promptRef.current.textContent = `${obj?.interaction?.prompt ?? `Inspect ${obj?.name ?? ""}`} [E / click]`;
        }
      } else {
        // generous proximity fallback so small ground items (scrap/drone) still prompt
        let best: WorldObject | null = null; let bestD = 4.5;
        for (const o of w.objects) {
          const d = Math.hypot(o.position[0] - st.pos.x, o.position[2] - st.pos.z);
          if (d < bestD) { bestD = d; best = o; }
        }
        st.interactObj = best;
        if (promptRef.current) {
          if (best) {
            promptRef.current.style.display = "block";
            promptRef.current.textContent = `${best.interaction?.prompt ?? "Inspect " + best.name} [E / click]`;
            const root = meshes.get(best.id);
            if (root) { setGlow(root, 0.9); glowRoot = root; }
          } else promptRef.current.style.display = "none";
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
        if (altRef.current) altRef.current.textContent = flying ? `${st.pos.y.toFixed(0)}m · FLYING` : st.pos.y > GROUND_Y + 0.2 ? `${st.pos.y.toFixed(0)}m · descending` : "grounded";
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
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onResize);
      for (const e of effects) e.dispose();
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
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 8, height: 8, marginLeft: -4, marginTop: -4, borderRadius: "50%", background: "#22d3ee", opacity: 0.9, pointerEvents: "none" }} />
      <div ref={promptRef} style={{ position: "absolute", left: "50%", bottom: 90, transform: "translateX(-50%)", display: "none", background: "rgba(10,10,25,.85)", border: "1px solid #22d3ee", color: "#e2e8f0", padding: "8px 14px", borderRadius: 8, fontSize: 14, pointerEvents: "none" }} />
      <div ref={flightRef} style={{ display: "none", position: "absolute", right: 12, top: 12, background: "rgba(8,20,30,.8)", border: "1px solid #22d3ee", borderRadius: 10, padding: "8px 12px", fontSize: 13, pointerEvents: "none" }}>
        🛰️ suit <span ref={altRef} style={{ color: "#22d3ee", fontWeight: 700 }}>grounded</span>
      </div>
      <div style={{ position: "absolute", left: 12, bottom: 12, color: "#94a3b8", fontSize: 12, background: "rgba(0,0,0,.5)", padding: "6px 10px", borderRadius: 6 }}>
        WASD move · drag mouse to look · E interact · Shift sprint · F fly · Space/C up/down
      </div>
    </div>
  );
}
