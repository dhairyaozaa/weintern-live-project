#!/usr/bin/env node
/**
 * Full UI flow test in headless Chrome (puppeteer-core → installed Chrome):
 *   register → browse → open event → book 2 tickets → apply WELCOME10 →
 *   pay (mock gateway) → QR pass page → switch to organizer →
 *   check-in console: scan QR (✅) → rescan (⚠️ duplicate).
 * Screenshots land in .ui-shots/.
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SHOTS = path.join(process.cwd(), ".ui-shots");
fs.mkdirSync(SHOTS, { recursive: true });

const EMAIL = `uitester${Date.now().toString(36)}@demo.io`;
const PASSWORD = "Password@123";
let failures = 0;

function check(name, cond, extra = "") {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name} ${extra}`); }
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: false });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--window-size=1440,900", "--disable-features=Translate"],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));
  page.setDefaultTimeout(30000);

  try {
    // ── 1. Register a fresh customer ──────────────────────────────────────
    console.log("1. Register");
    await page.goto(`${BASE}/register`, { waitUntil: "networkidle0" });
    await page.type("input[placeholder='Priya Sharma']", "Usha Iyer");
    await page.type("input[placeholder='you@example.com']", EMAIL);
    await page.type("input[placeholder='At least 8 characters']", PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
      page.click("button.btn-primary"),
    ]);
    await page.waitForSelector("a[href^='/events/']", { timeout: 30000 });
    check("registered + redirected to browse", page.url().includes("/browse"));

    // ── 2. Browse & open an event ─────────────────────────────────────────
    console.log("2. Browse");
    await sleep(800); // allow list fetch + render
    await shot(page, "01-browse.png");
    const cardTitles = await page.$$eval("a[href^='/events/']", (as) => as.map((a) => a.textContent?.trim().slice(0, 60)));
    check("event cards rendered", cardTitles.length > 0, `got ${cardTitles.length}`);
    // open the first non sold-out card
    const opened = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("a[href^='/events/']")];
      const target = cards.find((c) => !c.textContent?.includes("Sold out"));
      if (!target) return null;
      target.click();
      return target.href;
    });
    check("clicked an event card", !!opened);
    await page.waitForSelector("h1", { timeout: 30000 });
    // Wait until the buy box has rendered (Spinner disappears, tier "left" badges appear)
    await page.waitForFunction(
      () => !document.body.innerText.includes("Loading event") && document.body.innerText.includes("left"),
      { timeout: 30000 }
    );
    await sleep(300);

    // ── 3. Book 2 tickets in an open tier ─────────────────────────────────
    console.log("3. Book tickets");
    const eventTitle = await page.$eval("h1", (h) => h.textContent?.trim());
    const tierBox = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll(".card .rounded-lg.border")];
      for (const b of boxes) {
        if (b.textContent?.includes("left") && b.querySelector("button.btn-primary")) {
          const select = b.querySelector("select");
          if (select) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
            setter.call(select, "2");
            select.dispatchEvent(new Event("change", { bubbles: true }));
          }
          return { name: b.querySelector(".text-sm.font-bold")?.textContent, btn: true };
        }
      }
      return null;
    });
    check("open tier with Book now found", !!tierBox, JSON.stringify(tierBox));
    await shot(page, "02-event.png");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
      page.evaluate(() => {
        const btn = [...document.querySelectorAll("button.btn-primary")].find((b) => b.textContent?.includes("Book now"));
        btn?.click();
      }),
    ]);
    check("landed on checkout", page.url().includes("/checkout/"), page.url());

    // ── 4. Apply coupon WELCOME10 ─────────────────────────────────────────
    console.log("4. Apply coupon");
    await page.waitForSelector("input[placeholder='e.g. EARLY20']", { timeout: 30000 });
    const totalBefore = await page.evaluate(() => document.body.innerText.match(/Total\s*₹[\d,.]+/)?.[0]);
    await page.type("input[placeholder='e.g. EARLY20']", "WELCOME10");
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button.btn-secondary")].find((b) => b.textContent?.includes("Apply"));
      btn?.click();
    });
    await page.waitForFunction(
      () => document.body.innerText.includes("applied 🎉"),
      { timeout: 15000 }
    );
    const totalAfter = await page.evaluate(() => document.body.innerText.match(/Total\s*₹[\d,.]+/)?.[0]);
    check("coupon badge shows", true);
    check(`total dropped after coupon (${totalBefore} → ${totalAfter})`, totalBefore !== totalAfter, JSON.stringify({ totalBefore, totalAfter }));
    await shot(page, "03-checkout-coupon.png");

    // ── 5. Pay ────────────────────────────────────────────────────────────
    console.log("5. Pay");
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button.btn-primary")].find((b) => /Pay ₹/.test(b.textContent ?? ""));
      btn?.click();
    });
    await page.waitForSelector("img[alt='Ticket QR']", { timeout: 45000 });
    check("payment confirmed → QR tickets visible", true);
    const bookingUrl = page.url();
    const ref = bookingUrl.split("/").pop()?.split("?")[0];
    await sleep(800);
    await shot(page, "04-booking-qr.png");
    const pageText = await page.evaluate(() => document.body.innerText);
    check("status shows Confirmed", /confirmed/i.test(pageText));
    check("discount line on invoice", /coupon discount/i.test(pageText));
    check("invoice number assigned", /INV-\d+/.test(pageText));

    // Pull the QR payload (same data the visible QR encodes) via the app API.
    const qrPayload = await page.evaluate(async (r) => {
      const res = await fetch(`/api/bookings/${r}`, { cache: "no-store" });
      const d = await res.json();
      return d.tickets?.[0]?.qrPayload ?? null;
    }, ref);
    check("QR payload readable", !!qrPayload && qrPayload.startsWith("TF1."), String(qrPayload).slice(0, 20));

    // ── 6. Switch to organizer ────────────────────────────────────────────
    console.log("6. Organizer login");
    await page.evaluate(() => {
      const btn = document.querySelector("button[title='Sign out']");
      btn?.click();
    });
    await sleep(1200);
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button.btn-secondary")].find((b) => b.textContent?.includes("Organizer demo"));
      btn?.click();
    });
    await page.waitForFunction(() => document.body.innerText.includes("Organizer"), { timeout: 30000 });
    await sleep(1500);
    check("organizer signed in", page.url().includes("/organizer"), page.url());

    // ── 7. Check-in console: scan + duplicate scan ────────────────────────
    console.log("7. Gate check-in");
    await page.goto(`${BASE}/organizer/checkin`, { waitUntil: "networkidle0" });
    await page.waitForSelector("select.input", { timeout: 30000 });
    // select the event that matches the ticket (its title)
    await page.evaluate((title) => {
      const sel = document.querySelector("select.input");
      const opt = [...sel.options].find((o) => o.textContent?.toLowerCase().includes(title.toLowerCase().slice(0, 12)));
      if (opt) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
        setter.call(sel, opt.value);
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }, eventTitle ?? "");
    await page.type("input.font-mono", qrPayload);
    await page.click("button[type='submit'].btn-primary");
    await page.waitForFunction(() => document.body.innerText.includes("Welcome,"), { timeout: 20000 });
    const firstScan = await page.evaluate(() => document.body.innerText.match(/Welcome,[^\n]*/)?.[0]);
    check(`first scan accepted (${firstScan})`, !!firstScan);
    await shot(page, "05-checkin-ok.png");

    // duplicate scan (the console clears the scanner input after each submit)
    await page.click("input.font-mono");
    await page.type("input.font-mono", qrPayload);
    await page.click("button[type='submit'].btn-primary");
    await page.waitForFunction(() => document.body.innerText.includes("Already checked in"), { timeout: 20000 });
    check("duplicate scan flagged", true);
    await shot(page, "06-checkin-duplicate.png");

    // stats reflect the check-in — read the selected event's option text "(X/Y in)"
    let statsOk = false;
    let statsText = "";
    try {
      await page.waitForFunction(
        () => {
          const sel = document.querySelector("select.input");
          return /\(([1-9]\d*)\/\d+ in\)/.test(sel?.selectedOptions[0]?.textContent ?? "");
        },
        { timeout: 15000 }
      );
      statsText = await page.evaluate(() => document.querySelector("select.input")?.selectedOptions[0]?.textContent?.match(/\(\d+\/\d+ in\)/)?.[0] ?? "");
      statsOk = true;
    } catch { /* keep failure */ }
    check(`live stats updated (${statsText.trim()})`, statsOk);

    console.log(`\n${failures === 0 ? "🎉 UI FLOW PASSED" : `❌ ${failures} check(s) failed`}`);
    console.log(`   screenshots → .ui-shots/`);
    await browser.close();
    process.exit(failures === 0 ? 0 : 1);
  } catch (err) {
    failures++;
    console.error("\n✗ flow crashed:", err.message);
    try { await shot(page, "99-crash.png"); console.log("   crash screenshot → .ui-shots/99-crash.png"); } catch {}
    await browser.close();
    process.exit(1);
  }
}

main();
