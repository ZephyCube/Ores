import "./style.js";
import './smelt.js'; // AutoSmelt (based on Simple AutoSmelt by Rezn1r, MIT), merged into this pack
import { world, system } from '@minecraft/server';
import { smeltAfterHammer } from './smelt.js';
import { on, appliesIn } from './features.js';

// ZephyCube Ores: adds extra ore veins (about double the vanilla amount) to chunks the first time a player is near
// them, so land that was explored before the change gets the same ore as new land. Overworld: only natural
// stone/deepslate is replaced. Nether: only netherrack. Each chunk is done once per dimension; the done-list is saved
// in the world. Which dimensions get extra veins and double drops is set in the /zc:oresmodules menu.
const CONFIG = {
  radiusChunks: 3,          // chunks around each player that are topped up
  scanEveryTicks: 40,
  maxQueue: 60,
  // veins per chunk, size (blocks), y range
  doubleDrops: true,        // breaking an ore gives its drops twice (not with Silk Touch, not in creative)
  maxDoubledPerBreak: 8,    // safety cap: item entities copied per ore broken
  ores: [
    { name: "coal",     veins: 20, size: 12, minY: 0,   maxY: 160 },
    { name: "iron",     veins: 14, size: 9,  minY: -32, maxY: 72  },
    { name: "copper",   veins: 8,  size: 10, minY: -16, maxY: 96  },
    { name: "gold",     veins: 3,  size: 9,  minY: -64, maxY: 32  },
    { name: "redstone", veins: 6,  size: 8,  minY: -64, maxY: 16  },
    { name: "lapis",    veins: 2,  size: 7,  minY: -64, maxY: 64  },
    { name: "diamond",  veins: 3,  size: 6,  minY: -64, maxY: 16  }
  ]
};
const STONE = new Set(["minecraft:stone", "minecraft:andesite", "minecraft:diorite", "minecraft:granite", "minecraft:tuff"]);
const DEEP = new Set(["minecraft:deepslate"]);
// Nether: about the vanilla amount again of quartz and Nether gold (ancient debris is left alone)
const NETHER_ORES = [
  { block: "minecraft:quartz_ore",      veins: 16, size: 14, minY: 10, maxY: 117 },
  { block: "minecraft:nether_gold_ore", veins: 10, size: 10, minY: 10, maxY: 117 }
];
// 2x ancient debris (its own switch): the vanilla amount again, one large and one small vein per chunk
const DEBRIS_ORES = [
  { block: "minecraft:ancient_debris", veins: 1, size: 3, minY: 8, maxY: 24 },
  { block: "minecraft:ancient_debris", veins: 1, size: 2, minY: 8, maxY: 119 }
];
const DEBRIS_HOST = new Set(["minecraft:netherrack", "minecraft:basalt", "minecraft:blackstone"]);
// jobs: dimension, switch, done-list key prefix (the Overworld keeps the original one), ores, and which block becomes what.
// Each job has its own done-list, so turning a switch on later still tops up chunks other jobs already did.
const JOBS = {
  overworld: {
    dim: "minecraft:overworld", sw: "veins", prefix: "wo:r", ores: CONFIG.ores,
    oreFor: (ore, id) => (DEEP.has(id) ? `minecraft:deepslate_${ore.name}_ore` : STONE.has(id) ? `minecraft:${ore.name}_ore` : undefined)
  },
  nether: {
    dim: "minecraft:nether", sw: "veins", prefix: "wo:rn", ores: NETHER_ORES,
    oreFor: (ore, id) => (id === "minecraft:netherrack" ? ore.block : undefined)
  },
  debris: {
    dim: "minecraft:nether", sw: "debris", prefix: "wo:rd", ores: DEBRIS_ORES,
    oreFor: (ore, id) => (DEBRIS_HOST.has(id) ? ore.block : undefined)
  }
};

// ---- done-list: one property per 32x32 chunk region, 1024 bits as 256 hex characters
const regions = new Map();
const rKey = (job, rx, rz) => `${JOBS[job].prefix}:${rx}:${rz}`;
function region(job, rx, rz) {
  const k = rKey(job, rx, rz);
  let r = regions.get(k);
  if (!r) {
    r = new Uint8Array(128);
    try {
      const s = world.getDynamicProperty(k);
      if (typeof s === "string") for (let i = 0; i < 128 && i * 2 + 1 < s.length; i++) r[i] = parseInt(s.substr(i * 2, 2), 16) || 0;
    } catch { }
    regions.set(k, r);
  }
  return r;
}
const bitPos = (cx, cz) => ((cz & 31) << 5) | (cx & 31);
function isDone(job, cx, cz) {
  const r = region(job, cx >> 5, cz >> 5), b = bitPos(cx, cz);
  return (r[b >> 3] & (1 << (b & 7))) !== 0;
}
function markDone(job, cx, cz) {
  const rx = cx >> 5, rz = cz >> 5, r = region(job, rx, rz), b = bitPos(cx, cz);
  r[b >> 3] |= 1 << (b & 7);
  let s = "";
  for (let i = 0; i < 128; i++) s += r[i].toString(16).padStart(2, "0");
  try { world.setDynamicProperty(rKey(job, rx, rz), s); } catch { }
}

const queue = [];
const queued = new Set();
let running = false;
let doneCount = 0;

function loaded(dim, cx, cz) {
  try { return !!dim.getBlock({ x: cx * 16 + 8, y: 64, z: cz * 16 + 8 }) && !!dim.getBlock({ x: cx * 16, y: 64, z: cz * 16 }) && !!dim.getBlock({ x: cx * 16 + 15, y: 64, z: cz * 16 + 15 }); }
  catch { return false; }
}

function* topUp(dim, job, cx, cz) {
  const hr = dim.heightRange;
  const d = JOBS[job];
  let ops = 0;
  for (const ore of d.ores) {
    const lo = Math.max(hr.min, ore.minY), hi = Math.min(hr.max - 1, ore.maxY);
    for (let v = 0; v < ore.veins; v++) {
      let x = cx * 16 + Math.floor(Math.random() * 16);
      let y = lo + Math.floor(Math.random() * (hi - lo + 1));
      let z = cz * 16 + Math.floor(Math.random() * 16);
      for (let i = 0; i < ore.size; i++) {
        try {
          const b = dim.getBlock({ x, y, z });
          const id = b?.typeId;
          const to = id && d.oreFor(ore, id);
          if (to) b.setType(to);
        } catch { }
        x = Math.min(cx * 16 + 15, Math.max(cx * 16, x + Math.floor(Math.random() * 3) - 1));
        y = Math.min(hi, Math.max(lo, y + Math.floor(Math.random() * 3) - 1));
        z = Math.min(cz * 16 + 15, Math.max(cz * 16, z + Math.floor(Math.random() * 3) - 1));
        if (++ops % 60 === 0) yield;
      }
    }
  }
}

function* worker() {
  while (queue.length) {
    const { job, cx, cz } = queue.shift();
    queued.delete(`${job}|${cx},${cz}`);
    try {
      const j = JOBS[job];
      if (!appliesIn(j.sw, j.dim)) continue;
      const dim = world.getDimension(j.dim);
      if (isDone(job, cx, cz) || !loaded(dim, cx, cz)) continue;
      yield* topUp(dim, job, cx, cz);
      markDone(job, cx, cz);
      if (++doneCount % 100 === 0) console.warn(`[Ores] ${doneCount} chunks topped up since start`);
    } catch (e) { console.warn(`[Ores] chunk ${cx},${cz} (${job}): ${e}`); }
    yield;
  }
  running = false;
}

system.runInterval(() => {
  if (queue.length >= CONFIG.maxQueue) return;
  const cands = [];
  for (const p of world.getAllPlayers()) {
    try {
      const dimId = p.dimension.id;
      const jobs = Object.keys(JOBS).filter((k) => JOBS[k].dim === dimId && appliesIn(JOBS[k].sw, dimId));
      if (!jobs.length) continue;
      const pcx = Math.floor(p.location.x / 16), pcz = Math.floor(p.location.z / 16);
      for (let dx = -CONFIG.radiusChunks; dx <= CONFIG.radiusChunks; dx++) {
        for (let dz = -CONFIG.radiusChunks; dz <= CONFIG.radiusChunks; dz++) {
          const cx = pcx + dx, cz = pcz + dz;
          for (const job of jobs) {
            if (queued.has(`${job}|${cx},${cz}`) || isDone(job, cx, cz)) continue;
            cands.push({ job, cx, cz, dist: dx * dx + dz * dz });
          }
        }
      }
    } catch { }
  }
  cands.sort((a, b) => a.dist - b.dist);
  for (const c of cands) {
    if (queue.length >= CONFIG.maxQueue) break;
    const k = `${c.job}|${c.cx},${c.cz}`;
    if (queued.has(k)) continue;
    queued.add(k); queue.push({ job: c.job, cx: c.cx, cz: c.cz });
  }
  if (queue.length && !running) { running = true; system.runJob(worker()); }
}, CONFIG.scanEveryTicks);


// ---------------------------------------------------------------------------------------------------------------
// Double ore drops. Before the break we remember the item entities already lying near the block; after the break,
// every new item near it that belongs to that ore (raw drop or the smelted form, because AutoSmelt may have
// converted it already) is copied once. AutoSmelt then smelts the copy like any other drop. Silk Touch is skipped,
// so the ore block itself is never doubled. Only blocks broken by a player count (TNT, pistons: not doubled).
const DROPS = {
  coal_ore: ["coal"], iron_ore: ["raw_iron", "iron_ingot"], copper_ore: ["raw_copper", "copper_ingot"],
  gold_ore: ["raw_gold", "gold_ingot"], redstone_ore: ["redstone"], lit_redstone_ore: ["redstone"], lapis_ore: ["lapis_lazuli"],
  diamond_ore: ["diamond"], emerald_ore: ["emerald"], nether_gold_ore: ["gold_nugget"], quartz_ore: ["quartz"],
  ancient_debris: ["ancient_debris", "netherite_scrap"]
};
const DEBRIS = "minecraft:ancient_debris";
// Is doubling on for this block in this dimension? Ancient debris has its own switch; other ores use the dimension switches.
const doubleOn = (typeId, dimId) => (typeId === DEBRIS ? on("drops_debris") : appliesIn("drops", dimId));

// Ancient debris drops itself, so doubling debris a player placed would be an endless dupe (place, mine, get two).
// Placed debris is remembered per 512x512 area (world property wo:pd:<dim>:<rx>:<rz>) and never doubled. A piston
// that moves remembered debris also marks the blocks around it, so moving it does not make it count as natural.
const placedCache = new Map(); // property key -> Set of "x,y,z"
const pdKey = (dimId, l) => `wo:pd:${dimId.replace("minecraft:", "")}:${Math.floor(l.x / 512)}:${Math.floor(l.z / 512)}`;
const pkey = (l) => `${Math.floor(l.x)},${Math.floor(l.y)},${Math.floor(l.z)}`;
function placedSet(dimId, l) {
  const k = pdKey(dimId, l);
  let s = placedCache.get(k);
  if (!s) {
    s = new Set();
    try { const v = world.getDynamicProperty(k); if (typeof v === "string") for (const p of JSON.parse(v)) s.add(p); } catch { }
    placedCache.set(k, s);
  }
  return s;
}
function savePlaced(dimId, l) {
  const k = pdKey(dimId, l), s = placedSet(dimId, l);
  try { world.setDynamicProperty(k, s.size ? JSON.stringify([...s]) : undefined); } catch { }
}
const isPlaced = (dimId, l) => placedSet(dimId, l).has(pkey(l));
function setPlaced(dimId, l, yes) {
  const s = placedSet(dimId, l), k = pkey(l);
  if (yes === s.has(k)) return;
  if (yes) s.add(k); else s.delete(k);
  savePlaced(dimId, l);
}
world.afterEvents.playerPlaceBlock.subscribe((ev) => {
  try { if (ev.block.typeId === DEBRIS) setPlaced(ev.block.dimension.id, ev.block.location, true); } catch { }
});
world.afterEvents.pistonActivate.subscribe((ev) => {
  try {
    const dim = ev.dimension ?? ev.block?.dimension;
    const moved = ev.piston.getAttachedBlocksLocations().filter((l) => isPlaced(dim.id, l));
    for (const l of moved) {
      for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        setPlaced(dim.id, { x: Math.floor(l.x) + dx, y: Math.floor(l.y) + dy, z: Math.floor(l.z) + dz }, true);
      }
    }
  } catch { }
});
function dropsFor(typeId) {
  if (!typeId.startsWith("minecraft:")) return null;
  const base = typeId.slice(10).replace(/^deepslate_/, "");
  return DROPS[base] ?? null;
}
const doubled = new Set();          // entity ids already handled (originals and copies)
const snapshots = new Map();        // "dim:x,y,z" -> { ids:Set, tick }

function nearItems(dim, loc, r) {
  try { return dim.getEntities({ type: "minecraft:item", location: { x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5 }, maxDistance: r }); }
  catch { return []; }
}
const bkey = (dim, l) => `${dim.id}:${l.x},${l.y},${l.z}`;

function hasSilk(item) {
  try { return !!item?.getComponent("minecraft:enchantable")?.getEnchantments().some(e => e.type.id === "silk_touch"); }
  catch { return false; }
}
function creative(p) {
  try { return String(p.getGameMode()).toLowerCase() === "creative"; } catch { return false; }
}

world.beforeEvents.playerBreakBlock.subscribe((ev) => {
  if (!CONFIG.doubleDrops) return;
  try {
    const id = ev.block.typeId;
    if (!dropsFor(id) || !doubleOn(id, ev.block.dimension.id)) return;
    const ids = new Set();
    for (const e of nearItems(ev.block.dimension, ev.block.location, 3)) ids.add(e.id);
    snapshots.set(bkey(ev.block.dimension, ev.block.location), { ids, tick: system.currentTick });
    if (snapshots.size > 200) for (const [k, v] of snapshots) if (system.currentTick - v.tick > 40) snapshots.delete(k);
  } catch { }
});

function copyDrops(dim, loc, wanted, snap, budget) {
  let n = 0;
  for (const e of nearItems(dim, loc, 3)) {
    if (n >= budget) break;
    try {
      if (!e.isValid || doubled.has(e.id) || snap.ids.has(e.id)) continue;
      const st = e.getComponent("minecraft:item")?.itemStack;
      if (!st || !wanted.includes(st.typeId.replace("minecraft:", ""))) continue;
      doubled.add(e.id);
      const copy = dim.spawnItem(st.clone(), e.location);
      if (copy) doubled.add(copy.id);
      n++;
    } catch { }
  }
  if (doubled.size > 5000) doubled.clear();
  return n;
}

world.afterEvents.playerBreakBlock.subscribe((ev) => {
  if (!CONFIG.doubleDrops) return;
  try {
    const brokenId = ev.brokenBlockPermutation.type.id;
    const wanted = dropsFor(brokenId);
    if (!wanted) return;
    const dim = ev.block.dimension, loc = ev.block.location, k = bkey(dim, loc);
    const snap = snapshots.get(k) ?? { ids: new Set() };
    snapshots.delete(k);
    if (brokenId === DEBRIS && isPlaced(dim.id, loc)) { setPlaced(dim.id, loc, false); return; } // placed by a player
    if (!doubleOn(brokenId, dim.id)) return;
    // Silk Touch is skipped for ores (it would double the ore block); debris drops itself with or without it
    if (creative(ev.player) || (brokenId !== DEBRIS && hasSilk(ev.itemStackAfterBreak))) return;
    let left = CONFIG.maxDoubledPerBreak;
    // drops can appear a tick or two after the break event (and AutoSmelt swaps them later), so look three times
    left -= copyDrops(dim, loc, wanted, snap, left);
    for (const delay of [2, 6]) {
      system.runTimeout(() => { if (left > 0) left -= copyDrops(dim, loc, wanted, snap, left); }, delay);
    }
  } catch { }
});

// ---------------------------------------------------------------------------------------------------------------
// ZephyCube Ores Hammers (optional pack): a hammer breaks 8 extra blocks and reports them with the script event
// "zc:hammer_mined". Those blocks get double drops and AutoSmelt like the middle block (which gets them the normal
// way). Items that were already lying there ("before") are never doubled.
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id !== "zc:hammer_mined") return;
  try {
    const m = JSON.parse(ev.message);
    const dim = world.getDimension(m.d);
    const player = world.getEntity(m.p);
    if (!player || !Array.isArray(m.blocks) || !m.blocks.length) return;
    const b0 = m.blocks[0];
    let cx = 0, cy = 0, cz = 0;
    for (const b of m.blocks) { cx += b.x; cy += b.y; cz += b.z; }
    const center = { x: Math.floor(cx / m.blocks.length), y: Math.floor(cy / m.blocks.length), z: Math.floor(cz / m.blocks.length) };
    if (CONFIG.doubleDrops && !creative(player)) {
      const snap = { ids: new Set(Array.isArray(m.before) ? m.before : []) };
      for (const b of m.blocks) {
        const id = String(b.id);
        const wanted = dropsFor(id);
        if (!wanted) continue;
        const loc = { x: b.x, y: b.y, z: b.z };
        if (id === DEBRIS && isPlaced(m.d, loc)) { setPlaced(m.d, loc, false); continue; }
        if (!doubleOn(id, m.d) || (m.silk && id !== DEBRIS)) continue;
        let left = CONFIG.maxDoubledPerBreak;
        left -= copyDrops(dim, loc, wanted, snap, left);
        system.runTimeout(() => { if (left > 0) left -= copyDrops(dim, loc, wanted, snap, left); }, 2);
      }
    }
    smeltAfterHammer(player, dim, center, m.blocks.map((b) => String(b.id)));
  } catch { }
}, { namespaces: ["zc"] });
