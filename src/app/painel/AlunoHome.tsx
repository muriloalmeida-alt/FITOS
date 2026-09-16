import { AppShell, Card } from "@/shared/ui";
import { LogoutButton } from "./LogoutButton";
import { ALUNO_NAV_ITEMS } from "./navigation";

interface AlunoHomeProps {
  displayName: string;
  tenantName: string;
  personalName: string;
}

/// "Hoje" real do aluno (FIT-016): nome, personal/espaço vinculado e
/// estado da conta — deriva tudo da sessão no servidor (`/painel/page.tsx`),
/// nunca de algo que o cliente poderia influenciar. Nenhum treino, carga,
/// evolução ou avaliação é simulado — apenas comunica que virão no futuro.
export function AlunoHome({ displayName, tenantName, personalName }: AlunoHomeProps) {
  return (
    <AppShell title="Hoje" subtitle={`Olá, ${displayName}`} navItems={ALUNO_NAV_ITEMS} activeKey="hoje" trailing={<LogoutButton />}>
      <Card title="Seu vínculo">
        <p>
          Personal: <strong>{personalName}</strong>
        </p>
        <p>
          Espaço: <strong>{tenantName}</strong>
        </p>
        <p>
          Estado da conta: <strong>Ativa</strong>
        </p>
      </Card>

      <Card title="Seus treinos">
        <p>Seus treinos serão disponibilizados aqui em breve.</p>
      </Card>
    </AppShell>
  );
}
