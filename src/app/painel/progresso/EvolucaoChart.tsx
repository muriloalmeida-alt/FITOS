const WIDTH = 320;
const HEIGHT = 96;
const PADDING = 8;

export interface WeightPoint {
  recordedAt: string;
  weightKg: number;
}

/// Gráfico de evolução do peso (FIT-042) — sem nenhuma biblioteca de
/// gráficos (nenhuma Sprint anterior adicionou dependência nova; um SVG
/// desenhado à mão é suficiente para uma linha simples). `role="img"` +
/// `aria-label` resumem a tendência para leitor de tela; a tabela
/// completa (`page.tsx`) é o equivalente textual detalhado exigido pela
/// História — o gráfico é um complemento visual, nunca a única fonte.
export function EvolucaoChart({ points }: { points: WeightPoint[] }) {
  if (points.length < 2) {
    return null;
  }

  const weights = points.map((p) => p.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  const coords = points.map((point, index) => {
    const x = PADDING + (index / (points.length - 1)) * (WIDTH - PADDING * 2);
    const y = PADDING + (1 - (point.weightKg - min) / range) * (HEIGHT - PADDING * 2);
    return `${x},${y}`;
  });

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const label = `Gráfico de evolução do peso: de ${first.weightKg}kg em ${new Date(first.recordedAt).toLocaleDateString("pt-BR")} para ${last.weightKg}kg em ${new Date(last.recordedAt).toLocaleDateString("pt-BR")}`;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} role="img" aria-label={label}>
      <polyline points={coords.join(" ")} fill="none" stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}
