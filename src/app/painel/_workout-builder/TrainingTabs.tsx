import { SegmentedTabs } from "@/shared/ui";

/// Abas da área Treinos do Personal (FIT-146/FIT-147): cada aba é uma rota.
export function TrainingTabs({ active }: { active: "treinos" | "programas" | "exercicios" }) {
  return (
    <SegmentedTabs
      label="Área de treinos"
      value={active}
      items={[
        { key: "treinos", label: "Treinos", href: "/painel/treinos" },
        { key: "programas", label: "Programas", href: "/painel/treinos/planos" },
        { key: "exercicios", label: "Exercícios", href: "/painel/exercicios" },
      ]}
    />
  );
}
