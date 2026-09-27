import { Button } from "./Button";
import styles from "./SetLogger.module.css";

interface SetLoggerProps {
  currentSet: number;
  totalSets: number;
  reps: number | string;
  load: string;
  onComplete: () => void;
  completeLabel?: string;
  disabled?: boolean;
}

/// Registro de série durante a execução do treino (docs/03-experience/
/// UX-ARCHITECTURE.md — jornada do aluno: "registrar série... descansar com
/// temporizador"). Números grandes e legíveis a distância (execução real,
/// não em frente à tela) — `font-variant-numeric: tabular-nums` para reps/
/// carga não "pularem" de largura a cada dígito.
export function SetLogger({ currentSet, totalSets, reps, load, onComplete, completeLabel = "Série concluída", disabled }: SetLoggerProps) {
  return (
    <div className={styles.logger}>
      <div className={styles.progress}>
        <span>Sua série</span>
        <span className={styles.chip}>
          {currentSet} de {totalSets}
        </span>
      </div>
      <div className={styles.values}>
        <div className={styles.value}>
          <strong>{reps}</strong>
          <span>reps</span>
        </div>
        <div className={styles.value}>
          <strong>{load}</strong>
          <span>carga</span>
        </div>
      </div>
      <Button type="button" variant="filled" onClick={onComplete} disabled={disabled} className={styles.complete}>
        {completeLabel} ✓
      </Button>
    </div>
  );
}
