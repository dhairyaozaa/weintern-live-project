import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, handler } from "@/lib/api";
import { ApiError, createSession, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1),
});

export const POST = handler(async (req: Request) => {
  const body = schema.parse(await req.json());
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !(await verifyPassword(body.password, user.passwordHash)))
    throw new ApiError(401, "Invalid email or password");

  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role });
  await prisma.signIn.create({
    data: { userId: user.id, userAgent: req.headers.get("user-agent") ?? undefined },
  });
  return ok({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
