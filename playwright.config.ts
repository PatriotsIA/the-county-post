import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT || 5173);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `VITE_NEWS_API_URL=http://localhost:8787 VITE_EMAILJS_SERVICE_ID=service_test VITE_EMAILJS_TEMPLATE_ID=template_countypost VITE_EMAILJS_PUBLIC_KEY=test_public_key npm run dev -- --host 127.0.0.1 --strictPort --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } },
    },
  ],
});
