"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import styles from "./AppShell.module.css";

/// Item de navegação do shell autenticado (FIT-012). `href` só existe para
/// destinos reais e implementados — qualquer destino ainda não construído
/// (Alunos, Treinos, Financeiro, Configurações, Treino, Progresso, Perfil
/// de aluno) usa `comingSoon: true` e nunca recebe `href`, para nunca
/// simular uma funcionalidade que ainda não existe (aparece com o rótulo
/// "Em breve", desabilitado, e não navega para nenhum lugar).
export interface AppShellNavItem {
  key: string;
  label: string;
  href?: string;
  comingSoon?: boolean;
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  navItems: AppShellNavItem[];
  activeKey: string;
  trailing?: ReactNode;
  children: ReactNode;
}

/// Máximo de destinos exibidos diretamente na barra de navegação compacta
/// (mobile) antes de agrupar o restante sob "Mais" — mesmo critério descrito
/// em `docs/03-design/UX-ARCHITECTURE.md` ("Compact: Navigation bar + Mais").
const MAX_COMPACT_ITEMS = 4;

function NavLink({ item, isActive }: { item: AppShellNavItem; isActive: boolean }) {
  if (item.comingSoon || !item.href) {
    return (
      <span className={styles.navItemDisabled} aria-disabled="true">
        <span>{item.label}</span>
        <span className={styles.comingSoonBadge}>Em breve</span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
      aria-current={isActive ? "page" : undefined}
    >
      {item.label}
    </Link>
  );
}

export function AppShell({ title, subtitle, navItems, activeKey, trailing, children }: AppShellProps) {
  const [showMore, setShowMore] = useState(false);
  const visibleInCompact = navItems.slice(0, MAX_COMPACT_ITEMS);
  const collapsedInCompact = navItems.slice(MAX_COMPACT_ITEMS);

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <div>
          <span className={styles.brand}>FitOS</span>
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
      </header>

      <div className={styles.body}>
        <nav className={styles.sideRail} aria-label="Navegação principal">
          {navItems.map((item) => (
            <NavLink key={item.key} item={item} isActive={item.key === activeKey} />
          ))}
        </nav>

        <main className={styles.content}>{children}</main>
      </div>

      <nav className={styles.bottomNav} aria-label="Navegação principal">
        {visibleInCompact.map((item) => (
          <NavLink key={item.key} item={item} isActive={item.key === activeKey} />
        ))}
        {collapsedInCompact.length > 0 ? (
          <button
            type="button"
            className={styles.moreButton}
            aria-expanded={showMore}
            onClick={() => setShowMore((current) => !current)}
          >
            Mais
          </button>
        ) : null}
        {showMore && collapsedInCompact.length > 0 ? (
          <div className={styles.moreMenu} role="menu">
            {collapsedInCompact.map((item) => (
              <NavLink key={item.key} item={item} isActive={item.key === activeKey} />
            ))}
          </div>
        ) : null}
      </nav>
    </div>
  );
}
