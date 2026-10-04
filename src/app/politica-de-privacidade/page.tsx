import type { Metadata } from "next";
import Link from "next/link";
import { appName } from "@/shared/config/env";
import { LegalShell } from "../_entrada/LegalShell";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: `Política de Privacidade — ${appName}`,
  description: `Política de privacidade do ${appName} — rascunho pendente de revisão jurídica final.`,
};

/// Política de Privacidade (FIT-119). Mesmo raciocínio de honestidade do
/// Termos de Uso: rascunho, nunca apresentado como definitivo. Conteúdo
/// derivado do que `SEGURANCA-E-LGPD.md`/`REGRAS-DE-NEGOCIO.md` (seção 10)
/// já documentam sobre dados tratados hoje — nenhuma promessa (ex.:
/// exportação/exclusão automatizada de dados) além do que o produto de
/// fato implementa nesta História.
export default function PoliticaDePrivacidadePage() {
  return (
    <LegalShell active="privacidade">
      <h1 className={styles.title}>Política de Privacidade</h1>
      <p className={styles.updatedAt}>Última atualização: rascunho, sem data de publicação.</p>

      <p className={styles.draftNotice}>
        Este documento é um rascunho de trabalho, ainda não revisado por um responsável jurídico. Ele
        descreve honestamente quais dados o {appName} trata hoje, mas não deve ser tratado como a Política
        de Privacidade definitiva até essa revisão acontecer.
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>1. Quais dados tratamos</h2>
        <ul>
          <li>Identidade e contato: nome, e-mail e, para o personal, celular e CREF opcional.</li>
          <li>
            Dados de treino: exercícios, prescrições, sessões executadas e resultados registrados (séries,
            carga, descanso).
          </li>
          <li>Avaliação física: peso, percentual de gordura e medidas corporais, quando registrados.</li>
          <li>
            Financeiro: cobranças e pagamentos manuais entre personal e aluno — nunca dado de cartão, esse
            controle é sempre manual, sem nenhuma integração de pagamento. Já a assinatura do próprio FitOS
            (do personal ou do FitOS Livre), quando o plano é pago, processa o cartão através do Asaas, nosso
            parceiro de pagamentos: o número completo e o código de segurança passam só em trânsito até o
            Asaas, nunca ficam guardados pelo FitOS — só os últimos 4 dígitos e a bandeira, para identificação.
          </li>
        </ul>
        <p>Fotos de evolução são opcionais e, quando existirem, exigem autorização explícita do aluno.</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>2. Para que usamos esses dados</h2>
        <p>
          Exclusivamente para operar o produto: permitir que o personal acompanhe seus alunos, que o
          praticante do FitOS Livre acompanhe sua própria evolução, e para o controle financeiro manual
          entre personal e aluno. Não vendemos nem compartilhamos esses dados com terceiros para
          publicidade. A única exceção é o Asaas, nosso parceiro de pagamentos: quando a assinatura do
          próprio FitOS é paga, os dados do cartão e do titular são compartilhados com ele exclusivamente
          para processar essa cobrança, nunca para qualquer outra finalidade.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>3. Isolamento entre contas</h2>
        <p>
          Cada personal só acessa os dados dos próprios alunos; um aluno só acessa os próprios dados. Essa
          separação é aplicada tecnicamente em toda a aplicação, não apenas na interface.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>4. Retenção e encerramento de vínculo</h2>
        <p>
          Quando um personal encerra o vínculo com um aluno, o histórico de treinos, avaliações e cobranças
          já registrado é preservado — encerrar um vínculo nunca apaga nem duplica dado já existente. Uma
          política completa de retenção, anonimização e exclusão sob pedido ainda está em definição (ver
          observação abaixo).
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>5. O que ainda não está pronto</h2>
        <p>
          Fluxos formais de exportação e exclusão de dados pessoais sob pedido ainda não existem como
          funcionalidade — esta é uma lacuna conhecida e registrada internamente, não uma omissão
          silenciosa. Até existirem, qualquer pedido nesse sentido deve ser tratado manualmente pela
          equipe do {appName}.
        </p>
      </section>

      <p>
        Veja também os{" "}
        <Link href="/termos-de-uso" className={styles.inlineLink}>
          Termos de Uso
        </Link>
        .
      </p>
    </LegalShell>
  );
}
