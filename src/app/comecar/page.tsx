import type { Metadata } from "next";
import Link from "next/link";
import { appName } from "@/shared/config/env";
import { Button } from "@/shared/ui";
import { NavIcon, type NavIconName } from "@/shared/ui/NavIcon";
import { EntradaShell } from "../_entrada/EntradaShell";
import styles from "../_entrada/Entrada.module.css";
import { ConviteEntrada } from "./ConviteEntrada";
import { CriarContaForm } from "./CriarContaForm";

export const metadata: Metadata = {
  title: `Começar — ${appName}`,
  description: "Comece no FitOS como personal, com um convite ou treinando por conta própria.",
};

type Caminho = "personal" | "convite" | "livre";

const CAMINHOS: { key: Caminho; title: string; description: string; icon: NavIconName }[] = [
  { key: "personal", title: "Sou personal", description: "Alunos, treinos e mensalidades num lugar só.", icon: "alunos" },
  { key: "convite", title: "Tenho convite", description: "Meu personal me mandou um código ou link.", icon: "novo" },
  { key: "livre", title: "Treino por conta", description: "Monto meus treinos e registro tudo no FitOS Livre.", icon: "treinos" },
];

/// `?modo=` antigo (FIT-101/112, links já publicados) continua valendo.
function caminhoFrom(params: { caminho?: string; modo?: string }): Caminho | null {
  if (params.caminho === "personal" || params.caminho === "convite" || params.caminho === "livre") return params.caminho;
  if (params.modo === "personal") return "personal";
  if (params.modo === "individual") return "livre";
  return null;
}

/// Começar (FIT-164, E3 do protótipo): três caminhos em cartões; o
/// convite aceita código ou link; criar conta é uma tela só e segue para o
/// onboarding do papel escolhido.
export default async function ComecarPage({ searchParams }: { searchParams?: Promise<{ caminho?: string; modo?: string }> } = {}) {
  const caminho = caminhoFrom((await searchParams) ?? {});

  if (!caminho) {
    return (
      <EntradaShell>
        <div>
          <p className={styles.eyebrow}>Começar</p>
          <h1 className={styles.title}>Escolha seu caminho</h1>
        </div>
        <nav className={styles.cards} aria-label="Caminhos">
          {CAMINHOS.map((entry) => (
            <Link key={entry.key} href={`/comecar?caminho=${entry.key}`} className={styles.card}>
              <span className={styles.cardIcon} aria-hidden="true">
                <NavIcon name={entry.icon} />
              </span>
              <span className={styles.cardText}>
                <span className={styles.cardTitle}>{entry.title}</span>
                <span className={styles.muted}>{entry.description}</span>
              </span>
            </Link>
          ))}
        </nav>
        <p className={styles.muted}>
          Já tem conta? <Link href="/entrar" className={styles.back}>Entrar</Link>
        </p>
      </EntradaShell>
    );
  }

  if (caminho === "convite") {
    return (
      <EntradaShell back={{ href: "/comecar", label: "Voltar" }}>
        <div>
          <p className={styles.eyebrow}>Tenho convite</p>
          <h1 className={styles.title}>Cole seu convite</h1>
          <p className={styles.lead}>O código ou o link que seu personal mandou.</p>
        </div>
        <ConviteEntrada />
        <Button href="/entrar" variant="quiet" block>
          Já tenho conta
        </Button>
      </EntradaShell>
    );
  }

  return (
    <EntradaShell back={{ href: "/comecar", label: "Voltar" }}>
      <div>
        <p className={styles.eyebrow}>{caminho === "personal" ? "Sou personal" : "FitOS Livre"}</p>
        <h1 className={styles.title}>Crie sua conta</h1>
        <p className={styles.lead}>{caminho === "personal" ? "Depois você configura seu espaço e começa 30 dias grátis." : "Depois são três toques para montar seu primeiro treino. 30 dias grátis."}</p>
      </div>
      <CriarContaForm mode={caminho === "personal" ? "personal" : "individual"} />
      <p className={styles.muted}>
        Já tem conta? <Link href="/entrar" className={styles.back}>Entrar</Link>
      </p>
    </EntradaShell>
  );
}
