import { describe, expect, it } from "vitest";
import { binaryToInt, decodeMixed, decoderTables, encodeMixed, intToBinary, intToRoman, romanToInt } from "../../src/game/codes";

describe("ciphers (no plaintext answers)", () => {
  it("reads Roman numerals", () => {
    expect(romanToInt("VII")).toBe(7);
    expect(romanToInt("iv")).toBe(4);
    expect(romanToInt("IX")).toBe(9);
    expect(romanToInt("hello")).toBeNaN();
  });

  it("reads binary runs", () => {
    expect(binaryToInt("1001")).toBe(9);
    expect(binaryToInt("11")).toBe(3);
    expect(binaryToInt("102")).toBeNaN();
  });

  it("round-trips digits both ways", () => {
    for (let d = 1; d <= 9; d++) {
      expect(romanToInt(intToRoman(d))).toBe(d);
      expect(binaryToInt(intToBinary(d))).toBe(d);
    }
  });

  it("decodes the ridge tongue to the hatch code", () => {
    expect(decodeMixed("VII · 11 · IV · 1001")).toBe("7349");
    expect(encodeMixed("7349")).toBe("VII · 11 · IV · 1001");
    expect(decodeMixed("garbage !!")).toBe("");
  });

  it("prints a fair decoder ring", () => {
    const table = decoderTables();
    expect(table).toHaveLength(10);
    expect(table[7]).toEqual({ digit: 7, roman: "VII", binary: "111" });
  });
});
