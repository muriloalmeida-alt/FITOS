import { timingSafeEqual } from "node:crypto";

/// Comparação de segredos em tempo constante — evita que a diferença de
/// tempo de resposta revele quantos caracteres do segredo esperado
/// coincidem com o valor recebido. `timingSafeEqual` do Node exige buffers
/// do mesmo tamanho; comprimentos diferentes já significam segredos
/// diferentes, então retornam `false` diretamente (sem nenhuma comparação
/// que possa vazar tempo por tamanho — o próprio tamanho não é segredo).
export function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}
