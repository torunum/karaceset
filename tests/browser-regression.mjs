import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://127.0.0.1:5173/?testroom=1");
await page.waitForFunction(() => window.__game);
await page.evaluate(() => {
  const g = window.__game;
  g.renderScale = 0.5;
  g.resize();
});
await page.click("#start");
assert.equal(await page.evaluate(() => window.__game.mode), "playing");
const initialZ = await page.evaluate(() => window.__game.position.z);
await page.keyboard.down("w");
await page.waitForFunction((z) => window.__game.position.z < z - 0.5, initialZ);
await page.keyboard.up("w");
const yawBefore = await page.evaluate(() => window.__game.yaw);
await page.mouse.move(510, 310);
assert.notEqual(await page.evaluate(() => window.__game.yaw), yawBefore);
const ammo = await page.evaluate(() => window.__game.ammo);
await page.mouse.down();
await page.mouse.up();
assert.equal(await page.evaluate(() => window.__game.ammo), ammo - 1);
await page.keyboard.press("Escape");
assert.equal(await page.evaluate(() => window.__game.mode), "paused");
// Deterministic integration: use the live game's actual fixed-step combat methods to
// isolate mechanics from software-renderer timing. Only scene arrangement is staged.
const mechanics = await page.evaluate(() => {
  const g = window.__game;
  g.reset();
  g.mode = "playing";
  const e = g.enemies[0];
  g.position.set(0, 1.15, -2);
  g.yaw = 0;
  g.pitch = 0;
  g.shoot();
  let moved = false;
  for (let i = 0; i < 35; i++) {
    g.updateProjectiles(1 / 60);
    const before = e.position.z;
    g.updateEnemies(1 / 60);
    if (e.state === "pinning" && e.position.z !== before) moved = true;
  }
  const pin = {
    state: e.state,
    hp: e.hp,
    pins: g.pins,
    moved,
    z: e.position.z,
  };
  const hp = g.health;
  g.position.copy(e.position);
  for (let i = 0; i < 180; i++) g.updateEnemies(1 / 60);
  const noContact = g.health === hp;
  g.reset();
  g.mode = "playing";
  const open = g.enemies[0];
  open.position.set(0, 1.04, 0);
  open.rig.root.position.set(0, 0, 0);
  g.position.set(0, 1.15, 4);
  g.yaw = 0;
  g.pitch = 0;
  g.shoot();
  for (let i = 0; i < 35; i++) {
    g.updateProjectiles(1 / 60);
    g.updateEnemies(1 / 60);
  }
  const normal = { state: open.state, pins: g.pins, kills: g.kills };
  g.reset();
  g.mode = "playing";
  g.position.set(2, 1, 0);
  g.yaw = -Math.PI / 2;
  g.shoot();
  for (let i = 0; i < 20; i++) g.updateProjectiles(1 / 60);
  const wall = { projectiles: g.projectiles.length, remains: g.remains.length };
  g.hurt(100);
  const death = g.mode;
  return { pin, noContact, normal, wall, death };
});
assert.equal(mechanics.pin.state, "pinned");
assert.equal(mechanics.pin.hp, 0);
assert.equal(mechanics.pin.pins, 1);
assert.equal(mechanics.pin.moved, true);
assert(mechanics.pin.z > -9 + 0.57);
assert.equal(mechanics.noContact, true);
assert.equal(mechanics.normal.state, "dead");
assert.equal(mechanics.normal.pins, 0);
assert.equal(mechanics.normal.kills, 1);
assert.equal(mechanics.wall.projectiles, 0);
assert(mechanics.wall.remains > 0);
assert.equal(mechanics.death, "dead");
await page.click("#start");
assert.equal(await page.evaluate(() => window.__game.health), 100);
assert.equal(await page.evaluate(() => window.__game.mode), "playing");
await page.keyboard.press("Escape");
await page.goto("http://127.0.0.1:5173/");
await page.waitForFunction(() => window.__game);
await page.evaluate(() => {
  const g = window.__game;
  g.renderScale = 0.5;
  g.resize();
});
await page.click("#start");
await page.evaluate(() =>
  window.__game.position.copy(window.__game.level.buttonPosition),
);
await page.keyboard.press("e");
assert.equal(await page.evaluate(() => window.__game.level.gateOpen), true);
const attacks = await page.evaluate(() => {
  const g = window.__game;
  for (const e of g.enemies) {
    e.cooldown = 100;
    e.state = "idle";
  }
  const ranged = g.enemies.find((e) => e.kind === "spitter");
  ranged.position.set(8, 1.22, -37);
  ranged.state = "chase";
  ranged.cooldown = 0;
  g.position.set(8, 1.65, -33);
  g.updateEnemies(1 / 60);
  const telegraph = ranged.state === "windup";
  g.updateEnemies(0.9);
  const spawned = g.projectiles.some((p) => p.hostile);
  const before = g.health;
  for (let i = 0; i < 60; i++) g.updateProjectiles(1 / 60);
  const rangedDamage = before - g.health;
  const melee = g.enemies.find((e) => e.kind === "runner");
  melee.position.set(8, 1.04, -34);
  melee.state = "chase";
  melee.cooldown = 0;
  g.updateEnemies(1 / 60);
  const meleeTelegraph = melee.state === "windup";
  const hp = g.health;
  g.updateEnemies(0.6);
  return {
    telegraph,
    spawned,
    rangedDamage,
    meleeTelegraph,
    meleeDamage: hp - g.health,
  };
});
assert.equal(attacks.telegraph, true);
assert.equal(attacks.spawned, true);
assert.equal(attacks.rangedDamage, 15);
assert.equal(attacks.meleeTelegraph, true);
assert.equal(attacks.meleeDamage, 12);
const flow = await page.evaluate(() => {
  const g = window.__game;
  g.position.copy(g.level.exitPosition);
  g.interact();
  const locked = g.mode === "playing";
  // Kill all enemies through the combat handler to exercise the actual kill counter.
  for (const e of g.enemies) {
    while (e.hp > 0)
      g.hitEnemy(e, e.position.clone(), e.position.clone().set(0, 0, -1));
  }
  g.position.copy(g.level.exitPosition);
  g.interact();
  return { locked, mode: g.mode, kills: g.kills };
});
assert.equal(flow.locked, true);
assert.equal(flow.mode, "won");
assert.equal(flow.kills, 28);
assert.deepEqual(errors, []);
await fs.mkdir("docs", { recursive: true });
const report = {
  date: new Date().toISOString(),
  input: "Real keyboard, mouse movement, short click, Escape and E",
  mechanics,
  attacks,
  flow,
  errors,
  limitation:
    "Combat arrangements and final all-enemy cleanup use the development API; this is not a timed full human playthrough.",
};
await fs.writeFile(
  "docs/browser-verification.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
await browser.close();
