/**
 * Writes repo-root dashboard-config.json from Railway / process env:
 * SUPABASE_URL, SUPABASE_ANON_KEY, OPENROUTER_API_KEY (any subset).
 * Writes only keys that are non-empty and pass basic sanity checks.
 * Skips entirely if nothing valid to write.
 * Invoked via npm prestart — see package.json.
 */
const fs = require("fs");
const path = require("path");

function looksLikeRealJwt(str) {
  if (!str) return false;
  const low = str.toLowerCase();
  if (low.includes("placeholder") || low.includes("your_") || low.includes("test-")) return false;
  const parts = str.split(".");
  return parts.length === 3 && parts.every(p => p.length > 10);
}

function looksLikeRealUrl(str) {
  if (!str) return false;
  const low = str.toLowerCase();
  if (low.includes("your_project") || low.includes("placeholder")) return false;
  return str.startsWith("https://") && str.length > 20;
}

const rawUrl = String(process.env.SUPABASE_URL || "").trim();
const rawKey = String(process.env.SUPABASE_ANON_KEY || "").trim();
const rawOpenrouter = String(process.env.OPENROUTER_API_KEY || "").trim();

const url = looksLikeRealUrl(rawUrl) ? rawUrl : "";
const key = looksLikeRealJwt(rawKey) ? rawKey : "";
const openrouterKey = (rawOpenrouter && !rawOpenrouter.toLowerCase().includes("placeholder")) ? rawOpenrouter : "";

if (rawUrl && !url) console.warn("[prestart] SUPABASE_URL looks like a placeholder — skipping.");
if (rawKey && !key) console.warn("[prestart] SUPABASE_ANON_KEY looks like a placeholder — skipping.");

const cfg = {};
if (url) cfg.SUPABASE_URL = url;
if (key) cfg.SUPABASE_ANON_KEY = key;
if (openrouterKey) cfg.OPENROUTER_API_KEY = openrouterKey;

if (Object.keys(cfg).length === 0) process.exit(0);

const out = path.join(__dirname, "..", "dashboard-config.json");
fs.writeFileSync(out, JSON.stringify(cfg), "utf8");
