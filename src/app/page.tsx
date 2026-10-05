import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/modules/identity/session";
import { appName } from "@/shared/config/env";
import { SplashScreen } from "./SplashScreen";

export const metadata: Metadata = {
  title: appName,
};

/// `/` (FIT-125/EPIC-16) é a entrada do app (e o `start_url` do PWA): só
/// resolve sessão. FIT-141: em vez de redirecionar direto, mostra a tela
/// de abertura, que segue para o destino decidido aqui, no servidor, pela
/// sessão real — visitante não autenticado vai para `/entrar`; autenticado
/// vai para `/painel`, que já decide sozinho o dashboard certo por papel
/// (`PersonalHome`/`AlunoHome`/`IndividualHome` — nenhuma lógica de papel
/// duplicada aqui). Links diretos para `/entrar` ou `/painel` não passam
/// pela abertura, para não atrasar quem já sabe para onde vai.
///
/// FIT-162: quem já tem sessão não passa pela abertura — vai direto ao
/// Início.
export default async function RootPage() {
  const session = await getServerSession();
  if (session) {
    redirect("/painel");
  }
  return <SplashScreen destination="/entrar" />;
}
