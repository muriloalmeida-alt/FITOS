import type { Metadata } from "next";
import { AuthHero, Button, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `FitOS Livre — Seu treino. Sua evolução. — ${appName}`,
  description: "Entrada do FitOS Livre: treine sozinho, sem personal, com seu próprio espaço na aplicação.",
};

/// Tela 1 (Entrada) do onboarding "Treino sozinho" (FIT-101,
/// `04_FASE_2_2_FITOS_LIVRE.md` do pacote pós-MVP): proposta de valor e
/// escolha explícita do modo individual, antes do cadastro em si
/// (`/criar-conta?modo=individual`). Página pública, sem sessão — mesmo
/// padrão de `/entrar`/`/criar-conta`.
export default function TreinoSozinhoPage() {
  return (
    <main className={styles.main}>
      <AuthHero eyebrow="FitOS Livre" headline="Seu treino. Sua evolução." />

      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.title}>Treino sozinho, sem personal</h1>
          <p className={styles.subtitle}>
            Um espaço próprio para montar seus treinos a partir do catálogo do {appName}, registrar cada
            execução e acompanhar sua evolução — sem depender de um personal trainer.
          </p>
        </header>

        <Card title="O que você pode fazer aqui">
          <ul className={styles.list}>
            <li>Montar seus próprios treinos a partir do catálogo de exercícios.</li>
            <li>Registrar séries, carga, descanso e conclusão de cada sessão.</li>
            <li>Acompanhar histórico, frequência e evolução ao longo do tempo.</li>
          </ul>
        </Card>

        <Card title="O que isto não é">
          <p>
            Os modelos de treino aqui não substituem uma prescrição profissional personalizada — são um
            ponto de partida para você organizar o próprio treino, não uma recomendação médica ou de
            educação física individualizada.
          </p>
        </Card>

        <Button href="/criar-conta?modo=individual" variant="filled" className={styles.cta}>
          Criar meu espaço individual
        </Button>
      </div>
    </main>
  );
}
