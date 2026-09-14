import { describe, expect, it } from "vitest";
import { filterNotesByTarget, makeVoiceNoteId, mapMicError, voiceTargetKey } from "../../src/audio/voiceNotes";
import type { VoiceNoteMeta } from "../../src/audio/voiceNotes";

function meta(partial: Partial<VoiceNoteMeta> & { id: string }): VoiceNoteMeta {
  return {
    worldId: "w1",
    targetKind: "clue",
    targetId: "c1",
    label: "test",
    author: "you",
    createdAt: new Date().toISOString(),
    durationSec: 5,
    mime: "audio/webm",
    ...partial,
  };
}

describe("voiceNotes targets", () => {
  it("builds stable target keys", () => {
    expect(voiceTargetKey("clue", "c1")).toBe("clue:c1");
    expect(voiceTargetKey("mission", "m1")).toBe("mission:m1");
  });

  it("mints unique ids", () => {
    const ids = new Set([makeVoiceNoteId(), makeVoiceNoteId(), makeVoiceNoteId()]);
    expect(ids.size).toBe(3);
  });

  it("filters clips per component + world", () => {
    const notes = [
      meta({ id: "a", targetKind: "clue", targetId: "c1", worldId: "w1" }),
      meta({ id: "b", targetKind: "mission", targetId: "m1", worldId: "w1" }),
      meta({ id: "c", targetKind: "clue", targetId: "c1", worldId: "w2" }),
    ];
    expect(filterNotesByTarget(notes, "clue", "c1", "w1").map((n) => n.id)).toEqual(["a"]);
    expect(filterNotesByTarget(notes, "clue", "c1").map((n) => n.id).sort()).toEqual(["a", "c"]);
    expect(filterNotesByTarget(notes, "object", "o9", "w1")).toEqual([]);
  });

  it("maps mic failures to actionable messages (never raw browser text)", () => {
    const busy = Object.assign(new Error("Could not start audio source"), { name: "NotReadableError" });
    expect(mapMicError(busy)).toMatch(/busy|unavailable/i);
    expect(mapMicError(busy)).toMatch(/Dictate/);
    expect(mapMicError(Object.assign(new Error("denied"), { name: "NotAllowedError" }))).toMatch(/allow.*microphone|blocked/i);
    expect(mapMicError(Object.assign(new Error("none"), { name: "NotFoundError" }))).toMatch(/No microphone/i);
    // raw string fallback (no name) with the same browser text
    expect(mapMicError("Could not start audio source")).toMatch(/busy|unavailable/i);
  });
});
