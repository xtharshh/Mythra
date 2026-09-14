import { useEffect, useRef, useState } from "react";
import LumenScene from "../three/LumenScene";
import type { World, WorldObject } from "../types";
import demo from "../data/demo-world.json";
import { canDiscoverClue, isMissionComplete } from "../game/engines";
import { evaluateCondition } from "../game/conditions";
import { useLumen } from "../state/store";
import { ChaptersPanel, ContributeModal } from "../components/Community";
import { DialogueModal, LAB_BEAT, MISSION_BEATS, StoryIntro, Toasts, TransmissionModal } from "../components/Story";
import type { Beat, Toast } from "../components/Story";
import { EventLog, Inventory, InventoryStrip, Journal, MissionTracker, PuzzleModal } from "../components/Hud";
import { CheckpointPanel } from "../components/Checkpoints";
import { WorldMap } from "../components/WorldMap";
import { VoiceLibrary, VoiceNotes } from "../components/VoiceNotes";
import {
  isTtsSupported, isVoiceInputSupported, loadVoiceSettings, parseVoiceCommand,
  saveVoiceSettings, speak, startListening, stopSpeaking, warmVoices,
} from "../audio/voice";
import { triggerObject } from "../three/effects";
import type { PeerPresence } from "../three/LumenScene";
import { api, apiOn } from "../api/client";
import { loadSession } from "../auth/auth";
import { loadCharacter, encodeSuit, decodeSuit } from "../game/suits";
import type { VoiceSettings } from "../audio/voice";
import { ControlsModal } from "../components/Controls";
import { CharacterModal } from "../components/Character";
import { MilestoneModal } from "../components/Milestone";
import { AudioTestModal } from "../components/VoiceTest";
import type { MilestoneStats } from "../social/milestone";
import { saveOwner } from "../auth/auth";
import { setSfxOn, sfx, sfxOn } from "../audio/sfx";

export default function Play() {
  const s = useLumen();
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [showContribute, setShowContribute] = useState(false);
  const [flyMode, setFlyMode] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [transmissions, setTransmissions] = useState<Beat[]>([]);
  const [dialogue, setDialogue] = useState<{ name: string; lines: string[] } | null>(null);
  const [voice, setVoice] = useState<VoiceSettings>(() => loadVoiceSettings());
  const [listening, setListening] = useState(false);
  const [target, setTarget] = useState<WorldObject | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [peers, setPeers] = useState<PeerPresence[]>([]);
  const [milestone, setMilestone] = useState<MilestoneStats | null>(null);
  const [showAudio, setShowAudio] = useState(false);
  const [sound, setSound] = useState(() => sfxOn());
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCharacter, setShowCharacter] = useState(false);
  const [character, setCharacter] = useState(() => loadCharacter());
  const playRootRef = useRef<HTMLDivElement>(null);
  const [sideTab, setSideTab] = useState<"missions" | "map" | "journal" | "voice" | "system">("missions");
  const stopListenRef = useRef<(() => void) | null>(null);
  const shownBeats = useRef(new Set<string>());
  const toastId = useRef(0);
  const hasSuit = (s.inventory["suit"] ?? 0) > 0;

  // cinematic intro, once per story
  useEffect(() => {
    const w = useLumen.getState().world;
    if (!w) return;
    try {
      if (!localStorage.getItem(`lumen-intro:${w.id}`)) setIntroOpen(true);
    } catch { setIntroOpen(true); }
  }, [s.world?.id]);

  const beginIntro = () => {
    try { if (s.world) localStorage.setItem(`lumen-intro:${s.world.id}`, "1"); } catch { /* ignore */ }
    setIntroOpen(false);
  };

  const toggleVoice = () => {
    setVoice((v) => {
      const next = { ...v, enabled: !v.enabled };
      saveVoiceSettings(next);
      if (!next.enabled) stopSpeaking();
      else useLumen.getState().pushLog("🔊 Voice narration on — transmissions and dialogue will speak.");
      return next;
    });
  };

  const runVoiceCommand = (transcript: string) => {
    const cmd = parseVoiceCommand(transcript);
    const store = useLumen.getState();
    switch (cmd.action) {
      case "interact": {
        const t = target ?? null;
        if (t) interact(t);
        else store.pushLog("🎙️ No target in range — aim at something first.");
        break;
      }
      case "fly": toggleFly(); break;
      case "save": store.save(); break;
      case "readLog": {
        const last = store.log[store.log.length - 1] ?? "Nothing yet.";
        if (voice.enabled) speak(last, voice);
        else store.pushLog(`📜 ${last}`);
        break;
      }
      case "stop": stopSpeaking(); break;
      default: store.pushLog(`🎙️ Didn't catch that: "${cmd.heard}" — try "collect", "fly", "save".`);
    }
  };

  const toggleMic = () => {
    if (listening) {
      stopListenRef.current?.();
      stopListenRef.current = null;
      setListening(false);
      return;
    }
    if (!isVoiceInputSupported()) {
      s.pushLog("🎙️ Voice input not supported in this browser — use E / click.");
      return;
    }
    stopListenRef.current = startListening(
      (heard) => {
        setListening(false);
        s.pushLog(`🎙️ "${heard}"`);
        runVoiceCommand(heard);
      },
      (err) => {
        setListening(false);
        s.pushLog(`🎙️ Mic: ${err}`);
      },
    );
    setListening(true);
  };

  useEffect(() => () => {
    stopListenRef.current?.();
    stopSpeaking();
  }, []);

  const toggleFly = () => {
    if (!hasSuit) {
      s.pushLog("🛰️ You need the flight suit — check the Rover Garage locker.");
      return;
    }
    setFlyMode((f) => {
      s.pushLog(f ? "Suit thrusters off." : "🛰️ Suit online — Space up, C down, Shift boost.");
      return !f;
    });
  };

  // load demo world on first visit
  useEffect(() => {
    if (!s.world) {
      s.setWorld(structuredClone(demo) as unknown as World);
      s.addWorld(structuredClone(demo) as unknown as World);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // checkpoints follow the active world + explorer
  useEffect(() => {
    useLumen.getState().loadCheckpoints();
  }, [s.world?.id]);

  // warm TTS voices once so narration has sound from the first beat
  useEffect(() => { warmVoices(); }, []);

  // fullscreen label follows the actual state (Esc exits natively)
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await playRootRef.current?.requestFullscreen();
    } catch {
      useLumen.getState().pushLog("Fullscreen blocked by the browser here.");
    }
  };

  // every button answers with a click — one delegated listener, game-wide
  useEffect(() => {
    const onTap = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("button")) sfx("click");
    };
    document.addEventListener("pointerdown", onTap);
    return () => document.removeEventListener("pointerdown", onTap);
  }, []);

  const toggleSound = () => {
    setSound((v) => {
      setSfxOn(!v);
      if (!v) window.setTimeout(() => sfx("confirm"), 50);
      return !v;
    });
  };

  // every entry counts as a play for the Archive feed
  useEffect(() => {
    if (s.world?.id) useLumen.getState().recordPlay(s.world.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.world?.id]);

  // multiplayer presence: heartbeat + roster (only with API connected)
  useEffect(() => {
    if (!apiOn() || !s.world?.id) {
      setPeers([]);
      return;
    }
    const worldId = s.world.id;
    const theme = s.world.theme;
    let alive = true;
    const beat = async () => {
      const st = useLumen.getState();
      await api.heartbeat(worldId, st.playerPos, encodeSuit(character.suit, character.accent));
      const list = await api.peers(worldId);
      if (!alive || !list) return;
      const me = (loadSession()?.email ?? "").split("@")[0];
      setPeers(
        list
          .filter((p) => p.user !== me)
          .map((p) => {
            const spec = decodeSuit(p.suit, p.user, theme);
            return { user: p.user, pos: p.pos, suit: spec.suit, accent: spec.accent };
          }),
      );
    };
    void beat();
    const id = window.setInterval(() => void beat(), 4000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [s.world?.id]);

  // leaderboard: personal best follows missions + clues (best-effort)
  useEffect(() => {
    if (!apiOn() || !s.world?.id) return;
    const t = window.setTimeout(() => {
      void api.submitScore(s.world!.id, s.completedMissions.length, s.discoveredClues.length);
    }, 800);
    return () => window.clearTimeout(t);
  }, [s.world?.id, s.completedMissions, s.discoveredClues]);

  const world = s.world ?? (structuredClone(demo) as unknown as World);
  const puzzle = world.puzzles.find((p) => p.id === puzzleId) ?? null;

  const interact = (obj: WorldObject) => {
    triggerObject(obj.id); // scene plays pop + ring + flash on the hit object
    const store = useLumen.getState();
    const gs = store.gameState();
    store.inspectObject(obj.id);
    store.pushLog(`Inspected: ${obj.name}`);
    const ix = obj.interaction;
    if (!ix) { sfx("click"); checkMissions(); return; }
    const narrate = (line: string) => {
      if (voice.enabled && voice.autoNarrate) speak(line, voice);
    };
    if (ix.givesItemId) {
      const qty = ix.givesQuantity ?? 1;
      store.collect(ix.givesItemId, qty);
      const total = useLumen.getState().inventory[ix.givesItemId] ?? qty;
      const label = world.resources.find((r) => r.id === ix.givesItemId)?.name ?? ix.givesItemId;
      store.pushLog(`+${qty} ${label} (now ×${total})`);
      sfx("pickup");
      narrate(`Plus ${qty} ${label}.`);
      if (ix.givesItemId === "suit") store.pushLog("🛰️ Flight suit acquired — press F (or Fly) to roam the sky!");
    }
    if (ix.kind === "talk") {
      const speaker = world.characters.find((c) => c.locationId === obj.locationId) ?? world.characters[0];
      setDialogue({
        name: speaker?.name ?? "Unknown voice",
        lines: speaker?.dialogue?.length ? speaker.dialogue : ["...static..."],
      });
      sfx("talk");
    }
    if (ix.revealsClueId) {
      const fresh = useLumen.getState();
      const clue = world.clues.find((c) => c.id === ix.revealsClueId);
      if (fresh.discoveredClues.includes(ix.revealsClueId) && clue) {
        fresh.pushLog(`📜 ${clue.title}: ${clue.text}`);
        narrate(`${clue.title}. ${clue.text}`);
      } else if (canDiscoverClue(world, ix.revealsClueId, { ...gs, inspectedObjects: new Set([...gs.inspectedObjects, obj.id]), inventory: fresh.inventory })) {
        fresh.discoverClue(ix.revealsClueId);
        const title = world.clues.find((c) => c.id === ix.revealsClueId)?.title ?? ix.revealsClueId;
        fresh.pushLog(`📜 Clue: ${title}`);
        sfx("clue");
        narrate(`Clue discovered: ${title}`);
      } else {
        fresh.pushLog("The clue is locked (need item/mission).");
        sfx("denied");
      }
    }
    if (ix.opensPuzzleId) {
      setPuzzleId(ix.opensPuzzleId);
      const pz = world.puzzles.find((p) => p.id === ix.opensPuzzleId);
      sfx("puzzle");
      // the question itself, read aloud like a game show host
      if (pz) narrate(`${pz.title}. ${pz.description}`);
    }
    if (ix.kind === "solve" || obj.type === "door") sfx("door");
    if (ix.kind === "repair" || ix.kind === "activate" || ix.kind === "build") sfx("confirm");
    if (ix.unlocksLocationId) { store.reachLocation(ix.unlocksLocationId); store.pushLog(`🔓 Unlocked: ${ix.unlocksLocationId}`); }
    if (ix.startsMissionId) { store.startMission(ix.startsMissionId); }
    checkMissions();
  };

  const checkMissions = () => {
    const gs = useLumen.getState().gameState();
    for (const m of world.missions) {
      if (gs.completedMissions.has(m.id)) continue;
      // auto-start when startCondition met
      if (evaluateCondition(m.startCondition, gs) && !useLumen.getState().activeMissions.includes(m.id)) {
        useLumen.getState().startMission(m.id);
      }
      if (isMissionComplete(world, m.id, useLumen.getState().gameState())) {
        useLumen.getState().completeMission(m.id, m.rewards);
        useLumen.getState().pushLog(`✅ Mission complete: ${m.title}`);
        useLumen.getState().createCheckpoint(`Mission: ${m.title}`, "auto");
        sfx("mission");
        if (voice.enabled && voice.autoNarrate) speak(`Mission complete: ${m.title}`, voice);
        for (const r of m.rewards) if (r.unlocksLocationId) useLumen.getState().reachLocation(r.unlocksLocationId);
        const beat = MISSION_BEATS[m.id];
        if (beat && !shownBeats.current.has(beat.key)) {
          shownBeats.current.add(beat.key);
          setTransmissions((q) => [...q, beat]);
        }
      }
    }
    // endings
    for (const e of world.endings) {
      if (evaluateCondition(e.condition, useLumen.getState().gameState())) {
        useLumen.getState().pushLog(`${e.secret ? "🤫 Secret ending" : "🏁 Ending"}: ${e.title}`);
      }
    }
    // 100% milestone: every mission + every clue → brag card (once per explorer)
    {
      const gs = useLumen.getState().gameState();
      const allMissions = world.missions.length > 0 && world.missions.every((m) => gs.completedMissions.has(m.id));
      const allClues = world.clues.length > 0 && world.clues.every((c) => gs.discoveredClues.has(c.id));
      if (allMissions && allClues) {
        const key = `mythra-milestone:${world.id}:${saveOwner()}`;
        try {
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, new Date().toISOString());
            const email = saveOwner();
            sfx("milestone");
            setMilestone({
              user: email === "guest" ? "guest explorer" : email.split("@")[0],
              worldName: world.name,
              theme: world.theme,
              missions: world.missions.length,
              missionsTotal: world.missions.length,
              clues: world.clues.length,
              cluesTotal: world.clues.length,
              date: new Date().toLocaleDateString(),
            });
          }
        } catch {
          /* ignore */
        }
      }
    }
  };

  useEffect(() => { checkMissions(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.inventory, s.discoveredClues, s.solvedPuzzles, s.inspectedObjects, s.completedMissions]);

  const reach = (locId: string) => {
    const loc = world.locations.find((l) => l.id === locId);
    if (!loc) return;
    if (loc.locked && loc.unlockCondition && !evaluateCondition(loc.unlockCondition, s.gameState())) return; // still locked
    if (!s.reachedLocations.includes(locId)) {
      s.reachLocation(locId);
      s.pushLog(`📍 ${loc.name}`);
      useLumen.getState().createCheckpoint(`Location: ${loc.name}`, "auto");
      if (voice.enabled && voice.autoNarrate) speak(`Location: ${loc.name}. ${loc.description}`, voice);
      const id = ++toastId.current;
      setToasts((q) => [...q.slice(-2), { id, name: loc.name, desc: loc.description }]);
      window.setTimeout(() => setToasts((q) => q.filter((x) => x.id !== id)), 6000);
      if (locId === "loc_lab" && !shownBeats.current.has(LAB_BEAT.key)) {
        shownBeats.current.add(LAB_BEAT.key);
        setTransmissions((q) => [...q, LAB_BEAT]);
      }
      checkMissions();
    }
  };

  return (
    <div ref={playRootRef} style={{ height: "calc(100vh - 57px)", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <div className="row" style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
        <b>{world.name}</b>
        <span className="muted">{s.reachedLocations.length}/{world.locations.length} sites · {s.completedMissions.length}/{world.missions.length} missions</span>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => setShowContribute(true)}>Continue story</button>
        <button
          className={voice.enabled ? "btn" : "btn-ghost"}
          title={isTtsSupported() ? "Toggle voice narration" : "Voice not supported in this browser"}
          onClick={toggleVoice}
        >
          {voice.enabled ? "Voice on" : "Voice off"}
        </button>
        <button
          className={listening ? "btn" : "btn-ghost"}
          title={isVoiceInputSupported() ? 'Voice commands: "collect", "fly", "save", "read log"' : "Voice input not supported — use E / click"}
          onClick={toggleMic}
        >
          {listening ? "Listening…" : "Mic"}
        </button>
        <button className={flyMode ? "btn" : "btn-ghost"} title={hasSuit ? "Toggle flight (F)" : "Find the flight suit first"} onClick={toggleFly}>
          {flyMode ? "Flying" : "Fly"}
        </button>
        <button className="btn-ghost" title="Play in fullscreen (Esc exits)" onClick={() => void toggleFullscreen()}>
          {isFullscreen ? "Exit full" : "Fullscreen"}
        </button>
        <button className="btn-ghost" title="Show or hide the side panel" onClick={() => setPanelOpen((v) => !v)}>
          {panelOpen ? "Hide panel" : "Show panel"}
        </button>
        <div style={{ position: "relative" }}>
          <button className="btn-ghost" title="Save, checkpoints, controls, audio" onClick={() => setMenuOpen((v) => !v)}>Menu</button>          {menuOpen && (
            <div className="hud-panel" style={{ position: "absolute", right: 0, top: 44, zIndex: 20, minWidth: 190, display: "flex", flexDirection: "column", gap: 6 }}>
              <button className="btn-ghost" onClick={() => { s.save(); setMenuOpen(false); }}>Save run</button>
              <button className="btn-ghost" onClick={() => { s.load(); setMenuOpen(false); }}>Load run</button>
              <button className="btn-ghost" title="Pick your explorer suit" onClick={() => { setShowCharacter(true); setMenuOpen(false); }}>Character: {character.label}</button>
              <button className="btn-ghost" title="Remap every action to your own keys" onClick={() => { setShowControls(true); setMenuOpen(false); }}>Controls</button>
              <button className="btn-ghost" title="Prove speaker + mic work" onClick={() => { setShowAudio(true); setMenuOpen(false); }}>Audio test</button>
              <button className="btn-ghost" title="Toggle button + object sounds" onClick={toggleSound} style={sound ? undefined : { opacity: 0.55 }}>
                {sound ? "Sound on" : "Muted"}
              </button>
              <button className="btn-ghost" onClick={() => { s.reset(); setMenuOpen(false); }}>Reset world</button>
            </div>
          )}
        </div>
      </div>
      <InventoryStrip world={world} />
      <div className="play-grid" style={{ flex: 1, minHeight: 0, padding: 12, gridTemplateColumns: panelOpen ? undefined : "1fr" }}>
        <div style={{ minHeight: 420, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", position: "relative" }}>
          <LumenScene world={world} flyMode={flyMode} hasSuit={hasSuit} onInteractRequest={interact} onReachLocation={reach} onPositionChange={(p) => s.movePlayer(p)} onToggleFlyRequest={toggleFly} onTargetChange={setTarget} peers={peers} character={character} />
          {target && (
            <button
              className="btn"
              style={{ position: "absolute", right: 12, bottom: 44, zIndex: 5 }}
              title={`Interact with ${target.name} (same as E)`}
              onClick={() => interact(target)}
            >
              Interact: {target.interaction?.prompt ?? target.name} [E]
            </button>
          )}
        </div>
        <div style={{ display: panelOpen ? "flex" : "none", flexDirection: "column", gap: 10, overflow: "auto" }}>
          {target && (
            <div className="hud-panel">
              <div className="row"><b>At crosshair</b><span className="pill cyan">{target.name}</span></div>
              <div className="muted" style={{ fontSize: 12 }}>{target.description}</div>
              <VoiceNotes worldId={world.id} targetKind="object" targetId={target.id} label={target.name} compact />
            </div>
          )}
          <div className="row" style={{ gap: 6 }}>
            {(["missions", "map", "journal", "voice", "system"] as const).map((t) => (
              <button key={t} className={sideTab === t ? "btn" : "btn-ghost"} style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => setSideTab(t)}>
                {t === "missions" ? `Missions ${s.completedMissions.length}/${world.missions.length}` : t === "map" ? "Map" : t === "journal" ? `Journal ${s.discoveredClues.length}/${world.clues.length}` : t === "voice" ? "Voice" : "System"}
              </button>
            ))}
          </div>
          {sideTab === "missions" && (<><MissionTracker world={world} /><Inventory world={world} /></>)}
          {sideTab === "map" && <WorldMap world={world} playerPos={s.playerPos} reached={s.reachedLocations} />}
          {sideTab === "journal" && (<><Journal world={world} /><ChaptersPanel world={world} /></>)}
          {sideTab === "voice" && <VoiceLibrary worldId={world.id} />}
          {sideTab === "system" && (<><CheckpointPanel worldId={world.id} /><EventLog /></>)}
        </div>
      </div>
      {puzzle && <PuzzleModal puzzle={puzzle} onClose={() => { setPuzzleId(null); setTimeout(checkMissions, 50); }} />}
      {showControls && <ControlsModal onClose={() => setShowControls(false)} />}
      {showCharacter && <CharacterModal onClose={() => { setCharacter(loadCharacter()); setShowCharacter(false); }} />}
      {showAudio && <AudioTestModal onClose={() => setShowAudio(false)} />}
      {showContribute && <ContributeModal world={world} onClose={() => setShowContribute(false)} />}
      {introOpen && <StoryIntro world={world} onBegin={beginIntro} />}
      <Toasts toasts={toasts} />
      {transmissions[0] && <TransmissionModal beat={transmissions[0]} onClose={() => setTransmissions((q) => q.slice(1))} />}
      {milestone && <MilestoneModal stats={milestone} ground={world.environment.primaryColor} onClose={() => setMilestone(null)} />}
      {dialogue && <DialogueModal name={dialogue.name} lines={dialogue.lines} onClose={() => setDialogue(null)} />}
    </div>
  );
}
