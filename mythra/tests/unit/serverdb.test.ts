import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dbFile = join(tmpdir(), `mythra-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}.db`);
process.env.MYTHRA_DB = dbFile;

let store: typeof import("../../server/db.js").store;
let sqliteStore: import("../../server/store.js").Store;

describe("sqlite store", () => {
  beforeAll(async () => {
    ({ store } = await import("../../server/db.js"));
    const sqlite = await import("../../server/sqlite.js");
    sqliteStore = sqlite.createSqliteStore(dbFile);
  });

  afterAll(() => {
    try {
      const fs = require("node:fs") as typeof import("node:fs");
      fs.rmSync(dbFile, { force: true });
    } catch {
      /* ignore */
    }
  });

  it("round-trips progress per explorer+world", async () => {
    await store.putProgress("a@x.co", "w1", { inventory: { metal: 4 } });
    expect(await store.getProgress("a@x.co", "w1")).toEqual({ inventory: { metal: 4 } });
    expect(await store.getProgress("b@x.co", "w1")).toBeUndefined();
  });

  it("keeps personal bests on the board", async () => {
    await store.upsertScore("w1", "ivan", 3, 5);
    await store.upsertScore("w1", "ivan", 2, 9); // worse run must not overwrite
    const board = await store.boardFor("w1");
    expect(board.find((e) => e.user === "ivan")).toMatchObject({ missions: 3, clues: 5 });
  });

  it("ranks racers and scopes presence to rooms", async () => {
    await store.putRoom("r1", "w1", "ivan");
    await store.putRacer("r1", "ivan", 5, 9, true);
    await store.putRacer("r1", "zoe", 5, 9, false);
    const ranked = await store.racersFor("r1", "w1");
    expect(ranked[0].user).toBe("ivan"); // finished wins ties
    await store.heartbeat("w1", "a@x.co", [1, 2, 3], "s", "r1");
    await store.heartbeat("w1", "b@x.co", [4, 5, 6], "s", "");
    expect((await store.peersFor("w1", "r1", 15000)).map((p) => p.user)).toEqual(["a"]);
    expect((await store.peersFor("w1", "", 15000)).map((p) => p.user).sort()).toEqual(["a", "b"]);
  });

  it("stores tale snapshots for short room links", async () => {
    expect(await store.getRoomWorld("r9")).toBeUndefined();
    await store.putRoom("r9", "w9", "ivan");
    await store.putRoomWorld("r9", { id: "w9", name: "Pocket tale" });
    expect(await store.getRoomWorld("r9")).toMatchObject({ id: "w9", name: "Pocket tale" });
  });

  it("lists published tales parsed and ready for discovery", async () => {
    await store.putWorld("dw", { id: "dw", name: "Shared tale", missions: [], clues: [] }, "ivan");
    const listed = (await store.listWorlds()).find((w) => w.id === "dw");
    expect(listed?.data).toMatchObject({ name: "Shared tale" });
  });

  it("syncs shelves and checkpoints per explorer (ACID side)", async () => {
    expect(await store.getLibrary("_sync@x.co")).toBeUndefined();
    const at = await store.putLibrary("_sync@x.co", { worlds: [{ id: "w1" }], contributions: [], versions: [] });
    expect(await store.getLibrary("_sync@x.co")).toMatchObject({ updatedAt: at });
    expect(await store.getCheckpoints("_sync@x.co", "w1")).toBeUndefined();
    await store.putCheckpoints("_sync@x.co", "w1", [{ id: "c1" }]);
    expect((await store.getCheckpoints("_sync@x.co", "w1"))?.data).toEqual([{ id: "c1" }]);
  });

  it("auth codes round-trip and burn", async () => {
    await store.setCode("c@x.co", "123456", Date.now() + 60000);
    expect((await store.getCode("c@x.co"))?.code).toBe("123456");
    await store.addToken("tok", "c@x.co");
    expect(await store.emailForToken("tok")).toBe("c@x.co");
    await store.delCode("c@x.co");
    expect(await store.getCode("c@x.co")).toBeUndefined();
  });

  it("sqlite and postgres stores speak the same contract", async () => {
    const pg = await import("../../server/pg.js");
    const fake = pg.createPgStore(async () => []);
    expect(Object.keys(fake).sort()).toEqual(Object.keys(sqliteStore).sort());
  });
});
