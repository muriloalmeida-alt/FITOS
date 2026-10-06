import "server-only";
import { ASAAS_SANDBOX_BASE_URL, asaasRequest, type AsaasClientConfig } from "@/modules/billing/asaasClient";

/// Conta Asaas principal do FitOS (EPIC-38): cria as subcontas dos
/// personais e recebe a taxa de 2% por split. `API_ASAAS` é a chave;
/// `ASAAS_BASE_URL` escolhe o ambiente (sandbox quando ausente);
/// `ASAAS_WALLET_ID` evita buscar a carteira a cada cobrança.

export const FITOS_FEE_PERCENT = 2;

export function fitosAsaasConfig(deps: { fetchImpl?: typeof fetch } = {}): AsaasClientConfig & { environment: "producao" | "sandbox" } {
  const apiKey = process.env.API_ASAAS;
  if (!apiKey) throw new Error("API_ASAAS ausente: a conta Asaas do FitOS não está configurada.");
  const baseUrl = (process.env.ASAAS_BASE_URL ?? ASAAS_SANDBOX_BASE_URL).replace(/\/$/, "");
  return { apiKey, baseUrl, fetchImpl: deps.fetchImpl, environment: baseUrl.includes("sandbox") ? "sandbox" : "producao" };
}

let cachedWallet: string | null = null;

export async function fitosWalletId(deps: { fetchImpl?: typeof fetch } = {}): Promise<string> {
  if (process.env.ASAAS_WALLET_ID) return process.env.ASAAS_WALLET_ID;
  if (cachedWallet) return cachedWallet;
  const wallets = await asaasRequest<{ data: { id: string }[] }>(fitosAsaasConfig(deps), "/wallets");
  const id = wallets.data[0]?.id;
  if (!id) throw new Error("Carteira Asaas do FitOS não encontrada.");
  cachedWallet = id;
  return id;
}
