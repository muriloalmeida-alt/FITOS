import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AttentionItem } from "./AttentionItem";

describe("AttentionItem", () => {
  it("renderiza título e descrição, ícone oculto do leitor de tela", () => {
    render(<AttentionItem icon="★" title="Você está mais forte" description="+5 kg no agachamento em 30 dias" />);
    expect(screen.getByText("Você está mais forte")).toBeInTheDocument();
    expect(screen.getByText("+5 kg no agachamento em 30 dias")).toBeInTheDocument();
    expect(screen.getByText("★")).toHaveAttribute("aria-hidden", "true");
  });

  it("sem href/onClick: não é um elemento interativo", () => {
    render(<AttentionItem icon="◎" title="Avaliação pendente" description="há 62 dias" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("com href: renderiza como link navegável", () => {
    render(<AttentionItem icon="$" title="Diego Santos" description="Mensalidade vencida" href="/painel/financeiro" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/painel/financeiro");
  });

  it("com onClick: renderiza como botão e dispara o clique", async () => {
    const onClick = vi.fn();
    render(<AttentionItem icon="◎" title="Lucas Pereira" description="Avaliação há 62 dias" onClick={onClick} />);
    screen.getByRole("button").click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("tone warning nunca depende só da cor — o texto já carrega o significado", () => {
    render(<AttentionItem icon="$" title="Diego Santos" description="Mensalidade vencida" tone="warning" />);
    expect(screen.getByText("Mensalidade vencida")).toBeInTheDocument();
  });
});
