import Link from "next/link";
import styles from "./TreinosSubNav.module.css";

/// Sub-navegação entre "Modelos" e "Programas" (planos semanais) dentro
/// da seção Treinos — mesma estrutura de `docs/03-design/UX-ARCHITECTURE.md`
/// ("3. Treinos → Programas / Modelos").
export function TreinosSubNav({ active }: { active: "modelos" | "planos" }) {
  return (
    <nav className={styles.subNav} aria-label="Alternar entre modelos e programas">
      <Link href="/painel/treinos" className={active === "modelos" ? styles.linkActive : styles.link}>
        Modelos
      </Link>
      <Link href="/painel/treinos/planos" className={active === "planos" ? styles.linkActive : styles.link}>
        Programas
      </Link>
    </nav>
  );
}
