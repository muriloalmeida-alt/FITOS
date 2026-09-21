/**
 * Iniciais para avatar (docs/06-GOVERNANCA-DE-MIDIA.md do pacote de
 * redesign: "Avatar: iniciais ou avatar neutro" — nunca uma foto de banco
 * ou gerada por IA representando uma pessoa real). Primeira letra do
 * primeiro e do último nome, sempre maiúsculas; nomes de uma palavra
 * usam só a primeira letra.
 */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "";
  }
  if (parts.length === 1) {
    return parts[0]!.charAt(0).toUpperCase();
  }
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}
