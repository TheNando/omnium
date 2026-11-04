import { defineConfig } from "vite-plus";

// Appwrite deploys the contents of dist/ as-is, so everything is bundled into one file.
export default defineConfig({
  pack: {
    entry: { main: "src/main.ts" },
    format: "esm",
    platform: "node",
    target: "node22",
    dts: false,
    clean: true,
    deps: { alwaysBundle: [/.*/] },
    outExtensions: () => ({ js: ".mjs" }),
  },
});
