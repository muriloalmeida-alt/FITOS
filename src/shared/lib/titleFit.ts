/// Títulos de tela em uma linha no celular (390 px). Texto fixo é escrito
/// curto; para texto que vem de dados (nome do programa, do exercício), a
/// fonte desce um degrau conforme o tamanho e, no limite, corta com
/// reticências, mantendo o texto inteiro para leitores de tela.
export type TitleFit = "base" | "small" | "tiny";

export function titleFit(text: string): TitleFit {
  const length = [...text].length;
  if (length <= 20) return "base";
  if (length <= 26) return "small";
  return "tiny";
}
