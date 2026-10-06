// @vitest-environment node
//
// Vídeo e foto no chat (EPIC-40) contra PostgreSQL real: tipo pelos
// bytes, limites, quem pode ler, Range para o Safari e expiração.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { createTopic, getThread, listTopics, type ChatViewer } from "./messages";
import { detectVideoMime, expireOldAttachments, getAttachment, postAttachment, rangeResponse } from "./attachments";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const deps = { client: prisma, config: null };

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.chatAttachment.deleteMany({ where });
  await prisma.chatMessage.deleteMany({ where });
  await prisma.chatTopic.deleteMany({ where });
  await prisma.student.deleteMany({ where });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

const mp4 = (size = 64) => {
  const bytes = new Uint8Array(size);
  bytes.set([0, 0, 0, 0x18], 0);
  bytes.set([...("ftypisom" as string)].map((c) => c.charCodeAt(0)), 4);
  return bytes;
};
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

async function space(label: string) {
  const owner = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: "Murilo", role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${label} ${run}` } });
  const pupil = async (name: string): Promise<ChatViewer> => {
    const user = await prisma.user.create({ data: { email: `${label}-${name}-${run}@example.test`.toLowerCase(), name, role: "ALUNO" } });
    const student = await prisma.student.create({ data: { tenantId: tenant.id, userId: user.id, email: user.email, displayName: name } });
    return { role: "ALUNO", userId: user.id, tenantId: tenant.id, studentId: student.id };
  };
  return { coach: { role: "PERSONAL", userId: owner.id, tenantId: tenant.id } as ChatViewer, pupil };
}

describe("anexos do chat (EPIC-40)", () => {
  it("tipo de vídeo pelos primeiros bytes", () => {
    expect(detectVideoMime(mp4())).toBe("video/mp4");
    const mov = mp4();
    mov.set([..."qt  "].map((c) => c.charCodeAt(0)), 8);
    expect(detectVideoMime(mov)).toBe("video/quicktime");
    expect(detectVideoMime(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0]))).toBe("video/webm");
    expect(detectVideoMime(jpeg())).toBeNull();
  });

  it("aluno manda vídeo; personal assiste; outro aluno não", async () => {
    const { coach, pupil } = await space("video");
    const ana = await pupil("Ana");
    const pedro = await pupil("Pedro");
    const { id } = await createTopic(ana, { category: "EXERCICIO", exerciseName: "Supino", body: "Olha minha execução" }, deps);
    await postAttachment(ana, id, { bytes: mp4(2048), durationSec: "12.4" }, deps);
    await postAttachment(ana, id, { bytes: jpeg(), caption: "A pegada", width: 800, height: 600 }, deps);

    const thread = await getThread(coach, id, prisma);
    const [video, photo] = thread.messages.slice(1).map((message) => message.attachment!);
    expect(video).toMatchObject({ kind: "VIDEO", durationSec: 12, expired: false });
    expect(photo).toMatchObject({ kind: "FOTO", width: 800, height: 600 });
    expect(thread.messages[2]!.body).toBe("A pegada");
    expect((await listTopics(coach, {}, prisma))[0]!.lastMessage).toBe("📷 Foto · A pegada");

    expect((await getAttachment(coach, video!.id, prisma)).mimeType).toBe("video/mp4");
    await expect(getAttachment(pedro, video!.id, prisma)).rejects.toThrow("Anexo não encontrado.");
    const intruder = await space("video-outro");
    await expect(getAttachment(intruder.coach, video!.id, prisma)).rejects.toThrow("Anexo não encontrado.");
  });

  it("recusa o que não é vídeo nem foto, e vídeo longo demais", async () => {
    const { pupil } = await space("limite");
    const ana = await pupil("Ana");
    const { id } = await createTopic(ana, { category: "OUTRO", body: "oi" }, deps);
    await expect(postAttachment(ana, id, { bytes: new Uint8Array([1, 2, 3, 4, 5]) }, deps)).rejects.toThrow("Use um vídeo");
    await expect(postAttachment(ana, id, { bytes: mp4(), durationSec: 200 }, deps)).rejects.toThrow("até 90 segundos");
    await expect(postAttachment(ana, id, { bytes: new Uint8Array() }, deps)).rejects.toThrow("Escolha um vídeo ou uma foto.");
  });

  it("Range: 206 com o pedaço pedido", async () => {
    const data = new Uint8Array(Array.from({ length: 100 }, (_, i) => i));
    const full = rangeResponse(data, "video/mp4", null);
    expect(full.status).toBe(200);
    const part = rangeResponse(data, "video/mp4", "bytes=10-19");
    expect(part.status).toBe(206);
    expect(part.headers.get("Content-Range")).toBe("bytes 10-19/100");
    expect([...new Uint8Array(await part.arrayBuffer())]).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(rangeResponse(data, "video/mp4", "bytes=-5").headers.get("Content-Range")).toBe("bytes 95-99/100");
    expect(rangeResponse(data, "video/mp4", "bytes=200-").status).toBe(416);
  });

  it("depois de 90 dias o conteúdo sai e a mensagem fica", async () => {
    const { coach, pupil } = await space("expira");
    const ana = await pupil("Ana");
    const { id } = await createTopic(ana, { category: "OUTRO", body: "oi" }, deps);
    await postAttachment(ana, id, { bytes: mp4() }, deps);
    const later = new Date(Date.now() + 91 * 86_400_000);
    expect(await expireOldAttachments(later, prisma)).toBeGreaterThanOrEqual(1);
    const attachment = (await getThread(coach, id, prisma)).messages[1]!.attachment!;
    expect(attachment.expired).toBe(true);
    await expect(getAttachment(coach, attachment.id, prisma)).rejects.toThrow("Este anexo expirou.");
  });
});
