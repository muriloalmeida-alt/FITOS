import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorRecovery } from "./ErrorRecovery";

describe("ErrorRecovery", () => {
  it("renderiza role=alert com a descrição funcional do erro", () => {
    render(<ErrorRecovery description="Não foi possível carregar seus alunos." />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Não foi possível carregar seus alunos.")).toBeInTheDocument();
  });

  it("usa título padrão quando nenhum é informado", () => {
    render(<ErrorRecovery description="Erro." />);
    expect(screen.getByText("Algo não funcionou como esperado")).toBeInTheDocument();
  });

  it("com retry: renderiza o botão e dispara o clique", () => {
    const onClick = vi.fn();
    render(<ErrorRecovery description="Erro." retry={{ onClick }} />);
    screen.getByRole("button", { name: "Tentar novamente" }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("sem retry: não renderiza nenhum botão", () => {
    render(<ErrorRecovery description="Erro." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
