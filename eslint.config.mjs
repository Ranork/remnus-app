import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not part of the Next app: the .mcpb bundle launcher is a standalone
    // CommonJS Node script (own package.json), and src-tauri is the Rust project
    // plus its build output.
    "mcpb/**",
    "src-tauri/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // The React Compiler lint rules (eslint-plugin-react-hooks v6) flag two
      // patterns this codebase uses intentionally and pervasively: assigning a
      // latest-value ref during render (`refs`) and initializing/syncing state
      // from an external store inside an effect (`set-state-in-effect`). They
      // fire on correct code, so they're disabled until the app is migrated to
      // be React-Compiler-clean. The genuinely bug-catching compiler rules
      // (`static-components`, `immutability`, `purity`) stay as errors.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off"
    }
  }
]);

export default eslintConfig;
