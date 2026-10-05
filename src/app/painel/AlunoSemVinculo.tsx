"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo, Button, FormAlert, TextField } from "@/shared/ui";
import { requestJson } from "./_workout-builder/apiClient";
import { LogoutButton } from "./LogoutButton";
import styles from "./AlunoSemVinculo.module.css";

/// Aluno sem vínculo ativo (FIT-151): nunca teve personal ou o vínculo foi
/// encerrado. Duas saídas reais, sem barra inferior: entrar com o código
/// (ou link) de convite de um personal, ou treinar por conta própria no
/// FitOS Livre.
export function AlunoSemVinculo({ name, ended = false }: { name: string; ended?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<null | "code" | "solo">(null);
  const [error, setError] = useState<string | null>(null);
  const first = name.trim().split(/\s+/)[0] ?? name;

  async function run(kind: "code" | "solo", action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir.");
      setBusy(null);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.content}>
        <BrandLogo background="photo" size={40} />
        <div>
          <h1 className={styles.title}>{ended ? "Vínculo encerrado" : `Oi, ${first}.`}</h1>
          <p className={styles.text}>{ended ? `${first}, seu histórico continua guardado. Escolha como seguir.` : "Sua conta ainda não está ligada a um personal."}</p>
        </div>

        {error ? <FormAlert>{error}</FormAlert> : null}

        <section className={styles.card} aria-labelledby="tenho-codigo">
          <h2 id="tenho-codigo" className={styles.cardTitle}>
            Tenho um convite
          </h2>
          <p className={styles.text}>Cole o código ou o link que seu personal mandou.</p>
          <TextField label="Código ou link do convite" value={code} autoComplete="off" onChange={(event) => setCode(event.target.value)} />
          <Button type="button" size="lg" block disabled={busy !== null || code.trim().length === 0} onClick={() => void run("code", async () => {
            await requestJson("/api/minha-conta/convite", { method: "POST", body: JSON.stringify({ code }) });
            router.push("/painel");
            router.refresh();
          })}>
            {busy === "code" ? "Entrando…" : "Entrar com o convite"}
          </Button>
        </section>

        <section className={styles.card} aria-labelledby="sozinho">
          <h2 id="sozinho" className={styles.cardTitle}>
            Treinar por conta própria
          </h2>
          <p className={styles.text}>Monte seus treinos e registre tudo no FitOS Livre. Dá para entrar com um convite de personal depois.</p>
          <Button type="button" variant="secondary" size="lg" block disabled={busy !== null} onClick={() => void run("solo", async () => {
            const result = await requestJson<{ redirectTo: string }>("/api/minha-conta/treinar-sozinho", { method: "POST" });
            router.push(result.redirectTo);
            router.refresh();
          })}>
            {busy === "solo" ? "Preparando…" : "Treinar por conta própria"}
          </Button>
        </section>

        <LogoutButton block />
      </div>
    </main>
  );
}
