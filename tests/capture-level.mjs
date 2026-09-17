import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:5173/");
await page.waitForFunction(() => window.__game);
await page.evaluate(() => document.fonts.ready);
await page.click("#start");
await page.evaluate(() => {
  const g = window.__game;
  g.position.set(8, 1.65, -28);
  g.yaw = 0.1;
  g.pitch = -0.035;
});
await page.waitForTimeout(1000);
await page.screenshot({ path: "docs/screenshots/first-encounter.png" });
await page.evaluate(() => {
  const g = window.__game;
  g.level.gateOpen = true;
  g.position.set(6, 1.65, -71);
  g.yaw = 0;
  g.pitch = 0;
});
await page.waitForTimeout(700);
await page.screenshot({ path: "docs/screenshots/final-chamber.png" });
await browser.close();
