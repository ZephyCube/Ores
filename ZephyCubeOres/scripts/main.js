import { world, system } from '@minecraft/server';

// ZephyCube Ores: adds extra ore veins (about double the vanilla amount) to Overworld chunks the first
// time a player is near them, so land that was explored before the change gets the same ore as new land.
// Only natural stone/deepslate is replaced. Each chunk is done once; the done-list is saved in the world.
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
const DIM = "minecraft:overworld";
const STONE = new Set(["minecraft:stone", "minecraft:andesite", "minecraft:diorite", "minecraft:granite", "minecraft:tuff"]);
const DEEP = new Set(["minecraft:deepslate"]);

// ---- done-list: one property per 32x32 chunk region, 1024 bits as 256 hex characters
const regions = new Map();
const rKey = (rx, rz) => `wo:r:${rx}:${rz}`;
function region(rx, rz) {
  const k = rKey(rx, rz);
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
function isDone(cx, cz) {
  const r = region(cx >> 5, cz >> 5), b = bitPos(cx, cz);
  return (r[b >> 3] & (1 << (b & 7))) !== 0;
}
function markDone(cx, cz) {
  const rx = cx >> 5, rz = cz >> 5, r = region(rx, rz), b = bitPos(cx, cz);
  r[b >> 3] |= 1 << (b & 7);
  let s = "";
  for (let i = 0; i < 128; i++) s += r[i].toString(16).padStart(2, "0");
  try { world.setDynamicProperty(rKey(rx, rz), s); } catch { }
}

const queue = [];
const queued = new Set();
let running = false;
let doneCount = 0;

function loaded(dim, cx, cz) {
  try { return !!dim.getBlock({ x: cx * 16 + 8, y: 64, z: cz * 16 + 8 }) && !!dim.getBlock({ x: cx * 16, y: 64, z: cz * 16 }) && !!dim.getBlock({ x: cx * 16 + 15, y: 64, z: cz * 16 + 15 }); }
  catch { return false; }
}

function* topUp(dim, cx, cz) {
  const hr = dim.heightRange;
  let ops = 0;
  for (const ore of CONFIG.ores) {
    const lo = Math.max(hr.min, ore.minY), hi = Math.min(hr.max - 1, ore.maxY);
    for (let v = 0; v < ore.veins; v++) {
      let x = cx * 16 + Math.floor(Math.random() * 16);
      let y = lo + Math.floor(Math.random() * (hi - lo + 1));
      let z = cz * 16 + Math.floor(Math.random() * 16);
      for (let i = 0; i < ore.size; i++) {
        try {
          const b = dim.getBlock({ x, y, z });
          const id = b?.typeId;
          if (id && (STONE.has(id) || DEEP.has(id))) b.setType(DEEP.has(id) ? `minecraft:deepslate_${ore.name}_ore` : `minecraft:${ore.name}_ore`);
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
    const { cx, cz } = queue.shift();
    queued.delete(cx + "," + cz);
    try {
      const dim = world.getDimension(DIM);
      if (isDone(cx, cz) || !loaded(dim, cx, cz)) continue;
      yield* topUp(dim, cx, cz);
      markDone(cx, cz);
      if (++doneCount % 100 === 0) console.warn(`[Ores] ${doneCount} chunks topped up since start`);
    } catch (e) { console.warn(`[Ores] chunk ${cx},${cz}: ${e}`); }
    yield;
  }
  running = false;
}

system.runInterval(() => {
  if (queue.length >= CONFIG.maxQueue) return;
  const cands = [];
  for (const p of world.getAllPlayers()) {
    try {
      if (p.dimension.id !== DIM) continue;
      const pcx = Math.floor(p.location.x / 16), pcz = Math.floor(p.location.z / 16);
      for (let dx = -CONFIG.radiusChunks; dx <= CONFIG.radiusChunks; dx++) {
        for (let dz = -CONFIG.radiusChunks; dz <= CONFIG.radiusChunks; dz++) {
          const cx = pcx + dx, cz = pcz + dz;
          if (queued.has(cx + "," + cz) || isDone(cx, cz)) continue;
          cands.push({ cx, cz, d: dx * dx + dz * dz });
        }
      }
    } catch { }
  }
  cands.sort((a, b) => a.d - b.d);
  for (const c of cands) {
    if (queue.length >= CONFIG.maxQueue) break;
    const k = c.cx + "," + c.cz;
    if (queued.has(k)) continue;
    queued.add(k); queue.push({ cx: c.cx, cz: c.cz });
  }
  if (queue.length && !running) { running = true; system.runJob(worker()); }
}, CONFIG.scanEveryTicks);


// ---------------------------------------------------------------------------------------------------------------
// Double ore drops. Before the break we remember the item entities already lying near the block; after the break,
// every new item near it that belongs to that ore (raw drop or the smelted form, because Simple AutoSmelt may have
// converted it already) is copied once. AutoSmelt then smelts the copy like any other drop. Silk Touch is skipped,
// so the ore block itself is never doubled. Only blocks broken by a player count (TNT, pistons: not doubled).
const DROPS = {
  coal_ore: ["coal"], iron_ore: ["raw_iron", "iron_ingot"], copper_ore: ["raw_copper", "copper_ingot"],
  gold_ore: ["raw_gold", "gold_ingot"], redstone_ore: ["redstone"], lit_redstone_ore: ["redstone"], lapis_ore: ["lapis_lazuli"],
  diamond_ore: ["diamond"], emerald_ore: ["emerald"], nether_gold_ore: ["gold_nugget"], quartz_ore: ["quartz"]
};
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
    if (!dropsFor(id)) return;
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
    const wanted = dropsFor(ev.brokenBlockPermutation.type.id);
    if (!wanted) return;
    const dim = ev.block.dimension, loc = ev.block.location, k = bkey(dim, loc);
    const snap = snapshots.get(k) ?? { ids: new Set() };
    snapshots.delete(k);
    if (creative(ev.player) || hasSilk(ev.itemStackAfterBreak)) return;
    let left = CONFIG.maxDoubledPerBreak;
    // drops can appear a tick or two after the break event (and AutoSmelt swaps them later), so look three times
    left -= copyDrops(dim, loc, wanted, snap, left);
    for (const delay of [2, 6]) {
      system.runTimeout(() => { if (left > 0) left -= copyDrops(dim, loc, wanted, snap, left); }, delay);
    }
  } catch { }
});
