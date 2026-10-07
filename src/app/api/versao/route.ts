/// Versão no ar (commit do deploy). Nunca em cache: "Atualizar versão"
/// compara com a versão gravada no app aberto no aparelho.
export function GET() {
  const version = (process.env.RAILWAY_GIT_COMMIT_SHA ?? "dev").slice(0, 7);
  return Response.json({ version }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
