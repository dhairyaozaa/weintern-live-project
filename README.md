# 🎟️ TicketFlow — Event Ticketing Marketplace

A BookMyShow/Eventbrite-style platform: organizers publish events, configure
ticket tiers and capacity, accept payments, monitor sales in real time, and
validate attendees with digital QR tickets. Customers discover events, buy
with coupons, and get instant QR passes.

Built with **Next.js 14 (App Router) · Prisma · PostgreSQL · Tailwind · SSE**.

---

## Quick start (zero setup)

```bash
npm install
npm run dev
```

That's it. `npm run dev` auto-starts a **npm-managed embedded Postgres**
(no install, no account, no Docker). Data persists in `.pgdata/`.

Then open **http://localhost:3000** and sign in with a demo account:

| Role      | Email                    | Password      |
| --------- | ------------------------ | ------------- |
| Customer  | `customer@demo.io`       | `Password@123`|
| Organizer | `organizer@demo.io`      | `Password@123`|
| Admin     | `admin@demo.io`          | `Password@123`|

> First run: the dev server triggers `predev` → embedded Postgres boots →
> run `npm run db:push && npm run db:seed` once to create the schema and the
> 6 demo events / coupons / bookings.

## Scripts

| Command              | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | Start Postgres (if needed) + Next dev server              |
| `npm run db:up`      | Start embedded Postgres only (`scripts/db.mjs ensure`)    |
| `npm run db:push`    | Sync Prisma schema to the database                        |
| `npm run db:seed`    | Seed demo users/events/coupons/bookings                   |
| `npm run db:reset`   | Stop Postgres + wipe `.pgdata` (full reset)               |
| `npm run build`      | Production build (`prisma generate && next build`)        |
| `npm run typecheck`  | `tsc --noEmit`                                            |
| `node scripts/smoke.mjs` | E2E smoke test against `localhost:3000` (27 checks)   |

The database env var is **`TICKETFLOW_DATABASE_URL`** (in `.env`) — a
project-specific name so a globally exported `DATABASE_URL` can never
silently point the app at the wrong database. To use a real Postgres
(Neon, Supabase, local…), just change that one value.

## Feature map

**Discovery** — search, category/city/price/date filters, sorting, pagination,
view counters, verified-organizer badges.

**Organizer dashboard** — onboarding + verification flow, event creation with
tier configuration, per-event analytics, broadcast announcements, event-scoped
coupons, live gate console.

**Inventory & checkout** — atomic seat holds (10-min reservation, compare-and-set
`UPDATE` so concurrent buyers can never oversell), sold-out auto-flip, per-user
purchase limits, early-bird and demand pricing modes, coupon validation
(percent/flat, min order, caps, per-user limits).

**Payments** — pluggable gateway (`GATEWAY_MODE`): a full **MOCK** gateway that
simulates capture/failure, or **Razorpay** (checkout.js + signature verify +
webhook). Payment webhooks are idempotent; confirm path is race-safe.

**Tickets** — signed QR payloads (HMAC), seat labels, invoice numbers,
digital pass page, refund flow (gateway refund + inventory restore + notify).

**Event day** — SSE live stream per event, live mode toggle, QR gate scanner
with duplicate-scan detection, manual lookup fallback, check-in stats.

**Platform** — notifications, waitlist with auto-notify when stock returns,
admin moderation (organizer verification, event rejection, refunds, coupons,
settings, commission), full audit log.

## Architecture notes

```
src/
  app/            # App Router pages + /api route handlers
  components/     # EventCard, site header, UI primitives
  lib/            # domain layer
    inventory.ts  # holds/consume/sweep — oversell-safe
    booking.ts    # confirm (idempotent) + refund
    pricing.ts    # early-bird / demand pricing, purchase limits
    coupons.ts    # validation + usage tracking
    gateway.ts    # MOCK | Razorpay adapter
    checkin.ts    # QR verify + gate check-in
    realtime.ts   # in-process pub/sub → SSE
    qr.ts, auth.ts, audit.ts, settings.ts, waitlist.ts, notifications.ts
  middleware.ts   # JWT route guards per role
prisma/           # schema + seed
scripts/          # embedded DB lifecycle, smoke test
```

**Concurrency**: ticket holds use a conditional `updateMany`
(`sold + held ≤ capacity`) as a compare-and-set — two buyers racing for the
last seat: exactly one wins. Expired holds are swept opportunistically on
reserve; sold-out state recalculates and waitlisted users get notified
automatically.

**Payments**: the booking confirm path is idempotent (webhook vs. verify race
→ single CONFIRMED booking, single set of tickets). Coupon changes delete
stale CREATED payment orders; a fresh order is created at pay time.
