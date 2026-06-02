#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const PORT = 4173;
const HOST = "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}/airdrop-token-claim/`;
const OUTPUT_DIR = path.resolve("docs/assets/readme");

const shots = [
  ["overview", "demo-overview.png"],
  ["token-claim-states", "token-claim-states.png"],
  ["terms-quiz", "terms-quiz.png"],
  ["eas-terms-kit", "eas-terms-kit.png"],
];

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server not ready yet.
    }
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const server = spawn(
    "pnpm",
    ["exec", "vite", "preview", "--config", "demo/vite.config.ts", "--host", HOST, "--port", String(PORT), "--strictPort"],
    { stdio: "inherit" },
  );

  try {
    await waitForServer(BASE_URL);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    for (const [testId, fileName] of shots) {
      if (testId === "terms-quiz") {
        await page.getByRole("button", { name: /start quiz/i }).click();
        await page.getByText(/what should a production app do/i).waitFor();
      }

      const locator = page.locator(`[data-screenshot="${testId}"]`);
      await locator.scrollIntoViewIfNeeded();
      await locator.screenshot({ path: path.join(OUTPUT_DIR, fileName) });
      console.log(`Wrote ${path.join(OUTPUT_DIR, fileName)}`);
    }

    await browser.close();
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
