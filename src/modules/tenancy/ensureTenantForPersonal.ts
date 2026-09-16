import "server-only";
import { Prisma, PrismaClient, type Tenant } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

interface PersonalUser {
  id: string;
  name: string;
  role: string;
}

/// Regra de nomenclatura do tenant no MVP (FIT-010): "Espaço de {primeiro
/// nome}". Simples e sem fricção adicional no cadastro; editável pelo
/// personal em uma História futura (não implementado agora).
function tenantNameFor(personalName: string): string {
  const firstName = personalName.trim().split(/\s+/)[0];
  return `Espaço de ${firstName || "Personal"}`;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/// Garante que `user` (obrigatoriamente PERSONAL) possua exatamente um
/// tenant, criando-o se necessário. Idempotente e seguro sob concorrência:
/// - se o tenant já existe, retorna o mesmo registro (nenhuma duplicidade);
/// - se duas chamadas concorrentes tentarem criar ao mesmo tempo, a
///   constraint física `tenants.ownerId @unique` (FIT-007) rejeita a
///   segunda tentativa; essa chamada perdedora apenas busca e retorna o
///   tenant que a vencedora criou — nunca lança erro para quem só queria
///   garantir que o tenant existe.
///
/// `ownerId` do tenant é sempre `user.id` — nunca um valor externo. Não
/// existe parâmetro para o chamador informar um `ownerId`/`tenantId`
/// diferente: a única forma de influenciar o resultado é controlando qual
/// `user` (sempre derivado da sessão autenticada, nunca do payload do
/// cliente) é passado para esta função.
///
/// Este arquivo não importa nada de `modules/identity` deliberadamente —
/// é chamado diretamente pelo hook de cadastro em `identity/auth.ts`, e um
/// import de volta para `identity` criaria um ciclo de módulos. Quem
/// precisar da sessão para chamar esta função deve importar
/// `provisionTenantForCurrentSession` (`provisionTenant.ts`), não este
/// arquivo.
///
/// `client` é injetável (padrão: o singleton compartilhado da aplicação)
/// exclusivamente para permitir testes de integração contra o banco de
/// testes (`fitos_test`) sem duplicar esta lógica — em produção, nenhum
/// chamador deve passar esse parâmetro.
export async function ensureTenantForPersonal(user: PersonalUser, client: PrismaClient = prisma): Promise<Tenant> {
  if (user.role !== "PERSONAL") {
    throw new Error("Apenas usuários com papel PERSONAL podem ter um tenant provisionado automaticamente.");
  }

  const existing = await client.tenant.findUnique({ where: { ownerId: user.id } });
  if (existing) {
    return existing;
  }

  try {
    return await client.tenant.create({
      data: { ownerId: user.id, name: tenantNameFor(user.name) },
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return client.tenant.findUniqueOrThrow({ where: { ownerId: user.id } });
    }
    throw error;
  }
}
