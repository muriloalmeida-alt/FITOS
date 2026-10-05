import { SegmentedTabs } from "@/shared/ui";

/// Abas da área Treinos (FIT-146/FIT-147): cada aba é uma rota. No FitOS
/// Livre (FIT-157) são Treinos, Biblioteca (os prontos do personal) e
/// Exercícios.
export function TrainingTabs({ active, area = "personal" }: { active: "treinos" | "biblioteca" | "programas" | "exercicios"; area?: "personal" | "livre" }) {
  const items =
    area === "livre"
      ? [
          { key: "treinos" as const, label: "Meus treinos", href: "/painel/meus-treinos" },
          { key: "biblioteca" as const, label: "Biblioteca", href: "/painel/meus-treinos/biblioteca" },
          { key: "exercicios" as const, label: "Exercícios", href: "/painel/exercicios" },
        ]
      : [
          { key: "treinos" as const, label: "Biblioteca", href: "/painel/treinos" },
          { key: "exercicios" as const, label: "Exercícios", href: "/painel/exercicios" },
        ];
  return <SegmentedTabs label="Área de treinos" value={active} items={items} />;
}
