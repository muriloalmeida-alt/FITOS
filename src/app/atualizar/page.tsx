import type { Metadata } from "next";
import Link from "next/link";
import { appName } from "@/shared/config/env";
import { UpdateVersion } from "../_version/UpdateVersion";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Atualizar versão — ${appName}`,
  robots: { index: false, follow: false },
};

/// Link do suporte (sem menu e sem login): força o aparelho a carregar a
/// versão no ar quando algo parece desatualizado.
export default function AtualizarPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Atualizar versão</h1>
      <p className={styles.muted}>Use se o app parecer desatualizado. Leva só um instante.</p>
      <UpdateVersion revealed />
      <Link href="/painel" className={styles.link}>
        Voltar ao app
      </Link>
    </main>
  );
}
