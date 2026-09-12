#!/usr/bin/env node
import { spawn, exec } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const POLL_MS = 500;
const OPEN_FALLBACK_MS = 10_000;

function nextBin() {
  const local = path.join("node_modules", "next", "dist", "bin", "next");
  if (fs.existsSync(local)) {
    return { cmd: process.execPath, args: [local], shell: false };
  }
  return { cmd: "npx", args: ["--no-install", "next"], shell: true };
}

const { cmd, args, shell } = nextBin();

const child = spawn(cmd, [...args, "dev"], {
  env: process.env,
  shell,
  stdio: ["inherit", "pipe", "inherit"],
});

let localUrl = null;
let ready = false;
let scanBuffer = "";

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  scanBuffer += chunk;
  if (scanBuffer.length > 64_000) scanBuffer = scanBuffer.slice(-32_000);

  if (!localUrl) {
    const m = scanBuffer.match(/Local:\s*(http:\/\/[^\s]+)/i);
    if (m) localUrl = m[1];
  }
  if (!ready && /Ready in|started server|ready - started/i.test(scanBuffer)) {
    ready = true;
  }

  process.stdout.write(chunk);
});

let opened = false;
function openBrowser(url) {
  if (opened) return;
  opened = true;
  console.log(`\n▶ Opening ${url} in your browser...\n`);
  if (process.platform === "win32") {
    exec(`start "" "${url}"`);
  } else if (process.platform === "darwin") {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

async function isUp(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

async function pollAndOpen() {
  const url = localUrl || "http://localhost:3000";
  const t0 = Date.now();
  let fallbackScheduled = false;

  while (!opened) {
    if (ready && !fallbackScheduled) {
      fallbackScheduled = true;
      setTimeout(() => openBrowser(url), OPEN_FALLBACK_MS).unref();
    }
    if (await isUp(url)) {
      openBrowser(url);
      return;
    }
    if (Date.now() - t0 > 180_000) {
      console.warn("⚠ Server did not respond in 3 minutes; opening the browser anyway.");
      openBrowser(url);
      return;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

pollAndOpen().catch(() => {});

child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
