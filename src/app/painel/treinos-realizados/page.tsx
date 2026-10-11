import type { Metadata } from "next";
import { ActionRow, AppShell, Button, Tag } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { featureEnabled } from "@/shared/config/features";
import { durationLabel } from "@/shared/lib/retroactive";
import { sessionBadges } from "@/shared/lib/sessionBadges";
import { listSessionHistoryForStudent } from "@/modules/execution/history";
import { LogoutButton } from "../LogoutButton";
import { selfForPage } from "./selfPage";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Treinos realizados — ${appName}`,
};

const dateFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/// Treinos realizados (feature 2, parte 2): o histórico de quem treina,
/// com "Registrado" e a situação dos pontos; cada um abre o detalhe (foto
/// depois, editar o registro, excluir).
export default async function TreinosRealizadosPage() {
  const self = await selfForPage();
  const history = (await listSessionHistoryForStudent(self.scope)).filter((session) => session.status === "CONCLUIDA").slice(0, 50);
  return (
    <AppShell eyebrow="Treinos" title="Treinos realizados" navItems={self.navItems} activeKey="progresso" trailing={<LogoutButton />}>
      {featureEnabled("RETROATIVO") ? (
        <Button href="/painel/treinos-realizados/registrar" block>
          Registrar treino realizado
        </Button>
      ) : null}
      {history.length === 0 ? (
        <p className={styles.muted}>Nenhum treino concluído ainda.</p>
      ) : (
        <ul className={styles.list}>
          {history.map((session) => (
            <li key={session.id}>
              <ActionRow
                href={`/painel/treinos-realizados/${session.id}`}
                title={
                  <>
                    {session.workoutName}{" "}
                    {sessionBadges(session).map((badge) => (
                      <Tag key={badge.label} tone={badge.tone}>
                        {badge.label}
                      </Tag>
                    ))}
                  </>
                }
                description={[dateFmt.format(session.performedAt), session.endedAt ? durationLabel(Math.max(60, Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000))) : null].filter(Boolean).join(" · ")}
                trailing={<span aria-hidden="true">›</span>}
              />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
