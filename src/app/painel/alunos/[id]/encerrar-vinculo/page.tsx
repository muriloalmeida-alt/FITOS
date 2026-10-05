import { redirect } from "next/navigation";

/// URL antiga (FIT-106): encerrar vínculo agora é uma sheet no perfil (FIT-145).
export default async function EncerrarVinculoRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/painel/alunos/${id}?acao=encerrar`);
}
