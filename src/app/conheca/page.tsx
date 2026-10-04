import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BrandLogo, Button } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { formatCentsBRL } from "@/shared/lib/money";
import { listActivePlansForAudience } from "@/modules/billing/plans";
import exerciseImageManifest from "@/modules/exercises/data/manifesto-imagens-exercicios.json";
import styles from "./page.module.css";

/// Preço vem do catálogo real a cada visita, nunca de um número fixo.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${appName} — Treino, alunos e mensalidades sem formulário`,
  description: "Monte treinos pela biblioteca, acompanhe cada série dos alunos e controle mensalidades. 30 dias grátis.",
};

const LIBRARY_SLUGS = ["agachamento-livre-com-barra", "prancha-lateral", "puxada-alta-pegada-aberta", "rosca-direta-com-barra"];
const library = LIBRARY_SLUGS.map((slug) => exerciseImageManifest.find((entry) => entry.slug === slug)).filter((entry): entry is (typeof exerciseImageManifest)[number] => entry !== undefined);

const BENEFITS = [
  { title: "Treino montado em um minuto", text: "Escolha os exercícios na biblioteca com foto. Entram com 3 × 12 e você ajusta com + e −." },
  { title: "Cada série registrada", text: "O aluno marca série por série na academia, com descanso, voz e bipes. Você vê carga, recordes e como foi o treino." },
  { title: "Mensalidade sem planilha", text: "Gere as cobranças do mês de uma vez e marque o que recebeu com um toque." },
];

/// Conheça o FitOS (FIT-168, E7 do protótipo): promessa, três benefícios
/// numerados, biblioteca ilustrada com fotos reais, personal e aluno na
/// mesma rotina, três caminhos com preço real e CTA final. Só dados reais.
export default async function LandingPage() {
  const [personalPlans, livrePlans] = await Promise.all([listActivePlansForAudience("PERSONAL"), listActivePlansForAudience("INDIVIDUAL")]);
  const personalFrom = personalPlans.length > 0 ? Math.min(...personalPlans.map((plan) => plan.priceCents)) : null;
  const livre = livrePlans[0] ?? null;
  const trialDays = personalPlans.find((plan) => plan.trialDays)?.trialDays ?? livre?.trialDays ?? null;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <BrandLogo background="photo" size={40} />
        <Link href="/entrar" className={styles.login}>
          Entrar
        </Link>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>Para personal trainers e quem treina</p>
        <h1 className={styles.title}>Menos formulário. Mais treino.</h1>
        <p className={styles.lead}>Alunos, treinos e mensalidades num app só, pensado para a ação: cada tela termina no que você precisa fazer.</p>
        <Button href="/comecar" size="xl" block>
          {trialDays ? `Começar ${trialDays} dias grátis` : "Começar agora"}
        </Button>
      </section>

      <section className={styles.section} aria-labelledby="beneficios">
        <h2 id="beneficios" className={styles.sectionTitle}>
          O que muda no seu dia
        </h2>
        <ol className={styles.benefits}>
          {BENEFITS.map((benefit, index) => (
            <li key={benefit.title}>
              <span className={styles.number} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <strong>{benefit.title}</strong>
                <span className={styles.muted}>{benefit.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="biblioteca">
        <h2 id="biblioteca" className={styles.sectionTitle}>
          Biblioteca ilustrada
        </h2>
        <p className={styles.muted}>{exerciseImageManifest.length} exercícios com ilustração da execução, músculo e equipamento.</p>
        <ul className={styles.library}>
          {library.map((entry) => (
            <li key={entry.slug}>
              <Image src={`/media/exercises/${entry.slug}.webp`} alt={entry.altText} width={240} height={240} className={styles.libraryImage} />
              <span>{entry.nomeCanonico}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="rotina">
        <h2 id="rotina" className={styles.sectionTitle}>
          Personal e aluno na mesma rotina
        </h2>
        <div className={styles.split}>
          <div className={styles.panel}>
            <strong>Você</strong>
            <span className={styles.muted}>Monta o programa, atribui com um toque e vê no Início quem treinou, quem precisa de você e quem está com mensalidade atrasada.</span>
          </div>
          <div className={styles.panel}>
            <strong>Seu aluno</strong>
            <span className={styles.muted}>Abre o app e já vê o treino do dia. Na academia, registra cada série com uma mão e conta como foi.</span>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="caminhos">
        <h2 id="caminhos" className={styles.sectionTitle}>
          Escolha seu caminho
        </h2>
        <ul className={styles.paths}>
          <li>
            <Link href="/comecar?caminho=personal" className={styles.path}>
              <strong>Sou personal</strong>
              <span className={styles.muted}>{personalFrom !== null ? `A partir de ${formatCentsBRL(personalFrom)} por mês` : "Planos por número de alunos"}</span>
            </Link>
          </li>
          <li>
            <Link href="/comecar?caminho=convite" className={styles.path}>
              <strong>Tenho convite</strong>
              <span className={styles.muted}>Sem custo para o aluno: a mensalidade é combinada com o seu personal</span>
            </Link>
          </li>
          <li>
            <Link href="/treino-sozinho" className={styles.path}>
              <strong>Treino por conta</strong>
              <span className={styles.muted}>{livre ? `FitOS Livre por ${formatCentsBRL(livre.priceCents)} por mês` : "FitOS Livre"}</span>
            </Link>
          </li>
        </ul>
      </section>

      <section className={`${styles.section} ${styles.final}`}>
        <h2 className={styles.sectionTitle}>Pronto para começar?</h2>
        <Button href="/comecar" size="lg" block>
          {trialDays ? `Começar ${trialDays} dias grátis` : "Começar agora"}
        </Button>
      </section>

      <footer className={styles.footer}>
        <Link href="/termos-de-uso">Termos de uso</Link>
        <span aria-hidden="true">·</span>
        <Link href="/politica-de-privacidade">Privacidade</Link>
      </footer>
    </main>
  );
}
