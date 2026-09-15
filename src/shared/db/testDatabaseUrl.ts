/**
 * Deriva a URL do banco de testes a partir de DATABASE_URL, trocando apenas o
 * nome do banco (mantém host/usuário/senha do ambiente local). Nenhuma
 * credencial é escrita neste arquivo — tudo vem de variáveis de ambiente.
 */
export function testDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error("DATABASE_URL não definida. Configure .env a partir de .env.example.");
  }
  return base.replace(/\/([^/?]+)(\?.*)?$/, "/fitos_test$2");
}
