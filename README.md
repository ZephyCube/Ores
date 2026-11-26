<p align="center"><img src="logo.png" alt="ZephyCube" width="160"></p>

# ZephyCubeOres v1.7.0

Extra ore veins (about double the vanilla amount) in the Overworld and Nether, double ore drops (not with Silk Touch) and AutoSmelt. No Beta APIs.

> [!NOTE]
> This add-on is built for, and tuned specifically for, [WhitemaneSMP](https://whitemane.fun/). Every feature is a separate module: run `/zc:oresmodules` to open a menu where you can turn off anything you do not need (or use `/zc:oresmodules <module> off`).

**Credit:** the AutoSmelt part is based on Simple AutoSmelt by Rezn1r (MIT, https://mcpedl.com/simple-autosmelt/).

## Install

Download `ZephyCubeOres-v1.7.0-BP.mcaddon` (behavior pack) and `ZephyCubeOres-v1.7.0-RP.mcaddon` (resource pack) from the Releases page and open both. Or install by hand: copy the `ZephyCubeOres` folder into your world's `behavior_packs` folder and `ZephyCubeOres-RP` into `resource_packs`, then add each pack's `uuid` and `version` (from its `manifest.json`) to the world's `world_behavior_packs.json` / `world_resource_packs.json`. Optional: `ZephyCubeOres-v1.7.0-Hammers.mcaddon` (or the `ZephyCubeOres-Hammers` folder in `behavior_packs`) adds Simple Hammers; remove it to remove the hammers and their recipes. Optional: `ZephyCubeOres-v1.7.0-AntiXray.mcaddon` (or the `ZephyCubeOres-AntiXray` folder in `resource_packs`) turns Anti-Xray on; remove it to turn it off. Needs `@minecraft/server` 2.8.0 and `@minecraft/server-ui` 2.0.0.

## Features (modules)
`/zc:oresmodules` opens a menu with a switch per module and the dimension switches below (from the console it lists the modules); `/zc:oresmodules <module> on|off` also works. Saved in the world.

| Module | What it does |
| --- | --- |
| `veins` | 2x ores: tops up chunks within 3 chunks of players, once per chunk per dimension. Overworld: extra veins in natural stone/deepslate (coal 20, iron 14, copper 8, gold 3, redstone 6, lapis 2, diamond 3 per chunk). Nether: extra veins in netherrack (Nether quartz 16, Nether gold 10 per chunk; ancient debris is left alone). Done chunks are saved in the world, so old land gets the same ore |
| `double_drops` | 2x ore drops: ores broken by a player drop twice (not with Silk Touch, not in creative, max 8 item entities copied per ore) |
| `autosmelt` | AutoSmelt: ore and sand drops are smelted automatically for players who have it on (default on); `/zc:as`, the config item, lore on pickaxes and shovels |

## Where 2x ores and 2x ore drops apply
Five switches in the `/zc:oresmodules` menu, saved in the world property `wo:dims`:

| Switch | Default |
| --- | --- |
| 2x ores: Overworld | on |
| 2x ores: Nether | off |
| 2x ancient debris: Nether (one large and one small vein per chunk, like vanilla; in netherrack, basalt and blackstone) | off |
| 2x ore drops: Overworld (also covers the End) | on |
| 2x ore drops: Nether | on |

## Hammers (optional pack)
`ZephyCubeOres-Hammers` is Simple Hammers by Salas: stone, copper, iron, golden, diamond and netherite hammers (crafted like pickaxes with a full top row) that break the 3x3x1 area around the mined block, facing the player.
* Silk Touch, Fortune and Unbreaking work. Works in creative too (no wear, no drops).
* All 9 blocks get 2x ore drops and AutoSmelt like a pickaxe break (the hammer pack reports the extra 8 blocks to Ores with the script event `zc:hammer_mined`). AutoSmelt counts a hammer as a pickaxe.
* On or off: add the pack to the world to have hammers; remove it and the hammers and their recipes are gone (a script cannot remove a recipe, so they are a pack of their own). It needs the Ores resource pack for its textures and names.

## Anti-Xray (optional resource pack)
`ZephyCubeOres-AntiXray` forces stone, deepslate, netherrack, ores, dirt, sand, gravel, logs and other natural blocks to render as solid blocks, so X-ray resource packs cannot see through them. Based on Anti Xray by PPYGaming (stairs, slabs, walls, moss carpet and sulfur spikes are left out because they would render as full blocks).

It is a resource pack, so the server cannot switch it on or off with a command: add the pack to the world to turn Anti-Xray on, remove it to turn it off. It does not need the other Ores packs.

## Turn AutoSmelt on or off (players)
* `/zc:as` toggles it. `/zc:as on`, `/zc:as off`, `/zc:as status`. Everyone can use it. (`/as` may work too if no other pack has that command.)
* Or use the AutoSmelt Config item.

## Items and recipes
| Item | Recipe | Use |
| --- | --- | --- |
| `sas:config` (AutoSmelt Config), recipe `zc:autosmelt_config` | iron ingot x4 around cobblestone, crafting table | Opens the settings: on/off, particles, tool mode (pickaxe, shovel, both), activation (always, only sneaking, only standing), distance (1 to 20 blocks). Given once on first join |

## Commands
| Command | Who | Use |
| --- | --- | --- |
| `/zc:as [on\|off\|status]` | everyone | Your AutoSmelt on or off |
| `/zc:oresmodules [module] [on\|off]` | operators | Open the modules and dimensions menu, or turn one module on or off |

## Tags
| Tag | Effect |
| --- | --- |
| `sas:config_given` | Set once the config item was handed out on first join |
| `sas_on` | Set while AutoSmelt is on for the player (the vein miner in BedrockEssentials reads it) |

## Storage
World properties `wo:r:<rx>:<rz>`, `wo:rn:<rx>:<rz>` and `wo:rd:<rx>:<rz>` (done chunks: Overworld, Nether, ancient debris; each switch has its own list, so turning one on later still tops up old land), `wo:dims` (dimension switches), `wo:modules`; per-player properties `sas:*`.

## License

MIT, see `LICENSE`. AutoSmelt is based on Simple AutoSmelt by Rezn1r (MIT); the notice is kept in `ZephyCubeOres/scripts/smelt.js`.
