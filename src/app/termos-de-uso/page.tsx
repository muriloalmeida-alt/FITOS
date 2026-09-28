import type { Metadata } from "next";
import Link from "next/link";
import { appName } from "@/shared/config/env";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: `Termos de Uso — ${appName}`,
  description: `Termos de uso do ${appName} — rascunho pendente de revisão jurídica final.`,
};

/// Termos de Uso (FIT-119). Substitui o texto de pendência ("em
/// preparação") usado desde a FIT-110/FIT-113 — mas o conteúdo aqui é
/// deliberadamente um rascunho, nunca apresentado como documento
/// definitivo: `docs/06-engenharia/arquitetura/SEGURANCA-E-LGPD.md` já
/// lista "termos aplicáveis" como parte do gate de produção, e nenhum
/// responsável jurídico revisou este texto ainda (mesma pendência
/// registrada em `DECISOES-PENDENTES.md`). Página pública, sem sessão.
export default function TermosDeUsoPage() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.content}>
        <Link href="/" className={styles.backLink}>
          ← Voltar ao início
        </Link>

        <h1 className={styles.title}>Termos de Uso</h1>
        <p className={styles.updatedAt}>Última atualização: rascunho, sem data de publicação.</p>

        <p className={styles.draftNotice}>
          Este documento é um rascunho de trabalho, ainda não revisado por um responsável jurídico. Ele
          descreve honestamente como o {appName} funciona hoje, mas não deve ser tratado como o Termo de Uso
          definitivo até essa revisão acontecer.
        </p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. O que é o {appName}</h2>
          <p>
            {appName} é uma aplicação para personal trainers gerenciarem seus alunos (cadastro, prescrição de
            treinos, avaliações físicas e cobranças) e para pessoas treinarem por conta própria, sem
            personal, no modo FitOS Livre.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Contas e responsabilidade pelo uso</h2>
          <ul>
            <li>Você é responsável por manter suas credenciais de acesso em sigilo.</li>
            <li>
              Um personal trainer é responsável pela precisão das prescrições e avaliações que registra para
              seus alunos.
            </li>
            <li>
              Os modelos de treino do FitOS Livre não substituem uma prescrição profissional individualizada
              — são um ponto de partida para organizar o próprio treino, nunca uma recomendação médica ou de
              educação física personalizada.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Cobrança e assinatura</h2>
          <p>
            O controle financeiro entre personal e aluno (mensalidades, pagamentos) é manual — o {appName}{" "}
            registra o que o personal informa, mas não processa pagamento entre eles. A assinatura do próprio{" "}
            {appName} (para o personal ou para o FitOS Livre) segue os planos exibidos em cada conta e, para um
            plano pago, é cobrada de verdade através do Asaas, nosso parceiro de pagamentos — o cartão é cadastrado
            aqui mesmo, dentro do {appName}, nunca em um site de terceiros.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Encerramento de conta</h2>
          <p>
            Você pode deixar de usar o {appName} a qualquer momento. Um personal pode encerrar o vínculo com
            um aluno; isso não apaga o histórico de treinos e avaliações já registrado, pelas mesmas razões
            descritas na Política de Privacidade.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Alterações destes termos</h2>
          <p>
            Como este é um rascunho, o texto pode mudar substancialmente até a revisão jurídica final e a
            publicação da primeira versão definitiva.
          </p>
        </section>

        <p>
          Veja também a{" "}
          <Link href="/politica-de-privacidade" className={styles.inlineLink}>
            Política de Privacidade
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
