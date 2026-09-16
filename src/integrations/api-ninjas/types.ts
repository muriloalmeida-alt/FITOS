/// Contrato externo e DTO interno da Exercises API (API Ninjas), FIT-020.
///
/// O contrato externo (`ApiNinjasExerciseRaw`) marca todo campo além de
/// `name` como opcional deliberadamente — a documentação oficial não
/// garante presença de `type`/`muscle`/`difficulty`/`instructions`/
/// `equipments`/`safety_info` em todo resultado, e tratá-los como sempre
/// preenchidos seria assumir uma garantia que o fornecedor não dá.

/// Forma de um item exatamente como a API Ninjas devolve.
export interface ApiNinjasExerciseRaw {
  name: string;
  type?: string;
  muscle?: string;
  equipments?: string;
  difficulty?: string;
  instructions?: string;
  safety_info?: string;
}

/// DTO interno do FitOS — usado pelo restante da aplicação (FIT-021 em
/// diante). Nunca reexpõe os nomes de campo brutos da API Ninjas fora deste
/// pacote; nunca traduz o conteúdo (o texto original é preservado).
export interface ExerciseDTO {
  name: string;
  type: string | null;
  muscle: string | null;
  equipments: string | null;
  difficulty: string | null;
  instructions: string | null;
  safetyInfo: string | null;
}

/// Parâmetros de busca aceitos por `GET /v1/exercises`. `offset` é recurso
/// premium (ver ADR-004) — deliberadamente não exposto aqui: esta Sprint
/// não presume acesso a paginação além do plano confirmado.
export interface SearchExercisesInput {
  name?: string;
  type?: string;
  muscle?: string;
  difficulty?: string;
  equipments?: string;
}
