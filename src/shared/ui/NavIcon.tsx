/// Ícones de navegação (FIT-131, pacote visual 2026) — SVG code-native
/// (nunca bitmap, mesma filosofia de `PulseLine`), traço 2px com
/// `currentColor`: a cor segue o `color` CSS do elemento pai (`.navItem`/
/// `.navItemActive`), nunca fixa aqui. Seis conceitos vêm do pacote
/// aprovado (`inicio`, `alunos`, `treinos`, `evolucao`, `perfil`, `mais`);
/// `exercicios`/`financeiro`/`assinatura`/`config` foram desenhados nesta
/// implementação, no mesmo sistema visual de traço (o pacote não trouxe
/// ícone dedicado para esses quatro destinos, mas instruiu explicitamente
/// a produzir um no mesmo estilo em vez de usar emoji ou reaproveitar
/// "Mais"). Sempre decorativo (`aria-hidden`) — o rótulo textual ao lado
/// já nomeia o destino.
export type NavIconName =
  | "inicio"
  | "alunos"
  | "treinos"
  | "evolucao"
  | "perfil"
  | "mais"
  | "exercicios"
  | "financeiro"
  | "assinatura"
  | "config";

interface NavIconProps {
  name: NavIconName;
  className?: string;
}

function NavIconGlyph({ name }: { name: NavIconName }) {
  switch (name) {
    case "inicio":
      return (
        <>
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v11h14V10" />
          <path d="M10 21v-7h4v7" />
        </>
      );
    case "alunos":
      return (
        <>
          <circle cx="12" cy="7" r="3" />
          <circle cx="4" cy="10" r="2" />
          <circle cx="20" cy="10" r="2" />
          <path d="M5.5 21c.2-5 2.4-7 6.5-7s6.3 2 6.5 7" />
          <path d="M1 20c.1-3.3 1.3-5 3.5-5.3M23 20c-.1-3.3-1.3-5-3.5-5.3" />
        </>
      );
    case "treinos":
      return (
        <>
          <path d="M7 13 17 11" />
          <rect x="4" y="8" width="3" height="10" rx="1" />
          <rect x="1" y="10" width="3" height="6" rx="1" />
          <rect x="17" y="6" width="3" height="10" rx="1" />
          <rect x="20" y="8" width="3" height="6" rx="1" />
        </>
      );
    case "evolucao":
      return (
        <>
          <path d="M3 3v18h18" />
          <path d="m6 15 5-5 4 2 5-7" />
          <circle cx="20" cy="5" r="1" fill="currentColor" stroke="none" />
        </>
      );
    case "perfil":
      return (
        <>
          <circle cx="12" cy="7" r="4" />
          <path d="M3 21c.8-5 3.8-7 9-7s8.2 2 9 7" />
        </>
      );
    case "mais":
      return (
        <>
          <circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="20" cy="12" r="1.3" fill="currentColor" stroke="none" />
        </>
      );
    case "exercicios":
      return (
        <>
          <path d="M12 6c-1.8-1.3-4-2-6-2v14c2 0 4.2.7 6 2 1.8-1.3 4-2 6-2V4c-2 0-4.2.7-6 2Z" />
          <path d="M12 6v14" />
        </>
      );
    case "financeiro":
      return (
        <>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M7 7V5.5A1.5 1.5 0 0 1 8.5 4H19a2 2 0 0 1 2 2v1" />
          <circle cx="16" cy="13.5" r="1.3" fill="currentColor" stroke="none" />
        </>
      );
    case "assinatura":
      return (
        <>
          <rect x="2" y="5" width="20" height="14" rx="3" />
          <path d="M2 10h20" />
          <path d="M6 15h4" />
        </>
      );
    case "config":
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
        </>
      );
  }
}

export function NavIcon({ name, className }: NavIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <NavIconGlyph name={name} />
    </svg>
  );
}
