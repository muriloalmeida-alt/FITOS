import "server-only";
import { authErrorResponse } from "@/modules/tenancy/authContext";
import { ScheduleError } from "./schedule";

export function scheduleErrorResponse(error: unknown): Response {
  const auth = authErrorResponse(error);
  if (auth) return auth;
  if (error instanceof ScheduleError) return Response.json({ error: error.kind, message: error.message }, { status: error.kind === "NAO_ENCONTRADO" ? 404 : 400 });
  throw error;
}
