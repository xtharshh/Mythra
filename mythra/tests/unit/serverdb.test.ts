import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dbFile = join(tmpdir(), `mythra-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}.db`);
process.env.MYTHRA_DB = dbFile;

let store: typeof import("../../server/db.js").store;

describe("sqlite store", () => {
  beforeAll(async () => {
    ({ store } = await import("../../server/db.js"));
  });

  afterAll(() => {
    try {
      const fs = require("node:fs") as typeof import("node:fs");
      fs.rmSync(dbFile, { force: true });
    } catch {
      /* ignore */
    }
  });

  it("round-trips progress per explorer+world", () => {
    store.putProgress("a@x.co", "w1", { inventory: { metal: 4 } });
    expect(store.getProgress("a@x.co", "w1")).toEqual({ inventory: { metal: 4 } });
    expect(store.getProgress("b@x.co", "w1")).toBeUndefined();
  });

  it("keeps personal bests on the board", () => {
    store.upsertScore("w1", "ivan", 3, 5);
    store.upsertScore("w1", "ivan", 2, 9); // worse run must not overwrite
    const board = store.boardFor("w1");
    expect(board.find((e) => e.user === "ivan")).toMatchObject({ missions: 3, clues: 5 });
  });

  it("ranks racers and scopes presence to rooms", () => {
    store.putRoom("r1", "w1", "ivan");
    store.putRacer("r1", "ivan", 5, 9, true);
    store.putRacer("r1", "zoe", 5, 9, false);
    const ranked = store.racersFor("r1", "w1");
    expect(ranked[0].user).toBe("ivan"); // finished wins ties
    store.heartbeat("w1", "a@x.co", [1, 2, 3], "s", "r1");
    store.heartbeat("w1", "b@x.co", [4, 5, 6], "s", "");
    expect(store.peersFor("w1", "r1", 15000).map((p) => p.user)).toEqual(["a"]);
    expect(store.peersFor("w1", "", 15000).map((p) => p.user).sort()).toEqual(["a", "b"]);
  });

  it("auth codes round-trip and burn", () => {
    store.setCode("c@x.co", "123456", Date.now() + 60000);
    expect(store.getCode("c@x.co")?.code).toBe("123456");
    store.addToken("tok", "c@x.co");
    expect(store.emailForToken("tok")).toBe("c@x.co");
    store.delCode("c@x.co");
    expect(store.getCode("c@x.co")).toBeUndefined();
  });
});
