import { redirect } from "next/navigation";

/// URL antiga (FIT-014): inativar agora é uma sheet no perfil (FIT-145).
export default async function InativarRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/painel/alunos/${id}?acao=inativar`);
}
