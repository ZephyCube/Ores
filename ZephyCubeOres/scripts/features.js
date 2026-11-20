import { defineModules } from "./modules.js";

// Modules (turn parts off with /zc:oresmodules <module> off):
export const on = defineModules("wo", "zc:oresmodules", "Ores", [
  { key: "veins", label: "extra ore veins added to chunks near players (about double the vanilla amount)" },
  { key: "double_drops", label: "ores drop twice" },
  { key: "autosmelt", label: "AutoSmelt: smelts ore/sand drops automatically (config item, lore)" },
]);
