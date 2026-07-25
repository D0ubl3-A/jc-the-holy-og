import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("pageerror", err => consoleErrors.push(err.stack || err.message));

try {
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("#start", { state: "visible", timeout: 90_000 });
  await page.waitForFunction(() => typeof window.render_game_to_text === "function", null, { timeout: 90_000 });

  const pre = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (pre.version !== "3.0.0-visual-overhaul") throw new Error(`Unexpected runtime version: ${pre.version}`);
  if (!pre.renderer?.postProcessing || !pre.world?.sectionZero) throw new Error("Production renderer or Section Zero not active");

  await page.click("#start");
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === "playing", null, { timeout: 15_000 });
  await page.waitForTimeout(2500);

  const before = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(900);
  await page.keyboard.up("KeyW");
  const afterWalk = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  const moved = Math.hypot(afterWalk.player.x - before.player.x, afterWalk.player.z - before.player.z);
  if (moved < 1) throw new Error(`Player did not move enough in smoke test: ${moved}`);

  await page.keyboard.press("KeyF");
  await page.waitForTimeout(250);
  const flight = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (!flight.player.flying) throw new Error("Flight toggle failed");
  await page.keyboard.press("KeyF");

  const canvas = page.locator("#game-canvas");
  if (await canvas.count() !== 1) throw new Error("Expected exactly one production WebGL canvas");
  await page.screenshot({ path: "smoke-game.png", fullPage: true });

  const serious = consoleErrors.filter(e => !/favicon|Failed to load resource.*404/i.test(e));
  if (serious.length) throw new Error(`Browser errors:\n${serious.join("\n")}`);
  console.log(JSON.stringify({ ok: true, before, afterWalk, flight, consoleErrors }, null, 2));
} finally {
  await browser.close();
}
