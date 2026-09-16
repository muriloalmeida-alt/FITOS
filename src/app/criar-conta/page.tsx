import type { Metadata } from "next";
import Link from "next/link";
import { appName } from "@/shared/config/env";
import { CriarContaForm } from "./CriarContaForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Criar conta — ${appName}`,
  description: "Cadastro de conta de personal trainer no FitOS.",
};

export default function CriarContaPage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>Criar conta</h1>
          <p className={styles.subtitle}>
            O cadastro público do {appName} é destinado a personal trainers. Alunos recebem
            acesso a partir de um vínculo criado pelo seu personal, não por este formulário.
          </p>
        </header>

        <CriarContaForm />

        <p className={styles.footer}>
          Já tem conta? <Link href="/entrar">Entrar</Link>
        </p>
      </div>
    </main>
  );
}
