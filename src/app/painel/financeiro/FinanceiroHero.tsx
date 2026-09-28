"use client";

import { useState } from "react";
import Image from "next/image";
import { formatCentsBRL } from "@/shared/lib/money";
import styles from "./FinanceiroHero.module.css";

interface FinanceiroHeroProps {
  /** Valor real já recebido na competência filtrada (`getFinancialSummary`), nunca um número do print. */
  recebidoCents: number;
}

/**
 * Faixa editorial do Financeiro (pacote visual 2026, FIT-133, tela 11):
 * "controle do seu negócio" + valor recebido, foto `scene-group.png`
 * ("conteúdo editorial de comunidade/financeiro" na tabela de assets do
 * pacote — nunca atribuída a um aluno específico como se fosse o cliente
 * daquele valor). Mesma filosofia de fallback de `AuthHero`/`PersonalHero`:
 * se a foto falhar, o gradiente de marca permanece como o próprio
 * conteúdo, nunca um estado de erro.
 */
export function FinanceiroHero({ recebidoCents }: FinanceiroHeroProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={styles.hero}>
      {!imageFailed ? (
        <Image
          src="/media/brand/visual-2026/scene-group.png"
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectPosition: "70% 35%" }}
          className={styles.image}
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <div className={styles.overlay} />
      <div className={styles.content}>
        <p className={styles.eyebrow}>Controle do seu negócio</p>
        <p className={styles.value}>{formatCentsBRL(recebidoCents)}</p>
        <p className={styles.caption}>recebidos dos seus alunos nesta competência</p>
      </div>
    </div>
  );
}
