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
    expect(execFileSync("unzip", ["-l", file]).toString()).toMatch(/alunos\.csv[\s\S]*avaliações\.csv/);
    execFileSync("unzip", ["-o", "-q", file, "-d", dir]);
    expect(readFileSync(path.join(dir, "alunos.csv"), "utf8")).toBe("nome\r\nAna\r\n");
  });

  it("csv com ponto e vírgula, BOM e aspas quando precisa", () => {
    expect(toCsv(["Nome", "Obs"], [["Ana", 'disse "oi"; tchau'], ["Pedro", null]])).toBe('﻿Nome;Obs\r\nAna;"disse ""oi""; tchau"\r\nPedro;\r\n');
  });
});
