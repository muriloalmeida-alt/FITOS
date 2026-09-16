import type { Metadata } from "next";
import { appName } from "@/shared/config/env";
import { checkActivationToken } from "@/modules/identity/activation";
import { AtivarContaForm } from "./AtivarContaForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Ativar conta — ${appName}`,
  description: "Ativação de conta de aluno do FitOS a partir de um convite.",
};

interface AtivarContaPageProps {
  searchParams: Promise<{ token?: string }>;
}

/// Página pública (sem sessão) de ativação da conta do aluno (FIT-015).
/// A validação aqui é só para decidir o que renderizar — nunca confiada
/// como autorização real (a validação de verdade, atômica, acontece no
/// servidor ao submeter a senha: `activateStudentAccount`). Para token
/// inválido/expirado/usado, nunca mostra nenhum dado do aluno — apenas a
/// mensagem genérica.
export default async function AtivarContaPage({ searchParams }: AtivarContaPageProps) {
  const { token } = await searchParams;
  const check = token ? await checkActivationToken(token) : { valid: false as const };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>Ativar conta</h1>
        </header>

        {check.valid ? (
          <>
            <p className={styles.subtitle}>
              Olá, {check.studentName}. Defina sua senha para ativar seu acesso ao {appName}.
            </p>
            <AtivarContaForm token={token as string} />
          </>
        ) : (
          <p className={styles.subtitle}>
            Este link não é válido ou já expirou. Fale com seu personal para receber um novo convite.
          </p>
        )}
      </div>
    </main>
  );
}
