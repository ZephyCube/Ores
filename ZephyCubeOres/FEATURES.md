# ZephyCube Ores 1.3.0 (includes Simple AutoSmelt 2.2.1 by Rezn1r, MIT)

## Features (modules)
`/zc:oresmodules <module> off|on` (no argument lists them). Saved in the world.

| Module | What it does |
| --- | --- |
| `veins` | Tops up Overworld chunks within 3 chunks of players, once per chunk, with extra veins in natural stone/deepslate: coal 20, iron 14, copper 8, gold 3, redstone 6, lapis 2, diamond 3 per chunk. Done chunks are saved in the world, so old land gets the same ore |
| `double_drops` | Ores broken by a player drop twice (not with Silk Touch, not in creative, max 8 item entities copied per ore) |
| `autosmelt` | Simple AutoSmelt: ore and sand drops are smelted automatically for players who have it on; the config item is given on first join |

## Items and recipes
| Item | Recipe | Use |
| --- | --- | --- |
| `sas:config` (AutoSmelt Config) | iron ingot x4 around cobblestone, crafting table | Use it to open the AutoSmelt settings: on/off, particles, tool mode (pickaxe, shovel, both, any), activation (always or while sneaking), distance |

## Commands
| Command | Who | Use |
| --- | --- | --- |
| `/zc:oresmodules [module] [on\|off]` | operators | List or toggle modules |

## Tags
| Tag | Effect |
| --- | --- |
| `sas:config_given` | Set on a player once the config item was handed out on first join |

## Storage
World properties `wo:r:<rx>:<rz>` (done chunks), `wo:modules`; AutoSmelt keeps its per-player settings in player properties (`sas:*`).
