import { useEffect, useRef, useState } from "react";
import { loadVoiceSettings, speak, stopSpeaking } from "../audio/voice";
import { useLumen } from "../state/store";
import { loadBinds } from "../game/controls";

const TUTORIAL_KEY = "mythra-interactive-tutorial-v1";

export function interactiveTutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === "1";
  } catch {
    return true;
  }
}

export function markInteractiveTutorialSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function resetInteractiveTutorial(): void {
  try {
    localStorage.removeItem(TUTORIAL_KEY);
  } catch {
    /* ignore */
  }
}

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  action: "tap" | "wasd" | "drag" | "press-e" | "press-f" | "press-v" | "press-space" | "press-shift";
  targetPosition?: [number, number, number];
  fingerAnimation?: "tap" | "drag" | "hold" | "swipe";
  voiceText: string;
  highlightElement?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Mythio",
    description: "Tap anywhere to begin your journey. This interactive guide will teach you everything you need to know.",
    action: "tap",
    fingerAnimation: "tap",
    voiceText: "Welcome to Mythio, explorer. Tap anywhere to begin your journey. This interactive guide will teach you everything you need to know.",
  },
  {
    id: "movement",
    title: "Movement - WASD",
    description: "Use WASD keys to walk around. Hold Shift to sprint. Press Space to jump. Your explorer is always visible in front of you.",
    action: "wasd",
    fingerAnimation: "swipe",
    voiceText: "Use WASD keys to walk around. Hold Shift to sprint. Press Space to jump. Your explorer is always visible in front of you.",
    highlightElement: "canvas",
  },
  {
    id: "look",
    title: "Look Around - Drag Mouse",
    description: "Hold and drag your mouse to look around. Press V to switch between third-person and first-person view.",
    action: "drag",
    fingerAnimation: "drag",
    voiceText: "Hold and drag your mouse to look around. Press V to switch between third-person and first-person view.",
    highlightElement: "canvas",
  },
  {
    id: "interact",
    title: "Interact - Press E",
    description: "Aim at glowing objects like rovers, terminals, or scrap. Press E or click to interact, pick up, talk, or repair.",
    action: "press-e",
    fingerAnimation: "tap",
    voiceText: "Aim at glowing objects like rovers, terminals, or scrap. Press E or click to interact, pick up, talk, or repair.",
    highlightElement: "canvas",
  },
  {
    id: "flight",
    title: "Flight - Press F",
    description: "Find the flight suit locker at the Rover Garage to unlock flight. Then press F to toggle thrusters. Space goes up, C goes down.",
    action: "press-f",
    fingerAnimation: "tap",
    voiceText: "Find the flight suit locker at the Rover Garage to unlock flight. Then press F to toggle thrusters. Space goes up, C goes down.",
    highlightElement: "fly-button",
  },
  {
    id: "missions",
    title: "Missions & Journal",
    description: "Check the Missions panel for objectives. Clues go in your Journal. Locked doors open with puzzle answers. Every puzzle gives hints.",
    action: "tap",
    fingerAnimation: "tap",
    voiceText: "Check the Missions panel for objectives. Clues go in your Journal. Locked doors open with puzzle answers. Every puzzle gives hints.",
    highlightElement: "missions-tab",
  },
  {
    id: "complete",
    title: "You're Ready!",
    description: "You now know the basics. Explore, solve mysteries, and write your own story. Tap to close and begin your expedition.",
    action: "tap",
    fingerAnimation: "tap",
    voiceText: "You now know the basics, explorer. Explore, solve mysteries, and write your own story. Tap to close and begin your expedition.",
  },
];

function FingerPointer({ animation, style }: { animation: "tap" | "drag" | "hold" | "swipe"; style?: React.CSSProperties }) {
  const timeRef = useRef(0);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    let raf: number;
    const animate = () => {
      timeRef.current += 0.016;
      forceUpdate(n => n + 1);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  const t = timeRef.current;
  let path = "";
  let fingerStyle: React.CSSProperties = {};

  switch (animation) {
    case "tap": {
      const y = Math.abs(Math.sin(t * 3)) * 0.3;
      path = `M 0 0 Q 0 ${-0.5 - y} 0 ${-1 - y}`;
      fingerStyle = { animation: "bounce 0.6s ease-in-out infinite" };
      break;
    }
    case "drag": {
      const x = Math.sin(t * 2) * 0.4;
      path = `M 0 0 Q ${x * 0.5} ${-0.5} ${x} ${-1}`;
      fingerStyle = { animation: "dragMove 2s ease-in-out infinite" };
      break;
    }
    case "hold": {
      path = `M 0 0 L 0 -1`;
      fingerStyle = { animation: "pulse 1.5s ease-in-out infinite" };
      break;
    }
    case "swipe": {
      const x = Math.sin(t * 1.5) * 0.6;
      const y = Math.abs(Math.sin(t * 1.5)) * 0.2;
      path = `M ${-x} ${y} Q 0 ${-0.5} ${x} ${y}`;
      fingerStyle = { animation: "swipeMove 1.5s ease-in-out infinite" };
      break;
    }
  }

  const keyframes = `
    @keyframes bounce { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-8px) scale(1.2); } }
    @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.8; } }
    @keyframes dragMove { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(20px); } }
    @keyframes swipeMove { 0%, 100% { transform: translateX(-30px); } 50% { transform: translateX(30px); } }
  `;

  return (
    <div style={{ position: "relative", ...style, filter: "drop-shadow(0 4px 12px rgba(255,180,94,0.6))" }}>
      <svg width="80" height="100" viewBox="0 0 80 100" style={{ transform: "rotate(-90deg) scale(0.8)", ...fingerStyle }}>
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <style dangerouslySetInnerHTML={{ __html: keyframes }} />
        </defs>
        <path
          d={path}
          stroke="#ffb45e"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
        />
        <ellipse
          cx="0"
          cy="-1"
          rx={animation === "tap" ? 12 : 10}
          ry={animation === "tap" ? 8 : 6}
          fill="#ffb45e"
          filter="url(#glow)"
        />
      </svg>
      <div style={{
        position: "absolute",
        bottom: "-20px",
        left: "50%",
        transform: "translateX(-50%)",
        whiteSpace: "nowrap",
        color: "#ffb45e",
        fontSize: "12px",
        fontWeight: 700,
        textShadow: "0 2px 8px rgba(0,0,0,0.8)",
        fontFamily: "'JetBrains Mono', monospace",
        pointerEvents: "none",
      }}>
        {animation === "tap" && "TAP"}
        {animation === "drag" && "DRAG"}
        {animation === "hold" && "HOLD"}
        {animation === "swipe" && "SWIPE"}
      </div>
    </div>
  );
}

function TutorialPanel({ step, onNext, onClose, isLast }: { step: TutorialStep; onNext: () => void; onClose: () => void; isLast: boolean }) {
  const binds = loadBinds();

  const keyForAction = (action: TutorialStep["action"]) => {
    switch (action) {
      case "wasd": return "W / A / S / D";
      case "drag": return "Mouse Drag";
      case "press-e": return binds.interact[0]?.toUpperCase() ?? "E";
      case "press-f": return binds.flyToggle[0]?.toUpperCase() ?? "F";
      case "press-v": return "V";
      case "press-space": return "Space";
      case "press-shift": return "Shift";
      default: return "Tap";
    }
  };

  const stepIndex = TUTORIAL_STEPS.findIndex(s => s.id === step.id);

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10000,
        pointerEvents: "auto",
        width: "360px",
        maxWidth: "90vw",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, rgba(10,10,25,0.98) 0%, rgba(20,15,35,0.95) 100%)",
          border: "2px solid #ffb45e",
          borderRadius: "16px",
          padding: "24px",
          color: "#ffd9a8",
          fontFamily: "'JetBrains Mono', monospace",
          boxShadow: "0 0 40px rgba(255,180,94,0.3), inset 0 1px 0 rgba(255,180,94,0.1), 0 20px 60px rgba(0,0,0,0.5)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <span style={{ color: "#ffb45e", fontSize: "12px", fontWeight: 700, letterSpacing: "2px" }}>
            ◉ FIELD MANUAL · {stepIndex + 1} / {TUTORIAL_STEPS.length}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid #ffb45e44",
              color: "#ffb45e",
              padding: "4px 10px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "11px",
              fontFamily: "inherit",
            }}
          >
            SKIP
          </button>
        </div>

        <h2 style={{ margin: "0 0 12px", fontSize: "22px", color: "#fff", textShadow: "0 0 20px #ffb45e" }}>
          {step.title}
        </h2>

        <p style={{ margin: "0 0 20px", fontSize: "14px", lineHeight: 1.6, color: "#c9b8a0" }}>
          {step.description}
        </p>

        <div style={{ background: "rgba(255,180,94,0.1)", border: "1px solid #ffb45e44", borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ background: "#ffb45e", color: "#0a0a15", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}>
              ACTION
            </span>
            <span style={{ fontSize: "13px", color: "#ffd9a8" }}>{keyForAction(step.action)}</span>
          </div>
          <div style={{ fontSize: "12px", color: "#8b7a60" }}>
            {step.action === "wasd" && "Walk · Sprint · Jump"}
            {step.action === "drag" && "Look around · V for camera"}
            {step.action === "press-e" && "Interact with glowing objects"}
            {step.action === "press-f" && "Toggle flight (needs suit)"}
            {step.action === "press-v" && "Switch camera view"}
            {step.action === "press-space" && "Jump / Ascend in flight"}
            {step.action === "press-shift" && "Sprint / Boost in flight"}
            {step.action === "tap" && "Tap to continue"}
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {TUTORIAL_STEPS.map((s, i) => (
            <div
              key={s.id}
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "2px",
                background: i <= stepIndex ? "#ffb45e" : "#ffb45e22",
                transition: "background 0.3s ease",
              }}
            />
          ))}
        </div>

        <button
          onClick={isLast ? onClose : onNext}
          style={{
            width: "100%",
            padding: "14px",
            background: "linear-gradient(135deg, #ffb45e 0%, #ea580c 100%)",
            border: "none",
            borderRadius: "8px",
            color: "#0a0a15",
            fontSize: "14px",
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
            letterSpacing: "1px",
            boxShadow: "0 4px 20px rgba(255,180,94,0.4)",
          }}
        >
          {isLast ? "BEGIN EXPEDITION" : "NEXT →"}
        </button>
      </div>
    </div>
  );
}

function HighlightOverlay({ elementId }: { elementId?: string }) {
  if (!elementId) return null;

  const element = typeof document !== "undefined" ? document.getElementById(elementId) : null;
  if (!element) return null;

  const rect = element.getBoundingClientRect();

  const pulseStyle = `
    @keyframes pulse { 
      0%, 100% { box-shadow: 0 0 0 9999px rgba(10,10,25,0.7), 0 0 30px rgba(255,180,94,0.5), inset 0 0 30px rgba(255,180,94,0.2); } 
      50% { box-shadow: 0 0 0 9999px rgba(10,10,25,0.7), 0 0 50px rgba(255,180,94,0.8), inset 0 0 50px rgba(255,180,94,0.4); } 
    }
  `;

  return (
    <div
      style={{
        position: "fixed",
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
        border: "2px solid #ffb45e",
        borderRadius: "12px",
        boxShadow: "0 0 0 9999px rgba(10,10,25,0.7), 0 0 30px rgba(255,180,94,0.5), inset 0 0 30px rgba(255,180,94,0.2)",
        pointerEvents: "none",
        zIndex: 9999,
        animation: "pulse 2s ease-in-out infinite",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: pulseStyle }} />
    </div>
  );
}

export function InteractiveTutorial({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showOverlay, setShowOverlay] = useState(() => !interactiveTutorialSeen());
  const step = TUTORIAL_STEPS[currentStep];
  const isLast = currentStep >= TUTORIAL_STEPS.length - 1;
  const narratedRef = useRef(false);

  useEffect(() => {
    if (showOverlay && !narratedRef.current) {
      narratedRef.current = true;
      const settings = loadVoiceSettings();
      speak(step.voiceText, { ...settings, enabled: true });
    }
  }, [currentStep, showOverlay, step.voiceText]);

  const handleNext = () => {
    if (isLast) {
      markInteractiveTutorialSeen();
      stopSpeaking();
      setShowOverlay(false);
      onComplete();
    } else {
      narratedRef.current = false;
      setCurrentStep(c => c + 1);
    }
  };

  const handleClose = () => {
    markInteractiveTutorialSeen();
    stopSpeaking();
    setShowOverlay(false);
    onComplete();
  };

  if (!showOverlay) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(10,10,25,0.6)",
          backdropFilter: "blur(4px)",
          zIndex: 9998,
        }}
      />
      <HighlightOverlay elementId={step.highlightElement} />
      <TutorialPanel step={step} onNext={handleNext} onClose={handleClose} isLast={isLast} />
      {step.fingerAnimation && (
        <div
          style={{
            position: "fixed",
            top: step.highlightElement ? "calc(50% + 120px)" : "calc(50% + 160px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10001,
            pointerEvents: "none",
          }}
        >
          <FingerPointer animation={step.fingerAnimation} />
        </div>
      )}
    </>
  );
}

export function TutorialTrigger({ children }: { children: React.ReactNode }) {
  const store = useLumen();

  const handleStart = () => {
    resetInteractiveTutorial();
    store.pushLog("Restarting interactive tutorial...");
    window.location.reload();
  };

  return (
    <button
      onClick={handleStart}
      style={{
        padding: "8px 16px",
        background: "linear-gradient(135deg, #ffb45e 0%, #ea580c 100%)",
        border: "none",
        borderRadius: "8px",
        color: "#0a0a15",
        fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
        cursor: "pointer",
        boxShadow: "0 4px 20px rgba(255,180,94,0.4)",
      }}
    >
      {children}
    </button>
  );
}