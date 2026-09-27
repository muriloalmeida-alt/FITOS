import type { Metadata } from "next";
import { appName } from "@/shared/config/env";
import { Button } from "@/shared/ui";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: `Página não encontrada — ${appName}`,
};

/// Página 404 do segmento `app/` (convenção do Next.js — nenhuma rota
/// tinha esse limite antes da FIT-120, então uma URL inexistente caía no
/// 404 sem estilo do Next.js). Nunca reutiliza `ErrorRecovery`: um link
/// que não existe não é um erro recuperável com "tentar novamente" — é um
/// estado informativo, sem `role="alert"`.
export default function NotFound() {
  return (
    <div className={styles.wrapper}>
      <p className={styles.eyebrow}>404</p>
      <h1 className={styles.title}>Página não encontrada</h1>
      <p className={styles.description}>O endereço que você tentou acessar não existe ou foi movido.</p>
      <Button href="/" variant="filled">
        Voltar ao início
      </Button>
    </div>
  );
}
