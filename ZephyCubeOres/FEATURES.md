# ZephyCube Ores 1.5.0

## Features (modules)
`/zc:oresmodules` opens a menu with a switch per module and the dimension switches below (from the console it lists the modules); `/zc:oresmodules <module> on|off` also works. Saved in the world.

| Module | What it does |
| --- | --- |
| `veins` | 2x ores: tops up chunks within 3 chunks of players, once per chunk per dimension. Overworld: extra veins in natural stone/deepslate (coal 20, iron 14, copper 8, gold 3, redstone 6, lapis 2, diamond 3 per chunk). Nether: extra veins in netherrack (Nether quartz 16, Nether gold 10 per chunk; ancient debris is left alone). Done chunks are saved in the world, so old land gets the same ore |
| `double_drops` | 2x ore drops: ores broken by a player drop twice (not with Silk Touch, not in creative, max 8 item entities copied per ore) |
| `autosmelt` | AutoSmelt: ore and sand drops are smelted automatically for players who have it on (default on); `/zc:as`, the config item, lore on pickaxes and shovels |

## Where 2x ores and 2x ore drops apply
Four switches in the `/zc:oresmodules` menu, saved in the world property `wo:dims`:

| Switch | Default |
| --- | --- |
| 2x ores: Overworld | on |
| 2x ores: Nether | off |
| 2x ore drops: Overworld (also covers the End) | on |
| 2x ore drops: Nether | on |

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
World properties `wo:r:<rx>:<rz>` and `wo:rn:<rx>:<rz>` (done chunks, Overworld and Nether), `wo:dims` (dimension switches), `wo:modules`; per-player properties `sas:*`.

## License
AutoSmelt is based on Simple AutoSmelt by Rezn1r (MIT). The notice is kept in `scripts/smelt.js`.
