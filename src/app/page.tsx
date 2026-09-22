import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import exerciseImageManifest from "@/modules/exercises/data/manifesto-imagens-exercicios.json";
import { LandingHeader } from "./LandingHeader";
import { ConviteCodeForm } from "./ConviteCodeForm";
import styles from "./page.module.css";

/// Teaser da biblioteca ilustrada (FIT-111, seção 8B do pacote — deferido
/// da FIT-110 porque exigia o caminho real de imagens que só a FIT-111
/// estabelece). A quantidade exibida (`exerciseImageManifest.length`) vem
/// do próprio manifesto de importação versionado, nunca de um número
/// hardcoded: a seção nunca fica desatualizada nem "enganosa" (exigência
/// explícita do pacote) conforme novas ilustrações forem importadas em
/// histórias futuras — o texto sempre reflete a contagem real publicada.
const LIBRARY_TEASER_SLUGS = ["agachamento-livre-com-barra", "prancha-lateral", "puxada-alta-pegada-aberta", "rosca-direta-com-barra"];
const libraryTeaserItems = LIBRARY_TEASER_SLUGS.map((slug) => exerciseImageManifest.find((entry) => entry.slug === slug)).filter(
  (entry): entry is (typeof exerciseImageManifest)[number] => entry !== undefined
);

export const metadata: Metadata = {
  title: `${appName} — Gestão fitness, sem peso extra`,
  description:
    "Alunos, treinos e evolução em um só lugar. Menos planilha, mais tempo para transformar resultados.",
};

/// Landing comercial pública (FIT-110, EPIC-14). Substitui integralmente o
/// placeholder da fundação técnica (FIT-006) — aquela tela não tinha
/// nenhum guard de autenticação nem redirect, então não havia nada de
/// lógica de sessão para preservar aqui. Nunca verifica sessão: é a
/// mesma página para visitante autenticado ou não (o cabeçalho sempre
/// oferece "Entrar", nunca detecta e redireciona sozinho — decisão
/// deliberada, para a landing continuar sendo compartilhável/indexável
/// sem side effect de navegação).
///
/// Referência visual navegável do pacote
/// (`https://fitos-em-movimento.hmqsgqtv8q.chatgpt.site`) está fora do
/// alcance de rede desta sandbox (proxy de saída bloqueia o domínio) —
/// direção visual seguida a partir do texto da seção 4 do pacote e dos
/// tokens M3 "chrome" já existentes (`--fitos-color-chrome*`, mesma
/// paleta navy/lima do `AppShell` autenticado), nunca um Design System
/// paralelo.
export default function LandingPage() {
  return (
    <main className={styles.main}>
      <LandingHeader appName={appName} />

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Gestão fitness, sem peso extra</p>
          <h1 className={styles.heroTitle}>Seu trabalho. Em movimento.</h1>
          <p className={styles.heroDescription}>
            Alunos, treinos e evolução em um só lugar. Menos planilha, mais tempo para transformar
            resultados.
          </p>
          <div className={styles.heroActions}>
            <Button href="/criar-conta" variant="filled">
              Começar agora
            </Button>
            <Button href="#recursos" variant="outlined">
              Conhecer o {appName}
            </Button>
          </div>
        </div>
        <div className={styles.heroImageWrapper}>
          <Image
            src="/media/landing/fitos-landing-hero-principal.webp"
            alt="Personal trainer acompanhando de perto a execução de um exercício com halteres do seu aluno"
            width={900}
            height={1125}
            priority
            sizes="(min-width: 900px) 420px, 90vw"
            className={styles.heroImage}
          />
        </div>
      </section>

      <section id="recursos" className={styles.benefits}>
        <h2 className={styles.sectionTitle}>Tudo que o seu dia a dia de personal precisa</h2>
        <div className={styles.benefitsGrid}>
          <Card title="Alunos sob controle">
            <p>Cadastro, perfil, avaliações e histórico — tudo em um só lugar, sem planilha paralela.</p>
          </Card>
          <Card title="Treinos que evoluem">
            <p>Planos, exercícios, execução e acompanhamento, do primeiro treino à evolução ao longo do tempo.</p>
          </Card>
          <Card title="Financeiro simples">
            <p>
              Cobranças e recebimentos como controle financeiro do seu negócio — sem pagamento dentro
              do app nesta etapa.
            </p>
          </Card>
        </div>
      </section>

      <section id="comecar" className={styles.paths}>
        <h2 className={styles.sectionTitle}>Comece pelo caminho certo para você</h2>
        <div className={styles.pathsGrid}>
          <Card title="Sou Personal">
            <p>Gestão profissional de alunos, treinos e negócio.</p>
            <Button href="/criar-conta" variant="filled" className={styles.pathCta}>
              Criar conta grátis
            </Button>
          </Card>

          <Card title="Treino com Personal">
            <p>Ativação por convite e vínculo ao espaço do seu personal.</p>
            <p className={styles.pathHint}>
              Sem convite ainda? O acesso do aluno depende de um convite criado pelo seu personal —
              fale com ele para receber o seu.
            </p>
            <ConviteCodeForm />
          </Card>

          <Card title="FitOS Livre">
            <p>Escolha de produto e treino independente, sem vínculo com personal.</p>
            <Button href="/treino-sozinho" variant="outlined" className={styles.pathCta}>
              Conhecer o FitOS Livre
            </Button>
          </Card>
        </div>
      </section>

      <section id="biblioteca" className={styles.library}>
        <h2 className={styles.sectionTitle}>Biblioteca ilustrada de exercícios</h2>
        <p className={styles.libraryIntro}>
          {exerciseImageManifest.length} exercícios já ilustrados de um acervo planejado de quase 100 — biblioteca
          em expansão, disponível para Personal, Aluno vinculado e FitOS Livre.
        </p>
        <div className={styles.libraryGrid}>
          {libraryTeaserItems.map((entry) => (
            <figure key={entry.slug} className={styles.libraryItem}>
              <Image
                src={`/media/exercises/${entry.slug}.webp`}
                alt={entry.altText}
                width={200}
                height={200}
                loading="lazy"
                sizes="(min-width: 900px) 160px, 40vw"
                className={styles.libraryImage}
              />
              <figcaption className={styles.libraryCaption}>{entry.nomeCanonico}</figcaption>
            </figure>
          ))}
        </div>
        <p className={styles.libraryExample}>
          Busque por nome (ex.: &ldquo;agachamento&rdquo;) e filtre por músculo, equipamento e dificuldade — com
          ilustrações em duas fases do movimento quando aplicável.
        </p>
      </section>

      <section id="para-quem" className={styles.relationship}>
        <div className={styles.relationshipText}>
          <h2 className={styles.sectionTitle}>Personal e aluno, na mesma rotina</h2>
          <ul className={styles.relationshipList}>
            <li>Prescrição organizada, sempre visível para quem precisa dela.</li>
            <li>Evolução compartilhada — o personal acompanha, o aluno enxerga o próprio progresso.</li>
            <li>Rotina sem ruído: menos mensagem solta, mais treino de verdade.</li>
            <li>O acesso do seu aluno é sempre restrito ao seu espaço — nunca aos dados de outro personal.</li>
          </ul>
        </div>
        <div className={styles.relationshipImageWrapper}>
          <Image
            src="/media/landing/fitos-landing-hero-secundaria.webp"
            alt="Personal trainer e aluna revisando juntos o resultado de um treino no celular"
            width={900}
            height={600}
            loading="lazy"
            sizes="(min-width: 900px) 480px, 90vw"
            className={styles.relationshipImage}
          />
        </div>
      </section>

      <section className={styles.finalCta}>
        <h2 className={styles.finalCtaTitle}>Pronto para colocar sua rotina em movimento?</h2>
        <Button href="/criar-conta" variant="filled" className={styles.finalCtaButton}>
          Criar meu perfil
        </Button>
      </section>

      <footer className={styles.footer}>
        <p className={styles.footerBrand}>{appName}</p>
        <nav className={styles.footerLinks} aria-label="Links institucionais">
          <Link href="/entrar">Entrar</Link>
          <Link href="/criar-conta">Criar conta</Link>
          <Link href="/treino-sozinho">FitOS Livre</Link>
        </nav>
        <p className={styles.footerLegal}>
          Termos de uso e Política de Privacidade — em preparação. Nenhum link legal é publicado até
          existir uma página real.
        </p>
      </footer>
    </main>
  );
}
