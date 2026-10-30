import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 10000,
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**", ".claude/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      all: true,
      thresholds: {
        perFile: true,
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90,
      },
      include: [
        "src/shared/lib/jwt.ts",
        "src/shared/hooks/useNavSearch.ts",
        "src/feature/help/**/*.{ts,tsx}",
        "src/feature/about/**/*.{ts,tsx}",
        "src/shared/components/layout/nav-items.ts",
        "src/shared/i18n/config.ts",
      ],
      exclude: [
        "src/shared/components/ui/**",
        "src/test/**",
        "src/main.tsx",
        "src/app/router.tsx",
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        "**/*.config.*",
        "scripts/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@app": path.resolve(__dirname, "./src/app"),
      "@feature": path.resolve(__dirname, "./src/feature"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@ui": path.resolve(__dirname, "./src/shared/components/ui"),
    },
  },
});
