import { Button, Card } from "@/shared/ui";
import { appEnv, appName } from "@/shared/config/env";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.main}>
      <div className={styles.content}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Fundação técnica — FIT-006</span>
          <h1 className={styles.title}>{appName}</h1>
          <p className={styles.subtitle}>
            Esta é a fundação executável do FitOS: prova que a aplicação, o tema
            Material Design 3 e a estrutura de módulos estão operacionais. Nenhuma
            funcionalidade de produto (alunos, treinos, financeiro, agenda,
            mensagens ou IA) está implementada nesta tela.
          </p>
        </header>

        <div className={styles.grid}>
          <Card title="Tema e identidade">
            <p>
              Tokens de cor, tipografia, forma e espaçamento vêm de{" "}
              <code>docs/03-design/M3-DESIGN-TOKENS.md</code>. O tema claro e
              escuro respeita a preferência do sistema.
            </p>
          </Card>

          <Card title="Estrutura modular">
            <p>
              O código está organizado em módulos de domínio (
              <code>src/modules</code>) e código compartilhado (
              <code>src/shared</code>), refletindo os limites descritos em{" "}
              <code>VISAO-ARQUITETURAL.md</code>. Nesta História os módulos são
              apenas limites estruturais, sem regra de negócio.
            </p>
          </Card>

          <Card title="Ambiente atual">
            <p>
              Ambiente lógico: <strong>{appEnv}</strong>. Verifique{" "}
              <code>/api/health</code> para o healthcheck local.
            </p>
          </Card>

          <Card title="Fora do escopo desta História">
            <ul className={styles.list}>
              <li>Banco de dados e Prisma (FIT-007).</li>
              <li>Ambientes Railway (FIT-008).</li>
              <li>Autenticação (Better Auth/Clerk) e cobrança (Asaas/Mercado Pago).</li>
              <li>Qualquer funcionalidade de Alunos, Treinos ou Financeiro.</li>
            </ul>
          </Card>
        </div>

        <div className={styles.actions}>
          <Button variant="filled" type="button" disabled>
            Ação primária (exemplo)
          </Button>
          <Button variant="outlined" type="button" disabled>
            Ação secundária (exemplo)
          </Button>
        </div>

        <p className={styles.footer}>
          SPRINT-03 — Fundação Executável · EPIC-02 — Fundação Técnica · FIT-006
        </p>
      </div>
    </main>
  );
}
