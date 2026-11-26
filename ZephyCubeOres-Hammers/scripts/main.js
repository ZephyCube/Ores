// ZephyCube Ores Hammers: Simple Hammers (by Salas, v2.2.1) as an optional pack next to ZephyCube Ores.
// A hammer breaks the 3x3x1 area around the block it mines, on the side the player is facing.
// On or off = add or remove this pack (a script cannot remove recipes, so it is a pack of its own).
// Changes from the original: works in creative too (no durability loss and no drops there), and the mined face is read
// from the stable entityHitBlock event instead of the beta playerStartBreakingBlock event.
// After breaking the 8 extra blocks it sends the script event "zc:hammer_mined" so ZephyCube Ores gives those blocks
// double drops and AutoSmelt too (the middle block gets them the normal way):
//   { p: player id, d: dimension id, silk, blocks: [{ x, y, z, id }], before: [item entity ids that were already there] }
import { world, system, ItemComponentTypes, GameMode } from "@minecraft/server";

const NORTH_SOUTH = [[0, -1, 0], [-1, -1, 0], [-1, 0, 0], [-1, 1, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0], [1, -1, 0]];
const EAST_WEST = [[0, -1, 0], [0, -1, 1], [0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 1, -1], [0, 0, -1], [0, -1, -1]];
const UP_DOWN = [[-1, 0, -1], [0, 0, -1], [1, 0, -1], [-1, 0, 0], [1, 0, 0], [-1, 0, 1], [0, 0, 1], [1, 0, 1]];
const OFFSETS = { North: NORTH_SOUTH, South: NORTH_SOUTH, East: EAST_WEST, West: EAST_WEST, Up: UP_DOWN, Down: UP_DOWN };

const lastFace = new Map(); // player id -> face of the block they last hit
world.afterEvents.entityHitBlock.subscribe((ev) => {
  try { if (ev.damagingEntity?.typeId === "minecraft:player") lastFace.set(ev.damagingEntity.id, ev.blockFace); } catch { }
});
world.afterEvents.playerLeave.subscribe((ev) => lastFace.delete(ev.playerId));

function isCreative(p) { try { return p.getGameMode() === GameMode.Creative; } catch { return false; } }

// one point of wear (Unbreaking can skip it); breaks the hammer at 0
function wear(player, item) {
  const durability = item.getComponent(ItemComponentTypes.Durability);
  if (!durability) return item;
  const unbreaking = item.getComponent(ItemComponentTypes.Enchantable)?.getEnchantment("unbreaking");
  if (unbreaking && Math.random() > 1 / (unbreaking.level + 1)) return item;
  const eq = player.getComponent("minecraft:equippable");
  if (durability.damage + 1 >= durability.maxDurability) {
    eq?.setEquipment("Mainhand", undefined);
    try { player.playSound("random.break"); } catch { }
    return undefined;
  }
  durability.damage += 1;
  eq?.setEquipment("Mainhand", item);
  return item;
}

function fortuneDrops(level) {
  const multiplier = (1 / (level + 2)) + ((level + 1) / 2);
  return Math.floor(Math.random() * (multiplier - 1) + 1);
}

system.beforeEvents.startup.subscribe((init) => {
  // always registered (the hammer items need the component); the module switch is checked when a block is mined
  init.itemComponentRegistry.registerCustomComponent("simple_hammers:on_break", {
    onMineBlock: (ev, p) => {
      try {
        const player = ev.source, block = ev.block;
        let item = ev.itemStack;
        if (player?.typeId !== "minecraft:player" || !item) return;
        const include = p.params?.includeTags ?? [], exclude = p.params?.excludeTags ?? [];
        const tags = ev.minedBlockPermutation.getTags();
        if (!tags.some((t) => include.includes(t)) || tags.some((t) => exclude.includes(t))) return;
        const offsets = OFFSETS[lastFace.get(player.id)];
        if (!offsets) return;
        const creative = isCreative(player);
        const ench = item.getComponent(ItemComponentTypes.Enchantable);
        const silk = ench?.getEnchantment("silk_touch"), fortune = ench?.getEnchantment("fortune");
        if (!creative) item = wear(player, item); // the mined block itself
        const dim = block.dimension;
        const broken = [];
        // item entities already lying around, so ZephyCube Ores does not double them
        let before = [];
        if (!creative) { try { before = dim.getEntities({ type: "minecraft:item", location: block.center(), maxDistance: 4 }).map((e) => e.id); } catch { } }
        for (const [x, y, z] of offsets) {
          if (!creative && !item) break; // the hammer broke
          const b = block.offset({ x, y, z });
          if (!b) continue;
          const bt = b.getTags();
          if (!bt.some((t) => include.includes(t)) || bt.some((t) => exclude.includes(t))) continue;
          const { x: bx, y: by, z: bz } = b.location;
          if (creative) { b.setType("minecraft:air"); continue; }
          const id = b.typeId;
          const silkStack = silk && id !== "minecraft:budding_amethyst" ? b.getItemStack(1) : undefined;
          dim.runCommand(`fill ${bx} ${by} ${bz} ${bx} ${by} ${bz} air destroy`);
          broken.push({ x: bx, y: by, z: bz, id });
          const center = { x: bx + 0.5, y: by + 0.5, z: bz + 0.5 };
          if (silkStack) {
            for (const e of dim.getEntitiesAtBlockLocation(center)) if (e.typeId === "minecraft:item" || e.typeId === "minecraft:xp_orb") e.remove();
            dim.spawnItem(silkStack, center);
          } else if (fortune && id.includes("_ore")) {
            for (const e of dim.getEntitiesAtBlockLocation(center)) {
              if (e.typeId !== "minecraft:item") continue;
              const st = e.getComponent("minecraft:item")?.itemStack;
              for (let n = fortuneDrops(fortune.level); st && n > 0; n--) dim.spawnItem(st, center);
            }
          }
          item = wear(player, item);
        }
        if (broken.length) {
          try { system.sendScriptEvent("zc:hammer_mined", JSON.stringify({ p: player.id, d: dim.id, silk: !!silk, blocks: broken, before })); } catch { }
        }
      } catch { }
    },
  });
});
