// AutoSmelt, part of ZephyCube Ores. Based on Simple AutoSmelt by Rezn1r (https://mcpedl.com/simple-autosmelt/), MIT license.
// ZephyCube Ores 1.4.0: adds /zc:as and a default of "on"; module "autosmelt" turns it all off.
import { world, system, ItemStack, EntityComponentTypes, CommandPermissionLevel, CustomCommandStatus, CustomCommandParamType } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { on } from "./features.js";
const configGivenTag = "sas:config_given";
const onTag = "sas_on"; // mirror of the setting as a tag, so other packs (vein miner) can read it
const configDistanceKey = "sas:distance";
const configParticleKey = "sas:particle";
const configToolModeKey = "sas:tool_mode";
const configActivationModeKey = "sas:activation_mode";
const loreLine = '§r§6AutoSmelt';
const oldLoreLine = /^§r\s§cAuto§eSmelt$/; // old branded lore, replaced when seen on a tool
const smeltableOres = [
    "minecraft:copper_ore",
    "minecraft:deepslate_copper_ore",
    "minecraft:iron_ore",
    "minecraft:deepslate_iron_ore",
    "minecraft:gold_ore",
    "minecraft:deepslate_gold_ore",
    "minecraft:ancient_debris",
];
const smeltableBlocks = [
    "minecraft:sand",
    "minecraft:clay_ball"
];
const smeltingBlocks = {
    "minecraft:raw_copper": "minecraft:copper_ingot",
    "minecraft:raw_iron": "minecraft:iron_ingot",
    "minecraft:raw_gold": "minecraft:gold_ingot",
    "minecraft:ancient_debris": "minecraft:netherite_scrap",
    "minecraft:sand": "minecraft:glass",
    "minecraft:clay": "minecraft:brick"
}
const delayedSmeltAttempts = 40;
const delayedSmeltTickStep = 2;

function smeltNearbyDrops(player, dimension, location, maxDistance) {
    const nearbyItem = dimension.getEntities({
        type: "minecraft:item",
        location,
        maxDistance
    });
    for (const itemEntity of nearbyItem) {
        const itemComponent = itemEntity.getComponent(EntityComponentTypes.Item);
        if (!itemComponent)
            continue;
        const typeId = itemComponent.itemStack.typeId;
        const smeltedTypeId = smeltingBlocks[typeId];
        if (!smeltedTypeId)
            continue;
        const smeltedItem = new ItemStack(smeltedTypeId, itemComponent.itemStack.amount);
        const itemLoc = itemEntity.location;
        itemEntity.remove();
        dimension.spawnItem(smeltedItem, itemLoc);
        dimension.playSound("fire.fire", itemLoc, { volume: 0.5, pitch: 1.0 });
        if (isParticleEnabled(player)) {
            dimension.spawnParticle("minecraft:lava_particle", itemLoc);
        }
        dimension.spawnEntity("minecraft:xp_orb", itemLoc);
    }
}
function scheduleDelayedSmelt(player, dimension, location, maxDistance) {
    for (let attempt = 1; attempt <= delayedSmeltAttempts; attempt++) {
        system.runTimeout(() => {
            if (typeof player.isValid === "function" && !player.isValid())
                return;
            if (!isSmeltEnabled(player))
                return;
            smeltNearbyDrops(player, dimension, location, maxDistance);
        }, attempt * delayedSmeltTickStep);
    }
}

function isSmeltEnabled(player) {
    // on unless the player turned it off (settings from before the split are not kept, so the default is on)
    return player.getDynamicProperty("sas:enabled") !== false;
}
function setSmeltEnabled(player, enabled) {
    player.setDynamicProperty("sas:enabled", enabled);
    syncTag(player);
}
function syncTag(player) {
    try {
        const want = isSmeltEnabled(player);
        if (want && !player.hasTag(onTag)) player.addTag(onTag);
        else if (!want && player.hasTag(onTag)) player.removeTag(onTag);
    } catch { }
}
function isParticleEnabled(player) {
    const particle = player.getDynamicProperty(configParticleKey);
    return particle !== false; // default to true
}
function getToolMode(player) {
    const mode = player.getDynamicProperty(configToolModeKey);
    if (mode === "pickaxe" || mode === "shovel" || mode === "both") {
        return mode;
    }
    return "both"; // default to any
}
function getActivationMode(player) {
    const mode = player.getDynamicProperty(configActivationModeKey);
    if (mode === "sneak" || mode === "stand" || mode === "any") {
        return mode;
    }
    return "any"; // default to any
}
function addPickaxeLore(player) {
    const itemComponent = player.getComponent(EntityComponentTypes.Inventory);
    for (let i = 0; i < itemComponent.container.size; i++) {
        const item = itemComponent.container.getItem(i);
        if (item && item.typeId.endsWith("_pickaxe")) {
            const lore = item.getLore();
            const next = lore.filter((l) => !oldLoreLine.test(l));
            const changed = next.length !== lore.length;
            if (!next.includes(loreLine)) next.push(loreLine);
            if (changed || next.length !== lore.length) {
                item.setLore(next);
                itemComponent.container.setItem(i, item);
            }
        }
    }
}
function addShovelLore(player) {
    const itemComponent = player.getComponent(EntityComponentTypes.Inventory);
    for (let i = 0; i < itemComponent.container.size; i++) {
        const item = itemComponent.container.getItem(i);
        if (item && item.typeId.endsWith("_shovel")) {
            const lore = item.getLore();
            const next = lore.filter((l) => !oldLoreLine.test(l));
            const changed = next.length !== lore.length;
            if (!next.includes(loreLine)) next.push(loreLine);
            if (changed || next.length !== lore.length) {
                item.setLore(next);
                itemComponent.container.setItem(i, item);
            }
        }
    }
}
system.runInterval(() => {
    if (!on("autosmelt")) return;
    for (const player of world.getPlayers()) {
        if (isSmeltEnabled(player)) {
            const toolMode = getToolMode(player);
            if (toolMode === "pickaxe" || toolMode === "both" || toolMode === "any") {
                addPickaxeLore(player);
            }
            if (toolMode === "shovel" || toolMode === "both" || toolMode === "any") {
                addShovelLore(player);
            }
        }
    }
}, 5);
world.afterEvents.playerSpawn.subscribe((event) => {
    if (!on("autosmelt")) return;
    const initialSpawn = event.initialSpawn;
    const player = event.player;
    syncTag(player);
    const hasConfigTag = player.hasTag(configGivenTag);
    if (initialSpawn && !hasConfigTag) {
        setSmeltEnabled(event.player, true);
        // Give the config item on first spawn
        const configItem = new ItemStack("sas:config", 1);
        configItem.keepOnDeath = true;
        system.run(() => {
            player.dimension.spawnItem(configItem, player.location);
            player.addTag(configGivenTag);
        });
        const givenMessage = {
            rawtext: [
                { translate: "item.sas:config.given" }
            ]
        };
        player.sendMessage(givenMessage);
    }
});
world.afterEvents.playerBreakBlock.subscribe((event) => {
    const { player, block, brokenBlockPermutation } = event;
    if (!on("autosmelt") || !isSmeltEnabled(player))
        return;
    // Check activation mode
    const activationMode = getActivationMode(player);
    const isSneaking = player.isSneaking;
    if (activationMode === "sneak" && !isSneaking)
        return;
    if (activationMode === "stand" && isSneaking)
        return;
    const blockTypeId = brokenBlockPermutation.type.id;
    const isOre = smeltableOres.includes(blockTypeId);
    const isSmeltableBlock = smeltableBlocks.includes(blockTypeId);
    if (!isOre && !isSmeltableBlock)
        return;
    // Get config data 
    //  sas:distance - max distance to smelt
    let maxDistance = player.getDynamicProperty(configDistanceKey);
    if (typeof maxDistance !== "number" || isNaN(maxDistance) || maxDistance < 0) {
        maxDistance = 5; // default distance
    }
    const playerPos = player.location;
    const blockPos = block.location;
    const inventory = player.getComponent(EntityComponentTypes.Inventory);
    const heldItem = inventory.container.getItem(player.selectedSlotIndex);
    const toolMode = getToolMode(player);
    // Check tool type based on block type and tool mode
    if (isOre) {
        if (!heldItem || !(heldItem.typeId.endsWith("_pickaxe") || heldItem.typeId.endsWith("_hammer")))
            return; // hammers (ZephyCube Ores Hammers) count as pickaxes
        if (toolMode === "shovel")
            return; // pickaxe disabled
    }
    else if (isSmeltableBlock) {
        if (!heldItem || !heldItem.typeId.endsWith("_shovel"))
            return;
        if (toolMode === "pickaxe")
            return; // shovel disabled
    }
    const dx = playerPos.x - blockPos.x;
    const dy = playerPos.y - blockPos.y;
    const dz = playerPos.z - blockPos.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (distance > maxDistance + 1)
        return;
    smeltNearbyDrops(player, block.dimension, blockPos, maxDistance);
    if (isOre && player.isSneaking) {
        scheduleDelayedSmelt(player, block.dimension, { x: blockPos.x, y: blockPos.y, z: blockPos.z }, maxDistance);
    }
});
const configComponent = {
    onUse: (event, params) => {
        const player = event.source;
        const item = event.itemStack;
        // get curr config values
        const isSmeltEnabledValue = isSmeltEnabled(player);
        const isParticleEnabledValue = isParticleEnabled(player);
        const toolModeValue = getToolMode(player);
        const activationModeValue = getActivationMode(player);
        let distanceValue = player.getDynamicProperty(configDistanceKey);
        if (typeof distanceValue !== "number" || isNaN(distanceValue) || distanceValue < 0) {
            distanceValue = 5; // default distance
        }
        const form = new ModalFormData()
            .title("§lAutoSmelt")
            .label("§r§7Configure your AutoSmelt settings below.§r")
            .divider()
            .toggle("Enable AutoSmelt", { defaultValue: isSmeltEnabledValue })
            .toggle("Enable Particles", { defaultValue: isParticleEnabledValue })
            .dropdown("Tool Mode", ["Pickaxe", "Shovel", "Both"], { defaultValueIndex: toolModeValue === "pickaxe" ? 0 : toolModeValue === "shovel" ? 1 : 2 })
            .dropdown("Activation Mode", ["Sneak", "Stand", "Any"], { defaultValueIndex: activationModeValue === "sneak" ? 0 : activationModeValue === "stand" ? 1 : 2 })
            .slider("Max Smelt Distance", 1, 20, { defaultValue: distanceValue });
        form.show(player).then((response) => {
            if (response.canceled) {
                player.sendMessage("§7Configuration canceled.");
                return;
            }
            const [label, divider, smeltEnabledResp, particleEnabledResp, toolModeResp, activationModeResp, distanceResp] = response.formValues;
            setSmeltEnabled(player, smeltEnabledResp);
            player.setDynamicProperty(configParticleKey, particleEnabledResp);
            const toolModeStr = toolModeResp === 0 ? "pickaxe" : toolModeResp === 1 ? "shovel" : toolModeResp === 2 ? "both" : "any";
            player.setDynamicProperty(configToolModeKey, toolModeStr);
            const activationModeStr = activationModeResp === 0 ? "sneak" : activationModeResp === 1 ? "stand" : "any";
            player.setDynamicProperty(configActivationModeKey, activationModeStr);
            player.setDynamicProperty(configDistanceKey, distanceResp);
            const savedMessage = {
                rawtext: [
                    { translate: "item.sas:config.saved" }
                ]
            };
            player.sendMessage(savedMessage);
        });
        return true;
    }
};
system.beforeEvents.startup.subscribe((init) => {
    init.itemComponentRegistry.registerCustomComponent("sas:config_component", configComponent);
    const run = (origin, arg) => {
        if (!on("autosmelt")) return { status: CustomCommandStatus.Failure, message: "AutoSmelt is turned off by staff." };
        const player = origin.sourceEntity;
        if (!player || player.typeId !== "minecraft:player") return { status: CustomCommandStatus.Failure, message: "Players only." };
        const a = String(arg ?? "").toLowerCase();
        let state = isSmeltEnabled(player);
        if (a === "on") state = true;
        else if (a === "off") state = false;
        else if (a === "status") { /* no change */ }
        else if (a === "") state = !state;
        else return { status: CustomCommandStatus.Failure, message: "Use /zc:as, /zc:as on, /zc:as off or /zc:as status. More settings: use the AutoSmelt Config item." };
        system.run(() => {
            try {
                if (a !== "status") setSmeltEnabled(player, state);
                player.sendMessage(`AutoSmelt is §p${state ? "on" : "off"}§f.`);
            } catch { }
        });
        return { status: CustomCommandStatus.Success };
    };
    init.customCommandRegistry.registerCommand({
        name: "zc:as",
        description: "AutoSmelt: toggle on/off (or on, off, status)",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
        optionalParameters: [{ name: "state", type: CustomCommandParamType.String }],
    }, run);
});

// Called by main.js for the 8 extra blocks a hammer (ZephyCube Ores Hammers pack) breaks: same rules as a pickaxe break.
export function smeltAfterHammer(player, dimension, location, blockIds) {
    if (!on("autosmelt") || !isSmeltEnabled(player))
        return;
    const activationMode = getActivationMode(player);
    if (activationMode === "sneak" && !player.isSneaking)
        return;
    if (activationMode === "stand" && player.isSneaking)
        return;
    if (getToolMode(player) === "shovel")
        return;
    if (!blockIds.some((id) => smeltableOres.includes(id)))
        return;
    for (const delay of [1, 3, 8]) {
        system.runTimeout(() => {
            try { if (player.isValid) smeltNearbyDrops(player, dimension, location, 3); } catch { }
        }, delay);
    }
}
