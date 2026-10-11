import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo, Button } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { formatCentsBRL } from "@/shared/lib/money";
import { listActivePlansForAudience } from "@/modules/billing/plans";
import exerciseImageManifest from "@/modules/exercises/data/manifesto-imagens-exercicios.json";
import styles from "./page.module.css";

/// Preço e teste grátis vêm do catálogo real a cada visita.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `FitOS Livre — Treine por conta própria — ${appName}`,
  description: "Monte seus treinos pela biblioteca ilustrada, registre cada série e acompanhe sua evolução, sem personal.",
};

const CAN = [
  "Montar seus treinos pela biblioteca ilustrada, com 3 × 12 já preenchido",
  "Registrar cada série na academia, com descanso, voz e bipes",
  "Ver recordes, frequência e evolução de carga e de corpo",
  "Atalhos para a sua música durante o treino",
];

const CANNOT = [
  "Não substitui um personal: não há prescrição individualizada nem acompanhamento profissional",
  "Não é orientação médica. Na dúvida, procure um profissional de educação física",
];

/// FitOS Livre (FIT-169, E8 do protótipo): o que dá e o que não dá para
/// fazer, preço e teste grátis reais e um único CTA.
export default async function TreinoSozinhoPage() {
  const plans = await listActivePlansForAudience("INDIVIDUAL");
  const plan = plans[0] ?? null;
  const trialDays = plan?.trialDays ?? null;
  const cta = trialDays ? `Começar ${trialDays} dias grátis` : "Começar agora";

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/conheca" aria-label={`Conheça o ${appName}`}>
          <BrandLogo background="photo" size={40} />
        </Link>
        <Link href="/entrar" className={styles.login}>
          Entrar
        </Link>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>FitOS Livre</p>
        <h1 className={styles.title}>Seu treino, por conta própria.</h1>
        <p className={styles.lead}>Para quem treina sem personal e quer saber exatamente o que fez em cada série.</p>
        <Button href="/comecar?caminho=livre" size="xl" block>
          {cta}
        </Button>
      </section>

      <section className={styles.section} aria-labelledby="pode">
        <h2 id="pode" className={styles.sectionTitle}>
          O que você pode fazer
        </h2>
        <ul className={styles.checks}>
          {CAN.map((text) => (
            <li key={text}>
              <span className={styles.yes} aria-hidden="true">
                ✓
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <p className={`${styles.muted} ${styles.note}`}>{exerciseImageManifest.length} exercícios ilustrados na biblioteca.</p>
      </section>

      <section className={styles.section} aria-labelledby="nao">
        <h2 id="nao" className={styles.sectionTitle}>
          O que não é
        </h2>
        <ul className={styles.checks}>
          {CANNOT.map((text) => (
            <li key={text}>
              <span className={styles.no} aria-hidden="true">
                ✕
              </span>
              <span className={styles.muted}>{text}</span>
            </li>
          ))}
        </ul>
        <p className={`${styles.muted} ${styles.note}`}>
          Tem personal?{" "}
          <Link href="/comecar?caminho=convite" className={styles.inline}>
            Entre com o convite
          </Link>{" "}
          e treine com o programa dele, sem custo pelo app.
        </p>
      </section>

      {plan ? (
        <section className={`${styles.section} ${styles.price}`} aria-labelledby="preco">
          <h2 id="preco" className={styles.sectionTitle}>
            Quanto custa
          </h2>
          <span className={styles.priceValue}>
            {formatCentsBRL(plan.priceCents)} <span className={styles.unit}>por {plan.billingCycle === "ANUAL" ? "ano" : "mês"}</span>
          </span>
          <span className={styles.muted}>{trialDays ? `${trialDays} dias grátis para testar. Cancele quando quiser.` : "Cancele quando quiser."}</span>
          <Button href="/comecar?caminho=livre" size="lg" block>
            {cta}
          </Button>
        </section>
      ) : null}

      <footer className={styles.footer}>
        <Link href="/termos-de-uso">Termos de uso</Link>
        <span aria-hidden="true">·</span>
        <Link href="/politica-de-privacidade">Privacidade</Link>
      </footer>
    </main>
  );
}
