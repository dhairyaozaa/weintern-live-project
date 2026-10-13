#!/usr/bin/env node
/**
 * Foreground keeper: boots the embedded Postgres via the embedded-postgres
 * library and stays alive while the server runs. Normally spawned detached
 * by `db.mjs ensure` — you rarely need to run this directly.
 */
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, ".pgdata");
const PORT = Number(process.env.PGPORT || 5434);

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: "ticketflow",
  password: "ticketflow",
  port: PORT,
  persistent: true,
  // UTF-8 + C locale: Windows' default codepage (WIN1252) rejects ₹/emoji.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

async function shutdown() {
  try { await pg.stop(); } catch { /* already gone */ }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
  const firstRun = !fs.existsSync(path.join(DATA_DIR, "PG_VERSION"));
  // NOTE: initialise() is NOT idempotent (it re-runs initdb and fails on a
  // non-empty dir) — only call it on a fresh data directory.
  if (firstRun) await pg.initialise();
  await pg.start();
  if (firstRun) {
    const c = await pg.getPgClient("postgres");
    await c.connect();
    await c.query(`CREATE DATABASE "ticketflow"`);
    await c.end();
    console.log(`✓ database "ticketflow" created`);
  }
  console.log(`✓ Postgres ready on 127.0.0.1:${PORT}`);
  // Hold the process open so the detached daemon keeps Postgres alive.
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error("db-serve failed:", err?.message ?? err);
  process.exit(1);
});
