import "server-only";
import { authErrorResponse } from "@/modules/tenancy/authContext";
import { HealthFormError } from "./healthForm";

export function healthFormErrorResponse(error: unknown): Response {
  const auth = authErrorResponse(error);
  if (auth) return auth;
  if (error instanceof HealthFormError) return Response.json({ error: error.kind, message: error.message }, { status: error.kind === "NAO_ENCONTRADO" ? 404 : 400 });
  throw error;
}
