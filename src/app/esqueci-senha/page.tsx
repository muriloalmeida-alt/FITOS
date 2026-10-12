import type { Metadata } from "next";
import { appName } from "@/shared/config/env";
import { EntradaShell } from "../_entrada/EntradaShell";
import entrada from "../_entrada/Entrada.module.css";
import { EsqueciSenhaForm } from "./EsqueciSenhaForm";

export const metadata: Metadata = {
  title: `Esqueci minha senha — ${appName}`,
  description: "Receba por e-mail um link para criar uma nova senha no FitOS.",
};

/// Esqueci minha senha (EPIC-24): o e-mail da conta recebe um link para
/// criar uma senha nova.
export default function EsqueciSenhaPage() {
  return (
    <EntradaShell back={{ href: "/entrar", label: "Voltar" }}>
      <div>
        <h1 className={entrada.title}>Esqueci minha senha</h1>
        <p className={entrada.lead}>Informe o e-mail da sua conta. Enviamos um link para você criar uma senha nova.</p>
      </div>
      <EsqueciSenhaForm />
    </EntradaShell>
  );
}
