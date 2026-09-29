import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { appName } from "@/shared/config/env";
import { BrandLogo } from "@/shared/ui";
import { EntrarForm } from "./EntrarForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Entrar — ${appName}`,
  description: "Login de personal trainers e alunos no FitOS.",
};

/**
 * Tela de acesso (AjustesLogin, 29/09/2026 — FIT-139): foto em tela cheia
 * com degradê, marca no topo e formulário direto sobre a foto, sem cartão,
 * sem título/descrição acima dos campos ("Entrar" fica só no botão). No
 * desktop a foto continua em tela cheia e o formulário ocupa a região
 * escurecida à esquerda — nunca o split 50/50 com cartão isolado.
 */
export default function EntrarPage() {
  return (
    <main className={styles.main}>
      <Image
        src="/media/brand/visual-2026/scene-solo.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className={styles.photo}
      />
      <div className={styles.shade} aria-hidden />

      <div className={styles.content}>
        <Link href="/conheca" className={styles.brand} aria-label={`${appName} — conheça o ${appName}`}>
          <BrandLogo background="photo" size={56} decorative />
        </Link>

        <div className={styles.panel}>
          <h1 className={styles.srOnly}>Entrar no {appName}</h1>
          <p className={styles.headline}>
            Movimento começa
            <br />
            <span className={styles.headlineAccent}>com um plano.</span>
          </p>

          <Suspense fallback={<div className={styles.form} aria-hidden />}>
            <EntrarForm />
          </Suspense>

          <p className={styles.footer}>
            Ainda não tem conta de personal?
            <br />
            <Link href="/comecar">Criar conta</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
