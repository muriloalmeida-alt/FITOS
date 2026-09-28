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
      <AuthHero
        headline="Movimento começa"
        headlineAccent="com um plano."
        image={{ src: "/media/brand/visual-2026/scene-solo.png", objectPosition: "62% 30%" }}
        showOnMobile
      />

      <div className={styles.formColumn}>
        <div className={styles.card}>
          <header className={styles.header}>
            <h1 className={styles.title}>Entrar</h1>
            <p className={styles.subtitle}>Acesse sua conta de personal ou aluno do {appName}.</p>
          </header>

          <Suspense fallback={<div className={styles.form} aria-hidden />}>
            <EntrarForm />
          </Suspense>
        </div>

        <p className={styles.footer}>
          Ainda não tem conta de personal? <Link href="/comecar">Criar conta</Link>
        </p>
      </div>
    </main>
  );
}
