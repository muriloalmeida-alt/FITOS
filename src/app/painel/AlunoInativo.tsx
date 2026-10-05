import { BrandLogo } from "@/shared/ui";
import { LogoutButton } from "./LogoutButton";
import styles from "./AlunoSemVinculo.module.css";

/// Aluno inativado pelo personal (FIT-014, FIT-151): estado reversível,
/// distinto de "sem vínculo". Sem barra inferior e sem ações de treino.
export function AlunoInativo({ name, personalName }: { name: string; personalName: string }) {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return (
    <main className={styles.main}>
      <div className={styles.content}>
        <BrandLogo background="photo" size={40} />
        <div>
          <h1 className={styles.title}>Acesso pausado</h1>
          <p className={styles.text}>{personalName} pausou seu acesso. Seus treinos e avaliações continuam guardados. Fale com ele para voltar.</p>
        </div>
        <LogoutButton block />
      </div>
    </main>
  );
}
