import { describe, expect, it } from "vitest";
import { parseVoiceCommand } from "../../src/audio/voice";

describe("parseVoiceCommand", () => {
  it("maps collect/interact phrases", () => {
    expect(parseVoiceCommand("collect metal").action).toBe("interact");
    expect(parseVoiceCommand("Take the circuit board").action).toBe("interact");
    expect(parseVoiceCommand("talk to survivor").action).toBe("interact");
  });

  it("maps fly/save/read/stop phrases", () => {
    expect(parseVoiceCommand("take off").action).toBe("fly");
    expect(parseVoiceCommand("save checkpoint").action).toBe("save");
    expect(parseVoiceCommand("read the log").action).toBe("readLog");
    expect(parseVoiceCommand("stop talking").action).toBe("stop");
  });

  it("marks unknown input", () => {
    const r = parseVoiceCommand("dance around");
    expect(r.action).toBe("unknown");
  });
});
