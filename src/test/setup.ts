import "@testing-library/jest-dom/vitest";

// Os testes partem das features novas desligadas (cada um liga a sua com
// `vi.stubEnv`); no deploy elas vêm ligadas por padrão (features.ts).
for (const feature of ["RETROATIVO", "GAMIFICACAO", "CUPONS", "FUNCIONAL"]) {
  process.env[`FEATURE_${feature}`] ??= "off";
}
