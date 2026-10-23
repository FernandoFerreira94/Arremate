import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**", "src/generated/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["**/*.cjs"], languageOptions: { globals: { module: "readonly", require: "readonly", __dirname: "readonly" } }, rules: { "@typescript-eslint/no-require-imports": "off" } },
  { rules: { "@typescript-eslint/no-explicit-any": "error", "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] } },
);
