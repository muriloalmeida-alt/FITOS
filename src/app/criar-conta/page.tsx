import type { Metadata } from "next";
import Link from "next/link";
import { appName } from "@/shared/config/env";
import { CriarContaForm } from "./CriarContaForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Criar conta — ${appName}`,
  description: "Cadastro de conta de personal trainer ou de workspace individual no FitOS.",
};

interface CriarContaPageProps {
  searchParams: Promise<{ modo?: string }>;
}

/// `?modo=individual` (FIT-101, link vindo de `/treino-sozinho`) é a única
/// forma de chegar ao cadastro do workspace individual — o literal
/// `"individual"` é comparado aqui, no servidor, e todo o resto do fluxo
/// (`CriarContaForm`, `auth.ts`) só vê o resultado já decidido
/// (`mode: "individual" | "personal"`), nunca a query string crua. Ver
/// `ADR-007-SELECAO-DE-PAPEL-NO-CADASTRO.md`.
export default async function CriarContaPage({ searchParams }: CriarContaPageProps) {
  const { modo } = await searchParams;
  const mode = modo === "individual" ? "individual" : "personal";

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <header className={styles.header}>
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
        {mode === "personal" ? (
          <p className={styles.footer}>
            Vai treinar sozinho, sem personal? <Link href="/treino-sozinho">Conheça o FitOS Livre</Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}
