// Character picker — your explorer, your suit, now with a live 3D avatar.
// The preview is Facet's MIT Avatar Maker (src/three/AvatarMaker.tsx),
// dressed in the picked suit: shirt = suit color, hair = accent color.
// Persisted locally, suits broadcast to fellow solvers over presence.
import { useRef, useState } from "react";
import type * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { AvatarMaker, downloadAvatarGLB } from "../three/AvatarMaker";
import type { AvatarAccessory, AvatarBody, AvatarConfig, AvatarExpression, AvatarHairStyle } from "../game/suits";
import {
  AVATAR_ACCESSORIES,
  AVATAR_EXPRESSIONS,
  AVATAR_HAIR_STYLES,
  AVATAR_SKIN_COLORS,
  CHARACTERS,
  loadAvatar,
  loadCharacter,
  saveAvatar,
  saveCharacter,
} from "../game/suits";
import { Icon } from "./icons";
import { useLumen } from "../state/store";

/** Hostile-environment themes need a sealed suit; everyday streets,
 *  forests and fantasy towns fit the chibi face. */
const SUIT_THEMES = ["mars", "space", "ocean", "desert", "horror", "post_apocalyptic"];

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

function swatch(suit: number, accent: number): string {
  return `linear-gradient(135deg, ${hex(suit)} 55%, ${hex(accent)} 55%)`;
}

export function CharacterModal({ onClose }: { onClose: () => void }) {
  const [picked, setPicked] = useState(() => loadCharacter().id);
  const [avatar, setAvatar] = useState<AvatarConfig>(() => loadAvatar());
  const avatarRef = useRef<THREE.Group>(null);

  const suit = CHARACTERS.find((c) => c.id === picked) ?? CHARACTERS[0];
  const worldTheme = useLumen((s) => s.world?.theme);
  // Mars-like tale → astronaut; everyday tale → chibi. Only a suggestion —
  // the explorer's saved pick always wins until they tap Apply.
  const suggested: AvatarBody = worldTheme && !SUIT_THEMES.includes(worldTheme) ? "chibi" : "astronaut";

  const choose = (id: string) => {
    setPicked(id);
    saveCharacter(id);
  };
  const setLook = (patch: Partial<AvatarConfig>) => {
    setAvatar((prev) => {
      const next = { ...prev, ...patch };
      saveAvatar(next);
      return next;
    });
  };

  const pill = (active: boolean) => (active ? "btn" : "btn-ghost");

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal card avatar-modal" onClick={(e) => e.stopPropagation()}>
        <button className="btn-ghost" style={{ position: "absolute", top: 22, right: 10, padding: "0 8px" }} title="Close" onClick={onClose}>✕</button>
        <div className="case-kicker">Explorer roster · pick your body + suit</div>
        <h3 style={{ margin: "8px 0 4px" }}>Who descends?</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Your explorer wears this everywhere — walk the Surface as a suited
          astronaut or as your chibi avatar, including in other solvers'
          skies when you play online.
        </p>
        {avatar.body !== suggested && (
          <div className="row" style={{ marginTop: 8 }}>
            <span className="pill amber">
              {suggested === "astronaut"
                ? `⬢ ${worldTheme ?? "This"} tale needs a suit — Astronaut fits here`
                : `⬢ Everyday ${worldTheme ?? ""} streets — Chibi fits here`}
            </span>
            <button
              className="btn"
              style={{ padding: "4px 14px", fontSize: 12 }}
              onClick={() => setLook({ body: suggested })}
            >
              Use {suggested === "astronaut" ? "Astronaut" : "Chibi"}
            </button>
          </div>
        )}
        <div className="case-kicker" style={{ marginTop: 8 }}>Body</div>
        <div className="row" style={{ gap: 8, marginTop: 6 }}>
          {([
            { id: "astronaut", label: "Astronaut", hint: "Classic suited explorer" },
            { id: "chibi", label: "Chibi avatar", hint: "Big-head 3D avatar face" },
          ] as { id: AvatarBody; label: string; hint: string }[]).map((b) => (
            <button
              key={b.id}
              className={avatar.body === b.id ? "btn" : "btn-ghost"}
              style={{ flex: "1 1 180px", display: "flex", gap: 10, alignItems: "center", textAlign: "left" }}
              onClick={() => setLook({ body: b.id })}
              title={b.hint}
            >
              <span style={{
                width: 30, height: 30, borderRadius: b.id === "chibi" ? "50%" : "8px",
                background: swatch(suit.suit, suit.accent), flex: "none",
                border: "2px solid rgba(0,0,0,.4)",
              }} />
              <span>
                <b style={{ display: "block", fontSize: 13 }}>{b.label}</b>
                <span className="muted" style={{ fontSize: 11 }}>{b.hint}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="avatar-layout">
          {avatar.body === "chibi" && (
          <div className="avatar-stage" role="img" aria-label={`3D preview of ${suit.label}`}>
            <Canvas shadows camera={{ position: [0, 1.35, 4.6], fov: 42 }} dpr={[1, 1.75]}>
              <ambientLight intensity={0.85} />
              <directionalLight position={[3, 5, 4]} intensity={1.5} castShadow />
              <directionalLight position={[-4, 2, -3]} intensity={0.4} color="#8b5cf6" />
              <OrbitControls
                makeDefault
                target={[0, 1.02, 0]}
                enableZoom={false}
                enablePan={false}
                minPolarAngle={Math.PI / 3.4}
                maxPolarAngle={Math.PI / 1.85}
              />
              <AvatarMaker
                ref={avatarRef}
                skinColor={avatar.skinColor}
                hairColor={hex(suit.accent)}
                hairStyle={avatar.hairStyle}
                shirtColor={hex(suit.suit)}
                pantsColor="#262626"
                accessory={avatar.accessory}
                expression={avatar.expression}
              />
            </Canvas>
            <div className="dossier-meta avatar-stage-label">{suit.label} · {avatar.hairStyle} · {avatar.expression}</div>
          </div>
          )}
          <div className="avatar-controls">
            <div className="case-kicker">Suit</div>
            <div className="avatar-suits">
              {CHARACTERS.map((c) => (
                <button
                  key={c.id}
                  className={picked === c.id ? "btn avatar-suit on" : "btn-ghost avatar-suit"}
                  onClick={() => choose(c.id)}
                  title={c.blurb}
                >
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: swatch(c.suit, c.accent), flex: "none", border: "2px solid rgba(0,0,0,.4)" }} />
                  <b>{c.label}</b>
                </button>
              ))}
            </div>
            {avatar.body === "chibi" && (
            <>
            <div className="case-kicker" style={{ marginTop: 10 }}>Hair</div>            <div className="row" style={{ gap: 6 }}>
              {AVATAR_HAIR_STYLES.map((h: AvatarHairStyle) => (
                <button key={h} className={pill(avatar.hairStyle === h)} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setLook({ hairStyle: h })}>{h}</button>
              ))}
            </div>
            <div className="case-kicker" style={{ marginTop: 10 }}>Gear</div>
            <div className="row" style={{ gap: 6 }}>
              {AVATAR_ACCESSORIES.map((a: AvatarAccessory) => (
                <button key={a} className={pill(avatar.accessory === a)} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setLook({ accessory: a })}>{a}</button>
              ))}
            </div>
            <div className="case-kicker" style={{ marginTop: 10 }}>Mood</div>
            <div className="row" style={{ gap: 6 }}>
              {AVATAR_EXPRESSIONS.map((e: AvatarExpression) => (
                <button key={e} className={pill(avatar.expression === e)} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setLook({ expression: e })}>{e}</button>
              ))}
            </div>
            <div className="case-kicker" style={{ marginTop: 10 }}>Skin</div>
            <div className="row" style={{ gap: 6 }}>
              {AVATAR_SKIN_COLORS.map((s) => (
                <button
                  key={s}
                  title={s}
                  onClick={() => setLook({ skinColor: s })}
                  style={{
                    width: 26, height: 26, borderRadius: "50%", background: s, cursor: "pointer",
                    border: avatar.skinColor === s ? "2px solid var(--th-accent)" : "2px solid rgba(0,0,0,.4)",
                    boxShadow: avatar.skinColor === s ? "0 0 10px rgba(255,180,94,.7)" : "none",
                    padding: 0,
                  }}
                />
              ))}
            </div>
            </>
            )}
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={onClose}><Icon name="check" size={13} /> Suit up</button>
          {avatar.body === "chibi" && (
          <button
            className="btn-ghost"
            title="Download your character as a .glb 3D file"
            onClick={() => void downloadAvatarGLB(avatarRef.current, `${suit.id}-avatar.glb`)}
          >
            Export .glb
          </button>
          )}
        </div>
      </div>
    </div>
  );
}
