import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { appName } from "@/shared/config/env";
import { AuthHero } from "@/shared/ui";
import { EntrarForm } from "./EntrarForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Entrar — ${appName}`,
  description: "Login de personal trainers e alunos no FitOS.",
};

export default function EntrarPage() {
  return (
    <main className={styles.main}>
      <AuthHero eyebrow={appName} headline="Todo progresso começa com movimento." />

      <div className={styles.formColumn}>
        <div className={styles.card}>
          <header className={styles.header}>
            <h1 className={styles.title}>Entrar</h1>
            <p className={styles.subtitle}>Acesse sua conta de personal ou aluno do {appName}.</p>
          </header>

          <Suspense fallback={<div className={styles.form} aria-hidden />}>
            <EntrarForm />
          </Suspense>

          <p className={styles.footer}>
            Ainda não tem conta de personal? <Link href="/criar-conta">Criar conta</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
