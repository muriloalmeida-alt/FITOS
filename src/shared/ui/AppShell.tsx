"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { titleFit } from "@/shared/lib/titleFit";
import Link from "next/link";
import { initialsFromName } from "@/shared/lib/initials";
import { useAccountImage, useAccountName } from "./AccountContext";
import { BrandLogo } from "./BrandLogo";
import { NavIcon, type NavIconName } from "./NavIcon";
import styles from "./AppShell.module.css";

/// Item de navegação do shell autenticado (FIT-012). `href` só existe para
/// destinos reais e implementados — qualquer destino ainda não construído
/// usa `comingSoon: true` e nunca recebe `href`, para nunca simular uma
/// funcionalidade que ainda não existe (aparece com o rótulo "Em breve",
/// desabilitado, e não navega para nenhum lugar). `icon` (FIT-131, pacote
/// visual 2026) é opcional — item sem ele renderiza só o rótulo.
///
/// `compact` (AjustesPainel/AjustesTelas, 29/09/2026): marca os destinos
/// que ocupam a barra inferior mobile de quatro posições (Personal:
/// Início/Alunos/Treinos/Perfil; Aluno: Início/Treino/Progresso/Perfil;
/// Livre: Início/Treinos/Evolução/Perfil). Os demais destinos reais nunca
/// somem: continuam no rail desktop e, no mobile, no menu de conta aberto
/// pelo avatar do cabeçalho. Quando nenhum item é marcado, vale o critério
/// anterior (3 primeiros + "Mais").
export interface AppShellNavItem {
  key: string;
  label: string;
  href?: string;
  comingSoon?: boolean;
  icon?: NavIconName;
  compact?: boolean;
  /// FIT-149: o avatar do cabeçalho vira um link para este destino (o
  /// Perfil), no lugar do menu de conta. Os destinos fora da barra ficam
  /// no próprio Perfil ("Seu negócio").
  accountLink?: boolean;
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  /// Rótulo curto em caixa alta acima do título (ex.: "ALUNOS",
  /// "PERFIL DO ALUNO", data do dia no Início) — hierarquia das prévias
  /// AjustesTelas. Opcional; sem ele, só título/subtítulo.
  eyebrow?: string;
  /// "mobile": o cabeçalho da página só aparece visualmente no mobile — no
  /// desktop fica apenas para leitores de tela (a própria página já mostra
  /// o mesmo texto em destaque, ex.: saudação no hero do Início do
  /// Personal). Default "always".
  headerMode?: "always" | "mobile";
  navItems: AppShellNavItem[];
  activeKey: string;
  trailing?: ReactNode;
  children: ReactNode;
}

/// Máximo de destinos visíveis na barra de navegação compacta (mobile),
/// contando o botão "Mais" quando ele existe (fallback sem `compact`).
const MAX_COMPACT_ITEMS = 4;

function NavLink({ item, isActive, onNavigate }: { item: AppShellNavItem; isActive: boolean; onNavigate?: () => void }) {
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
      onClick={onNavigate}
    >
      {item.icon ? <NavIcon name={item.icon} className={styles.navIcon} /> : null}
      <span className={styles.navLabel}>{item.label}</span>
    </Link>
  );
}

function splitCompact(navItems: AppShellNavItem[]) {
  if (navItems.some((item) => item.compact)) {
    return {
      visible: navItems.filter((item) => item.compact),
      collapsed: navItems.filter((item) => !item.compact),
      usesAccountMenu: true,
    };
  }
  const hasOverflow = navItems.length > MAX_COMPACT_ITEMS;
  return {
    visible: hasOverflow ? navItems.slice(0, MAX_COMPACT_ITEMS - 1) : navItems,
    collapsed: hasOverflow ? navItems.slice(MAX_COMPACT_ITEMS - 1) : [],
    usesAccountMenu: false,
  };
}

/// Menu de conta do avatar (cabeçalho). No mobile é o acesso aos destinos
/// reais que não cabem na barra de quatro posições (ex.: Exercícios,
/// Financeiro e Assinatura do Personal; Assinatura do Livre) e ao "Sair".
/// No desktop, o rail já lista todos os destinos — o menu repete só a
/// conta e o "Sair", nunca um destino fictício.
function AccountMenu({
  name,
  items,
  activeKey,
  trailing,
}: {
  name: string | null;
  items: AppShellNavItem[];
  activeKey: string;
  trailing?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const initials = name ? initialsFromName(name) : "";
  const image = useAccountImage();

  return (
    <div className={styles.account} ref={containerRef}>
      <button
        type="button"
        className={styles.avatarButton}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={name ? `Conta de ${name}` : "Conta"}
        onClick={() => setOpen((current) => !current)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- foto privada, servida por rota autenticada (EPIC-35) */}
        {image ? <img src={image} alt="" className={styles.avatarPhoto} /> : initials ? <span aria-hidden="true">{initials}</span> : <NavIcon name="perfil" className={styles.navIcon} />}
      </button>
      {open ? (
        <div id={menuId} className={styles.accountMenu}>
          {name ? <p className={styles.accountName}>{name}</p> : null}
          {items.length > 0 ? (
            <nav aria-label="Mais destinos" className={styles.accountLinks}>
              {items.map((item) => (
                <NavLink key={item.key} item={item} isActive={item.key === activeKey} onNavigate={() => setOpen(false)} />
              ))}
            </nav>
          ) : null}
          {trailing ? <div className={styles.accountTrailing}>{trailing}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ title, subtitle, eyebrow, headerMode = "always", navItems, activeKey, trailing, children }: AppShellProps) {
  const [showMore, setShowMore] = useState(false);
  const accountName = useAccountName();
  const accountImage = useAccountImage();
  const { visible, collapsed, usesAccountMenu } = splitCompact(navItems);
  const accountLinkItem = navItems.find((item) => item.accountLink) ?? null;

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <BrandLogo background="photo" size={44} className={styles.brand} />
        <div className={styles.topBarEnd}>
          {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
          {accountLinkItem?.href ? (
            <div className={styles.account}>
              <Link href={accountLinkItem.href} className={styles.avatarButton} aria-label={accountName ? `Perfil de ${accountName}` : "Perfil"} aria-current={accountLinkItem.key === activeKey ? "page" : undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element -- foto privada, servida por rota autenticada (EPIC-35) */}
                {accountImage ? <img src={accountImage} alt="" className={styles.avatarPhoto} /> : accountName ? <span aria-hidden="true">{initialsFromName(accountName)}</span> : <NavIcon name="perfil" className={styles.navIcon} />}
              </Link>
            </div>
          ) : (
            <AccountMenu name={accountName} items={usesAccountMenu ? collapsed : []} activeKey={activeKey} trailing={trailing} />
          )}
        </div>
      </header>

      <div className={styles.body}>
        <nav className={styles.sideRail} aria-label="Navegação principal">
          {navItems.map((item) => (
            <NavLink key={item.key} item={item} isActive={item.key === activeKey} />
          ))}
        </nav>

        <main className={styles.content}>
          <div className={headerMode === "mobile" ? `${styles.pageHeader} ${styles.pageHeaderMobileOnly}` : styles.pageHeader}>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
            <h1 className={`${styles.title} ${styles[`title-${titleFit(title)}`] ?? ""}`} title={titleFit(title) === "tiny" ? title : undefined}>
              {title}
            </h1>
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          {children}
        </main>
      </div>

      <nav className={styles.bottomNav} aria-label="Navegação principal">
        {visible.map((item) => (
          <NavLink key={item.key} item={item} isActive={item.key === activeKey} />
        ))}
        {!usesAccountMenu && collapsed.length > 0 ? (
          <button
            type="button"
            className={styles.moreButton}
            aria-expanded={showMore}
            onClick={() => setShowMore((current) => !current)}
          >
            <NavIcon name="mais" className={styles.navIcon} />
            <span className={styles.navLabel}>Mais</span>
          </button>
        ) : null}
        {!usesAccountMenu && showMore && collapsed.length > 0 ? (
          <div className={styles.moreMenu} role="menu">
            {collapsed.map((item) => (
              <NavLink key={item.key} item={item} isActive={item.key === activeKey} />
            ))}
          </div>
        ) : null}
      </nav>
    </div>
  );
}
