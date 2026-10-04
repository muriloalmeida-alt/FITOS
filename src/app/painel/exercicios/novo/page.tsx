import { redirect } from "next/navigation";

/// URL antiga de "Cadastrar exercício" (FIT-022): agora o cadastro é uma
/// sheet sobre a biblioteca (FIT-147).
export default function NovoExercicioPage() {
  redirect("/painel/exercicios?origem=meus&novo=1");
}
