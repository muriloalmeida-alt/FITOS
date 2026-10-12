import type { Metadata } from "next";
import { Suspense } from "react";
import { appName } from "@/shared/config/env";
import { EntradaShell } from "../_entrada/EntradaShell";
import entrada from "../_entrada/Entrada.module.css";
import { RedefinirSenhaForm } from "./RedefinirSenhaForm";

export const metadata: Metadata = {
  title: `Nova senha — ${appName}`,
  description: "Crie uma nova senha para a sua conta do FitOS.",
};

/// Página do link do e-mail de "Esqueci minha senha" (EPIC-24).
export default function RedefinirSenhaPage() {
  return (
    <EntradaShell back={{ href: "/entrar", label: "Entrar" }}>
      <div>
        <h1 className={entrada.title}>Nova senha</h1>
        <p className={entrada.lead}>Escolha a senha que você vai usar para entrar no FitOS.</p>
      </div>
      <Suspense fallback={<div className={entrada.form} aria-hidden />}>
        <RedefinirSenhaForm />
      </Suspense>
    </EntradaShell>
  );
}
