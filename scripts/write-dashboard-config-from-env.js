/**
 * Writes repo-root dashboard-config.json from Railway / process env:
 * SUPABASE_URL, SUPABASE_ANON_KEY, OPENROUTER_API_KEY (any subset).
 * Writes only keys that are non-empty; skips entirely if nothing to write.
 * Invoked via npm prestart — see package.json.
 */
const fs = require("fs");
const path = require("path");

const url = String(process.env.SUPABASE_URL || "").trim();
const key = String(process.env.SUPABASE_ANON_KEY || "").trim();
const openrouterKey = String(process.env.OPENROUTER_API_KEY || "").trim();

const cfg = {};
if (url) cfg.SUPABASE_URL = url;
if (key) cfg.SUPABASE_ANON_KEY = key;
if (openrouterKey) cfg.OPENROUTER_API_KEY = openrouterKey;

if (Object.keys(cfg).length === 0) process.exit(0);

const out = path.join(__dirname, "..", "dashboard-config.json");
fs.writeFileSync(out, JSON.stringify(cfg), "utf8");
