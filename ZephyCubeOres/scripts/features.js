import { world, system } from "@minecraft/server";
import { defineModules } from "./modules.js";

// Where the 2x ores (extra veins) and the 2x ore drops apply. Saved in the world property wo:dims.
const DKEY = "wo:dims";
const dims = { veinsOverworld: true, veinsNether: false, dropsOverworld: true, dropsNether: true };
system.run(() => {
  try {
    const o = JSON.parse(world.getDynamicProperty(DKEY) ?? "{}");
    for (const k of Object.keys(dims)) if (typeof o[k] === "boolean") dims[k] = o[k];
  } catch { }
});
const saveDims = () => { try { world.setDynamicProperty(DKEY, JSON.stringify(dims)); } catch { } };
const dimSwitch = (key, label, tooltip) => ({ label, tooltip, get: () => dims[key], set: (v) => { dims[key] = v === true; saveDims(); } });

// /zc:oresmodules opens a menu with the modules and the dimension switches; /zc:oresmodules <module> off also works.
export const on = defineModules("wo", "zc:oresmodules", "Ores", [
  { key: "veins", label: "extra ore veins added to chunks near players (about double the vanilla amount)" },
  { key: "double_drops", label: "ores drop twice" },
  { key: "autosmelt", label: "AutoSmelt: smelts ore/sand drops automatically (/zc:as, config item, lore)" },
], [
  dimSwitch("veinsOverworld", "2x ores: Overworld", "Extra coal, iron, copper, gold, redstone, lapis and diamond veins"),
  dimSwitch("veinsNether", "2x ores: Nether", "Extra Nether quartz and Nether gold veins"),
  dimSwitch("dropsOverworld", "2x ore drops: Overworld", "Ores broken in the Overworld (and the End) drop twice"),
  dimSwitch("dropsNether", "2x ore drops: Nether", "Ores broken in the Nether drop twice"),
]);

// true when the feature ("veins" or "drops") applies in that dimension
export function appliesIn(feature, dimId) {
  const nether = dimId === "minecraft:nether";
  return feature === "veins" ? (nether ? dims.veinsNether : dimId === "minecraft:overworld" && dims.veinsOverworld)
    : (nether ? dims.dropsNether : dims.dropsOverworld);
}
