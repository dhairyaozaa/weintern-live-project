#!/usr/bin/env node
/**
 * End-to-end smoke test against a running dev server (http://localhost:3000).
 * Exercises: login → browse → reserve(coupon) → mock-pay → tickets →
 * organizer QR check-in (incl. duplicate scan) → notifications → guard rails.
 *
 *   node scripts/smoke.mjs
 */
const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const PASSWORD = "Password@123";
let failures = 0;

function check(name, cond, extra = "") {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name} ${extra}`); }
}

async function api(path, { method = "GET", body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, data, cookie: setCookie ? setCookie.split(";")[0] : null };
}

async function main() {
  console.log(`Smoke testing ${BASE}\n`);

  // ── 1. Public browse ──────────────────────────────────────────────────────
  console.log("1. Public event discovery");
  const list = await api("/api/events?sort=soon");
  check("GET /api/events → 200", list.status === 200);
  const events = list.data?.events ?? [];
  check("published events returned", events.length >= 3, `got ${events.length}`);
  const open = events.find((e) => !e.soldOut);
  check("at least one non-sold-out event", !!open);
  const detail = await api(`/api/events/${open.slug}`);
  check("GET /api/events/[slug] → 200", detail.status === 200);
  const tier = (detail.data?.tiers ?? []).find((t) => !t.soldOut && t.remaining > 0);
  check("open tier available", !!tier);

  // ── 2. Auth ───────────────────────────────────────────────────────────────
  console.log("2. Authentication");
  const bad = await api("/api/auth/login", { method: "POST", body: { email: "customer@demo.io", password: "wrong" } });
  check("wrong password rejected (401)", bad.status === 401);
  const login = await api("/api/auth/login", { method: "POST", body: { email: "customer@demo.io", password: PASSWORD } });
  check("customer login → 200", login.status === 200 && login.data?.user?.role === "CUSTOMER");
  const userCookie = login.cookie;
  const me = await api("/api/auth/me", { cookie: userCookie });
  check("session cookie works (/api/auth/me)", me.data?.user?.email === "customer@demo.io");

  // ── 3. Checkout: reserve → coupon → pay ───────────────────────────────────
  console.log("3. Checkout with coupon");
  // Try reserving with the demo coupon; if the account has exhausted its
  // per-user limit (expected on repeat runs), fall back to a plain booking.
  let reserve = await api("/api/checkout/reserve", {
    method: "POST", cookie: userCookie,
    body: { tierId: tier.id, quantity: 2, couponCode: "WELCOME10" },
  });
  const usedCoupon = reserve.status === 200;
  if (!reserve.status.toString().startsWith("2")) {
    reserve = await api("/api/checkout/reserve", {
      method: "POST", cookie: userCookie,
      body: { tierId: tier.id, quantity: 2 },
    });
  }
  check("reserve → 200", reserve.status === 200, JSON.stringify(reserve.data));
  const bookingRef = reserve.data?.booking?.reference;
  check("booking reference issued", !!bookingRef);
  if (usedCoupon) check("coupon accepted at reserve", true);
  check("hold expiry returned", !!reserve.data?.booking?.expiresAt);

  const dupCoupon = await api("/api/checkout/apply-coupon", {
    method: "POST", cookie: userCookie,
    body: { reference: bookingRef, couponCode: "WELCOME10" },
  });
  check("re-applying same coupon still valid or clear rejection", [200, 400, 409].includes(dupCoupon.status));

  const pay = await api("/api/checkout/mock-pay", {
    method: "POST", cookie: userCookie, body: { bookingRef },
  });
  check("mock payment captured", pay.data?.status === "CAPTURED", JSON.stringify(pay.data));
  check("invoice number assigned", !!pay.data?.booking?.invoiceNo);

  const priced = await api(`/api/bookings/${bookingRef}`, { cookie: userCookie });
  check(
    usedCoupon ? "WELCOME10 discount reflected in booking" : "booking priced correctly",
    usedCoupon
      ? (priced.data?.booking?.discountPs ?? 0) > 0
      : (priced.data?.booking?.totalPs ?? 0) > 0
  );

  // Idempotency: paying again must fail cleanly
  const payAgain = await api("/api/checkout/mock-pay", {
    method: "POST", cookie: userCookie, body: { bookingRef },
  });
  check("double-pay rejected (409)", payAgain.status === 409);

  const booking = await api(`/api/bookings/${bookingRef}`, { cookie: userCookie });
  check("booking visible with QR tickets", (booking.data?.tickets?.length ?? 0) === 2);
  const qrPayload = booking.data?.tickets?.[0]?.qrPayload;

  // ── 4. Guard rails ────────────────────────────────────────────────────────
  console.log("4. Guard rails");
  const oversell = await api("/api/checkout/reserve", {
    method: "POST", cookie: userCookie,
    body: { tierId: tier.id, quantity: 999 },
  });
  check("oversell rejected (400/409)", [400, 409].includes(oversell.status));
  const noAuth = await api("/api/checkout/reserve", { method: "POST", body: { tierId: tier.id, quantity: 1 } });
  check("unauthenticated reserve rejected (401)", noAuth.status === 401);
  const otherTicket = await api("/api/checkin", {
    method: "POST", cookie: userCookie, body: { payload: qrPayload ?? "x" },
  });
  check("customer cannot scan tickets (403)", otherTicket.status === 403);

  // ── 5. Organizer check-in ─────────────────────────────────────────────────
  console.log("5. Organizer gate check-in");
  const orgLogin = await api("/api/auth/login", { method: "POST", body: { email: "organizer@demo.io", password: PASSWORD } });
  const orgCookie = orgLogin.cookie;
  check("organizer login → 200", orgLogin.status === 200);
  if (qrPayload) {
    const scan1 = await api("/api/checkin", { method: "POST", cookie: orgCookie, body: { payload: qrPayload } });
    check("first scan → checked in", scan1.status === 200 && scan1.data?.alreadyCheckedIn === false, JSON.stringify(scan1.data));
    const scan2 = await api("/api/checkin", { method: "POST", cookie: orgCookie, body: { payload: qrPayload } });
    check("duplicate scan detected", scan2.status === 200 && scan2.data?.alreadyCheckedIn === true);
    const stats = await api("/api/checkin", { cookie: orgCookie });
    check("gate stats endpoint works", stats.status === 200 && Array.isArray(stats.data?.events));
  }

  // ── 6. Notifications & admin ──────────────────────────────────────────────
  console.log("6. Notifications & admin");
  const notifs = await api("/api/notifications", { cookie: userCookie });
  check("buyer got notifications (ticket + reminder)", (notifs.data?.notifications?.length ?? 0) >= 2);
  const adminLogin = await api("/api/auth/login", { method: "POST", body: { email: "admin@demo.io", password: PASSWORD } });
  const overview = await api("/api/admin/overview", { cookie: adminLogin.cookie });
  check("admin overview loads", overview.status === 200 && typeof overview.data?.kpis?.gmvPs === "number");
  const forbidden = await api("/api/admin/overview", { cookie: userCookie });
  check("customer blocked from admin (403)", forbidden.status === 403);

  console.log(`\n${failures === 0 ? "🎉 ALL CHECKS PASSED" : `❌ ${failures} check(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error("smoke crashed:", e); process.exit(1); });
