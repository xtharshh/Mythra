// Living-world effects (§14, skills.md V1/V2): fire, steam, dust, holograms,
// orbiters, waving flag, blinking machines, animated astronaut.
// Every effect exposes update(t, dt) and dispose() — nothing static on screen.
import * as THREE from "three";

export interface Updatable {
  update(t: number, dt: number): void;
  dispose(): void;
}

function rand(seed: { v: number }): number {
  seed.v = (seed.v * 16807) % 2147483647;
  return seed.v / 2147483647;
}

/* ------------------------------------------------------------------ */
/* Rising particle column: fire (additive), steam (normal), motes.     */
/* ------------------------------------------------------------------ */
interface ColumnOpts {
  count: number;
  width: number;
  height: number;
  rise: number;
  size: number;
  startColor: THREE.ColorRepresentation;
  endColor: THREE.ColorRepresentation;
  blending?: THREE.Blending;
  opacity?: number;
  drift?: number;
}

export class ParticleColumn implements Updatable {
  readonly group = new THREE.Group();
  private geo = new THREE.BufferGeometry();
  private pts: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private start = new THREE.Color();
  private end = new THREE.Color();
  private opts: ColumnOpts;
  private seed = { v: 1234567 };

  constructor(opts: ColumnOpts) {
    this.opts = opts;
    this.start.set(opts.startColor);
    this.end.set(opts.endColor);
    const n = opts.count;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.life[i] = rand(this.seed) * 2;
      this.maxLife[i] = 0.8 + rand(this.seed) * 1.4;
      this.respawn(i, true);
    }
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: opts.size,
      vertexColors: true,
      transparent: true,
      opacity: opts.opacity ?? 0.9,
      depthWrite: false,
      blending: opts.blending ?? THREE.NormalBlending,
      sizeAttenuation: true,
    });
    this.pts = new THREE.Points(this.geo, mat);
    this.pts.frustumCulled = false;
    this.group.add(this.pts);
  }

  private respawn(i: number, randomAge = false): void {
    const o = this.opts;
    this.pos[i * 3] = (rand(this.seed) - 0.5) * o.width;
    this.pos[i * 3 + 1] = randomAge ? rand(this.seed) * o.height : 0;
    this.pos[i * 3 + 2] = (rand(this.seed) - 0.5) * o.width;
    this.vel[i * 3] = (rand(this.seed) - 0.5) * (o.drift ?? 0.4);
    this.vel[i * 3 + 1] = o.rise * (0.7 + rand(this.seed) * 0.6);
    this.vel[i * 3 + 2] = (rand(this.seed) - 0.5) * (o.drift ?? 0.4);
    this.life[i] = randomAge ? rand(this.seed) * this.maxLife[i] : 0;
  }

  update(_t: number, dt: number): void {
    const o = this.opts;
    const tmp = new THREE.Color();
    for (let i = 0; i < this.life.length; i++) {
      this.life[i] += dt;
      if (this.life[i] >= this.maxLife[i] || this.pos[i * 3 + 1] > o.height) {
        this.maxLife[i] = 0.8 + rand(this.seed) * 1.4;
        this.respawn(i);
        continue;
      }
      const k = this.life[i] / this.maxLife[i];
      this.pos[i * 3] += (this.vel[i * 3] + Math.sin(_t * 3 + i) * 0.25) * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      tmp.copy(this.start).lerp(this.end, k);
      const fade = 1 - k;
      this.col[i * 3] = tmp.r * fade + 0.02;
      this.col[i * 3 + 1] = tmp.g * fade + 0.02;
      this.col[i * 3 + 2] = tmp.b * fade + 0.02;
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    (this.pts.material as THREE.Material).dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Fire: particle column + glowing core + flickering light.             */
/* ------------------------------------------------------------------ */
export class Fire implements Updatable {
  readonly group = new THREE.Group();
  private column: ParticleColumn;
  private core: THREE.Mesh;
  private light: THREE.PointLight;
  private base: number;

  constructor(scale = 1, lightIntensity = 14) {
    this.column = new ParticleColumn({
      count: 90, width: 0.5 * scale, height: 2.2 * scale, rise: 1.8,
      size: 0.42 * scale, startColor: 0xffd23f, endColor: 0xff3d00,
      blending: THREE.AdditiveBlending, opacity: 0.95,
    });
    this.column.group.position.y = 0.3 * scale;
    this.group.add(this.column.group);
    this.core = new THREE.Mesh(
      new THREE.ConeGeometry(0.32 * scale, 0.9 * scale, 10),
      new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.core.position.y = 0.55 * scale;
    this.group.add(this.core);
    this.light = new THREE.PointLight(0xff8a2a, lightIntensity, 14 * scale, 1.6);
    this.light.position.y = 1.2 * scale;
    this.group.add(this.light);
    this.base = lightIntensity;
  }

  update(t: number, dt: number): void {
    this.column.update(t, dt);
    const flicker = 0.82 + 0.18 * Math.sin(t * 23) * Math.sin(t * 7.3 + 1.7);
    this.light.intensity = this.base * flicker;
    const s = 1 + 0.12 * Math.sin(t * 17);
    this.core.scale.set(s, 1 + 0.2 * Math.sin(t * 13 + 0.5), s);
  }

  dispose(): void {
    this.column.dispose();
    this.core.geometry.dispose();
    (this.core.material as THREE.Material).dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Dust storm: wind-blown particles wrapping around the play area.      */
/* ------------------------------------------------------------------ */
export class DustStorm implements Updatable {
  private geo = new THREE.BufferGeometry();
  private pts: THREE.Points;
  private pos: Float32Array;
  private count: number;
  private bounds: number;

  constructor(count = 900, bounds = 70) {
    this.count = count;
    this.bounds = bounds;
    this.pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.pos[i * 3] = (Math.random() - 0.5) * bounds * 2;
      this.pos[i * 3 + 1] = Math.random() * 9 + 0.2;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * bounds * 2;
    }
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.pts = new THREE.Points(this.geo, new THREE.PointsMaterial({
      color: 0xd98a5f, size: 0.14, transparent: true, opacity: 0.5, depthWrite: false,
    }));
    this.pts.frustumCulled = false;
  }

  get object(): THREE.Points { return this.pts; }

  update(t: number, dt: number): void {
    const b = this.bounds;
    for (let i = 0; i < this.count; i++) {
      this.pos[i * 3] += (3.2 + Math.sin(t * 0.7 + i) * 1.2) * dt;
      this.pos[i * 3 + 1] += Math.sin(t * 1.3 + i * 1.7) * 0.35 * dt;
      this.pos[i * 3 + 2] += Math.cos(t * 0.5 + i * 0.6) * 0.8 * dt;
      if (this.pos[i * 3] > b) this.pos[i * 3] = -b;
      if (this.pos[i * 3 + 2] > b) this.pos[i * 3 + 2] = -b;
      if (this.pos[i * 3 + 2] < -b) this.pos[i * 3 + 2] = b;
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    (this.pts.material as THREE.Material).dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Hologram: counter-rotating rings + rising motes + glow.              */
/* ------------------------------------------------------------------ */
export class Hologram implements Updatable {
  readonly group = new THREE.Group();
  private rings: THREE.Mesh[] = [];
  private motes: ParticleColumn;
  private light: THREE.PointLight;

  constructor(radius = 1) {
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * (0.55 + i * 0.28), 0.03, 8, 48),
        new THREE.MeshBasicMaterial({ color: i === 1 ? 0x8b5cf6 : 0x22d3ee, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      ring.rotation.x = Math.PI / 2 + (i - 1) * 0.35;
      this.rings.push(ring);
      this.group.add(ring);
    }
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.5, 32),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.02;
    this.group.add(disc);
    this.motes = new ParticleColumn({
      count: 50, width: radius, height: 2.4, rise: 0.7, size: 0.12,
      startColor: 0x67e8f9, endColor: 0x1e1b4b, blending: THREE.AdditiveBlending, opacity: 0.9,
    });
    this.group.add(this.motes.group);
    this.light = new THREE.PointLight(0x22d3ee, 8, 12, 1.8);
    this.light.position.y = 1;
    this.group.add(this.light);
  }

  update(t: number, dt: number): void {
    this.rings[0].rotation.z = t * 0.9;
    this.rings[1].rotation.z = -t * 0.6;
    this.rings[2].rotation.z = t * 0.35;
    this.group.position.y += Math.sin(t * 2) * 0.0006;
    this.motes.update(t, dt);
    this.light.intensity = 7 + Math.sin(t * 4) * 1.5;
  }

  dispose(): void {
    for (const r of this.rings) { r.geometry.dispose(); (r.material as THREE.Material).dispose(); }
    this.motes.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Satellite orbiter + moon.                                            */
/* ------------------------------------------------------------------ */
export class Orbiter implements Updatable {
  readonly group = new THREE.Group();
  private pivot = new THREE.Group();
  private sat = new THREE.Group();
  private beacon: THREE.Mesh;
  private moon: THREE.Mesh;

  constructor() {
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(9, 24, 18),
      new THREE.MeshStandardMaterial({ color: 0xcfc4e8, roughness: 0.95, emissive: 0x4c3a78, emissiveIntensity: 0.25 })
    );
    this.moon.position.set(120, 95, -160);
    this.group.add(this.moon);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x9aa7bd, metalness: 0.85, roughness: 0.3 })
    );
    this.sat.add(body);
    const panelGeo = new THREE.BoxGeometry(3.4, 0.08, 1.2);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.6, roughness: 0.35, emissive: 0x1e3a8a, emissiveIntensity: 0.5 });
    const p1 = new THREE.Mesh(panelGeo, panelMat);
    p1.position.x = 2.4;
    const p2 = new THREE.Mesh(panelGeo, panelMat);
    p2.position.x = -2.4;
    this.sat.add(p1, p2);
    const dish = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 0.6, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide })
    );
    dish.position.y = -0.9;
    dish.rotation.x = Math.PI;
    this.sat.add(dish);
    this.beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2222 })
    );
    this.beacon.position.y = 0.7;
    this.sat.add(this.beacon);
    this.sat.position.set(46, 0, 0);
    this.pivot.add(this.sat);
    this.pivot.position.set(0, 62, -40);
    this.group.add(this.pivot);
  }

  update(t: number, _dt: number): void {
    this.pivot.rotation.y = t * 0.05; // slow orbit across the sky
    this.sat.rotation.y = t * 0.4;
    this.sat.position.y = Math.sin(t * 0.5) * 2;
    (this.beacon.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(t * 6) > 0 ? 0xff2222 : 0x440000);
    this.moon.rotation.y = t * 0.01;
  }

  dispose(): void {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const m = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
  }
}

/* ------------------------------------------------------------------ */
/* Waving flag (vertex animation).                                      */
/* ------------------------------------------------------------------ */
export class Flag implements Updatable {
  readonly group = new THREE.Group();
  private cloth: THREE.Mesh;
  private base: Float32Array;

  constructor(color = 0xea580c) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 3.4, 10),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.8, roughness: 0.35 })
    );
    pole.position.y = 1.7;
    pole.castShadow = true;
    this.group.add(pole);
    const geo = new THREE.PlaneGeometry(1.5, 0.9, 14, 8);
    this.base = (geo.attributes.position.array as Float32Array).slice();
    this.cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.8, emissive: color, emissiveIntensity: 0.15 }));
    this.cloth.position.set(0.8, 2.85, 0);
    this.cloth.castShadow = true;
    this.group.add(this.cloth);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff7cc })
    );
    lamp.position.y = 3.45;
    this.group.add(lamp);
  }

  update(t: number, _dt: number): void {
    const p = this.cloth.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = this.base[i * 3];
      const k = (x + 0.75) / 1.5; // 0 at pole → 1 at free edge
      p.setZ(i, Math.sin(x * 4.2 - t * 5.2) * 0.16 * k + Math.sin(x * 9 - t * 8.5) * 0.04 * k);
      p.setY(i, this.base[i * 3 + 1] + Math.sin(x * 3 - t * 4) * 0.03 * k);
    }
    p.needsUpdate = true;
    this.cloth.geometry.computeVertexNormals();
  }

  dispose(): void {
    this.cloth.geometry.dispose();
    (this.cloth.material as THREE.Material).dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Machine blinkers: status lights that pulse on a host mesh.          */
/* ------------------------------------------------------------------ */
export class Blinkers implements Updatable {
  private items: { mesh: THREE.Mesh; base: THREE.Color; phase: number; speed: number }[] = [];
  private host: THREE.Object3D;

  constructor(host: THREE.Object3D, count = 3, colors: number[] = [0x22ff88, 0xffaa00, 0xff3344], spots?: [number, number, number][]) {
    this.host = host;
    const seed = { v: 987654 };
    for (let i = 0; i < count; i++) {
      const base = new THREE.Color(colors[i % colors.length]);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 8),
        new THREE.MeshBasicMaterial({ color: base.clone() })
      );
      const s = spots?.[i % spots.length];
      if (s) mesh.position.set(s[0], s[1], s[2]);
      else mesh.position.set(-0.35 + (i * 0.7) / Math.max(1, count - 1), 0.56, 0.42);
      host.add(mesh);
      this.items.push({ mesh, base, phase: rand(seed) * Math.PI * 2, speed: 2 + rand(seed) * 4 });
    }
  }

  update(t: number, _dt: number): void {
    for (const it of this.items) {
      const on = Math.sin(t * it.speed + it.phase) > -0.1;
      (it.mesh.material as THREE.MeshBasicMaterial).color.copy(it.base).multiplyScalar(on ? 1 : 0.12);
    }
  }

  dispose(): void {
    for (const it of this.items) {
      this.host.remove(it.mesh);
      it.mesh.geometry.dispose();
      (it.mesh.material as THREE.Material).dispose();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Lab-door scan bar: red light sweeping vertically.                    */
/* ------------------------------------------------------------------ */
export class ScanBar implements Updatable {
  readonly mesh: THREE.Mesh;
  private min: number;
  private max: number;

  constructor(width = 1.5, minY = 0.25, maxY = 1.9) {
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.05, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.min = minY;
    this.max = maxY;
  }

  update(t: number, _dt: number): void {
    const k = (Math.sin(t * 1.6) + 1) / 2;
    this.mesh.position.y = this.min + (this.max - this.min) * k;
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.4 * Math.sin(t * 9);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Astronaut: articulated suit — idle breath, head scan, walk swing,    */
/* wave when the player is near.                                        */
/* ------------------------------------------------------------------ */
export interface AstroState {
  moving: boolean;
  waving: boolean;
}

export class Astronaut implements Updatable {
  readonly group = new THREE.Group();
  readonly state: AstroState = { moving: false, waving: false };
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private helmet = new THREE.Group();
  private torso = new THREE.Mesh();
  private phase = 0;

  constructor(suitColor = 0xe8e4da, accentColor = 0xea580c) {
    const suit = new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.6, metalness: 0.1 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.7 });
    const accent = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5, emissive: accentColor, emissiveIntensity: 0.25 });

    const limb = (r: number, len: number, mat: THREE.Material): THREE.Mesh => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
      m.castShadow = true;
      return m;
    };

    for (const [pivot, x] of [[this.legL, -0.13], [this.legR, 0.13]] as const) {
      const leg = limb(0.09, 0.5, suit);
      leg.position.y = -0.38;
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.26), dark);
      boot.position.set(0, -0.72, 0.04);
      boot.castShadow = true;
      pivot.add(leg, boot);
      pivot.position.set(x, 0.85, 0);
      this.group.add(pivot);
    }

    this.torso = limb(0.24, 0.5, suit);
    this.torso.position.y = 1.2;
    const chestLamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
    chestLamp.position.set(0.1, 1.32, 0.24);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.24), dark);
    pack.position.set(0, 1.25, -0.3);
    pack.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.5), accent);
    stripe.position.y = 1.02;
    this.group.add(this.torso, chestLamp, pack, stripe);

    for (const [pivot, x] of [[this.armL, -0.34], [this.armR, 0.34]] as const) {
      const arm = limb(0.07, 0.42, suit);
      arm.position.y = -0.28;
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), dark);
      glove.position.y = -0.55;
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.15), accent);
      band.position.y = -0.12;
      pivot.add(arm, glove, band);
      pivot.position.set(x, 1.45, 0);
      pivot.rotation.z = x > 0 ? -0.12 : 0.12;
      this.group.add(pivot);
    }

    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 14), suit);
    helm.castShadow = true;
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.165, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0x0b1020, metalness: 1, roughness: 0.08, emissive: 0x164e63, emissiveIntensity: 0.6 })
    );
    visor.scale.set(1, 0.82, 0.72);
    visor.position.z = 0.075;
    this.helmet.add(helm, visor);
    this.helmet.position.y = 1.68;
    this.group.add(this.helmet);
    this.group.traverse((o) => { o.frustumCulled = false; });
  }

  update(t: number, dt: number): void {
    const speed = this.state.moving ? 7 : 1.6;
    this.phase += dt * speed;
    const swing = this.state.moving ? 0.62 : 0.045;
    const s = Math.sin(this.phase);
    this.legL.rotation.x = s * swing;
    this.legR.rotation.x = -s * swing;
    if (this.state.waving) {
      // raised right arm waving hello
      this.armR.rotation.z = -2.35 + Math.sin(t * 9) * 0.35;
      this.armR.rotation.x = 0;
      this.armL.rotation.x = -s * 0.1;
      this.helmet.rotation.y = Math.sin(t * 1.2) * 0.15;
    } else {
      this.armL.rotation.x = -s * swing * 0.8;
      this.armR.rotation.x = s * swing * 0.8;
      this.armL.rotation.z = 0.12;
      this.armR.rotation.z = -0.12;
      // slow head scan when idle
      this.helmet.rotation.y = this.state.moving ? Math.sin(this.phase * 0.25) * 0.1 : Math.sin(t * 0.45) * 0.55;
    }
    // breathing / walk bob
    this.group.position.y += 0; // base position owned by scene
    this.torso.position.y = 1.2 + (this.state.moving ? Math.abs(Math.cos(this.phase)) * 0.05 : Math.sin(t * 1.6) * 0.012);
    this.helmet.rotation.x = this.state.moving ? 0.06 : Math.sin(t * 0.8) * 0.04;
  }

  dispose(): void {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const m = mesh.material as THREE.Material | THREE.Material[];
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
  }
}

/* ------------------------------------------------------------------ */
/* Wind rush: air streaming past the camera while flying fast.          */
/* ------------------------------------------------------------------ */
export class WindRush implements Updatable {
  private geo = new THREE.BufferGeometry();
  private pts: THREE.Points;
  private mat: THREE.PointsMaterial;
  private pos: Float32Array;
  private count = 140;
  private box = 16;
  private center = new THREE.Vector3();
  private strength = 0;

  constructor() {
    this.pos = new Float32Array(this.count * 3);
    for (let i = 0; i < this.count; i++) this.reset(i);
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ color: 0xe8f4ff, size: 0.09, transparent: true, opacity: 0, depthWrite: false });
    this.pts = new THREE.Points(this.geo, this.mat);
    this.pts.frustumCulled = false;
  }

  get object(): THREE.Points { return this.pts; }

  setFlight(center: THREE.Vector3, strength: number): void {
    this.center.copy(center);
    this.strength = strength;
  }

  private reset(i: number): void {
    const b = this.box;
    this.pos[i * 3] = this.center.x + (Math.random() - 0.5) * b;
    this.pos[i * 3 + 1] = this.center.y + (Math.random() - 0.5) * b * 0.7;
    this.pos[i * 3 + 2] = this.center.z + (Math.random() - 0.5) * b;
  }

  update(t: number, dt: number): void {
    const b = this.box;
    this.mat.opacity += ((this.strength > 0.02 ? 0.6 : 0) - this.mat.opacity) * Math.min(1, dt * 3);
    if (this.mat.opacity < 0.01) return;
    const fall = (2 + this.strength * 14) * dt;
    for (let i = 0; i < this.count; i++) {
      this.pos[i * 3 + 1] -= fall;
      this.pos[i * 3] += Math.sin(t * 2 + i) * dt * 0.6;
      if (this.pos[i * 3 + 1] < this.center.y - b * 0.35) this.reset(i);
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Scattered rocks + craters for realistic terrain dressing.            */
/* ------------------------------------------------------------------ */
export function scatterRocks(scene: THREE.Scene, bounds: number, count = 130, seedStart = 4242): THREE.InstancedMesh {
  const geo = new THREE.DodecahedronGeometry(0.6, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a4632, roughness: 1 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const seed = { v: seedStart };
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = rand(seed) * Math.PI * 2;
    const r = 12 + rand(seed) * (bounds + 8);
    dummy.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r);
    dummy.rotation.set(rand(seed) * 3, rand(seed) * 3, rand(seed) * 3);
    const s = 0.3 + rand(seed) * rand(seed) * 2.4;
    dummy.scale.set(s, s * (0.6 + rand(seed) * 0.5), s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.04 + rand(seed) * 0.03, 0.45, 0.22 + rand(seed) * 0.14);
    mesh.setColorAt(i, color);
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

export function scatterCraters(scene: THREE.Scene, seedStart = 777): THREE.Group {
  const group = new THREE.Group();
  const seed = { v: seedStart };
  const mat = new THREE.MeshBasicMaterial({ color: 0x5e2318, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 9; i++) {
    const r = 2 + rand(seed) * 4;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.7, r, 28), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set((rand(seed) - 0.5) * 110, 0.06, (rand(seed) - 0.5) * 110);
    group.add(ring);
  }
  scene.add(group);
  return group;
}

/* ------------------------------------------------------------------ */
/* Gradient sky dome with sun glow.                                     */
/* ------------------------------------------------------------------ */
export function createSky(topColor: string, horizonColor: string): THREE.Mesh {
  const geo = new THREE.SphereGeometry(320, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(topColor) },
      horizon: { value: new THREE.Color(horizonColor) },
      sunDir: { value: new THREE.Vector3(-0.55, 0.28, 0.2).normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, -1.0, 1.0);
        vec3 col = mix(horizon, top, smoothstep(0.0, 0.65, h));
        col = mix(col, horizon * 0.55, smoothstep(0.0, -0.4, h));
        float sun = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 220.0);
        float glow = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 6.0);
        col += vec3(1.0, 0.75, 0.5) * sun * 1.6 + vec3(0.9, 0.4, 0.25) * glow * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.frustumCulled = false;
  return dome;
}
