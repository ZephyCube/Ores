// Shared "modules" helper: every feature of this pack can be turned on or off at runtime (no restart).
//   /<command>                 lists the modules and their state
//   /<command> <module> on|off turns one module on or off (operators only; the choice is saved in the world)
import { world, system, CommandPermissionLevel, CustomCommandStatus, CustomCommandParamType } from "@minecraft/server";

export function defineModules(ns, command, title, defs) {
    const KEY = `${ns}:modules`;
    const off = new Set();
    const known = new Set(defs.map((d) => d.key));
    system.run(() => {
        try {
            const s = world.getDynamicProperty(KEY);
            if (typeof s === "string") for (const k of JSON.parse(s)) if (known.has(k)) off.add(k);
        } catch { }
    });
    const save = () => { try { world.setDynamicProperty(KEY, JSON.stringify([...off])); } catch { } };
    const list = () => defs.map((d) => `§7- §f${d.key} ${off.has(d.key) ? "§coff" : "§aon"}§7: ${d.label}`).join("\n");
    system.beforeEvents.startup.subscribe((init) => {
        init.customCommandRegistry.registerCommand({
            name: command,
            description: `${title}: list modules, or <module> on|off`,
            permissionLevel: CommandPermissionLevel.GameDirectors,
            cheatsRequired: false,
            optionalParameters: [{ name: "module", type: CustomCommandParamType.String }, { name: "state", type: CustomCommandParamType.String }],
        }, (origin, mod, state) => {
            if (mod === undefined || mod === null || mod === "") {
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
