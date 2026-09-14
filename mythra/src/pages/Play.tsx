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
import { Leaderboard } from "../components/Leaderboard";
import { ownerLabel } from "../game/credits";
import { WorldMap } from "../components/WorldMap";
import { VoiceLibrary, VoiceNotes } from "../components/VoiceNotes";
import {
  isTtsSupported, isVoiceInputSupported, loadVoiceSettings, parseVoiceCommand,
  saveVoiceSettings, speak, startListening, stopSpeaking, warmVoices,
} from "../audio/voice";
import { buildInviteLink, buildShortInviteLink, parseInvite, parseRoomId } from "../game/invite";
import { importWorldCode, importWorldObject } from "../game/share";
import { RacePanel } from "../components/Race";
import { triggerObject } from "../three/effects";
import type { PeerPresence } from "../three/LumenScene";
import { api, apiOn, apiToken, formatPing, pingApi } from "../api/client";
import { loadSession } from "../auth/auth";
import { loadCharacter, encodeSuit, decodeSuit } from "../game/suits";
import type { VoiceSettings } from "../audio/voice";
import { ControlsModal } from "../components/Controls";
import { loadView, saveView } from "../game/controls";
import type { ViewMode } from "../game/controls";
import { CharacterModal } from "../components/Character";
import { MilestoneModal } from "../components/Milestone";
import { AudioTestModal } from "../components/VoiceTest";
import type { MilestoneStats } from "../social/milestone";
import { saveOwner } from "../auth/auth";
import { setSfxOn, sfx, sfxOn } from "../audio/sfx";
import { ambient, loadAmbience, saveAmbience } from "../audio/ambient";

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
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<MilestoneStats | null>(null);
  const [showAudio, setShowAudio] = useState(false);
  const [sound, setSound] = useState(() => sfxOn());
  const [ambience, setAmbience] = useState(() => loadAmbience());
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCharacter, setShowCharacter] = useState(false);
  const [character, setCharacter] = useState(() => loadCharacter());
  const playRootRef = useRef<HTMLDivElement>(null);
  const [sideTab, setSideTab] = useState<"missions" | "map" | "journal" | "voice" | "board" | "system">("missions");
  const stopListenRef = useRef<(() => void) | null>(null);
  const shownBeats = useRef(new Set<string>());
  const shownChapters = useRef(new Set<string>());
  const toastId = useRef(0);
  const [view, setView] = useState<ViewMode>(() => loadView());
  const [ping, setPing] = useState<number | null>(null);
  const hasSuit = (s.inventory["suit"] ?? 0) > 0;

  /** Milestone moment: toast card + fanfare + spoken line. */
  const celebrate = (name: string, desc: string, spoken: string, fanfare: "confirm" | "mission" = "confirm") => {
    const id = ++toastId.current;
    setToasts((q) => [...q.slice(-2), { id, name, desc }]);
    window.setTimeout(() => setToasts((q) => q.filter((x) => x.id !== id)), 6000);
    sfx(fanfare);
    if (voice.enabled) speak(spoken, voice);
  };

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

  const toggleView = () => {
    setView((v) => {
      const next: ViewMode = v === "third" ? "first" : "third";
      saveView(next);
      useLumen.getState().pushLog(next === "third" ? "Camera: third person — explorer visible." : "Camera: first person — through your visor.");
      return next;
    });
  };

  const toggleFly = () => {
    if (!hasSuit) {
      s.pushLog("No thrusters yet — find the flight suit locker at the Rover Garage to unlock the sky.");
      return;
    }
    setFlyMode((f) => {
      s.pushLog(f ? "Suit thrusters off." : "Suit online — Space up, C down, Shift boost. The sky is open.");
      return !f;
    });
  };

  // load demo world on first visit — or land straight into a race link.
  // `?room=` (short, needs the API) wins; legacy `?invite=` carries the tale.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) {
      setJoining(true);
      (async () => {
        try {
          const roomId = parseRoomId(roomParam);
          const r = await api.raceRoom(roomId);
          if (!r) throw new Error("Couldn't reach the race room — is the API online?");
          const snapshot = (r as { world?: unknown }).world ?? (await api.world(r.room.worldId));
          if (!snapshot) throw new Error("That room has no tale — ask the host for a fresh link.");
          const w = importWorldObject(snapshot);
          s.setWorld(structuredClone(w));
          s.addWorld(structuredClone(w));
          setRoomId(roomId);
          s.pushLog(`Joined the race — solve it faster than the host.`);
        } catch (e) {
          useLumen.getState().pushLog(e instanceof Error ? e.message : "Race join failed.");
          if (!useLumen.getState().world) {
            s.setWorld(structuredClone(demo) as unknown as World);
            s.addWorld(structuredClone(demo) as unknown as World);
          }
        } finally {
          setJoining(false);
          window.history.replaceState(null, "", window.location.pathname);
        }
      })();
      return;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
    try {
      const q = params.get("invite");
      if (q) {
        const inv = parseInvite(q);
        const w = importWorldCode(inv.code);
        s.setWorld(structuredClone(w));
        s.addWorld(structuredClone(w));
        if (inv.room) {
          setRoomId(inv.room);
          s.pushLog(`Joined the race — solve it faster than the host.`);
        } else {
          s.pushLog(`Imported tale: ${w.name}.`);
        }
        window.history.replaceState(null, "", window.location.pathname);
        return;
      }
    } catch (e) {
      useLumen.getState().pushLog(e instanceof Error ? e.message : "Invite failed.");
    }
    if (!s.world) {
      // reload reopens whoever's last tale (their shelf, their save) —
      // the demo only greets brand-new explorers
      useLumen.getState().loadLibrary();
      if (!useLumen.getState().restoreLastWorld()) {
        s.setWorld(structuredClone(demo) as unknown as World);
        s.addWorld(structuredClone(demo) as unknown as World);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // checkpoints follow the active world + explorer
  useEffect(() => {
    useLumen.getState().loadCheckpoints();
  }, [s.world?.id]);

  // warm TTS voices once so narration has sound from the first beat
  useEffect(() => { warmVoices(); }, []);

  // live ping for the viewport chip — null = local/offline
  useEffect(() => {
    if (!apiOn()) {
      setPing(null);
      return;
    }
    let alive = true;
    const probe = async () => {
      const ms = await pingApi();
      if (alive) setPing(ms);
    };
    void probe();
    const id = window.setInterval(() => void probe(), 10000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  // universe ambience: starts on first gesture (autoplay policy), stops off-surface
  useEffect(() => {
    if (!s.world) return;
    const theme = s.world.theme;
    let on = loadAmbience();
    const kick = () => {
      if (on) ambient.start(theme);
    };
    // already-gestured sessions start immediately; otherwise first tap/key does it
    kick();
    window.addEventListener("pointerdown", kick, { once: true });
    window.addEventListener("keydown", kick, { once: true });
    return () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
      ambient.stop();
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.world?.id]);

  const toggleAmbience = () => {
    setAmbience((v) => {
      const next = !v;
      saveAmbience(next);
      if (next && s.world) ambient.start(s.world.theme);
      else ambient.stop();
      return next;
    });
  };

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
      await api.heartbeat(worldId, st.playerPos, encodeSuit(character.suit, character.accent), roomId ?? undefined);
      const list = await api.peers(worldId, roomId ?? undefined);
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
  }, [s.world?.id, roomId, character]);

  // leaderboard: personal best follows missions + clues (best-effort)
  // race room: live speed board follows too (finished flips at 100%)
  useEffect(() => {
    if (!s.world?.id) return;
    const worldId = s.world.id;
    const finished =
      s.world.missions.length > 0 &&
      s.world.missions.every((m) => s.completedMissions.includes(m.id)) &&
      s.world.clues.every((c) => s.discoveredClues.includes(c.id));
    const t = window.setTimeout(() => {
      if (apiOn()) {
        void api.submitScore(worldId, s.completedMissions.length, s.discoveredClues.length);
        if (roomId) void api.raceProgress(roomId, s.completedMissions.length, s.discoveredClues.length, finished);
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [s.world?.id, s.completedMissions, s.discoveredClues, roomId]);

  const invite = async () => {
    const w = useLumen.getState().world;
    if (!w) return;
    if (!apiOn()) {
      // offline link still carries the whole tale — solo flight, same story
      setRoomId(null);
      setInviteLink(buildInviteLink("", w));
      useLumen.getState().pushLog("Invite link carries the tale (offline) — connect the API for the live race.");
      return;
    }
    if (!apiToken()) {
      const hasSession = !!loadSession();
      useLumen.getState().pushLog(
        hasSession
          ? "This sign-in predates the API link — sign OUT and sign back IN once, then invite."
          : "Sign in first (nav → Sign in) — race rooms need a username.",
      );
      return;
    }
    const r = await api.createRoom(w.id, w);
    if (!r) {
      useLumen.getState().pushLog("Couldn't open a race room — API unreachable.");
      return;
    }
    setRoomId(r.roomId);
    setInviteLink(buildShortInviteLink(r.roomId));
    useLumen.getState().pushLog("Race room open — short link ready, fastest solver wins.");
  };

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
        celebrate(`Milestone — ${m.title}`, "Mission complete. The story moves.", `Milestone complete: ${m.title}.`, "mission");
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

  // new continued chapters announce + narrate themselves on arrival
  useEffect(() => {
    const entries = s.world?.communityLog ?? [];
    for (const e of entries) {
      if (shownChapters.current.has(e.id)) continue;
      shownChapters.current.add(e.id);
      const n = entries.indexOf(e) + 1;
      const id = ++toastId.current;
      setToasts((q) => [...q.slice(-2), { id, name: `Chapter ${n}: ${e.title}`, desc: `by ${e.author} — narrating…` }]);
      window.setTimeout(() => setToasts((q) => q.filter((x) => x.id !== id)), 6000);
      if (voice.enabled) speak(`Chapter ${n}: ${e.title}, by ${e.author}. ${e.text}`, voice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.world?.communityLog]);

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
        {joining && <span className="pill cyan">Joining race…</span>}
        <span className="pill cyan">⚑ story by {ownerLabel(world.ownerId)}</span>
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
        <button className={flyMode ? "btn" : "btn-ghost"} title={hasSuit ? "Toggle flight (F) — Space up, C down" : "Unlock: find the flight suit locker first"} onClick={toggleFly}>
          {flyMode ? "Flying" : "Fly"}
        </button>
        <button className="btn-ghost" title="Top 10 + live solvers for this story" onClick={() => setSideTab("board")}>
          Board
        </button>
        <button className="btn-ghost" title="Play in fullscreen (Esc exits)" onClick={() => void toggleFullscreen()}>
          {isFullscreen ? "Exit full" : "Fullscreen"}
        </button>
        <button className="btn-ghost" title="Switch first / third person camera (V)" onClick={toggleView}>
          {view === "third" ? "3rd person" : "1st person"}
        </button>
        <div style={{ position: "relative" }}>
          <button className="btn-ghost" title="Save, checkpoints, controls, audio" onClick={() => setMenuOpen((v) => !v)}>Menu</button>
          {menuOpen && (
            <div className="hud-panel" style={{ position: "absolute", right: 0, top: 44, zIndex: 20, minWidth: 190, display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <span className="dossier-meta">Game menu</span>
                <button className="btn-ghost" style={{ padding: "0 8px" }} title="Close menu" onClick={() => setMenuOpen(false)}>✕</button>
              </div>
              <button className="btn" title="Invite solvers to this tale (join link + speed race)" onClick={() => { void invite().then(() => setSideTab("system")); setMenuOpen(false); }}>Invite solvers</button>
              <button className="btn-ghost" onClick={() => { s.save(); setMenuOpen(false); }}>Save run</button>
              <button className="btn-ghost" onClick={() => { s.load(); setMenuOpen(false); }}>Load run</button>
              <button className="btn-ghost" title="Pick your explorer suit" onClick={() => { setShowCharacter(true); setMenuOpen(false); }}>Character: {character.label}</button>
              <button className="btn-ghost" title="Remap every action to your own keys" onClick={() => { setShowControls(true); setMenuOpen(false); }}>Controls</button>
              <button className="btn-ghost" title="Prove speaker + mic work" onClick={() => { setShowAudio(true); setMenuOpen(false); }}>Audio test</button>
              <button className="btn-ghost" title="Toggle button + object sounds" onClick={toggleSound} style={sound ? undefined : { opacity: 0.55 }}>
                {sound ? "Sound on" : "Muted"}
              </button>
              <button className="btn-ghost" title="Toggle the universe ambience bed" onClick={() => { toggleAmbience(); }} style={ambience ? undefined : { opacity: 0.55 }}>
                {ambience ? "Ambience on" : "Ambience off"}
              </button>
              <button className="btn-ghost" onClick={() => { s.reset(); setMenuOpen(false); }}>Reset world</button>
            </div>
          )}
        </div>
      </div>
      <InventoryStrip world={world} />
      <div className="play-grid" style={{ flex: 1, minHeight: 0, padding: 12 }}>
        <div style={{ minHeight: 420, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", position: "relative" }}>
          <LumenScene world={world} flyMode={flyMode} hasSuit={hasSuit} onInteractRequest={interact} onReachLocation={reach} onPositionChange={(p) => s.movePlayer(p)} onToggleFlyRequest={toggleFly} onTargetChange={setTarget} peers={peers} character={character} view={view} onToggleViewRequest={toggleView} home={s.playerPos} />
          <div className="ping-chip" title={apiOn() ? "Live link to the MYTHRA API (10s ping)" : "Offline — playing local"}>
            <span className="blink" />ping {formatPing(ping, apiOn())}
          </div>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "auto" }}>
          {target && (
            <div className="hud-panel">
              <div className="row"><b>At crosshair</b><span className="pill cyan">{target.name}</span></div>
              <div className="muted" style={{ fontSize: 12 }}>{target.description}</div>
              <VoiceNotes worldId={world.id} targetKind="object" targetId={target.id} label={target.name} compact />
            </div>
          )}
          <div className="row" style={{ gap: 6 }}>
            {(["missions", "map", "journal", "voice", "board", "system"] as const).map((t) => (
              <button key={t} className={sideTab === t ? "btn" : "btn-ghost"} style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => setSideTab(t)}>
                {t === "missions" ? `Missions ${s.completedMissions.length}/${world.missions.length}` : t === "map" ? "Map" : t === "journal" ? `Journal ${s.discoveredClues.length}/${world.clues.length}` : t === "voice" ? "Voice" : t === "board" ? "Board" : "System"}
              </button>
            ))}
          </div>
          {sideTab === "missions" && (<><MissionTracker world={world} /><Inventory world={world} /></>)}
          {sideTab === "map" && <WorldMap world={world} playerPos={s.playerPos} reached={s.reachedLocations} />}
          {sideTab === "journal" && (<><Journal world={world} /><ChaptersPanel world={world} /></>)}
          {sideTab === "voice" && <VoiceLibrary worldId={world.id} />}
          {sideTab === "board" && (<>
            <Leaderboard worldId={world.id} worldName={world.name} />
            <div className="hud-panel">
              <div className="row"><b>Live in this story</b><span className="pill cyan">{peers.length + 1}</span></div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: `#${character.suit.toString(16).padStart(6, "0")}`, display: "inline-block" }} />
                  <b>You · {character.label}</b>
                  <span className="pill green">solving now</span>
                </div>
                {peers.length === 0 && (
                  <div className="muted">Alone here — send an Invite and racers appear live with their suits.</div>
                )}
                {peers.map((p) => (
                  <div key={p.user} className="row" style={{ gap: 8 }}>
                    <span style={{ width: 12, height: 12, borderRadius: "50%", background: `#${p.suit.toString(16).padStart(6, "0")}`, display: "inline-block" }} />
                    <b>{p.user}</b>
                    <span className="pill green">live</span>
                  </div>
                ))}
              </div>
            </div>
          </>)}
          {sideTab === "system" && (<><RacePanel worldId={world.id} worldName={world.name} roomId={roomId} inviteLink={inviteLink} onInvite={() => void invite()} /><CheckpointPanel worldId={world.id} /><EventLog /></>)}
        </div>
      </div>
      {puzzle && <PuzzleModal puzzle={puzzle} onClose={() => { setPuzzleId(null); setTimeout(checkMissions, 50); }} onSolved={(p) => celebrate(`Correct — ${p.title}`, "Puzzle cracked. That answer moved the story.", `Correct answer. ${p.title}, solved.`)} />}
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
