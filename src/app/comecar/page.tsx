import type { Metadata } from "next";
import Link from "next/link";
import { appName } from "@/shared/config/env";
import { Button } from "@/shared/ui";
import { EntradaShell } from "../_entrada/EntradaShell";
import styles from "../_entrada/Entrada.module.css";
import { ConviteEntrada } from "./ConviteEntrada";
import { listActivePlansForAudience } from "@/modules/billing/plans";
import { LivreComecar } from "./LivreComecar";
import { PersonalComecar } from "./PersonalComecar";

export const metadata: Metadata = {
  title: `Começar — ${appName}`,
  description: "Comece no FitOS como personal, com um convite ou treinando por conta própria.",
};

type Caminho = "personal" | "convite" | "livre";

const CAMINHOS: { key: Caminho; kicker: string; title: string; description: string }[] = [
  { key: "personal", kicker: "Sou personal", title: "Dar treino aos meus alunos", description: "Seu primeiro aluno recebe o treino hoje." },
  { key: "convite", kicker: "Tenho personal", title: "Treinar com meu personal", description: "Abra o link que ele mandou ou cole o código." },
  { key: "livre", kicker: "FitOS Livre", title: "Treinar por conta", description: "Três toques e seu plano está pronto." },
];

/// `?modo=` antigo (FIT-101/112, links já publicados) continua valendo.
function caminhoFrom(params: { caminho?: string; modo?: string }): Caminho | null {
  if (params.caminho === "personal" || params.caminho === "convite" || params.caminho === "livre") return params.caminho;
  if (params.modo === "personal") return "personal";
  if (params.modo === "individual") return "livre";
  return null;
}

/// Começar (EPIC-33, E2): "o que você quer fazer?", com o resultado de cada
/// caminho. Personal: uma pergunta e a conta. Convite: código ou link.
/// Livre: três toques, o plano e só então a conta.
export default async function ComecarPage({ searchParams }: { searchParams?: Promise<{ caminho?: string; modo?: string }> } = {}) {
  const caminho = caminhoFrom((await searchParams) ?? {});

  if (!caminho) {
    return (
      <EntradaShell>
        <h1 className={styles.title}>O que você quer fazer?</h1>
        <nav className={styles.cards} aria-label="Caminhos">
          {CAMINHOS.map((entry) => (
            <Link key={entry.key} href={`/comecar?caminho=${entry.key}`} className={styles.action}>
              <span className={styles.actionKicker}>{entry.kicker}</span>
              <span className={styles.actionTitle}>{entry.title}</span>
              <span className={styles.muted}>{entry.description}</span>
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
          <p className={styles.eyebrow}>Tenho personal</p>
          <h1 className={styles.title}>Cole seu convite</h1>
        </div>
        <ConviteEntrada />
        <Button href="/entrar" variant="quiet" block>
          Já tenho conta
        </Button>
      </EntradaShell>
    );
  }

  if (caminho === "personal") {
    const plans = await listActivePlansForAudience("PERSONAL");
    return (
      <EntradaShell back={{ href: "/comecar", label: "Voltar" }}>
        <PersonalComecar plans={plans.map((plan) => ({ id: plan.id, name: plan.name, priceCents: plan.priceCents, studentLimit: plan.studentLimit }))} />
        <p className={styles.muted}>
          Já tem conta? <Link href="/entrar" className={styles.back}>Entrar</Link>
        </p>
      </EntradaShell>
    );
  }

  const plan = (await listActivePlansForAudience("INDIVIDUAL"))[0] ?? null;
  return (
    <EntradaShell back={{ href: "/comecar", label: "Voltar" }}>
      <LivreComecar priceCents={plan?.priceCents ?? null} trialDays={plan?.trialDays ?? null} />
      <p className={styles.muted}>
        Já tem conta? <Link href="/entrar" className={styles.back}>Entrar</Link>
      </p>
    </EntradaShell>
  );
}
