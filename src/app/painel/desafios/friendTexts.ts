/// Textos de Amigos compartilhados entre o painel, o grupo e o convite.
export const MODE_LABEL = { TOTAL: "Pontos totais", EQUILIBRADO: "Equilibrado" } as const;

export const MODE_HELP = {
  TOTAL: "Soma os pontos de todos os treinos. Bom para quem tem treinos parecidos.",
  EQUILIBRADO: "Média por exercício, 3 melhores treinos da semana, 1 por dia. Justo entre programas diferentes.",
} as const;

export const FRIEND_RULES = [
  "Só contam treinos com foto, feitos durante a temporada e depois que você entrou.",
  "O grupo vê seu nome, foto do perfil e pontos. Nunca cargas, programa, dados de saúde ou a foto do treino.",
  "Você pode sair quando quiser: seus treinos param de contar e você deixa de ver o grupo.",
];

const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });

export function seasonLabel(season: { lengthDays: number; startsAt: string; endsAt: string; running: boolean } | null, nowIso: string): string {
  if (!season) return "Sem temporada";
  if (!season.running) return `Temporada encerrada em ${dayFmt.format(new Date(season.endsAt))}`;
  const left = Math.max(0, Math.ceil((new Date(season.endsAt).getTime() - new Date(nowIso).getTime()) / 86_400_000));
  return `Temporada de ${season.lengthDays} dias · ${left === 1 ? "falta 1 dia" : `faltam ${left} dias`}`;
}
