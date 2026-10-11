/// Imagem do resultado gerada no aparelho (FIT-153): nada vai para o
/// servidor. Usa o compartilhamento nativo quando o aparelho aceita
/// arquivos; senão, baixa o PNG.
export async function shareWorkoutImage(data: { workoutName: string; minutes: number; sets: number; volumeKg: number; records: number }): Promise<"shared" | "downloaded" | "failed"> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "failed";
    ctx.fillStyle = "#07090d";
    ctx.fillRect(0, 0, 1080, 1080);
    ctx.fillStyle = "#ff7847";
    ctx.fillRect(80, 80, 120, 12);
    ctx.font = "800 44px Manrope, system-ui, sans-serif";
    ctx.fillText("FitOS", 80, 170);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 84px Manrope, system-ui, sans-serif";
    wrap(ctx, data.workoutName, 80, 330, 920, 96);
    const stats = [
      [`${data.minutes} min`, "tempo ativo"],
      [String(data.sets), "séries"],
      [`${String(Math.round(data.volumeKg)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} kg`, "no total"],
    ];
    stats.forEach(([value, label], index) => {
      const x = 80 + index * 320;
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 64px Manrope, system-ui, sans-serif";
      ctx.fillText(value!, x, 720);
      ctx.fillStyle = "#9aa6b3";
      ctx.font = "600 34px Manrope, system-ui, sans-serif";
      ctx.fillText(label!, x, 772);
    });
    if (data.records > 0) {
      ctx.fillStyle = "#ffad8f";
      ctx.font = "800 40px Manrope, system-ui, sans-serif";
      ctx.fillText(`★ ${data.records} ${data.records === 1 ? "novo recorde" : "novos recordes"}`, 80, 900);
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return "failed";
    const file = new File([blob], "treino-fitos.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: "Treino concluído no FitOS" });
      return "shared";
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "treino-fitos.png";
    link.click();
    URL.revokeObjectURL(url);
    return "downloaded";
  } catch {
    return "failed";
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/);
  let line = "";
  let currentY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
}

/// Imagem do relatório do mês (EPIC-45), gerada no aparelho.
export async function shareReportImage(data: { label: string; name: string; sessions: number; days: number; minutes: number; volumeKg: number; records: number }): Promise<"shared" | "downloaded" | "failed"> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "failed";
    ctx.fillStyle = "#07090d";
    ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = "#ff7847";
    ctx.fillRect(80, 80, 120, 12);
    ctx.font = "800 44px Manrope, system-ui, sans-serif";
    ctx.fillText("FitOS", 80, 170);
    ctx.fillStyle = "#9aa6b3";
    ctx.font = "700 40px Manrope, system-ui, sans-serif";
    ctx.fillText(data.name, 80, 300);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 96px Manrope, system-ui, sans-serif";
    wrap(ctx, data.label, 80, 410, 920, 106);
    const stats = [
      [String(data.sessions), data.sessions === 1 ? "treino" : "treinos"],
      [String(data.days), data.days === 1 ? "dia" : "dias"],
      [`${Math.round(data.minutes / 60)} h`, "treinando"],
      [`${String(data.volumeKg).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} kg`, "levantados"],
    ];
    stats.forEach(([value, label], index) => {
      const x = 80 + (index % 2) * 480;
      const y = 700 + Math.floor(index / 2) * 220;
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 88px Manrope, system-ui, sans-serif";
      ctx.fillText(value!, x, y);
      ctx.fillStyle = "#9aa6b3";
      ctx.font = "600 38px Manrope, system-ui, sans-serif";
      ctx.fillText(label!, x, y + 56);
    });
    if (data.records > 0) {
      ctx.fillStyle = "#ffad8f";
      ctx.font = "800 44px Manrope, system-ui, sans-serif";
      ctx.fillText(`★ ${data.records} ${data.records === 1 ? "recorde novo" : "recordes novos"}`, 80, 1200);
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return "failed";
    const file = new File([blob], "relatorio-fitos.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: `Meu mês no FitOS · ${data.label}` });
      return "shared";
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "relatorio-fitos.png";
    link.click();
    URL.revokeObjectURL(url);
    return "downloaded";
  } catch {
    return "failed";
  }
}
