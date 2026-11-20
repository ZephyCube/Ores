<p align="center"><img src="logo.png" alt="ZephyCube" width="160"></p>

# ZephyCubeOres v1.4.4

## Features (modules)
`/zc:oresmodules <module> off|on` (no argument lists them). Saved in the world.

| Module | What it does |
| --- | --- |
| `veins` | Tops up Overworld chunks within 3 chunks of players, once per chunk, with extra veins in natural stone/deepslate: coal 20, iron 14, copper 8, gold 3, redstone 6, lapis 2, diamond 3 per chunk. Done chunks are saved in the world, so old land gets the same ore |
| `double_drops` | Ores broken by a player drop twice (not with Silk Touch, not in creative, max 8 item entities copied per ore) |
| `autosmelt` | AutoSmelt: ore and sand drops are smelted automatically for players who have it on (default on); `/zc:as`, the config item, lore on pickaxes and shovels |

> [!NOTE]
> This add-on is built for, and tuned specifically for, [WhitemaneSMP](https://whitemane.fun/). Every feature is a separate module, so you can turn off anything you do not need with `/zc:oresmodules <module> off` (run `/zc:oresmodules` to list the modules).

**Credit:** the AutoSmelt part is based on Simple AutoSmelt by Rezn1r (MIT, https://mcpedl.com/simple-autosmelt/).

## Install

Download `ZephyCubeOres-v1.4.4-BP.mcaddon` (behavior pack) and `ZephyCubeOres-v1.4.4-RP.mcaddon` (resource pack) from the Releases page and open both. Or install by hand: copy the `ZephyCubeOres` folder into your world's `behavior_packs` folder and `ZephyCubeOres-RP` into `resource_packs`, then add each pack's `uuid` and `version` (from its `manifest.json`) to the world's `world_behavior_packs.json` / `world_resource_packs.json`. Needs `@minecraft/server` 2.8.0 and `@minecraft/server-ui` 2.0.0.

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
| `/zc:oresmodules [module] [on\|off]` | operators | List or toggle modules |

## Tags
| Tag | Effect |
| --- | --- |
| `sas:config_given` | Set once the config item was handed out on first join |
| `sas_on` | Set while AutoSmelt is on for the player (the vein miner in BedrockEssentials reads it) |

## Storage
World properties `wo:r:<rx>:<rz>` (done chunks), `wo:modules`; per-player properties `sas:*`.

## License

MIT, see `LICENSE`. AutoSmelt is based on Simple AutoSmelt by Rezn1r (MIT); the notice is kept in `ZephyCubeOres/scripts/smelt.js`.
