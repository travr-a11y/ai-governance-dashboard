/**
 * Writes repo-root dashboard-config.json from SUPABASE_URL + SUPABASE_ANON_KEY
 * when both are set (e.g. Railway Variables). Safe no-op if either is missing.
 * Invoked via npm prestart — see package.json.
 */
const fs = require("fs");
const path = require("path");

const url = String(process.env.SUPABASE_URL || "").trim();
const key = String(process.env.SUPABASE_ANON_KEY || "").trim();
if (!url || !key) process.exit(0);

const out = path.join(__dirname, "..", "dashboard-config.json");
fs.writeFileSync(
  out,
  JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key }),
  "utf8"
);
