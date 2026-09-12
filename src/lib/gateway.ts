import { createHmac, randomUUID, timingSafeEqual } from "crypto";

export type GatewayMode = "MOCK" | "RAZORPAY";
export const gatewayMode = (): GatewayMode =>
  (process.env.GATEWAY_MODE as GatewayMode) || "MOCK";

export type GatewayOrder = {
  orderId: string;
  amountPs: number;
  keyId?: string;
  mock: boolean;
};

export type VerifyInput = {
  orderId: string;
  paymentRef: string;
  signature?: string;
};

export type CaptureResult = {
  paymentRef: string;
  method: string;
  status: "CAPTURED" | "FAILED";
  failureReason?: string;
};

const razorBase = "https://api.razorpay.com/v1";
const rzKey = () => process.env.RAZORPAY_KEY_ID || "";
const rzSecret = () => process.env.RAZORPAY_KEY_SECRET || "";
const rzAuth = () =>
  `Basic ${Buffer.from(`${rzKey()}:${rzSecret()}`).toString("base64")}`;

/** Create a payment order at the configured gateway. */
export async function createGatewayOrder(params: {
  bookingRef: string;
  amountPs: number;
}): Promise<GatewayOrder> {
  if (gatewayMode() === "RAZORPAY") {
    const res = await fetch(`${razorBase}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: rzAuth() },
      body: JSON.stringify({
        amount: params.amountPs,
        currency: "INR",
        receipt: params.bookingRef,
        notes: { bookingRef: params.bookingRef },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Razorpay order failed: ${res.status} ${text}`);
    }
    const order = (await res.json()) as { id: string; amount: number };
    return {
      orderId: order.id,
      amountPs: order.amount,
      keyId: rzKey(),
      mock: false,
    };
  }
  return {
    orderId: `mockorder_${randomUUID().replace(/-/g, "").slice(0, 18)}`,
    amountPs: params.amountPs,
    mock: true,
  };
}

/** MOCK: deterministic success unless amount/flag says otherwise. */
export async function captureMockPayment(params: {
  orderId: string;
  amountPs: number;
  simulateFailure?: boolean;
}): Promise<CaptureResult> {
  if (params.simulateFailure) {
    return {
      paymentRef: `mockpay_${randomUUID().slice(0, 14)}`,
      method: "mock_card",
      status: "FAILED",
      failureReason: "Simulated bank decline",
    };
  }
  return {
    paymentRef: `mockpay_${randomUUID().replace(/-/g, "").slice(0, 18)}`,
    method: "mock_upi",
    status: "CAPTURED",
  };
}

/** Razorpay checkout handshake verification: HMAC(order|payment, secret). */
export function verifyRazorpaySignature(input: VerifyInput): boolean {
  if (gatewayMode() === "MOCK") return true;
  const expected = createHmac("sha256", rzSecret())
    .update(`${input.orderId}|${input.paymentRef}`)
    .digest("hex");
  if (!input.signature) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(input.signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Razorpay webhook signature verification. */
export function verifyRazorpayWebhook(body: string, signature: string | null): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return false;
  if (!signature) return false;
  const expected = createHmac("sha256", webhookSecret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** MOCK webhook/signature helper (kept symmetric with Razorpay flow). */
export function mockSignature(orderId: string, paymentRef: string): string {
  return createHmac("sha256", process.env.JWT_SECRET || "dev-secret")
    .update(`${orderId}|${paymentRef}`)
    .digest("hex");
}

/** Initiate a refund at the gateway. */
export async function gatewayRefund(params: {
  paymentRef: string;
  amountPs: number;
}): Promise<{ refundId: string }> {
  if (gatewayMode() === "RAZORPAY") {
    const res = await fetch(`${razorBase}/payments/${params.paymentRef}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: rzAuth() },
      body: JSON.stringify({ amount: params.amountPs, speed: "normal" }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Razorpay refund failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as { id: string };
    return { refundId: data.id };
  }
  return { refundId: `mockrefund_${randomUUID().slice(0, 14)}` };
}
