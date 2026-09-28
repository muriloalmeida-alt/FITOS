import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanOptionCard, type PlanOptionCardPlan } from "./PlanOptionCard";

const PLAN: PlanOptionCardPlan = {
  id: "plan-personal-20",
  name: "Personal 20",
  description: "Até 20 alunos ativos",
  priceCents: 4990,
  billingCycle: "MENSAL",
  studentLimit: 20,
  trialDays: 30,
};

describe("PlanOptionCard (FIT-126)", () => {
  it("mostra nome, preço, limite de alunos e o disclosure do trial", () => {
    render(<PlanOptionCard plan={PLAN} groupName="plano" selected={false} onSelect={() => {}} />);

    expect(screen.getByText("Personal 20")).toBeInTheDocument();
    expect(screen.getByText("R$ 49,90 / mês")).toBeInTheDocument();
    expect(screen.getByText("Alunos ativos: até 20")).toBeInTheDocument();
    expect(screen.getByText("30 dias grátis, depois R$ 49,90/mês")).toBeInTheDocument();
  });

  it("nunca mostra a linha de alunos ativos quando showStudentLimit é false (FitOS Livre)", () => {
    render(<PlanOptionCard plan={PLAN} groupName="plano" selected={false} onSelect={() => {}} showStudentLimit={false} />);

    expect(screen.queryByText("Alunos ativos: até 20")).not.toBeInTheDocument();
  });

  it("nunca mostra disclosure de trial quando o plano não concede um", () => {
    render(<PlanOptionCard plan={{ ...PLAN, trialDays: null }} groupName="plano" selected={false} onSelect={() => {}} />);

    expect(screen.queryByText(/dias grátis/)).not.toBeInTheDocument();
  });

  it("chama onSelect ao clicar no cartão", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PlanOptionCard plan={PLAN} groupName="plano" selected={false} onSelect={onSelect} />);

    await user.click(screen.getByRole("radio"));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("marca o rádio como selecionado quando selected é true", () => {
    render(<PlanOptionCard plan={PLAN} groupName="plano" selected onSelect={() => {}} />);

    expect(screen.getByRole("radio")).toBeChecked();
  });
});
