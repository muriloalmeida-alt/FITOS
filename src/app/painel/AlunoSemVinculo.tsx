import { Card } from "@/shared/ui";
import { LogoutButton } from "./LogoutButton";
import styles from "./AlunoSemVinculo.module.css";

/// Estado real, não um erro: sessão válida de um usuário ALUNO sem nenhum
/// `Student` vinculado (FIT-011). Sem um vínculo, não há nenhum destino de
/// negócio a mostrar — por isso não usa `AppShell` (que pressupõe uma
/// arquitetura de navegação de papel conhecido); é a tela de "sem
/// permissão" descrita em `docs/03-design/UX-ARCHITECTURE.md`.
export function AlunoSemVinculo() {
  return (
    <main className={styles.main}>
      <div className={styles.content}>
        <Card title="Sem vínculo ativo">
          <p>Sua conta ainda não está vinculada a um personal. Fale com seu personal para ativar o acesso.</p>
        </Card>
        <LogoutButton />
      </div>
    </main>
  );
}
