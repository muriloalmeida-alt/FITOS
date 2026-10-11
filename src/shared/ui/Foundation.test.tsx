import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionRow } from "./ActionRow";
import { ChipGroup } from "./ChipGroup";
import { NextStepCard } from "./NextStepCard";
import { ProgressBar } from "./ProgressBar";
import { SegmentedTabs } from "./SegmentedTabs";
import { Sheet } from "./Sheet";
import { SkeletonScreen } from "./Skeleton";
import { PlanLimitState, StatePanel } from "./StatePanel";
import { Stepper } from "./Stepper";
import { Switch } from "./Switch";
import { Tag } from "./Tag";
import { ToastProvider, useToast } from "./Toast";
import { WeekStrip } from "./WeekStrip";

describe("Stepper", () => {
  function Harness({ initial = 3, min = 1, max = 5, step = 1 }: { initial?: number; min?: number; max?: number; step?: number }) {
    const [value, setValue] = useState(initial);
    return <Stepper label="Séries" value={value} onChange={setValue} min={min} max={max} step={step} />;
  }

  it("aumenta e diminui pelo passo, com nome acessível nos dois botões", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Aumentar séries" }));
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent("4");
    await user.click(screen.getByRole("button", { name: "Diminuir séries" }));
    await user.click(screen.getByRole("button", { name: "Diminuir séries" }));
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("desabilita o botão no limite mínimo e máximo", () => {
    render(<Harness initial={1} />);
    expect(screen.getByRole("button", { name: "Diminuir séries" })).toBeDisabled();
    render(<Stepper label="Reps" value={5} onChange={() => {}} max={5} />);
    expect(screen.getByRole("button", { name: "Aumentar reps" })).toBeDisabled();
  });

  it("aceita passo decimal sem erro de ponto flutuante e formata o valor", async () => {
    const user = userEvent.setup();
    function Load() {
      const [value, setValue] = useState(0);
      return <Stepper label="Carga" value={value} onChange={setValue} step={2.5} format={(v) => (v === 0 ? "Livre" : `${String(v).replace(".", ",")} kg`)} />;
    }
    render(<Load />);
    expect(screen.getByText("Livre")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aumentar carga" }));
    await user.click(screen.getByRole("button", { name: "Aumentar carga" }));
    await user.click(screen.getByRole("button", { name: "Aumentar carga" }));
    expect(screen.getByText("7,5 kg")).toBeInTheDocument();
  });
});

describe("ChipGroup", () => {
  it("seleção única é um radiogroup com aria-checked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChipGroup label="Forma de pagamento" value="Pix" onChange={onChange} options={[{ value: "Pix", label: "Pix" }, { value: "Dinheiro", label: "Dinheiro" }]} />);
    expect(screen.getByRole("radiogroup", { name: "Forma de pagamento" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Pix" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("radio", { name: "Dinheiro" }));
    expect(onChange).toHaveBeenCalledWith("Dinheiro");
  });

  it("seleção múltipla alterna valores com aria-pressed", async () => {
    const user = userEvent.setup();
    function Multi() {
      const [value, setValue] = useState<string[]>(["seg"]);
      return <ChipGroup multiple label="Dias" value={value} onChange={setValue} options={[{ value: "seg", label: "Seg" }, { value: "ter", label: "Ter" }]} />;
    }
    render(<Multi />);
    await user.click(screen.getByRole("button", { name: "Ter" }));
    expect(screen.getByRole("button", { name: "Ter" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Seg" }));
    expect(screen.getByRole("button", { name: "Seg" })).toHaveAttribute("aria-pressed", "false");
  });

  it("filtro opcional pode ser desmarcado tocando de novo", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<ChipGroup label="Músculo" value="Pernas" onChange={() => {}} allowDeselect onClear={onClear} options={[{ value: "Pernas", label: "Pernas" }]} />);
    await user.click(screen.getByRole("radio", { name: "Pernas" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

describe("Sheet", () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Abrir
        </button>
        <Sheet open={open} onClose={() => setOpen(false)} title="Recebi de Pedro" description="Confirme o valor.">
          <input aria-label="Valor" />
          <button type="button">Confirmar</button>
        </Sheet>
      </>
    );
  }

  it("abre como diálogo modal nomeado, foca o primeiro campo e fecha com Esc devolvendo o foco", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Abrir" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Recebi de Pedro" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Confirme o valor.");
    expect(screen.getByRole("textbox", { name: "Valor" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("prende o Tab dentro da sheet", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.tab();
    expect(screen.getByRole("button", { name: "Confirmar" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Valor" })).toHaveFocus();
  });
});

describe("Toast", () => {
  function Trigger() {
    const toast = useToast();
    return (
      <button type="button" onClick={() => toast.show("Pagamento registrado")}>
        Salvar
      </button>
    );
  }

  it("anuncia a mensagem numa região role=status já presente", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    const region = screen.getByRole("status");
    expect(region).toBeEmptyDOMElement();
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(region).toHaveTextContent("Pagamento registrado");
  });

  it("sem provider, useToast não quebra", async () => {
    const user = userEvent.setup();
    render(<Trigger />);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.queryByText("Pagamento registrado")).not.toBeInTheDocument();
  });
});

describe("componentes de apresentação", () => {
  it("SegmentedTabs marca a aba ativa e chama onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedTabs label="Vista" value="treinos" onChange={onChange} items={[{ key: "treinos", label: "Treinos", count: 3 }, { key: "programas", label: "Programas" }]} />);
    expect(screen.getByRole("button", { name: "Treinos · 3" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Programas" }));
    expect(onChange).toHaveBeenCalledWith("programas");
  });

  it("SegmentedTabs com href vira links com aria-current", () => {
    render(<SegmentedTabs label="Vista" value="a" items={[{ key: "a", label: "A", href: "/a" }, { key: "b", label: "B", href: "/b" }]} />);
    expect(screen.getByRole("link", { name: "A" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "B" })).not.toHaveAttribute("aria-current");
  });

  it("NextStepCard é um único alvo (link ou botão)", () => {
    render(<NextStepCard eyebrow="Próximo passo" title="Montar um treino" href="/painel/treinos/novo" />);
    expect(screen.getByRole("link", { name: /Montar um treino/ })).toHaveAttribute("href", "/painel/treinos/novo");
  });

  it("ActionRow mostra a ação abaixo do texto e nunca aninha alvos quando a linha é link", () => {
    const { rerender } = render(<ActionRow title="Pedro Lima" description="Sem programa" action={{ label: "Atribuir programa", href: "/x" }} />);
    expect(screen.getByRole("link", { name: "Atribuir programa →" })).toHaveAttribute("href", "/x");
    rerender(<ActionRow title="Pedro Lima" href="/alunos/1" action={{ label: "Atribuir programa", href: "/x" }} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("Switch usa role=switch com aria-checked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Voz e bipes" checked={false} onChange={onChange} />);
    const control = screen.getByRole("switch", { name: /Voz e bipes/ });
    expect(control).toHaveAttribute("aria-checked", "false");
    await user.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("ProgressBar expõe valor limitado entre 0 e 100", () => {
    render(<ProgressBar value={140} label="Teste grátis" valueText="Faltam 0 dias" />);
    const bar = screen.getByRole("progressbar", { name: "Teste grátis" });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar).toHaveAttribute("aria-valuetext", "Faltam 0 dias");
  });

  it("WeekStrip descreve cada dia por extenso, sem depender da cor", () => {
    render(
      <WeekStrip
        days={[
          { short: "S", name: "Segunda", state: "done" },
          { short: "T", name: "Terça", state: "planned", today: true },
          { short: "Q", name: "Quarta", state: "rest" },
        ]}
      />,
    );
    expect(screen.getByLabelText("Segunda: treino feito")).toHaveTextContent("✓");
    expect(screen.getByLabelText("Terça (hoje): treino previsto")).toBeInTheDocument();
    expect(screen.getByLabelText("Quarta: descanso")).toBeInTheDocument();
  });

  it("Tag sempre tem texto", () => {
    render(<Tag tone="error">Atrasada</Tag>);
    expect(screen.getByText("Atrasada")).toBeInTheDocument();
  });

  it("SkeletonScreen anuncia o carregamento", () => {
    render(<SkeletonScreen />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando");
  });

  it("StatePanel informa e oferece saída; PlanLimitState leva a planos e alunos", () => {
    render(<StatePanel eyebrow="Sem permissão" title="Esta área não é do seu perfil." primary={{ label: "Ir para o meu início", href: "/painel" }} />);
    expect(screen.getByRole("heading", { name: "Esta área não é do seu perfil." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para o meu início" })).toHaveAttribute("href", "/painel");
    render(<PlanLimitState planName="Personal 20" maxStudents={20} />);
    expect(screen.getByText(/Personal 20 permite até 20 alunos ativos/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver planos" })).toHaveAttribute("href", "/painel/assinatura");
    expect(screen.getByRole("link", { name: "Gerenciar alunos" })).toHaveAttribute("href", "/painel/alunos");
  });
});
