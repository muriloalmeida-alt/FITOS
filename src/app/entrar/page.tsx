import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { appName } from "@/shared/config/env";
import { Button } from "@/shared/ui";
import { EntradaShell } from "../_entrada/EntradaShell";
import entrada from "../_entrada/Entrada.module.css";
import { EntrarForm } from "./EntrarForm";

export const metadata: Metadata = {
  title: `Entrar — ${appName}`,
  description: "Entre no FitOS: personal, aluno ou FitOS Livre.",
};

/// Entrar (FIT-163, E2 do protótipo): e-mail e senha com o erro junto do
/// campo, "Começar agora" e "Recebi um convite". Fundo escuro liso.
/// "Esqueci minha senha" (EPIC-24) leva ao pedido do link por e-mail.
export default function EntrarPage() {
  return (
    <EntradaShell>
      <div>
        <p className={entrada.eyebrow}>Bem-vindo de volta</p>
        <h1 className={entrada.title}>Entrar</h1>
      </div>
      <Suspense fallback={<div className={entrada.form} aria-hidden />}>
        <EntrarForm />
      </Suspense>
      <Link href="/esqueci-senha" className={entrada.forgot}>
        Esqueci minha senha
      </Link>
      <div className={entrada.divider}>ainda não tem conta?</div>
      <div className={entrada.alt}>
        <Button href="/comecar" variant="secondary" block>
          Começar agora
        </Button>
        <Button href="/comecar?caminho=convite" variant="quiet" block>
          Recebi um convite
        </Button>
      </div>
    </EntradaShell>
  );
}
