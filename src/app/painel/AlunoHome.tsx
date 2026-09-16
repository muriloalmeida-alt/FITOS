import { AppShell, Card } from "@/shared/ui";
import { LogoutButton } from "./LogoutButton";
import { ALUNO_NAV_ITEMS } from "./navigation";

interface AlunoHomeProps {
  displayName: string;
  email: string;
}

export function AlunoHome({ displayName, email }: AlunoHomeProps) {
  return (
    <AppShell
      title="Hoje"
      subtitle={`Olá, ${displayName}`}
      navItems={ALUNO_NAV_ITEMS}
      activeKey="hoje"
      trailing={<LogoutButton />}
    >
      <Card title="Sua conta">
        <p>
          E-mail: <strong>{email}</strong>
        </p>
        <p>
          Papel: <strong>Aluno</strong>
        </p>
      </Card>
    </AppShell>
  );
}
