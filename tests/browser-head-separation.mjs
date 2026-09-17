import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 980 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("[vite] failed to connect to websocket.")) errors.push(m.text());
  });
  // Keep the staged GPU snapshot stable while another task edits the level.
  await page.routeWebSocket("**", socket => socket.close());
  await page.goto("http://127.0.0.1:5173/?chapel=1");
  await page.waitForFunction(
    () => window.__game?.assetsReady && window.__game.cultSprites.ready,
    undefined,{timeout:90000}
  ).catch(error=>{console.error(errors);throw error;});
  const result = await page.evaluate(async () => {
    const g = window.__game;
    g.mode = "paused";
    g.onChange = () => {};
    const T = await import("/node_modules/three/build/three.module.js");
    const { containsHead, headContour } = await import("/src/sprite-heads.ts");
    const target = new T.WebGLRenderTarget(444, 444),
      stage = new T.Scene(),
      camera = new T.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 5);
    camera.position.z = 2;
    const clear = g.renderer.getClearColor(new T.Color()),
      clearAlpha = g.renderer.getClearAlpha();
    const render = (object) => {
      stage.clear();
      stage.add(object);
      g.renderer.setRenderTarget(target);
      g.renderer.setClearColor(0x181214, 0);
      g.renderer.clear();
      g.renderer.render(stage, camera);
      const bytes = new Uint8Array(444 * 444 * 4);
      g.renderer.readRenderTargetPixels(target, 0, 0, 444, 444, bytes);
      return bytes;
    };
    const gallery = document.createElement("div");
    gallery.id = "head-review";
    gallery.style =
      "position:fixed;inset:0;z-index:999999;background:#181214;overflow:auto;display:grid;grid-template-columns:repeat(8,1fr);gap:4px;padding:10px;color:#fff;font:13px monospace;";
    document.body.append(gallery);
    function tile(bytes, label) {
      const d = document.createElement("div"),
        canvas = document.createElement("canvas");
      canvas.width = 444;
      canvas.height = 444;
      canvas.style = "width:100%;image-rendering:pixelated;";
      const data = new Uint8ClampedArray(bytes.length);
      for (let y = 0; y < 444; y++)
        data.set(
          bytes.subarray((443 - y) * 444 * 4, (444 - y) * 444 * 4),
          y * 444 * 4,
        );
      canvas.getContext("2d").putImageData(new ImageData(data, 444, 444), 0, 0);
      d.append(label, canvas);
      gallery.append(d);
    }
    const results = [];
    for (const kind of ["cultist", "shambler"]) {
      const actor = g.enemies.find((e) => e.kind === kind);
      actor.rig.root.rotation.y = Math.PI;
      actor.lostParts.clear();
      actor.rig.head.visible = true;
      const poses = [
        ["idle", 1, false],
        ["chase", 2, true],
        ["chase", 2.1, true],
        ["chase", 2.2, true],
        ["chase", 2.3, true],
        ["windup", 3, false],
        ["windup", 3.6, false],
        ["hurt", 4, false],
        ["dead", 5, false],
      ];
      for (let poseIndex = 0; poseIndex < poses.length; poseIndex++) {
        const frame = [0,1,2,3,2,4,5,6,7][poseIndex];
        const [state, time, moving] = poses[poseIndex];
        actor.state = state;
        actor.timer = frame === 5 ? 0.05 : 0.5;
        actor.rig.root.userData.moving = moving;
        if (kind === "cultist" && frame === 5) {
          actor.state = "chase";
          actor.rig.root.userData.spriteFiredAt = time;
        }
        actor.lostParts.clear();
        actor.rig.head.visible = true;
        g.cultSprites.update(
          [actor],
          actor.position.clone().add(new T.Vector3(0, 0, 3)),
          time,
        );
        const name = kind === "cultist" ? "cult-enforcer" : "executioner",
          source = g.scene.getObjectByName(`${name}-pixel-sprite`),
          sample = source.clone();
        sample.position.set(0, 0, 0);
        sample.rotation.set(0, 0, 0);
        sample.scale.setScalar(1 / (kind === "cultist" ? 2.1 : 2.3));
        sample.visible = true;
        const before = render(sample);
        if (kind === "shambler" && moving) {
          // Empty corners must be genuinely absent after runtime chroma key.
          if (before[3] !== 0 || before[(443*444+443)*4+3] !== 0)
            throw new Error("Walk atlas background leaked into renderer");
          tile(before, `forward gait ${actor.rig.root.userData.spriteWalkCell}`);
        }
        g.gore.sever(actor.rig,"head",new T.Vector3(1,0,0));
        const fragment=g.gore.particles.filter(p=>p.mesh.userData.headOnly).at(-1)?.mesh;
        if(!fragment) throw new Error(`Missing illustrated head for ${kind} ${frame}`);
        actor.rig.head.visible = false;
        // No lostParts yet: severing must survive the caller's delayed bookkeeping.
        g.cultSprites.update(
          [actor],
          actor.position.clone().add(new T.Vector3(0, 0, 3)),
          time,
        );
        const after = render(sample),
          walkCell = actor.rig.root.userData.spriteWalkCell,
          contour = headContour(walkCell === null ? name : "executioner-walk", walkCell ?? frame);
        let removed = 0,
          weaponChanges = 0;
        for (let y = 0; y < 444; y++)
          for (let x = 0; x < 444; x++) {
            const i = (y * 444 + x) * 4;
            if (before[i + 3] > 0 && after[i + 3] === 0) removed++;
            if (
              !containsHead(contour, (x + 0.5) / 444, (y + 0.5) / 444) &&
              before[i + 3] !== after[i + 3]
            )
              weaponChanges++;
          }
        tile(after, `${name} ${frame}`);
        results.push({
          kind,
          frame,
          actual: actor.rig.root.userData.spriteFrame,
          walkCell,
          removed,
          weaponChanges,
          headOnly: fragment.userData.headOnly,
          canonicalRow: fragment.material.map.offset.y > 0.5,
        });
        if (frame === 7) {
          fragment.position.set(0, 0, 0);
          fragment.scale.multiplyScalar(2);
          const head = render(fragment);
          tile(head, `${name} detached`);
        }
        fragment.material.map.dispose();
        fragment.material.dispose();
      }
    }
    g.renderer.setRenderTarget(null);
    g.renderer.setClearColor(clear, clearAlpha);
    target.dispose();
    return results;
  });
  for (const r of result) {
    assert.equal(r.actual, r.frame);
    assert(r.removed > 100, JSON.stringify(r));
    assert.equal(r.weaponChanges, 0, JSON.stringify(r));
    assert(r.headOnly && r.canonicalRow);
  }
  assert.deepEqual(errors, []);
  await page.screenshot({
    path: "docs/screenshots/head-separation-review.png",
    fullPage: true,
  });
  await fs.writeFile(
    "docs/head-separation-verification.json",
    JSON.stringify(
      {
        method:
          "Isolated actual GPU sprite renders across all action frames; alpha outside head contour must remain identical",
        result,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
