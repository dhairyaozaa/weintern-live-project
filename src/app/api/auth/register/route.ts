import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, createSession, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const POST = handler(async (req: Request) => {
  const body = schema.parse(await req.json());
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw new ApiError(409, "An account with this email already exists");

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash: await hashPassword(body.password),
      role: "CUSTOMER",
    },
  });
  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role });
  await notify({
    userId: user.id,
    kind: "SYSTEM",
    title: "Welcome to TicketFlow 🎟️",
    body: "Discover events, grab tickets and get digital QR passes — all in one place.",
    link: "/",
  });
  await audit({ actorId: user.id, action: "user.register", entity: "User", entityId: user.id });
  return ok({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
