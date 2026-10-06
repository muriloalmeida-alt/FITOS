import "server-only";
import { authErrorResponse } from "@/modules/tenancy/authContext";
import { ChatError } from "./messages";

export function chatErrorResponse(error: unknown): Response {
  const auth = authErrorResponse(error);
  if (auth) return auth;
  if (error instanceof ChatError) return Response.json({ error: error.kind, message: error.message }, { status: error.kind === "NAO_ENCONTRADO" ? 404 : 400 });
  throw error;
}
