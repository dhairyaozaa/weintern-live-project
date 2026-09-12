import { randomBytes, createHmac } from "crypto";

const secret = () => process.env.JWT_SECRET || "dev-secret-change-me";

/** URL-safe random id */
export const rid = (len = 10) => randomBytes(len).toString("base64url");

/** Signed QR payload: TF1.<ticketId>.<hmac>. Opaque, unforgeable, single source of truth. */
export function makeQrPayload(ticketId: string, eventId: string): string {
  const sig = createHmac("sha256", secret())
    .update(`${ticketId}.${eventId}`)
    .digest("base64url")
    .slice(0, 24);
  return `TF1.${ticketId}.${sig}`;
}

export function parseQrPayload(payload: string): { ticketId: string } | null {
  const parts = payload.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "TF1") return null;
  return { ticketId: parts[1] };
}

/** Human booking reference: TF-XXXXXX */
export function bookingReference() {
  return `TF-${rid(4).replace(/[^A-Z0-9]/gi, "X").toUpperCase().slice(0, 6)}`;
}

/** Invoice number: INV-2026-000123 */
export function invoiceNumber(seq: number) {
  return `INV-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`;
}
