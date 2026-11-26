// Shared "modules" helper (same file in every ZephyCube pack): every feature of a pack can be turned on or off
// at runtime, no restart needed. The choice is saved in the world.
//   /<command>                  run by a player: opens a menu with one switch per module
//                               run from the console: lists the modules and their state
//   /<command> <module> on|off  turns one module on or off
// Operators only.
// Optional extra switches (settings that are not a whole module) can be added to the same menu:
//   defineModules(ns, command, title, defs, [{ label, tooltip, get: () => bool, set: (bool) => void }])
// A module with defaultOff: true starts off until it is turned on (saved as "+key").
// A module with a name is shown by that name in the menu (the key is what the command uses).
import { world, system, CommandPermissionLevel, CustomCommandStatus, CustomCommandParamType } from "@minecraft/server";
import { ModalFormData, FormCancelationReason } from "@minecraft/server-ui";

// Shows a form, waiting while the player still has the chat or another screen open.
export async function showForm(player, form) {
    for (let i = 0; i < 30; i++) {
        if (!player.isValid) return undefined;
        const r = await form.show(player);
        if (!r.canceled || r.cancelationReason !== FormCancelationReason.UserBusy) return r;
        await new Promise((res) => system.runTimeout(res, 10));
    }
    return undefined;
}

export function defineModules(ns, command, title, defs, extras = []) {
    const KEY = `${ns}:modules`;
    const defaultOff = new Set(defs.filter((d) => d.defaultOff).map((d) => d.key));
    const off = new Set(defaultOff);
    const known = new Set(defs.map((d) => d.key));
    system.run(() => {
        try {
            const s = world.getDynamicProperty(KEY);
            if (typeof s === "string") for (const k of JSON.parse(s)) {
                if (known.has(k)) off.add(k);
                else if (k.startsWith("+") && known.has(k.slice(1))) off.delete(k.slice(1));
            }
        } catch { }
    });
    const save = () => {
        const v = [...[...off].filter((k) => !defaultOff.has(k)), ...[...defaultOff].filter((k) => !off.has(k)).map((k) => "+" + k)];
        try { world.setDynamicProperty(KEY, JSON.stringify(v)); } catch { }
    };
    const list = () => defs.map((d) => `§7- §f${d.key} ${off.has(d.key) ? "§coff" : "§aon"}§7: ${d.name ? d.name + ", " : ""}${d.label}`).join("\n");

    async function openMenu(player) {
        const form = new ModalFormData().title(`${title} modules`);
        for (const d of defs) form.toggle(d.name ?? d.key, { defaultValue: !off.has(d.key), tooltip: d.name ? `${d.label} (/${command} ${d.key} on|off)` : d.label });
        for (const x of extras) form.toggle(x.label, { defaultValue: x.get() === true, tooltip: x.tooltip });
        form.submitButton("Save");
        const r = await showForm(player, form);
        if (!r || r.canceled || !r.formValues) return;
        // only the toggles carry a value; keep the ones that are booleans, in order
        const vals = r.formValues.filter((v) => typeof v === "boolean");
        if (vals.length !== defs.length + extras.length) return;
        const changed = [];
        defs.forEach((d, i) => {
            const on = vals[i];
            if (on === !off.has(d.key)) return;
            if (on) off.delete(d.key); else off.add(d.key);
            changed.push(`${d.name ?? d.key} ${on ? "§aon" : "§coff"}§r`);
        });
        extras.forEach((x, i) => {
            const v = vals[defs.length + i];
            if (v === (x.get() === true)) return;
            try { x.set(v); changed.push(`${x.label} ${v ? "§aon" : "§coff"}§r`); } catch { }
        });
        if (!changed.length) return;
        save();
        try { player.sendMessage(`${title}: ${changed.join(", ")}.`); } catch { }
    }

    system.beforeEvents.startup.subscribe((init) => {
        init.customCommandRegistry.registerCommand({
            name: command,
            description: `${title}: open the modules menu, or <module> on|off`,
            permissionLevel: CommandPermissionLevel.GameDirectors,
            cheatsRequired: false,
            optionalParameters: [{ name: "module", type: CustomCommandParamType.String }, { name: "state", type: CustomCommandParamType.String }],
        }, (origin, mod, state) => {
            if (mod === undefined || mod === null || mod === "") {
                const src = origin.sourceEntity;
                if (src?.typeId === "minecraft:player") {
                    system.run(() => { openMenu(src).catch(() => { }); });
                    return { status: CustomCommandStatus.Success, message: `Close the chat to open the ${title} modules menu.` };
                }
                return { status: CustomCommandStatus.Success, message: `§e${title} modules:\n${list()}\n§7Use /${command} <module> on|off` };
            }
            const key = String(mod).toLowerCase();
            if (!known.has(key)) return { status: CustomCommandStatus.Failure, message: `Unknown module "${mod}". Modules: ${defs.map((d) => d.key).join(", ")}` };
            const s = String(state ?? "").toLowerCase();
            if (s !== "on" && s !== "off") return { status: CustomCommandStatus.Success, message: `${key} is ${off.has(key) ? "§coff" : "§aon"}§r. Use /${command} ${key} on|off` };
            if (s === "on") off.delete(key); else off.add(key);
            save();
            return { status: CustomCommandStatus.Success, message: `${title}: ${key} is now ${s === "on" ? "§aon" : "§coff"}§r.` };
        });
    });
    return (key) => !off.has(key);
}
