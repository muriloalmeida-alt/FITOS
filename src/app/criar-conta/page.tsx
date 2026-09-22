import type { Metadata } from "next";
import Link from "next/link";
import { appName } from "@/shared/config/env";
import { CriarContaForm } from "./CriarContaForm";
import { OnboardingEntry } from "./OnboardingEntry";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Criar conta — ${appName}`,
  description: "Cadastro de conta de personal trainer ou de workspace individual no FitOS.",
};

interface CriarContaPageProps {
  searchParams: Promise<{ modo?: string }>;
}

/// Entrada do onboarding (FIT-112, seção 6 do pacote): `/criar-conta` sem
/// `?modo=` nunca mais assume personal silenciosamente — mostra a
/// "primeira decisão" com os três caminhos explícitos (`OnboardingEntry`).
/// `?modo=individual`/`?modo=personal` (FIT-101/ADR-007) são a etapa 2,
/// alcançada só depois de uma escolha explícita ali ou de um link que já
/// vem com o caminho decidido (ex.: `/treino-sozinho`, cards da landing).
/// Qualquer outro valor de `modo` (inclusive ausente) volta para a etapa 1
/// — nunca um valor não reconhecido cai direto num formulário.
export default async function CriarContaPage({ searchParams }: CriarContaPageProps) {
  const { modo } = await searchParams;
  const step = modo === "personal" || modo === "individual" ? 2 : 1;

  if (step === 1) {
    return (
      <main className={styles.main}>
        <div className={`${styles.card} ${styles.cardWide}`}>
          <header className={styles.header}>
            <p className={styles.stepIndicator}>Passo 1 de 2</p>
            <h1 className={styles.title}>Como você quer começar?</h1>
            <p className={styles.subtitle}>Escolha o caminho certo para você — cada um leva a uma experiência diferente.</p>
          </header>

          <OnboardingEntry />

          <p className={styles.footer}>
            Já tem conta? <Link href="/entrar">Entrar</Link>
          </p>
        </div>
      </main>
    );
  }

  const mode = modo as "personal" | "individual";

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <header className={styles.header}>
          <p className={styles.stepIndicator}>Passo 2 de 2</p>
          <h1 className={styles.title}>Criar conta</h1>
          <p className={styles.subtitle}>
            {mode === "individual" ? (
              <>
                Cadastro do FitOS Livre — seu espaço para treinar sozinho, sem personal. Alunos com
                personal recebem acesso a partir de um vínculo criado por ele, não por este formulário.
              </>
            ) : (
              <>
                O cadastro público do {appName} é destinado a personal trainers. Alunos recebem
                acesso a partir de um vínculo criado pelo seu personal, não por este formulário.
              </>
            )}
          </p>
        </header>

        <CriarContaForm mode={mode} />

        <p className={styles.footer}>
          Já tem conta? <Link href="/entrar">Entrar</Link>
        </p>
      </div>
    </main>
  );
}
