import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { publishedDataPreview } from "./scripts/dev/published-data.ts";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_LOCAL_PUBLISHED_");
  const allDesks = env.VITE_LOCAL_PUBLISHED_NEWS === "true";
  const preview =
    command === "serve" && mode === "development" && (allDesks || env.VITE_LOCAL_PUBLISHED_ATLAS === "true");
  return {
    cacheDir: mode === "test" ? "node_modules/.vite-browser-tests" : undefined,
    plugins: [react(), preview && publishedDataPreview(allDesks)],
    envPrefix: ["VITE_", "RSS_2_API"],
  };
});
