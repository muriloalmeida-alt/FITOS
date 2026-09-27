"use client";

import { useEffect } from "react";
import { ErrorRecovery } from "@/shared/ui";
import styles from "./error.module.css";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/// Estado de erro do segmento `app/` (convenção do Next.js — nenhuma rota
/// tinha esse limite antes da FIT-120; um erro não tratado caía no
/// overlay genérico de desenvolvimento ou numa tela em branco em
/// produção). Nunca expõe `error.message`/stack ao usuário — só registra
/// no console para diagnóstico, mesmo padrão de "nunca um erro técnico
/// genérico exposto" já documentado em `ErrorRecovery`.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={styles.wrapper}>
      <ErrorRecovery
        description="Não foi possível carregar esta página. Tente novamente — se o problema continuar, volte em alguns minutos."
        retry={{ onClick: reset }}
      />
    </div>
  );
}
