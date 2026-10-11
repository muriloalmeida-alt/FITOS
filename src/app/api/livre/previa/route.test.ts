import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/livre/previa (EPIC-33)", () => {
  it("mostra os treinos que as três respostas geram, com dias e tempo", async () => {
    const response = await GET(new Request("http://x/api/livre/previa?objetivo=PERDER_PESO&dias=TRES_A_QUATRO_DIAS&experiencia=INICIANTE"));
    const body = (await response.json()) as { workouts: { name: string; days: string[]; minutes: number }[] };
    expect(body.workouts.map((workout) => workout.name)).toEqual(["Corpo todo A", "Caminhada inclinada", "Corpo todo B", "Bike leve"]);
    expect(body.workouts[1]).toMatchObject({ days: ["TERCA"], minutes: 30 });
  });

  it("respostas inválidas: 400", async () => {
    expect((await GET(new Request("http://x/api/livre/previa?objetivo=X&dias=Y&experiencia=Z"))).status).toBe(400);
  });
});
