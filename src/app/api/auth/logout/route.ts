import { ok, handler } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  await destroySession();
  return ok({ success: true });
});
