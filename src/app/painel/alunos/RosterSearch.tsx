"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./page.module.css";

/// Busca por nome ou e-mail (FIT-144): vira `?q=` com pausa de 300 ms.
export function RosterSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");

  useEffect(() => {
    if ((params.get("q") ?? "") === query) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      next.delete("limite");
      router.replace(next.toString() ? `${pathname}?${next}` : pathname);
    }, 300);
    return () => clearTimeout(timer);
  }, [params, pathname, query, router]);

  return (
    <label className={styles.search}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou e-mail" aria-label="Buscar por nome ou e-mail" />
    </label>
  );
}
