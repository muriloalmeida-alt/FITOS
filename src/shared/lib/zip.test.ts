// @vitest-environment node
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { crc32, createZip, toCsv } from "./zip";

describe("zip e csv da exportação", () => {
  it("crc32 confere com o valor de referência", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("gera um ZIP que o unzip do sistema abre, com nomes acentuados", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "zip-"));
    const file = path.join(dir, "dados.zip");
    writeFileSync(file, createZip([{ name: "alunos.csv", content: "nome\r\nAna\r\n" }, { name: "avaliações.csv", content: "ok" }]));
    // Integridade pelo próprio unzip (CRC e estrutura); o nome mostrado pelo
    // unzip depende do idioma da máquina, então o nome acentuado é conferido
    // direto no diretório central do ZIP, com a marca de UTF-8 (bit 11).
    expect(execFileSync("unzip", ["-t", file]).toString()).toMatch(/No errors detected/);
    execFileSync("unzip", ["-o", "-q", file, "alunos.csv", "-d", dir]);
    expect(readFileSync(path.join(dir, "alunos.csv"), "utf8")).toBe("nome\r\nAna\r\n");
    const zip = readFileSync(file);
    const names: string[] = [];
    for (let at = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])); at >= 0; at = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), at + 4)) {
      expect(zip.readUInt16LE(at + 8) & 0x0800).toBe(0x0800);
      names.push(zip.subarray(at + 46, at + 46 + zip.readUInt16LE(at + 28)).toString("utf8"));
    }
    expect(names).toEqual(["alunos.csv", "avaliações.csv"]);
  });

  it("csv com ponto e vírgula, BOM e aspas quando precisa", () => {
    expect(toCsv(["Nome", "Obs"], [["Ana", 'disse "oi"; tchau'], ["Pedro", null]])).toBe('﻿Nome;Obs\r\nAna;"disse ""oi""; tchau"\r\nPedro;\r\n');
  });
});
