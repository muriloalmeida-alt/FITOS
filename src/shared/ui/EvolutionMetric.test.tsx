import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EvolutionMetric } from "./EvolutionMetric";

describe("EvolutionMetric", () => {
  it("renderiza valor e rótulo", () => {
    render(<EvolutionMetric value="12" label="alunos ativos" />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("alunos ativos")).toBeInTheDocument();
  });

  it("sem trend: não renderiza nenhum chip de tendência", () => {
    render(<EvolutionMetric value="82%" label="frequência" />);
    expect(screen.queryByText("↑")).not.toBeInTheDocument();
  });

  it("com trend: o rótulo textual da tendência é sempre lido, nunca só a cor", () => {
    render(<EvolutionMetric value="82%" label="frequência" trend={{ label: "+12% na semana", direction: "up" }} />);
    expect(screen.getByText("+12% na semana")).toBeInTheDocument();
  });
});
