// @vitest-environment node
//
// Foto de perfil e fotos de evolução (EPIC-35) contra PostgreSQL real
// (banco de testes): autorização do aluno, isolamento por tenant e por
// aluno, retirada da autorização.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import {
  PhotoError,
  addEvolutionPhoto,
  deleteEvolutionPhotoForViewer,
  detectImageMime,
  getEvolutionPhotoForViewer,
  getUserAvatar,
  listEvolutionPhotos,
  recordPhotoConsent,
  removeUserAvatar,
  revokePhotoConsent,
  setUserAvatar,
} from "./photos";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 1, 2, 3, 4]);

afterAll(async () => {
  await prisma.evolutionPhoto.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { email: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function setup(label: string) {
  const owner = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: `Dono ${label}`, role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}` } });
  const student = await prisma.student.create({ data: { tenantId: tenant.id, email: `aluno-${label}-${run}@example.test`, displayName: `Aluno ${label}` } });
  return { owner, tenant, student, scope: { tenantId: tenant.id, studentId: student.id } };
}

const photo = (scope: { tenantId: string; studentId: string }, actorUserId: string, pose = "FRENTE") =>
  addEvolutionPhoto({ ...scope, actorUserId, pose, bytes: JPEG, width: 900, height: 1200 }, prisma);

describe("detectImageMime", () => {
  it("reconhece JPEG, PNG e WebP pelos bytes e recusa o resto", () => {
    expect(detectImageMime(JPEG)).toBe("image/jpeg");
    expect(detectImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectImageMime(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(detectImageMime(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});

describe("foto de perfil", () => {
  it("grava, aponta User.image para a rota com versão e remove", async () => {
    const { owner } = await setup("avatar");
    const image = await setUserAvatar({ userId: owner.id, bytes: JPEG }, prisma);
    expect(image).toMatch(new RegExp(`^/api/avatar/${owner.id}\\?v=\\d+$`));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).image).toBe(image);
    expect((await getUserAvatar(owner.id, prisma))?.mimeType).toBe("image/jpeg");

    await removeUserAvatar(owner.id, prisma);
    expect(await getUserAvatar(owner.id, prisma)).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).image).toBeNull();
  });

  it("recusa arquivo que não é imagem", async () => {
    const { owner } = await setup("avatar-svg");
    await expect(setUserAvatar({ userId: owner.id, bytes: new TextEncoder().encode("<svg/>") }, prisma)).rejects.toMatchObject({ kind: "VALIDACAO" });
  });
});

describe("fotos de evolução", () => {
  it("exige a autorização do aluno antes da primeira foto e registra quem autorizou", async () => {
    const { owner, student, scope } = await setup("consent");
    await expect(photo(scope, owner.id)).rejects.toBeInstanceOf(PhotoError);
    await expect(photo(scope, owner.id)).rejects.toMatchObject({ kind: "SEM_AUTORIZACAO" });

    await recordPhotoConsent({ ...scope, actorUserId: owner.id }, prisma);
    const consent = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
    expect(consent.photoConsentAt).not.toBeNull();
    expect(consent.photoConsentByUserId).toBe(owner.id);

    const created = await photo(scope, owner.id, "LADO");
    expect(created.pose).toBe("LADO");
    expect(await listEvolutionPhotos(scope, prisma)).toEqual([expect.objectContaining({ id: created.id, pose: "LADO", width: 900, height: 1200 })]);
  });

  it("recusa pose desconhecida", async () => {
    const { owner, scope } = await setup("pose");
    await recordPhotoConsent({ ...scope, actorUserId: owner.id }, prisma);
    await expect(photo(scope, owner.id, "TOPO")).rejects.toMatchObject({ kind: "VALIDACAO" });
  });

  it("isola por tenant e, para o aluno, pelo próprio registro", async () => {
    const a = await setup("iso-a");
    const b = await setup("iso-b");
    const other = await prisma.student.create({ data: { tenantId: a.tenant.id, email: `outro-${run}@example.test`, displayName: "Outro" } });
    await recordPhotoConsent({ ...a.scope, actorUserId: a.owner.id }, prisma);
    const created = await photo(a.scope, a.owner.id);

    expect(await getEvolutionPhotoForViewer({ role: "PERSONAL", tenantId: a.tenant.id }, created.id, prisma)).not.toBeNull();
    expect(await getEvolutionPhotoForViewer({ role: "PERSONAL", tenantId: b.tenant.id }, created.id, prisma)).toBeNull();
    expect(await getEvolutionPhotoForViewer({ role: "ALUNO", tenantId: a.tenant.id, studentId: a.student.id }, created.id, prisma)).not.toBeNull();
    expect(await getEvolutionPhotoForViewer({ role: "ALUNO", tenantId: a.tenant.id, studentId: other.id }, created.id, prisma)).toBeNull();

    // Aluno de outro tenant não recebe foto nem autorização pelo personal errado.
    await expect(recordPhotoConsent({ tenantId: b.tenant.id, studentId: a.student.id, actorUserId: b.owner.id }, prisma)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
    await expect(deleteEvolutionPhotoForViewer({ role: "PERSONAL", tenantId: b.tenant.id }, created.id, prisma)).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });

    await deleteEvolutionPhotoForViewer({ role: "ALUNO", tenantId: a.tenant.id, studentId: a.student.id }, created.id, prisma);
    expect(await listEvolutionPhotos(a.scope, prisma)).toEqual([]);
  });

  it("retirar a autorização apaga as fotos e bloqueia novas", async () => {
    const { owner, scope } = await setup("revoke");
    await recordPhotoConsent({ ...scope, actorUserId: owner.id }, prisma);
    await photo(scope, owner.id, "FRENTE");
    await photo(scope, owner.id, "COSTAS");

    await revokePhotoConsent(scope, prisma);
    expect(await listEvolutionPhotos(scope, prisma)).toEqual([]);
    await expect(photo(scope, owner.id)).rejects.toMatchObject({ kind: "SEM_AUTORIZACAO" });
  });
});
