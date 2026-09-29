import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StudentCard } from "./StudentCard";

describe("StudentCard", () => {
  it("renderiza nome, descrição e status (texto, não só cor)", () => {
    render(<StudentCard name="Camila Souza" description="Treinou hoje · força" statusLabel="Ativa" statusTone="positive" />);
    expect(screen.getByText("Camila Souza")).toBeInTheDocument();
    expect(screen.getByText("Treinou hoje · força")).toBeInTheDocument();
    expect(screen.getByText("Ativa")).toBeInTheDocument();
  });

  it("mostra iniciais no lugar de foto (Avatar), nunca uma imagem de banco", () => {
    render(<StudentCard name="Lucas Pereira" statusLabel="Atenção" statusTone="warning" />);
    expect(screen.getByText("LP")).toBeInTheDocument();
  });

  it("com href: renderiza como link para o perfil do aluno", () => {
    render(<StudentCard name="Bruno Lima" statusLabel="Ativo" statusTone="positive" href="/painel/alunos/123" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/painel/alunos/123");
  });

  it("sem href: não é um elemento interativo", () => {
    render(<StudentCard name="Bruno Lima" statusLabel="Ativo" statusTone="positive" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("FIT-137: com href, mostra o rótulo visível 'Abrir perfil →' (antes não havia nenhuma affordance de texto)", () => {
    render(<StudentCard name="Bruno Lima" statusLabel="Ativo" statusTone="positive" href="/painel/alunos/123" />);
    expect(screen.getByText("Abrir perfil →")).toBeInTheDocument();
  });

  it("sem href: nunca mostra 'Abrir perfil →' (não há perfil para abrir)", () => {
    render(<StudentCard name="Bruno Lima" statusLabel="Ativo" statusTone="positive" />);
    expect(screen.queryByText("Abrir perfil →")).not.toBeInTheDocument();
  });

  it("FIT-137: com weeklyRhythm, mostra a barra real de dias treinados nesta semana", () => {
    render(
      <StudentCard
        name="Camila Souza"
        statusLabel="Ativa"
        statusTone="positive"
        weeklyRhythm={{ completedDays: 2, targetDays: 3 }}
      />
    );
    expect(screen.getByRole("progressbar", { name: "Camila Souza: 2 de 3 dias treinados nesta semana" })).toBeInTheDocument();
  });

  it("sem weeklyRhythm: não mostra nenhuma barra de progresso (sem meta real para comparar)", () => {
    render(<StudentCard name="Camila Souza" statusLabel="Ativa" statusTone="positive" />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
