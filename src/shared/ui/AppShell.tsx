"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import { NavIcon, type NavIconName } from "./NavIcon";
import styles from "./AppShell.module.css";

/// Item de navegação do shell autenticado (FIT-012). `href` só existe para
/// destinos reais e implementados — qualquer destino ainda não construído
/// (Alunos, Treinos, Financeiro, Configurações, Treino, Progresso, Perfil
/// de aluno) usa `comingSoon: true` e nunca recebe `href`, para nunca
/// simular uma funcionalidade que ainda não existe (aparece com o rótulo
/// "Em breve", desabilitado, e não navega para nenhum lugar). `icon`
/// (FIT-131, pacote visual 2026) é opcional — item sem ele continua
/// renderizando só o rótulo, mesmo comportamento de antes desta rodada
/// (cobre fixtures de teste que não precisam de ícone).
export interface AppShellNavItem {
  key: string;
  label: string;
  href?: string;
  comingSoon?: boolean;
  icon?: NavIconName;
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  navItems: AppShellNavItem[];
  activeKey: string;
  trailing?: ReactNode;
  children: ReactNode;
}

/// Máximo de destinos visíveis na barra de navegação compacta (mobile),
/// contando o botão "Mais" quando ele existe — mesmo critério descrito em
/// `docs/03-design/UX-ARCHITECTURE.md` ("Compact: Navigation bar + Mais").
/// Sem overflow (ex.: Aluno/Livre, 4 destinos reais): os 4 aparecem,
/// nenhum "Mais". Com overflow (ex.: Personal, mais de 4 destinos): os 3
/// primeiros aparecem + "Mais" ocupa o 4º slot, nunca 4 reais + um 5º
/// botão — item corrigido nesta rodada (o cálculo anterior sempre mostrava
/// os 4 primeiros e adicionava "Mais" como destino extra, resultando em 5
/// pílulas na barra do Personal em vez de 4).
const MAX_COMPACT_ITEMS = 4;

function NavLink({ item, isActive }: { item: AppShellNavItem; isActive: boolean }) {
  if (item.comingSoon || !item.href) {
    return (
      <span className={styles.navItemDisabled} aria-disabled="true">
        {item.icon ? <NavIcon name={item.icon} className={styles.navIcon} /> : null}
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
      {item.icon ? <NavIcon name={item.icon} className={styles.navIcon} /> : null}
      <span className={styles.navLabel}>{item.label}</span>
    </Link>
  );
}

export function AppShell({ title, subtitle, navItems, activeKey, trailing, children }: AppShellProps) {
  const [showMore, setShowMore] = useState(false);
  const hasOverflow = navItems.length > MAX_COMPACT_ITEMS;
  const visibleInCompact = hasOverflow ? navItems.slice(0, MAX_COMPACT_ITEMS - 1) : navItems;
  const collapsedInCompact = hasOverflow ? navItems.slice(MAX_COMPACT_ITEMS - 1) : [];

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <div>
          <BrandLogo background="dark" size={20} className={styles.brand} />
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
