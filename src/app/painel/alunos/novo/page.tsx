import { redirect } from "next/navigation";

/// URL antiga de "Cadastrar aluno" (FIT-013): agora é a sheet de convite
/// sobre a lista de alunos (FIT-144).
export default function NovoAlunoPage() {
  redirect("/painel/alunos?novo=1");
}
