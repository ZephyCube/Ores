// ZephyCube chat look (same file in every pack, only TAGS differs). Applies to every chat message and title this
// pack sends: "[ZephyCube] text" with gray brackets, a lapis-blue name, white text, gold highlights; red stays red.
// Titles are bold gold, subtitles white. Action bars are not touched. Change BLUE to restyle (§1 darker, §9 lighter).
import * as mc from "@minecraft/server";

const { world, Player, ScreenDisplay } = mc;

const BLUE = "§t";
const PREFIX = "§7[" + BLUE + "ZephyCube§7]§r ";
const TAGS = []; // old "[Tag]" lead-ins that the prefix replaces
const CODE = /§[0-9a-fg-v]/g;
const TAG_RE = TAGS.length
  ? new RegExp("^((?:§[0-9a-v])*)\\[(?:§[klmnor0-9a-v])*(?:" + TAGS.map((t) => [...t].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(?:§[0-9a-v])*")).join("|") + ")(?:§[0-9a-v])*\\](?:§r)?:?")
  : null;

function styleChat(msg) {
  if (typeof msg !== "string") {
    // RawMessage / array: put the prefix in front, leave the content alone
    if (msg && typeof msg === "object") {
      const first = Array.isArray(msg) ? msg[0] : msg.rawtext?.[0];
      if (first && typeof first.text === "string" && first.text.startsWith(PREFIX)) return msg;
      return { rawtext: [{ text: PREFIX + "§f" }, ...(Array.isArray(msg) ? msg : [msg])] };
    }
    return msg;
  }
  if (!msg || msg.startsWith(PREFIX)) return msg;
  if (msg.length > 700 || msg.split("\n").length > 6) return msg;
  if (TAG_RE) msg = msg.replace(TAG_RE, (m, lead) => (/§[c4]/.test(lead) ? "§c" : "")).replace(/^((?:§[0-9a-vklmnor])*)\s+/, "$1");
  const lead = msg.match(/^(?:§[klmnor])*(§[0-9a-fg-v])/)?.[1];
  const base = lead === "§c" || lead === "§4" ? "§c" : "§f";
  const body = msg.replace(CODE, (c) => {
    if (c === lead) return base;
    if (c === "§c" || c === "§4") return "§c";
    if (c === "§7" || c === "§8" || c === "§f") return c;
    return "§6";
  });
  return PREFIX + (lead ? "" : base) + body;
}

function styleTitle(t) {
  if (typeof t !== "string") return t;
  const plain = t.replace(CODE, "").replace(/§[klmnor]/g, "");
  if (!plain.trim() || plain.startsWith("!")) return t;
  return "§l§6" + plain;
}

function patch(proto, name, fn) {
  try {
    const orig = proto[name];
    if (typeof orig !== "function") return;
    Object.defineProperty(proto, name, {
      value: function (...args) { return orig.apply(this, fn(args)); },
      writable: true, configurable: true,
    });
  } catch {}
}

patch(Player?.prototype, "sendMessage", (a) => { a[0] = styleChat(a[0]); return a; });
patch(Object.getPrototypeOf(world), "sendMessage", (a) => { a[0] = styleChat(a[0]); return a; });
patch(ScreenDisplay?.prototype, "setTitle", (a) => {
  a[0] = styleTitle(a[0]);
  try { if (a[1] && typeof a[1].subtitle === "string") a[1] = { ...a[1], subtitle: "§f" + a[1].subtitle.replace(CODE, "") }; } catch {}
  return a;
});
