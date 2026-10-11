import { redirect } from "next/navigation";

/// O registro de treino realizado agora vale para aluno e Livre.
export default function RegistrarTreinoPage() {
  redirect("/painel/treinos-realizados/registrar");
}
