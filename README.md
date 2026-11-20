<p align="center"><img src="logo.png" alt="ZephyCube" width="160"></p>

# ZephyCubeOres v1.3.0

Extra ore veins for Overworld chunks near players (about double the vanilla amount, once per chunk) and double ore drops (not with Silk Touch). Includes Simple AutoSmelt. No Beta APIs.

**Credit:** the AutoSmelt part is Simple AutoSmelt by Rezn1r (MIT, https://mcpedl.com/simple-autosmelt/).

## Install

Download `ZephyCubeOres-v1.3.0.mcaddon` from the Releases page and open it (installs both packs), or install by hand:

Copy the `ZephyCubeOres` folder into your world's `behavior_packs` folder and `ZephyCubeOres-RP` into `resource_packs`, then add each pack's `uuid` and `version` (from its `manifest.json`) to the world's `world_behavior_packs.json` / `world_resource_packs.json`. Needs `@minecraft/server` 2.8.0 and `@minecraft/server-ui` 2.0.0.

## Commands

- `/zc:oresmodules [module] [on|off]`: list or toggle modules (operators).

## License

MIT. Simple AutoSmelt by Rezn1r (MIT).
