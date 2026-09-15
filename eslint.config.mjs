import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: ["vitest.config.ts", "src/test/**"],
  },
];

export default eslintConfig;
