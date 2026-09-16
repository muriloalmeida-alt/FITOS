import { Card } from "@/shared/ui";
import { LogoutButton } from "./LogoutButton";
import styles from "./AlunoSemVinculo.module.css";

/// Estado real, distinto de "nunca vinculado" (`AlunoSemVinculo`): o aluno
/// já teve acesso, mas o personal inativou o vínculo (FIT-014). Mensagem
/// própria — não é a mesma coisa que "nunca chegou a ter um personal", e
/// confundir os dois casos seria uma informação enganosa para o aluno.
export function AlunoInativo() {
  return (
    <main className={styles.main}>
      <div className={styles.content}>
        <Card title="Conta inativa">
          <p>Sua conta foi inativada pelo seu personal. Fale com ele para reativar o acesso.</p>
        </Card>
        <LogoutButton />
      </div>
    </main>
  );
}
