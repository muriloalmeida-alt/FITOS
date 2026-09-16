/// Erros tipados do client da Exercises API (API Ninjas), FIT-020.
///
/// Nenhuma mensagem aqui inclui a chave, a URL completa da requisição ou o
/// corpo bruto da resposta — apenas o que é seguro registrar/exibir.
export class ApiNinjasError extends Error {
  constructor(
    public readonly kind:
      | "CHAVE_AUSENTE"
      | "NAO_AUTORIZADO"
      | "PROIBIDO"
      | "LIMITE_EXCEDIDO"
      | "ERRO_SERVIDOR"
      | "TIMEOUT"
      | "RESPOSTA_INVALIDA",
    message: string
  ) {
    super(message);
    this.name = "ApiNinjasError";
  }
}
