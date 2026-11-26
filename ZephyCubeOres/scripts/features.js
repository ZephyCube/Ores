import { world, system } from "@minecraft/server";
import { defineModules } from "./modules.js";

// The Ores switches. /zc:oresmodules opens a menu with one switch each; /zc:oresmodules <key> on|off also works.
// Saved in the world property wo:modules.
const SWITCHES = [
  { key: "ores_overworld", name: "2x ores: Overworld", label: "extra coal, iron, copper, gold, redstone, lapis and diamond veins in chunks near players" },
  { key: "ores_nether", name: "2x ores: Nether", label: "extra Nether quartz and Nether gold veins in chunks near players", defaultOff: true },
  { key: "debris_nether", name: "2x ancient debris: Nether", label: "extra ancient debris (one large and one small vein per chunk, like vanilla)", defaultOff: true },
  { key: "drops_overworld", name: "2x ore drops: Overworld", label: "ores broken in the Overworld (and the End) drop twice" },
  { key: "drops_nether", name: "2x ore drops: Nether", label: "ores broken in the Nether drop twice" },
  { key: "autosmelt", name: "AutoSmelt", label: "smelts ore and sand drops automatically (/zc:as, config item, lore)" },
];

// One-time move from the 1.5.0-1.7.0 settings: the "veins" and "double_drops" switches plus the dimension switches
// in wo:dims become the six switches above, with the same effect as before. Runs before modules.js reads wo:modules.
system.run(() => {
  try {
    const rawDims = world.getDynamicProperty("wo:dims");
    let mods = [];
    try { const s = world.getDynamicProperty("wo:modules"); if (typeof s === "string") mods = JSON.parse(s); } catch { }
    if (typeof rawDims !== "string" && !mods.includes("veins") && !mods.includes("double_drops")) return;
    const d = { veinsOverworld: true, veinsNether: false, debrisNether: false, dropsOverworld: true, dropsNether: true };
    try { const o = JSON.parse(rawDims ?? "{}"); for (const k of Object.keys(d)) if (typeof o[k] === "boolean") d[k] = o[k]; } catch { }
    const veins = !mods.includes("veins"), drops = !mods.includes("double_drops");
    const state = {
      ores_overworld: veins && d.veinsOverworld, ores_nether: veins && d.veinsNether, debris_nether: veins && d.debrisNether,
      drops_overworld: drops && d.dropsOverworld, drops_nether: drops && d.dropsNether, autosmelt: !mods.includes("autosmelt"),
    };
    // modules.js format: keys that are off (default-on switches), "+key" for default-off switches that are on
    const out = SWITCHES.flatMap((s) => (s.defaultOff ? (state[s.key] ? ["+" + s.key] : []) : (state[s.key] ? [] : [s.key])));
    world.setDynamicProperty("wo:modules", JSON.stringify(out));
    world.setDynamicProperty("wo:dims", undefined);
  } catch { }
});

export const on = defineModules("wo", "zc:oresmodules", "Ores", SWITCHES);

// true when the feature ("veins", "debris" or "drops") is on in that dimension
export function appliesIn(feature, dimId) {
  const nether = dimId === "minecraft:nether";
  if (feature === "debris") return nether && on("debris_nether");
  if (feature === "veins") return nether ? on("ores_nether") : dimId === "minecraft:overworld" && on("ores_overworld");
  return nether ? on("drops_nether") : on("drops_overworld");
}
