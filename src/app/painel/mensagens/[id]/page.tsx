import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError } from "@/modules/tenancy/authContext";
import { ChatError, getThread, requireChatViewer } from "@/modules/messages/messages";
import { getQuickReplies } from "@/modules/messages/quickReplies";
import { chatCategoryLabel } from "@/shared/lib/chatCategories";
import { LogoutButton } from "../../LogoutButton";
import { ALUNO_NAV_ITEMS, PERSONAL_NAV_ITEMS } from "../../navigation";
import { Thread } from "./Thread";

export const metadata: Metadata = { title: `Conversa — ${appName}` };

/// Uma conversa (EPIC-39): as mensagens do assunto, a resposta e
/// "Resolvido". Abrir marca como lida.
export default async function ConversaPage({ params }: { params: Promise<{ id: string }> }) {
  let viewer;
  try {
    viewer = await requireChatViewer();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
  let thread;
  try {
    thread = await getThread(viewer, (await params).id);
  } catch (error) {
    if (error instanceof ChatError) notFound();
    throw error;
  }
  const personal = viewer.role === "PERSONAL";
  const quickReplies = personal ? await getQuickReplies(viewer.tenantId) : undefined;
  const other = personal ? thread.studentName : thread.personalName;

  return (
    <AppShell
      eyebrow={chatCategoryLabel(thread.category)}
      title={thread.title}
      subtitle={`Com ${other.trim().split(/\s+/)[0]}`}
      navItems={personal ? PERSONAL_NAV_ITEMS : ALUNO_NAV_ITEMS}
      activeKey="mensagens"
      trailing={<LogoutButton />}
    >
      <Thread
        topicId={thread.id}
        resolved={thread.resolved}
        backHref={personal ? `/painel/mensagens?aluno=${thread.studentId}` : "/painel/mensagens"}
        studentHref={personal ? `/painel/alunos/${thread.studentId}` : null}
        messages={thread.messages.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() }))}
        quickReplies={quickReplies}
        attachHint={!personal && thread.category === "EXERCICIO" ? `Grave a execução (até 30 s) pelo botão da câmera: ${thread.personalName.trim().split(/\s+/)[0]} assiste e corrige.` : undefined}
      />
    </AppShell>
  );
}
