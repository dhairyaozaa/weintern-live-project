import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./auth";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, init);
}

export function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Wrap a route handler: maps ApiError/ZodError to clean JSON responses. */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) return fail(err.status, err.message);
      if (err instanceof ZodError) {
        const msg = err.issues[0]
          ? `${err.issues[0].path.join(".") || "input"}: ${err.issues[0].message}`
          : "Invalid input";
        return fail(400, msg);
      }
      console.error("[api]", err);
      const anyErr = err as { code?: string };
      if (anyErr?.code === "P2002") return fail(409, "Duplicate value");
      if (anyErr?.code === "P2025") return fail(404, "Not found");
      return fail(500, "Something went wrong");
    }
  };
}

export function pageParams(req: Request, def = 20) {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const take = Math.min(50, Math.max(1, Number(url.searchParams.get("take") ?? def) || def));
  return { page, take, skip: (page - 1) * take };
}
