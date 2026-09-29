"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./PersonalHero.module.css";

interface PersonalHeroProps {
  greeting: string;
  activeStudentsCount: number;
  activeWorkoutsCount: number;
}

/**
 * Faixa editorial do Início do Personal (Lote B, FIT-082; foto atualizada
 * na FIT-133/pacote visual 2026 para `scene-program.png` — "Personal
 * preparando programa no tablet", exatamente o uso que a tabela de assets
 * do pacote define para o dashboard do Personal). Mesma filosofia de
 * fallback do `AuthHero`: se a imagem de marca falhar, o gradiente
 * `--fitos-color-chrome*` permanece como o próprio conteúdo, nunca um
 * estado de erro.
 *
 * FIT-137 (correção pós-validação real, pacote visual 2026 — tela-06): o
 * saudação era um texto genérico fixo ("Sua equipe está em movimento.") e
 * as métricas reais (alunos ativos, treinos ativos) ficavam só num card
 * separado abaixo — a tela-06 mostra as duas coisas sobrepostas na própria
 * foto. `greeting` vem do servidor (hora real do request, `page.tsx`) para
 * nunca divergir entre o HTML gerado no servidor e o hidratado no
 * navegador. As duas métricas aqui **duplicam** o que já aparece em "Visão
 * geral" abaixo (mesmo padrão já aceito em `FinanceiroHero`/FIT-133, que
 * duplica "Recebido") — nunca um terceiro número (a "76% treinos
 * concluídos" do print é explicitamente fictícia, sem fonte confiável de
 * "% concluído" agregado; não reproduzida).
 */
export function PersonalHero({ greeting, activeStudentsCount, activeWorkoutsCount }: PersonalHeroProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={styles.hero}>
      {!imageFailed ? (
        <Image
          src="/media/brand/visual-2026/scene-program.png"
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectPosition: "62% 30%" }}
          className={styles.image}
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <div className={styles.overlay} />
      <div className={styles.content}>
        <p className={styles.headline}>{greeting}</p>
        <p className={styles.subheadline}>Seu trabalho está em movimento.</p>
      </div>
      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span className={styles.tileValue}>{activeStudentsCount}</span>
          <span className={styles.tileLabel}>{activeStudentsCount === 1 ? "aluno ativo" : "alunos ativos"}</span>
        </div>
        <div className={`${styles.tile} ${styles.tileWarm}`}>
          <span className={styles.tileValue}>{activeWorkoutsCount}</span>
          <span className={styles.tileLabel}>{activeWorkoutsCount === 1 ? "treino ativo" : "treinos ativos"}</span>
        </div>
      </div>
    </div>
  );
}
