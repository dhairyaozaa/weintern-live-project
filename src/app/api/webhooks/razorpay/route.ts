import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";
import { verifyRazorpayWebhook, gatewayMode } from "@/lib/gateway";
import { confirmBooking, expireBooking } from "@/lib/booking";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

type WebhookEntity = {
  id: string;
  order_id?: string;
  amount?: number;
  method?: string;
  error_description?: string;
  notes?: Record<string, string>;
};

/**
 * Razorpay webhook receiver. Verifies HMAC signature, then applies the
 * payment lifecycle server-side (works even if the buyer closed the tab).
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (gatewayMode() === "RAZORPAY") {
    const valid = verifyRazorpayWebhook(raw, signature);
    if (!valid) return fail(400, "Invalid webhook signature");
  } else if (process.env.NODE_ENV === "production") {
    return fail(400, "Webhooks disabled in MOCK mode");
  }

  let body: {
    event?: string;
    payload?: { payment?: { entity?: WebhookEntity }; refund?: { entity?: { id: string; payment_id?: string } } };
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "Invalid JSON");
  }

  const event = body.event ?? "";
  const payment = body.payload?.payment?.entity;

  try {
    if ((event === "payment.captured" || event === "payment.authorized") && payment?.order_id) {
      const rec = await prisma.payment.findUnique({
        where: { orderId: payment.order_id },
        include: { booking: true },
      });
      if (rec && rec.booking.status === "PENDING_PAYMENT") {
        await prisma.payment.update({
          where: { id: rec.id },
          data: {
            status: "CAPTURED",
            paymentRef: payment.id,
            method: payment.method,
            rawPayload: body as object,
          },
        });
        await confirmBooking(rec.booking.id);
        await audit({
          action: "webhook.payment.captured",
          entity: "Booking",
          entityId: rec.booking.id,
          metadata: { paymentRef: payment.id },
        });
      }
    } else if (event === "payment.failed" && payment?.order_id) {
      const rec = await prisma.payment.findUnique({
        where: { orderId: payment.order_id },
        include: { booking: true },
      });
      if (rec) {
        await prisma.payment.update({
          where: { id: rec.id },
          data: {
            status: "FAILED",
            paymentRef: payment.id,
            failureReason: payment.error_description ?? "Bank declined",
            rawPayload: body as object,
          },
        });
      }
    } else if (event === "refund.processed") {
      const refundEntity = body.payload?.refund?.entity;
      if (refundEntity?.id) {
        await prisma.refund.updateMany({
          where: { providerRef: refundEntity.id },
          data: { status: "COMPLETED" },
        });
      }
    }
  } catch (err) {
    // Log but ACK so Razorpay does not retry forever on our internal errors.
    console.error("[webhook] handler error", err);
  }

  return ok({ received: true });
}
