import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("retorna status ok com metadados da aplicação", async () => {
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.app).toBe("FitOS");
    expect(typeof body.timestamp).toBe("string");
  });
});
