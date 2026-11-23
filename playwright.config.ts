import { defineConfig, devices } from "@playwright/test";

const release = process.env.FETCH_RELEASE_TEST === "true";
const geography = process.env.FETCH_GEOGRAPHY_TEST === "true";
const port = Number(process.env.PLAYWRIGHT_PORT || (release ? 4183 : geography ? 4184 : 4182));
const buildDir = geography ? `node_modules/.cache/fetch-geography-${port}` : "node_modules/.cache/fetch-release";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: release ? "./tests" : geography ? "./tests/geography" : "./tests/e2e",
  ...(release && { testMatch: ["**/release/*.spec.ts", "**/e2e/fetch-county-comparison.spec.ts", "**/e2e/fetch-reader-tasks.spec.ts"] }),
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: release || geography
      ? `VITE_FETCH_PREVIEW=true VITE_NEWS_API_URL=http://localhost:8787 npm exec -- vite build --outDir ${buildDir} --emptyOutDir && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort --outDir ${buildDir}`
      : `VITE_LOCAL_PUBLISHED_ATLAS=false VITE_NEWS_API_URL=http://localhost:8787 VITE_NEWSLETTER_API_URL=http://localhost:8788 npm run dev -- --mode test --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (process.env.CI ? undefined : "/usr/bin/chromium"),
          args: ["--no-sandbox"],
        },
      },
    },
    ...(release ? [
      { name: "firefox", use: { ...devices["Desktop Firefox"] } },
      { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
    ] : []),
  ],
});
