import { prisma } from "./prisma";

/**
 * Persist an in-app notification. Swap/extend here for email/SMS providers
 * (SendGrid, Resend, MSG91…) without touching call sites.
 */
export async function notify(params: {
  userId: string;
  title: string;
  body: string;
  kind?: "SYSTEM" | "BOOKING" | "WAITLIST" | "EVENT_UPDATE" | "TICKET";
  link?: string;
}) {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        body: params.body,
        kind: params.kind ?? "SYSTEM",
        link: params.link,
      },
    });
  } catch (err) {
    console.error("[notify] failed", err);
  }
}
