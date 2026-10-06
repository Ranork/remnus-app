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
    // CommonJS Node script (own package.json), `cli/` is the published `remnus`
    // command (standalone ESM Node package, own package.json), and src-tauri is
    // the Rust project plus its build output.
    "mcpb/**",
    "cli/**",
    "src-tauri/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // A leading underscore marks a deliberately unused binding (a server action's
      // required `prevState`, a destructured field dropped from a rest object).
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
      // The React Compiler lint rules (eslint-plugin-react-hooks v6) flag two
      // patterns this codebase uses intentionally and pervasively: assigning a
      // latest-value ref during render (`refs`) and initializing/syncing state
      // from an external store inside an effect (`set-state-in-effect`). They
      // fire on correct code, so they're disabled until the app is migrated to
      // be React-Compiler-clean. The genuinely bug-catching compiler rules
      // (`static-components`, `immutability`, `purity`) stay as errors.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      // Links prefetch on intent, not on sight (V2 R9.4): use @/components/ui/link.
      "no-restricted-imports": ["error", { paths: [{ name: "next/link", message: "Use @/components/ui/link (prefetches on hover/focus instead of on entering the viewport)." }] }]
    }
  },
  {
    files: ["src/components/ui/link.tsx"],
    rules: { "no-restricted-imports": "off" }
  }
]);

export default eslintConfig;
