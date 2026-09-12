#!/usr/bin/env node
/**
 * Zero-setup local Postgres for TicketFlow (npm-managed binaries — nothing to
 * install, no account). Data lives in .pgdata/ and survives restarts.
 *
 *   node scripts/db.mjs ensure  → running? done. else boot detached daemon + wait
 *   node scripts/db.mjs start   → run the keeper in the foreground (manual)
 *   node scripts/db.mjs stop    → shut down (reads pid from .pgdata/postmaster.pid)
 *   node scripts/db.mjs status  → exit 0 if reachable, 1 if not
 *   node scripts/db.mjs reset   → stop + wipe .pgdata (full reset)
 */
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { Client } from "pg";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, ".pgdata");
const PGUSER = "ticketflow";
const PASSWORD = "ticketflow";
const DB = "ticketflow";
const PORT = Number(process.env.PGPORT || 5434);
const HOST = "127.0.0.1";

function canAuth() {
  return new Promise(async (resolve) => {
    const c = new Client({ host: HOST, port: PORT, user: PGUSER, password: PASSWORD, database: DB, connectionTimeoutMillis: 2500 });
    try { await c.connect(); await c.query("SELECT 1"); resolve(true); }
    catch { resolve(false); }
    finally { await c.end().catch(() => {}); }
  });
}

async function waitFor(fn, uptoMs, step = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < uptoMs) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, step));
  }
  return false;
}

function serverPid() {
  try {
    const first = fs.readFileSync(path.join(DATA_DIR, "postmaster.pid"), "utf8").split("\n")[0].trim();
    const pid = Number(first);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function isPostgresPid(pid) {
  try {
    const out = execFileSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], { encoding: "utf8" });
    return /postgres\.exe/i.test(out);
  } catch {
    return false;
  }
}

async function stopServer() {
  const pid = serverPid();
  if (pid && isPostgresPid(pid)) {
    try { execFileSync("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore" }); } catch { /* already gone */ }
  }
  const stopped = await waitFor(async () => !(await canAuth()), 20000);
  // Belt & braces: any stray postgres processes (crashed children etc.)
  try {
    const out = execFileSync("tasklist", ["/FI", "IMAGENAME eq postgres.exe", "/FO", "CSV", "/NH"], { encoding: "utf8" });
    for (const line of out.split("\n")) {
      const m = line.match(/"postgres\.exe","(\d+)"/i);
      if (m) { try { execFileSync("taskkill", ["/F", "/PID", m[1]], { stdio: "ignore" }); } catch {} }
    }
  } catch { /* tasklist unavailable */ }
  return stopped;
}

async function main() {
  const cmd = process.argv[2] || "ensure";

  if (cmd === "status") {
    const ok = await canAuth();
    console.log(ok ? "up" : "down");
    process.exit(ok ? 0 : 1);
  }

  if (cmd === "stop") {
    console.log((await stopServer()) ? "✓ Postgres stopped" : "⚠ Postgres did not stop cleanly");
    process.exit(0);
  }

  if (cmd === "reset") {
    await stopServer();
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    console.log("✓ wiped .pgdata — run `npm run db:up && npm run db:push && npm run db:seed`");
    process.exit(0);
  }

  if (cmd === "start") {
    // Foreground keeper (manual use).
    await import("./db-serve.mjs");
    return;
  }

  // ── ensure (default) ─────────────────────────────────────────────────────
  if (await canAuth()) {
    console.log("✓ database ready");
    process.exit(0);
  }

  // Boot the keeper as a detached daemon; it survives this process exiting.
  const child = spawn(process.execPath, [path.join(ROOT, "scripts", "db-serve.mjs")], {
    cwd: ROOT,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: process.env,
  });
  child.unref();

  const ok = await waitFor(canAuth, 90000);
  if (!ok) {
    console.error("✗ Postgres did not become ready in 90s — run `node scripts/db-serve.mjs` to see errors");
    process.exit(1);
  }
  console.log("✓ database ready (embedded Postgres, data in .pgdata/)");
  process.exit(0);
}

main().catch((err) => {
  console.error("db.mjs failed:", err?.message ?? err);
  process.exit(1);
});
