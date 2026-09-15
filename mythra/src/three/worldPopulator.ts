// World populator — fills empty space around locations with roads, props, ambient life.
// Every area gets multiple objects so the world reads as a game, not an empty stage.
import type { World, WorldObject } from "../types";
import { mulberry } from "./factory";

const BASE_DENSITY = 0.11; // objects per unit^2 around locations at medium density
const MIN_PROPS_PER_AREA = 14;
const MAX_PROPS_PER_AREA = 42;
const MIN_SPACING = 2.2; // min meters between procedural props
const MIN_DIST_FROM_STORY = 2.5; // keep procedural props off hand-placed mission objects
const MAX_LINK_DIST = 32;
const MAX_LINKS_PER_LOCATION = 2; // nearest-neighbour roads: connected, no spaghetti

/** Fill density follows the brief's clue density: sparse / normal / dense. */
const DENSITY_SCALE = { low: 0.55, medium: 1, high: 1.6 } as const;

interface PopulateOptions {
  theme: World["theme"];
  seed: number;
  worldBounds: number;
  density?: keyof typeof DENSITY_SCALE;
}

function makeIdGen(seed: number) {
  const rnd = mulberry(seed);
  let counter = 0;
  return () => {
    counter++;
    const a = Math.floor(rnd() * 1e9).toString(36);
    const b = Math.floor(rnd() * 1e9).toString(36);
    return `obj_gen_${a}_${b}_${counter}`;
  };
}

function addObject(world: World, obj: Omit<WorldObject, "id"> & { id?: string }, genId: () => string): void {
  const id = obj.id ?? genId();
  world.objects.push({ ...obj, id } as WorldObject);
}

function dist2(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0], dz = a[2] - b[2];
  return dx * dx + dz * dz;
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

export function populateWorld(world: World, opts: PopulateOptions): void {
  // Idempotent: strip any previous bake so re-running never duplicates.
  world.objects = world.objects.filter(
    (o) => !(o.metadata && (o.metadata as Record<string, unknown>).procedural),
  );
  const rnd = mulberry(opts.seed);
  const genId = makeIdGen(opts.seed);
  const { locations, settings } = world;
  const bounds = settings.worldBounds;

  // 1. Connect each location to its nearest unlocked neighbours with roads.
  // Nearest-neighbour (not all-pairs) keeps every area reachable without spaghetti.
  const open = locations.filter((l) => !l.locked);
  const linked = new Set<string>();
  const linkRoad = (a: (typeof locations)[number], b: (typeof locations)[number]): void => {
    const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    if (linked.has(key)) return;
    linked.add(key);
    const d2 = dist2(a.position, b.position);
    const segments = Math.max(2, Math.ceil(Math.sqrt(d2) / 7));
    const shortA = a.id.slice(-4);
    const shortB = b.id.slice(-4);
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const x = lerp(a.position[0], b.position[0], t);
      const z = lerp(a.position[2], b.position[2], t);
      // road segment
      addObject(world, {
        type: "machine",
        modelId: "road",
        name: `Access Road ${shortA}-${shortB}-${s}`,
        description: "Compacted regolith track.",
        locationId: a.id,
        position: [x, 0, z],
        rotation: [0, Math.atan2(b.position[2] - a.position[2], b.position[0] - a.position[0]), 0],
        scale: [1, 1, 1],
        interaction: { kind: "inspect", prompt: "Follow the road" },
        visibility: "visible",
        metadata: { procedural: true },
      }, genId);
      // streetlamps along road
      if (s % 2 === 0 && s > 0 && s < segments) {
        addObject(world, {
          type: "machine",
          modelId: "streetlamp",
          name: "Road Lamp",
          description: "Solar-charged path light.",
          locationId: a.id,
          position: [x + (rnd() - 0.5) * 2.4, 0, z + (rnd() - 0.5) * 2.4],
          rotation: [0, rnd() * Math.PI * 2, 0],
          scale: [1, 1, 1],
          interaction: { kind: "inspect", prompt: "Check lamp" },
          visibility: "visible",
          metadata: { procedural: true },
        }, genId);
      }
    }
  };
  for (const a of open) {
    const neighbours = open
      .filter((b) => b.id !== a.id)
      .map((b) => ({ b, d2: dist2(a.position, b.position) }))
      .filter(({ d2 }) => d2 <= MAX_LINK_DIST * MAX_LINK_DIST)
      .sort((p, q) => p.d2 - q.d2)
      .slice(0, MAX_LINKS_PER_LOCATION);
    for (const { b } of neighbours) linkRoad(a, b);
  }

  // 2. Populate each location area with ambient props
  for (const loc of locations) {
    if (loc.locked && !loc.tags.includes("start")) continue; // don't spoil hidden areas

    const [cx, , cz] = loc.position;
    const radius = Math.min(loc.radius * 1.5, 15);
    const scale = DENSITY_SCALE[opts.density ?? "medium"];
    const count = Math.max(
      Math.round(MIN_PROPS_PER_AREA * scale),
      Math.min(Math.round(MAX_PROPS_PER_AREA * scale), Math.floor(Math.PI * radius * radius * BASE_DENSITY * scale)),
    );

    const propPools: Record<string, Array<{ modelId: string; type: WorldObject["type"]; name: string; desc: string; scale: [number, number, number]; yOffset: number }>> = {
      // Mars / space / post-apocalyptic — colony clutter so no area feels empty
      mars: [
        { modelId: "scrap", type: "resource_node", name: "Debris Pile", desc: "Wind-scoured metal fragments.", scale: [0.8, 0.6, 0.8], yOffset: 0.3 },
        { modelId: "barrel", type: "container", name: "Storage Drum", desc: "Sealed chemical drum.", scale: [1, 1, 1], yOffset: 0.5 },
        { modelId: "container", type: "container", name: "Supply Crate", desc: "Landing manifest intact.", scale: [1, 1, 1], yOffset: 0.35 },
        { modelId: "drone", type: "machine", name: "Survey Drone", desc: "Inactive reconnaissance unit.", scale: [1, 1, 1], yOffset: 0.6 },
        { modelId: "rover", type: "vehicle", name: "Abandoned Rover", desc: "Wheels sunk in dust.", scale: [1.5, 1, 1.2], yOffset: 0.8 },
        { modelId: "landmark", type: "landmark", name: "Basalt Boulder", desc: "Volcanic ejecta.", scale: [1.2, 1, 1.2], yOffset: 0.4 },
        { modelId: "crystal", type: "crystal", name: "Crystal Outcrop", desc: "Glowing mineral vein.", scale: [0.8, 1.2, 0.8], yOffset: 0.5 },
        { modelId: "solar", type: "machine", name: "Spare Panel", desc: "Cracked but wired.", scale: [1.6, 0.5, 1.2], yOffset: 0.6 },
        { modelId: "beacon", type: "machine", name: "Relay Mast", desc: "Blinking position relay.", scale: [0.8, 1.2, 0.8], yOffset: 0 },
        { modelId: "console", type: "terminal", name: "Field Terminal", desc: "Dust in the keys.", scale: [1, 1, 1], yOffset: 0.4 },
        { modelId: "house", type: "building", name: "Hab Shelter", desc: "Pressurised half-dome.", scale: [1.1, 1, 1.1], yOffset: 0 },
        { modelId: "streetlamp", type: "machine", name: "Flood Mast", desc: "Solar-charged work light.", scale: [1, 1.2, 1], yOffset: 0 },
      ],
      // Fantasy / ancient ruins / forest
      fantasy: [
        { modelId: "tree", type: "landmark", name: "Ancient Tree", desc: "Roots drink deep.", scale: [1, 1.2, 1], yOffset: 0 },
        { modelId: "bush", type: "landmark", name: "Berry Bush", desc: "Edible if you know which.", scale: [0.8, 0.8, 0.8], yOffset: 0 },
        { modelId: "flower", type: "landmark", name: "Glowflower", desc: "Bioluminescent bloom.", scale: [0.6, 0.6, 0.6], yOffset: 0 },
        { modelId: "statue", type: "landmark", name: "Weathered Statue", desc: "Face worn by centuries.", scale: [1, 1.2, 1], yOffset: 0 },
        { modelId: "campfire", type: "machine", name: "Old Campfire", desc: "Ashes still warm.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "tent", type: "building", name: "Tattered Tent", desc: "Traveler's shelter.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "fountain", type: "machine", name: "Stone Well", desc: "Water runs deep.", scale: [1, 1, 1], yOffset: 0 },
      ],
      // Cyberpunk / city
      cyberpunk: [
        { modelId: "building", type: "building", name: "Mega-block Tower", desc: "Thousands sleep inside.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "streetlamp", type: "machine", name: "Neon Lamp", desc: "Holographic ad projector.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "bench", type: "container", name: "Transit Bench", desc: "Heated seat, fingerprint lock.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "trashbin", type: "container", name: "Recycler Unit", desc: "Sorts waste automatically.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "billboard", type: "landmark", name: "Holo-billboard", desc: "Cycles corporate dreams.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "car", type: "vehicle", name: "Autocab", desc: "Awaiting dispatch.", scale: [1, 1, 1], yOffset: 0.3 },
        { modelId: "phonebooth", type: "terminal", name: "Data Kiosk", desc: "Anonymous uplink.", scale: [1, 1, 1], yOffset: 0 },
      ],
      // Ocean / underwater
      ocean: [
        { modelId: "boat", type: "vehicle", name: "Research Sub", desc: "Pressure hull intact.", scale: [1, 1, 1], yOffset: -1 },
        { modelId: "container", type: "container", name: "Cargo Container", desc: "Watertight seal.", scale: [1, 1, 1], yOffset: -0.5 },
        { modelId: "crystal", type: "crystal", name: "Thermal Vent", desc: "Life thrives here.", scale: [1.5, 2, 1.5], yOffset: -2 },
        { modelId: "statue", type: "landmark", name: "Coral Monument", desc: "Grown, not built.", scale: [1.2, 1.5, 1.2], yOffset: -1 },
      ],
      // Desert
      desert: [
        { modelId: "cactus", type: "landmark", name: "Barrel Cactus", desc: "Water reservoir.", scale: [1, 1.2, 1], yOffset: 0 },
        { modelId: "palmtree", type: "landmark", name: "Date Palm", desc: "Oasis marker.", scale: [1, 1.5, 1], yOffset: 0 },
        { modelId: "tent", type: "building", name: "Nomad Tent", desc: "Woven goat hair.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "campfire", type: "machine", name: "Fire Pit", desc: "Night warmth.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "scrap", type: "resource_node", name: "Sand-buried Wreck", desc: "Metal ribs exposed.", scale: [1.5, 0.5, 1.5], yOffset: 0.3 },
      ],
      // Horror
      horror: [
        { modelId: "statue", type: "landmark", name: "Weeping Angel", desc: "Don't blink.", scale: [1, 1.3, 1], yOffset: 0 },
        { modelId: "campfire", type: "machine", name: "Dying Embers", desc: "Warmth fades.", scale: [0.8, 0.8, 0.8], yOffset: 0 },
        { modelId: "tree", type: "landmark", name: "Dead Tree", desc: "No leaves ever.", scale: [1, 1.5, 1], yOffset: 0 },
        { modelId: "phonebooth", type: "terminal", name: "Dead Line", desc: "Static only.", scale: [1, 1, 1], yOffset: 0 },
      ],
      // Space station / orbit — clean hardware, glowing relays
      space: [
        { modelId: "console", type: "terminal", name: "Ops Terminal", desc: "Telemetry scrolling.", scale: [1, 1, 1], yOffset: 0.4 },
        { modelId: "beacon", type: "machine", name: "Nav Relay", desc: "Blinking position relay.", scale: [0.8, 1.2, 0.8], yOffset: 0 },
        { modelId: "solar", type: "machine", name: "Panel Wing", desc: "Drinking starlight.", scale: [1.6, 0.5, 1.2], yOffset: 0.6 },
        { modelId: "barrel", type: "container", name: "Reaction Drum", desc: "Sealed propellant.", scale: [1, 1, 1], yOffset: 0.5 },
        { modelId: "container", type: "container", name: "Cargo Pod", desc: "Vacuum-rated case.", scale: [1, 1, 1], yOffset: 0.35 },
        { modelId: "drone", type: "machine", name: "Service Drone", desc: "Parked on its pad.", scale: [1, 1, 1], yOffset: 0.6 },
        { modelId: "locker", type: "container", name: "Suit Locker", desc: "EVA suit inside.", scale: [1, 1.4, 1], yOffset: 0 },
        { modelId: "crystal", type: "crystal", name: "Reactor Shard", desc: "Warm to the eye.", scale: [0.8, 1.2, 0.8], yOffset: 0.5 },
        { modelId: "streetlamp", type: "machine", name: "Deck Light", desc: "Cold white flood.", scale: [1, 1.2, 1], yOffset: 0 },
      ],
      // Forest / wilds — trees, water, old camps
      forest: [
        { modelId: "tree", type: "landmark", name: "Tall Pine", desc: "Sap and birdsong.", scale: [1.1, 1.4, 1.1], yOffset: 0 },
        { modelId: "bush", type: "landmark", name: "Berry Bush", desc: "Edible if you know which.", scale: [0.9, 0.9, 0.9], yOffset: 0 },
        { modelId: "flower", type: "landmark", name: "Wildflower", desc: "Bees work it.", scale: [0.7, 0.7, 0.7], yOffset: 0 },
        { modelId: "campfire", type: "machine", name: "Old Campfire", desc: "Ashes still warm.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "tent", type: "building", name: "Trail Tent", desc: "Smells of canvas.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "pond", type: "landmark", name: "Still Pond", desc: "Drinkable upstream.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "statue", type: "landmark", name: "Mossy Marker", desc: "Trail shrine.", scale: [0.9, 1, 0.9], yOffset: 0 },
      ],
      // Ancient ruins — fallen stone, offerings, old fires
      ancient_ruins: [
        { modelId: "landmark", type: "landmark", name: "Fallen Obelisk", desc: "Glyphs half-erased.", scale: [1.3, 1.1, 1.3], yOffset: 0.4 },
        { modelId: "statue", type: "landmark", name: "Broken Idol", desc: "Face worn away.", scale: [1, 1.2, 1], yOffset: 0 },
        { modelId: "tent", type: "building", name: "Digger Tent", desc: "Someone camps here.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "campfire", type: "machine", name: "Cookfire", desc: "Recent coals.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "fountain", type: "machine", name: "Dry Basin", desc: "Rains fill it.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "torch", type: "machine", name: "Offering Torch", desc: "Still burns.", scale: [1, 1, 1], yOffset: 0 },
      ],
      // Post-apocalyptic — wrecks, drums, survivor camps
      post_apocalyptic: [
        { modelId: "scrap", type: "resource_node", name: "Wreck Heap", desc: "Picked nearly clean.", scale: [1, 0.8, 1], yOffset: 0.3 },
        { modelId: "barrel", type: "container", name: "Fuel Drum", desc: "Smells of petrol.", scale: [1, 1, 1], yOffset: 0.5 },
        { modelId: "container", type: "container", name: "Nailed Crate", desc: "Nailed shut twice.", scale: [1, 1, 1], yOffset: 0.35 },
        { modelId: "tent", type: "building", name: "Lean-to", desc: "Tarp and poles.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "campfire", type: "machine", name: "Barrel Fire", desc: "Someone's home.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "car", type: "vehicle", name: "Dead Sedan", desc: "Stripped to the frame.", scale: [1, 1, 1], yOffset: 0.3 },
        { modelId: "streetlamp", type: "machine", name: "Dead Lamp", desc: "Hasn't lit in years.", scale: [1, 1.1, 1], yOffset: 0 },
      ],
      // Default / generic
      default: [
        { modelId: "scrap", type: "resource_node", name: "Scrap Metal", desc: "Usable fragments.", scale: [1, 1, 1], yOffset: 0.3 },
        { modelId: "container", type: "container", name: "Wooden Crate", desc: "Nailed shut.", scale: [1, 1, 1], yOffset: 0.35 },
        { modelId: "barrel", type: "container", name: "Oil Drum", desc: "Rusted but sealed.", scale: [1, 1, 1], yOffset: 0.5 },
        { modelId: "bush", type: "landmark", name: "Shrub", desc: "Dry branches.", scale: [1, 1, 1], yOffset: 0 },
        { modelId: "landmark", type: "landmark", name: "Field Stone", desc: "Glacial erratic.", scale: [1.2, 1, 1.2], yOffset: 0.4 },
      ],
    };

    const pool = propPools[opts.theme] ?? propPools.default;
    const placed: [number, number][] = [];

    type PoolEntry = (typeof pool)[number];
    const placeOne = (prop: PoolEntry): void => {
      // Poisson-disc-ish spacing, kept clear of hand-placed story objects
      let x = 0, z = 0, attempts = 0;
      let ok = false;
      do {
        const angle = rnd() * Math.PI * 2;
        const dist = radius * Math.sqrt(rnd());
        x = cx + Math.cos(angle) * dist;
        z = cz + Math.sin(angle) * dist;
        attempts++;
        if (attempts > 24) break;
        const clearOfProps = !placed.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < MIN_SPACING * MIN_SPACING);
        // Only hand-placed story objects repel — neighbouring areas' own
        // procedural sprawl must not starve later locations (tower bug).
        const clearOfStory = !world.objects.some((o) =>
          !(o.metadata && (o.metadata as Record<string, unknown>).procedural) &&
          (o.position[0] - x) ** 2 + (o.position[2] - z) ** 2 < MIN_DIST_FROM_STORY * MIN_DIST_FROM_STORY);
        ok = clearOfProps && clearOfStory;
      } while (!ok);

      if (!ok) return;
      placed.push([x, z]);
      addObject(world, {
        type: prop.type,
        modelId: prop.modelId,
        name: prop.name,
        description: prop.desc,
        locationId: loc.id,
        position: [x, prop.yOffset, z],
        rotation: [0, rnd() * Math.PI * 2, 0],
        scale: prop.scale,
        interaction: { kind: "inspect", prompt: `Examine ${prop.name.toLowerCase()}` },
        visibility: "visible",
        metadata: { procedural: true },
      }, genId);
    };

    for (let i = 0; i < count; i++) {
      placeOne(pool[Math.floor(rnd() * pool.length)]);
    }

    // Smart bias by location role: supply clutter where resources live,
    // markers where clues hide — so each area's fill matches its purpose.
    const bias: { kinds: WorldObject["type"][]; n: number }[] = [];
    if (loc.tags.includes("resource")) bias.push({ kinds: ["container", "resource_node"], n: 3 });
    if (loc.tags.includes("clue")) bias.push({ kinds: ["landmark"], n: 2 });
    for (const { kinds, n } of bias) {
      const fitting = pool.filter((p) => kinds.includes(p.type));
      if (fitting.length === 0) continue;
      for (let k = 0; k < n; k++) placeOne(fitting[Math.floor(rnd() * fitting.length)]);
    }

    // Add benches/lights near mission locations
    if (loc.tags.includes("mission") || loc.tags.includes("start")) {
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + rnd() * 0.5;
        const dist = loc.radius * 0.7;
        const x = cx + Math.cos(angle) * dist;
        const z = cz + Math.sin(angle) * dist;
        addObject(world, {
          type: "machine",
          modelId: "streetlamp",
          name: "Area Light",
          description: "Floodlight on a pole.",
          locationId: loc.id,
          position: [x, 0, z],
          rotation: [0, angle + Math.PI / 2, 0],
          scale: [1, 1, 1],
          interaction: { kind: "inspect", prompt: "Check light" },
          visibility: "visible",
          metadata: { procedural: true },
        }, genId);
      }
    }

    // Add a landmark at location center if not start
    if (!loc.tags.includes("start") && !loc.locked) {
      const landmarkTypes = ["landmark", "statue", "windmill", "watertower", "telescope"];
      const lm = landmarkTypes[Math.floor(rnd() * landmarkTypes.length)];
      addObject(world, {
        type: "landmark",
        modelId: lm,
        name: `${loc.name} Beacon`,
        description: `Nav marker for ${loc.name.toLowerCase()}.`,
        locationId: loc.id,
        position: [cx, 0, cz],
        rotation: [0, rnd() * Math.PI * 2, 0],
        scale: [1.5, 1.5, 1.5],
        interaction: { kind: "inspect", prompt: "Read beacon" },
        visibility: "visible",
        metadata: { procedural: true },
      }, genId);
    }
  }

  // 3. Add some global ambient objects (not tied to locations)
  const globalCount = Math.floor(bounds * bounds * 0.001);
  for (let i = 0; i < globalCount; i++) {
    const x = (rnd() - 0.5) * bounds * 2;
    const z = (rnd() - 0.5) * bounds * 2;
    // Skip if too close to any location
    if (locations.some(l => (l.position[0] - x) ** 2 + (l.position[2] - z) ** 2 < 100)) continue;

    const globalProps: { modelId: string; type: "landmark" | "crystal"; name: string; desc: string; scale: [number, number, number] }[] = [
      { modelId: "statue", type: "landmark", name: "Standing Stone", desc: "Ancient marker.", scale: [1, 1, 1] },
      { modelId: "bush", type: "landmark", name: "Wild Bush", desc: "Hardy survivor.", scale: [1, 1, 1] },
      { modelId: "crystal", type: "crystal", name: "Crystal Shard", desc: "Catches the light.", scale: [0.6, 0.8, 0.6] },
    ];
    const prop = globalProps[Math.floor(rnd() * globalProps.length)];
    addObject(world, {
      type: prop.type,
      modelId: prop.modelId,
      name: prop.name,
      description: prop.desc,
      locationId: locations[0]?.id ?? "loc_landing",
      position: [x, 0, z],
      rotation: [0, rnd() * Math.PI * 2, 0],
      scale: prop.scale,
      interaction: { kind: "inspect", prompt: `Examine ${prop.name.toLowerCase()}` },
      visibility: "visible",
      metadata: { procedural: true, global: true },
    }, genId);
  }
}

// Convenience: populate demo world in-place for testing
export function populateDemoWorld(world: World): World {
  const clone = structuredClone(world);
  populateWorld(clone, { theme: clone.theme, seed: clone.environment.terrainSeed, worldBounds: clone.settings.worldBounds });
  return clone;
}