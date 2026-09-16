import { NextResponse } from "next/server";
import { prisma } from "@/shared/db/prisma";

/// Readiness check (FIT-008): confirma que o PostgreSQL está acessível antes
/// de considerar a instância pronta para receber tráfego. A resposta é
/// deliberadamente genérica em ambos os casos — nunca inclui a mensagem de
/// erro, host, credencial ou stack trace do driver, mesmo quando a conexão
/// falha.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ready" }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
