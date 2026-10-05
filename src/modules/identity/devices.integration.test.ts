// @vitest-environment node
//
// Aparelhos conectados (Configurações, EPIC-36) contra PostgreSQL real.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { deviceLabel, listDevices, signOutDevice, signOutOtherDevices } from "./devices";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function account(label: string) {
  const user = await prisma.user.create({ data: { email: `${label}-${run}@example.test`, name: "Murilo", role: "PERSONAL" } });
  const session = (userAgent: string | null, expired = false) =>
    prisma.session.create({ data: { userId: user.id, token: `${label}-${Math.random()}-${run}`, userAgent, expiresAt: new Date(Date.now() + (expired ? -1 : 1) * 86_400_000) } });
  return { user, session };
}

describe("aparelhos conectados (EPIC-36)", () => {
  it("nomeia aparelho e navegador", () => {
    expect(deviceLabel(IPHONE)).toBe("Safari no iPhone");
    expect(deviceLabel(MAC_CHROME)).toBe("Chrome no Mac");
    expect(deviceLabel(null)).toBe("Aparelho desconhecido");
  });

  it("lista as sessões válidas com a atual primeiro e desconecta as outras", async () => {
    const { user, session } = await account("lista");
    const current = await session(MAC_CHROME);
    const phone = await session(IPHONE);
    const tablet = await session(null);
    await session(IPHONE, true);

    const devices = await listDevices({ userId: user.id, currentSessionId: current.id }, prisma);
    expect(devices.map((device) => [device.label, device.current])).toEqual([["Chrome no Mac", true], ...devices.slice(1).map((device) => [device.label, false])]);
    expect(devices).toHaveLength(3);

    expect(await signOutDevice({ userId: user.id, sessionId: current.id, currentSessionId: current.id }, prisma)).toBe(false);
    expect(await signOutDevice({ userId: user.id, sessionId: phone.id, currentSessionId: current.id }, prisma)).toBe(true);
    const other = await account("outro");
    expect(await signOutDevice({ userId: other.user.id, sessionId: tablet.id, currentSessionId: null }, prisma)).toBe(false);

    expect(await signOutOtherDevices({ userId: user.id, currentSessionId: current.id }, prisma)).toBe(2);
    expect((await listDevices({ userId: user.id, currentSessionId: current.id }, prisma)).map((device) => device.id)).toEqual([current.id]);
  });
});
