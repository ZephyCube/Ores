// Simple AutoSmelt Main Script
// Made by Rezn1r - https://mcpedl.com/simple-autosmelt/
// License: MIT
import { world, system, ItemStack, EntityComponentTypes } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
const configGivenTag = "sas:config_given";
const configDistanceKey = "sas:distance";
const configParticleKey = "sas:particle";
const configToolModeKey = "sas:tool_mode";
const configActivationModeKey = "sas:activation_mode";
const loreLine = '§r §cAuto§eSmelt';
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
    const key = "sas:enabled";
    const dynamicProperties = player.getDynamicProperty(key);
    return dynamicProperties === true;
}
function setSmeltEnabled(player, enabled) {
    const key = "sas:enabled";
    player.setDynamicProperty(key, enabled);
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
            if (!lore.includes(loreLine)) {
                lore.push(loreLine);
                item.setLore(lore);
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
            if (!lore.includes(loreLine)) {
                lore.push(loreLine);
                item.setLore(lore);
                itemComponent.container.setItem(i, item);
            }
        }
    }
}
system.runInterval(() => {
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
    const initialSpawn = event.initialSpawn;
    const player = event.player;
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
    if (!isSmeltEnabled(player))
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
        if (!heldItem || !heldItem.typeId.endsWith("_pickaxe"))
            return;
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
            .title("§l§cAuto§eSmelt§r §6Configuration")
            .label("§r§7Configure your AutoSmelt settings below.§r")
            .divider()
            .toggle("Enable AutoSmelt", { defaultValue: isSmeltEnabledValue })
            .toggle("Enable Particles", { defaultValue: isParticleEnabledValue })
            .dropdown("Tool Mode", ["Pickaxe", "Shovel", "Both"], { defaultValueIndex: toolModeValue === "pickaxe" ? 0 : toolModeValue === "shovel" ? 1 : 2 })
            .dropdown("Activation Mode", ["Sneak", "Stand", "Any"], { defaultValueIndex: activationModeValue === "sneak" ? 0 : activationModeValue === "stand" ? 1 : 2 })
            .slider("Max Smelt Distance", 1, 20, { defaultValue: distanceValue });
        form.show(player).then((response) => {
            if (response.canceled) {
                player.sendMessage("§cConfiguration canceled.§r");
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
});
