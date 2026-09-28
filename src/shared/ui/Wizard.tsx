"use client";

import { useEffect } from "react";
import styles from "./Wizard.module.css";

interface WizardProgressProps {
  step: number;
  totalSteps: number;
}

/// Indicador de progresso genérico dos onboardings guiados (FIT-126,
/// extraído do que antes era só um parágrafo de texto duplicado em cada
/// wizard ad-hoc) — texto "Passo X de Y" (mantido, é o que os testes de
/// cada wizard já verificam) mais uma barra visual real, nunca só texto:
/// requisito explícito do pacote de nunca aceitar um formulário genérico
/// sem projeto visual de progresso.
export function WizardProgress({ step, totalSteps }: WizardProgressProps) {
  const percent = Math.round((step / totalSteps) * 100);
  return (
    <div className={styles.progress}>
      <p className={styles.progressLabel}>
        Passo {step} de {totalSteps}
      </p>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-valuenow={step}
      >
        <div className={styles.progressFill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/// Confirmação nativa do navegador ao fechar a aba/navegar para fora do
/// site com dados preenchidos e a submissão ainda não concluída — requisito
/// comum (seção 6 do pacote) que antes era um `useEffect` idêntico
/// duplicado em cada wizard (`PersonalOnboardingWizard`, e agora também o
/// onboarding do FitOS Livre); extraído aqui para os três perfis
/// reaproveitarem a mesma implementação.
export function useUnsavedChangesGuard(hasUnsavedData: boolean, isSubmitting: boolean): void {
  useEffect(() => {
    if (!hasUnsavedData || isSubmitting) {
      return;
    }
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedData, isSubmitting]);
}
