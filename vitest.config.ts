import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "tests/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
      "@features": path.resolve(rootDir, "./src/features"),
      "@shared": path.resolve(rootDir, "./src/shared"),
      "@lib": path.resolve(rootDir, "./src/lib"),
      "@mocks": path.resolve(rootDir, "./src/mocks"),
      // Stub the "server-only" guard in unit tests; production code keeps the
      // import as a build-time barrier against client bundling.
      "server-only": path.resolve(rootDir, "./vitest.server-only-stub.ts"),
    },
  },
});
