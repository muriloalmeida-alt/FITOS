import { Button, PathPhotoCard } from "@/shared/ui";
import { ConviteCodeForm } from "../ConviteCodeForm";
import styles from "./page.module.css";

/// Primeira decisão do onboarding (FIT-112, seção 6 do pacote; rota
/// renomeada de `/criar-conta` para `/comecar` na FIT-125/EPIC-16): quem
/// chega em `/comecar` sem `?modo=` (ex.: o CTA "Criar conta grátis" do
/// cabeçalho, genérico) nunca cai direto no formulário de personal — vê os
/// três caminhos explícitos, mesma decisão que a landing (`/conheca`) já
/// oferece em destaque (FIT-110), aqui como a etapa 1 de um fluxo de duas
/// etapas real (URL navegável: escolher aqui é
/// `?modo=personal`/`?modo=individual`, nunca estado só de cliente). "Tenho
/// convite" nunca é a etapa 2 deste fluxo — reaproveita o mesmo
/// `ConviteCodeForm` da landing (FIT-110) e sai imediatamente para
/// `/ativar-conta`, sem passar pelo cadastro de conta nova (um aluno
/// convidado nunca cria conta por aqui).
///
/// Cartões fotográficos (pacote visual 2026, FIT-131, tela 03): mesmas
/// fotos do pacote por caminho (`scene-program` para o personal preparando
/// programa, `scene-coach` para o contexto de acompanhamento do convite,
/// `scene-solo` para o treino independente do Livre) — nunca a mesma foto
/// repetida entre os três cartões desta tela.
export function OnboardingEntry() {
  return (
    <div className={styles.entryGrid}>
      <PathPhotoCard
        step="01"
        category="PROFISSIONAL"
        title="Sou personal"
        description="Quero gerenciar alunos, treinos e meu negócio."
        image={{ src: "/media/brand/visual-2026/scene-program.png", objectPosition: "60% 30%" }}
      >
        <Button href="/comecar?modo=personal" variant="filled" className={styles.entryCta}>
          Continuar
        </Button>
      </PathPhotoCard>

      <PathPhotoCard
        step="02"
        category="CONVITE"
        title="Tenho convite do meu personal"
        description="Quero acessar meus treinos e acompanhar minha evolução."
        image={{ src: "/media/brand/visual-2026/scene-coach.png", objectPosition: "50% 35%" }}
      >
        <ConviteCodeForm />
      </PathPhotoCard>

      <PathPhotoCard
        step="03"
        category="INDEPENDENTE"
        title="FitOS Livre"
        description="Quero treinar por conta própria, sem depender de um personal."
        image={{ src: "/media/brand/visual-2026/scene-solo.png", objectPosition: "55% 35%" }}
      >
        <Button href="/treino-sozinho" variant="outlined" className={styles.entryCta}>
          Conhecer o FitOS Livre
        </Button>
      </PathPhotoCard>
    </div>
  );
}
