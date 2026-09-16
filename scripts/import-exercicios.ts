/**
 * Comando administrativo de importação do catálogo global (FIT-021).
 *
 * Execução manual apenas — `npm run import:exercises`. NUNCA é chamado
 * pelo build, pelo seed, a cada deploy ou a cada acesso à página; não há
 * nenhum gatilho automático em nenhum lugar do código para este script.
 *
 * Protegido pela ausência de credencial: sem `API_NINJAS_API_KEY`
 * configurada, encerra imediatamente com uma mensagem explícita, sem
 * tentar nenhuma chamada de rede nem escrever no banco. Isso, na prática,
 * mantém a importação real desativada até que o Produto forneça uma chave
 * nova por canal seguro (nunca reutilizando a chave já exposta) e confirme
 * o plano/licença comercial adequado — ver ADR-004.
 *
 * Termos de busca: um pequeno conjunto de grupos musculares comuns por
 * padrão, ou informados via argumento de linha de comando (um por
 * grupo/tipo/dificuldade, separados por vírgula). Deliberadamente não tenta
 * contornar o limite de 5 resultados por chamada com paginação/loop — cada
 * termo é uma chamada, e o volume real depende do plano contratado.
 */
import { PrismaClient } from "@prisma/client";
import { importGlobalExercises } from "../src/modules/exercises/importExercises";

const DEFAULT_MUSCLE_GROUPS = [
  "biceps",
  "triceps",
  "chest",
  "back",
  "shoulders",
  "quadriceps",
  "hamstrings",
  "glutes",
  "calves",
  "abdominals",
];

async function main() {
  if (!process.env.API_NINJAS_API_KEY) {
    console.log(
      "[import-exercicios] API_NINJAS_API_KEY não está configurada — importação real permanece indisponível. " +
        "Nenhuma chamada de rede ou escrita no banco foi feita. Configure a variável (chave nova, obtida por " +
        "canal seguro, nunca a chave já exposta) e confirme o plano/licença comercial antes de repetir."
    );
    return;
  }

  const argMuscles = process.argv[2]?.split(",").map((m) => m.trim()).filter(Boolean);
  const muscleGroups = argMuscles && argMuscles.length > 0 ? argMuscles : DEFAULT_MUSCLE_GROUPS;

  const prisma = new PrismaClient();
  try {
    const result = await importGlobalExercises(
      muscleGroups.map((muscle) => ({ muscle })),
      prisma
    );
    console.log("[import-exercicios] resultado:", JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[import-exercicios] falha não tratada:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
