import { Tag } from "@/shared/ui";
import { PARQ_QUESTIONS, activityLabel, conditionLabel, type HealthAnswers } from "@/shared/lib/healthForm";
import styles from "./Health.module.css";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

/// Leitura da ficha de saúde para o personal (EPIC-46): os "sim" do PAR-Q
/// primeiro, depois o resto.
export function HealthSummary({ answers, parqYes, updatedAt, filledBySelf }: { answers: HealthAnswers; parqYes: number; updatedAt: Date; filledBySelf: boolean }) {
  const yes = PARQ_QUESTIONS.filter((_, index) => answers.parq[index]);
  const rows: [string, string][] = [
    ["Condições", answers.conditions.map(conditionLabel).join(", ")],
    ["Lesões ou cirurgias", answers.injuries],
    ["Remédios", answers.medications],
    ["Dores", answers.pain],
    ["Rotina", activityLabel(answers.activity) ?? ""],
    ["Observações", answers.notes],
  ];
  return (
    <div className={styles.summary}>
      <p className={styles.muted}>
        {filledBySelf ? "Respondida pelo aluno" : "Preenchida por você"} em {dateFmt.format(updatedAt)}.
      </p>
      {parqYes > 0 ? (
        <section className={styles.alert} aria-label="PAR-Q">
          <p>
            <Tag tone="error">PAR-Q</Tag> {parqYes} {parqYes === 1 ? "resposta sim" : "respostas sim"}: recomende avaliação médica antes de aumentar a intensidade.
          </p>
          <ul>
            {yes.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>
      ) : (
        <p>
          <Tag tone="ok">PAR-Q</Tag> Nenhuma resposta sim.
        </p>
      )}
      <dl className={styles.list}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
