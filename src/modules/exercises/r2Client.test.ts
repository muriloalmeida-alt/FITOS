// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { detectContentType, EXERCISE_IMAGE_CACHE_CONTROL, uploadAndVerifyObject } from "./r2Client";

function fakeClient(sendImpl: (command: unknown) => Promise<unknown>) {
  return { send: vi.fn(sendImpl) } as unknown as import("@aws-sdk/client-s3").S3Client;
}

describe("detectContentType", () => {
  it("retorna image/webp para extensão webp", () => {
    expect(detectContentType("webp")).toBe("image/webp");
  });

  it("retorna image/png para extensão png", () => {
    expect(detectContentType("png")).toBe("image/png");
  });

  it("lança para extensão não suportada", () => {
    expect(() => detectContentType("gif")).toThrow(/não suportada/);
  });
});

describe("uploadAndVerifyObject", () => {
  const body = Buffer.from("conteudo-de-teste");

  it("envia PutObjectCommand com Content-Type e Cache-Control corretos, e confirma com HeadObjectCommand", async () => {
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof PutObjectCommand) {
        expect(command.input).toMatchObject({
          Bucket: "fitos-exercicios",
          Key: "exercises/x.webp",
          ContentType: "image/webp",
          CacheControl: EXERCISE_IMAGE_CACHE_CONTROL,
        });
        return {};
      }
      if (command instanceof HeadObjectCommand) {
        return { ContentLength: body.byteLength };
      }
      throw new Error("comando inesperado");
    });
    const client = { send } as unknown as import("@aws-sdk/client-s3").S3Client;

    await expect(
      uploadAndVerifyObject({ client, bucket: "fitos-exercicios", key: "exercises/x.webp", body, contentType: "image/webp" })
    ).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(2);
  });

  it("lança quando o PutObjectCommand falha, sem chegar a confirmar com HeadObject", async () => {
    const headSpy = vi.fn();
    const client = fakeClient(async (command) => {
      if (command instanceof PutObjectCommand) {
        throw new Error("acesso negado (credenciais inválidas)");
      }
      headSpy();
      return {};
    });

    await expect(
      uploadAndVerifyObject({ client, bucket: "fitos-exercicios", key: "exercises/x.webp", body, contentType: "image/webp" })
    ).rejects.toThrow(/acesso negado/);
    expect(headSpy).not.toHaveBeenCalled();
  });

  it("lança quando o HeadObjectCommand confirma um tamanho diferente do enviado", async () => {
    const client = fakeClient(async (command) => {
      if (command instanceof PutObjectCommand) return {};
      if (command instanceof HeadObjectCommand) return { ContentLength: 0 };
      throw new Error("comando inesperado");
    });

    await expect(
      uploadAndVerifyObject({ client, bucket: "fitos-exercicios", key: "exercises/x.webp", body, contentType: "image/webp" })
    ).rejects.toThrow(/Confirmação do objeto/);
  });
});
