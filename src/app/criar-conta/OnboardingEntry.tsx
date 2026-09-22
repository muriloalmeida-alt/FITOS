import { Button, Card } from "@/shared/ui";
import { ConviteCodeForm } from "../ConviteCodeForm";
import styles from "./page.module.css";

/// Primeira decisão do onboarding (FIT-112, seção 6 do pacote): quem chega
/// em `/criar-conta` sem `?modo=` (ex.: o CTA "Criar conta grátis" do
/// cabeçalho, genérico) nunca cai direto no formulário de personal — vê os
/// três caminhos explícitos, mesma decisão que a landing já oferece em
/// destaque (FIT-110), aqui como a etapa 1 de um fluxo de duas etapas
/// real (URL navegável: escolher aqui é `?modo=personal`/`?modo=individual`,
/// nunca estado só de cliente). "Tenho convite" nunca é a etapa 2 deste
/// fluxo — reaproveita o mesmo `ConviteCodeForm` da landing (FIT-110) e sai
/// imediatamente para `/ativar-conta`, sem passar pelo cadastro de conta
/// nova (um aluno convidado nunca cria conta por aqui).
export function OnboardingEntry() {
  return (
    <div className={styles.entryGrid}>
      <Card title="Sou Personal">
        <p>Quero gerenciar alunos, treinos e meu negócio.</p>
        <Button href="/criar-conta?modo=personal" variant="filled" className={styles.entryCta}>
          Continuar
        </Button>
      </Card>

      <Card title="Tenho convite do meu personal">
        <p>Quero acessar meus treinos e acompanhar minha evolução.</p>
        <ConviteCodeForm />
      </Card>

      <Card title="FitOS Livre">
        <p>Quero treinar por conta própria, sem depender de um personal.</p>
        <Button href="/treino-sozinho" variant="outlined" className={styles.entryCta}>
          Conhecer o FitOS Livre
        </Button>
      </Card>
    </div>
  );
}
