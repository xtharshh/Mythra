// HeroScene — lightweight 3D animated background for the dossier landing.
// Mars + starfield + drifting dust + orbiter. Cheap by design (capped DPR,
// ~4 draw batches) and static when prefers-reduced-motion is set.
import { useEffect, useRef } from "react";
import * as THREE from "three";

function marsTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  const base = g.createLinearGradient(0, 0, 0, 256);
  base.addColorStop(0, "#d97a4e");
  base.addColorStop(0.5, "#c1553b");
  base.addColorStop(1, "#7c2d1e");
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 256);
  // darker maria blotches
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * 512, y = 60 + Math.random() * 150, r = 8 + Math.random() * 30;
    const blot = g.createRadialGradient(x, y, 0, x, y, r);
    blot.addColorStop(0, "rgba(60,18,8,0.5)");
    blot.addColorStop(1, "rgba(60,18,8,0)");
    g.fillStyle = blot;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // polar cap
  g.fillStyle = "rgba(243,231,211,0.9)";
  g.fillRect(0, 0, 512, 14);
  g.fillStyle = "rgba(243,231,211,0.35)";
  g.fillRect(0, 14, 512, 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function HeroScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 0.4, 7);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffd9b0, 0x2b0f0a, 0.9));
    const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
    sun.position.set(-5, 2.5, 4);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x8b5cf6, 0.8);
    rim.position.set(5, -1, -4);
    scene.add(rim);

    // stars
    const starGeo = new THREE.BufferGeometry();
    {
      const n = 420;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const r = 14 + Math.random() * 22;
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
        pos[i * 3 + 1] = r * Math.cos(ph) * 0.6;
        pos[i * 3 + 2] = -Math.abs(r * Math.sin(ph) * Math.sin(th)) - 2;
      }
      starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffd9b0, size: 0.06, transparent: true, opacity: 0.85 })));
    }

    // mars
    const map = marsTexture();
    const mars = new THREE.Mesh(
      new THREE.SphereGeometry(1.9, 40, 28),
      new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0 }),
    );
    mars.position.set(2.4, 0.1, 0);
    scene.add(mars);
    // thin atmosphere rim
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(2.02, 40, 28),
      new THREE.MeshBasicMaterial({ color: 0xff8a4e, transparent: true, opacity: 0.12, side: THREE.BackSide }),
    );
    glow.position.copy(mars.position);
    scene.add(glow);

    // orbiter: small bus + panels circling mars
    const orbiter = new THREE.Group();
    const bus = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: 0x9aa7bd, metalness: 0.85, roughness: 0.3 }));
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.16), new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.6, roughness: 0.35, emissive: 0x1e3a8a, emissiveIntensity: 0.6 }));
    orbiter.add(bus, wing);
    scene.add(orbiter);

    // dust motes drifting past camera
    const dustGeo = new THREE.BufferGeometry();
    const DUST = 160;
    const dustPos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 12;
      dustPos[i * 3 + 1] = (Math.random() - 0.5) * 6;
      dustPos[i * 3 + 2] = Math.random() * 6 - 1;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xd98a5f, size: 0.035, transparent: true, opacity: 0.6, depthWrite: false }));
    scene.add(dust);

    let px = 0, py = 0;
    const onPointer = (e: PointerEvent) => {
      px = (e.clientX / window.innerWidth - 0.5) * 0.6;
      py = (e.clientY / window.innerHeight - 0.5) * 0.4;
    };
    window.addEventListener("pointermove", onPointer);

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const timer = new THREE.Timer();
    let raf = 0;
    const render = () => {
      timer.update();
      const t = timer.getElapsed();
      mars.rotation.y = t * 0.06;
      const a = t * 0.25;
      orbiter.position.set(
        mars.position.x + Math.cos(a) * 2.7,
        mars.position.y + Math.sin(a * 0.7) * 0.7,
        mars.position.z + Math.sin(a) * 1.4,
      );
      orbiter.rotation.y = t * 0.8;
      const p = dustGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < DUST; i++) {
        let x = p.getX(i) + 0.0035;
        if (x > 6) x = -6;
        p.setX(i, x);
      }
      p.needsUpdate = true;
      camera.position.x += (px - camera.position.x) * 0.03;
      camera.position.y += (0.4 - py - camera.position.y) * 0.03;
      camera.lookAt(1.2, 0, 0);
      renderer.render(scene, camera);
    };

    if (calm) {
      render(); // one static frame, no motion
    } else {
      const animate = () => {
        raf = requestAnimationFrame(animate);
        render();
      };
      animate();
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      starGeo.dispose();
      dustGeo.dispose();
      map.dispose();
      mars.geometry.dispose();
      (mars.material as THREE.Material).dispose();
      glow.geometry.dispose();
      (glow.material as THREE.Material).dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} aria-hidden style={{ position: "absolute", inset: 0 }} />;
}
