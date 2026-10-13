#!/usr/bin/env node
/**
 * Makes sure a usable .env exists so a fresh clone works with zero setup.
 *
 *  - No .env yet        -> create it with the embedded-Postgres defaults
 *  - .env exists        -> only add any required keys that are missing
 *                          (never overwrites values you already set)
 *
 * The embedded Postgres in scripts/db-serve.mjs uses:
 *   user=ticketflow  password=ticketflow  db=ticketflow  host=127.0.0.1  port=5434
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ENV_PATH = path.join(process.cwd(), ".env");
const PORT = process.env.PGPORT || 5434;

const defaults = {
  TICKETFLOW_DATABASE_URL: `postgresql://ticketflow:ticketflow@127.0.0.1:${PORT}/ticketflow?schema=public`,
  JWT_SECRET: crypto.randomBytes(32).toString("hex"),
  APP_URL: "http://localhost:3000",
  GATEWAY_MODE: "MOCK",
};

const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
const hasKey = (key) => new RegExp(`^\\s*${key}\\s*=\\s*\\S`, "m").test(existing);

const missing = Object.entries(defaults).filter(([key]) => !hasKey(key));

if (missing.length === 0) {
  process.exit(0);
}

const block = missing.map(([key, value]) => `${key}="${value}"`).join("\n") + "\n";
const prefix = existing && !existing.endsWith("\n") ? "\n" : "";
fs.writeFileSync(ENV_PATH, existing + prefix + block);

console.log(`✓ .env updated (added: ${missing.map(([k]) => k).join(", ")})`);
