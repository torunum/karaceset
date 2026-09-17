import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5173/");
  await page.waitForFunction(() => window.__game);
  const result = await page.evaluate(async () => {
    const { traceShot } = await import("/src/combat.ts");
    const g = window.__game;
    g.refreshHitParts();
    const heads = [...new Set(g.enemies.map((e) => e.kind))].map((kind) => {
      const e = g.enemies.find((e) => e.kind === kind);
      const head = e.hitParts.find((p) => p.name === "head");
      const origin = head.center.clone();
      origin.y = 1.65;
      origin.z -= 4;
      return { kind, hit: traceShot(origin, head.center, [], [e])?.part };
    });
    g.mode = "playing";
    const cultist = g.enemies.find((e) => e.kind === "cultist");
    for (const e of g.enemies) {
      e.state = "idle";
      e.position.set(1000, 1, 1000);
    }
    g.position.set(8, 1.65, -28);
    cultist.lostParts.add("rightArm");
    cultist.position.set(8, 1.08, -36);
    cultist.state = "windup";
    cultist.timer = 0.001;
    const before = g.health;
    g.updateEnemies(0.016);
    const distantDamage = before - g.health;
    cultist.position.set(8, 1.08, -29);
    cultist.state = "windup";
    cultist.timer = 0.001;
    g.updateEnemies(0.016);
    return {
      heads,
      distantDamage,
      closeDamage: before - distantDamage - g.health,
    };
  });
  assert.equal(
    result.distantDamage,
    0,
    "disarmed cultist cannot melee after player retreats",
  );
  assert.equal(
    result.closeDamage,
    12,
    "disarmed cultist still hits within melee reach",
  );
  for (const head of result.heads)
    assert.equal(
      head.hit,
      "head",
      `${head.kind} head must be targetable from standing eye height`,
    );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
