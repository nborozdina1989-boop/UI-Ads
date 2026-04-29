import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/static-components": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".vercel/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "backups/**",
      ".backup/**",
      ".backup_adriver/**",
      ".backup_generation/**",
      ".backups/**",
      "**/*.bak*",
      "**/*.backup*",
      "**/*.safe.*",
      "**/page.before-*.tsx",
    ],
  },
];

export default eslintConfig;
