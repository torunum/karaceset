import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
await fs.mkdir("docs/screenshots", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://127.0.0.1:5173/");
await page.waitForFunction(() => !!window.__game);
await page.waitForTimeout(2000);
await page.screenshot({ path: "docs/screenshots/menu.png" });
console.log(
  "INITIAL",
  await page.evaluate(() => ({
    enemies: window.__game.enemies.length,
    walls: window.__game.level.walls.length,
    drawCalls: window.__game.renderer.info.render.calls,
    triangles: window.__game.renderer.info.render.triangles,
    polys: window.__game.level.polygons.length,
    inside: window.__game.level.contains(0, 6, 0.34),
  })),
);
await page.click("#start");
await page.waitForTimeout(300);
await page.keyboard.down("w");
await page.waitForTimeout(800);
await page.keyboard.up("w");
await page.screenshot({ path: "docs/screenshots/playing.png" });
console.log(
  "MOVEMENT",
  await page.evaluate(() => ({
    position: window.__game.position.toArray(),
    mode: window.__game.mode,
    locked: !!document.pointerLockElement,
  })),
);
await page.mouse.click(720, 450);
await page.waitForTimeout(150);
console.log(
  "SHOT",
  await page.evaluate(() => ({
    ammo: window.__game.ammo,
    projectiles: window.__game.projectiles.length,
  })),
);
await page.keyboard.press("Escape");
await page.waitForTimeout(100);
console.log("PAUSE", await page.evaluate(() => window.__game.mode));
await page.goto("http://127.0.0.1:5173/?testroom=1");
await page.waitForFunction(() => !!window.__game);
await page.click("#start");
await page.evaluate(() => {
  const g = window.__game;
  g.position.set(0, 1.2, -2);
  g.pitch = 0;
  g.yaw = 0;
  g.enemies[0].state = "idle";
  g.enemies[0].cooldown = 100;
});
await page.mouse.down();
await page.mouse.up();
await page.waitForFunction(
  () => window.__game.enemies[0].hp === 0,
  {},
  { timeout: 30000 },
);
await page.waitForFunction(
  () => window.__game.enemies[0].state === "pinned",
  {},
  { timeout: 30000 },
);
console.log(
  "PIN",
  await page.evaluate(() => {
    const g = window.__game,
      e = g.enemies[0];
    g.position.set(1.7, 1.55, -4.5);
    g.yaw = 0.48;
    g.pitch = -0.06;
    return {
      ammo: g.ammo,
      kills: g.kills,
      pins: g.pins,
      state: e.state,
      position: e.position.toArray(),
      pin: e.pin,
      health: g.health,
    };
  }),
);
await page.screenshot({ path: "docs/screenshots/pinning.png" });
console.log("ERRORS", errors);
await browser.close();
