import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  globalIgnores([".next/**", "coverage/**", "playwright-report/**", "test-results/**"]),
  ...nextVitals,
  {
    rules: {
      "no-undef": "error",
      "react/no-unescaped-entities": "off",
      // Existing effects intentionally synchronize URL, session, and overlay state.
      "react-hooks/set-state-in-effect": "off"
    }
  }
]);
