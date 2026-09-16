import { AppShell, Card } from "@/shared/ui";
import { LogoutButton } from "./LogoutButton";
import { PERSONAL_NAV_ITEMS } from "./navigation";

interface PersonalHomeProps {
  name: string;
  email: string;
  tenantName: string | null;
}

export function PersonalHome({ name, email, tenantName }: PersonalHomeProps) {
  return (
    <AppShell
      title="Início"
      subtitle={`Olá, ${name}`}
      navItems={PERSONAL_NAV_ITEMS}
      activeKey="inicio"
      trailing={<LogoutButton />}
    >
      <Card title="Sua sessão">
        <p>
          E-mail: <strong>{email}</strong>
        </p>
        <p>
          Papel: <strong>Personal</strong>
        </p>
      </Card>

      {tenantName ? (
        <Card title="Seu espaço">
          <p>
            Nome: <strong>{tenantName}</strong>
          </p>
        </Card>
      ) : null}
    </AppShell>
  );
}
