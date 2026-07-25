import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleMessages = [];
const pageErrors = [];
page.on("console", msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", err => pageErrors.push(err.stack || err.message));

let stage = "launch";
let pre = null;
let before = null;
let afterWalk = null;
let flight = null;
let fatal = null;
let screenshotError = null;

try {
  stage = "navigate";
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded", timeout: 60_000 });

  stage = "wait-for-boot";
  await page.waitForSelector("#start", { state: "visible", timeout: 90_000 });
  await page.waitForFunction(() => typeof window.render_game_to_text === "function", null, { timeout: 90_000 });

  stage = "preflight-state";
  pre = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (pre.version !== "3.0.0-visual-overhaul") throw new Error(`Unexpected runtime version: ${pre.version}`);
  if (!pre.renderer?.postProcessing || !pre.world?.sectionZero) throw new Error("Production renderer or Section Zero not active");
  if (pre.world.osmRoadSegments < 1000) throw new Error(`Vegas OSM road network did not load: ${pre.world.osmRoadSegments}`);

  stage = "start-game";
  await page.click("#start");
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === "playing", null, { timeout: 15_000 });
  await page.waitForTimeout(2200);

  stage = "runtime-screenshot";
  try {
    await page.screenshot({ path: "smoke-game.png", fullPage: false, animations: "disabled", timeout: 30_000 });
  } catch (error) {
    screenshotError = error?.stack || String(error);
  }

  stage = "movement";
  before = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await page.keyboard.down("w");
  await page.waitForTimeout(1100);
  await page.keyboard.up("w");
  afterWalk = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  const moved = Math.hypot(afterWalk.player.x - before.player.x, afterWalk.player.z - before.player.z);
  if (moved < 1) throw new Error(`Player did not move enough in smoke test: ${moved}; before=${JSON.stringify(before.player)} after=${JSON.stringify(afterWalk.player)}`);

  stage = "flight";
  await page.keyboard.press("f");
  await page.waitForTimeout(350);
  flight = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (!flight.player.flying) throw new Error(`Flight toggle failed: ${JSON.stringify(flight.player)}`);
  await page.keyboard.press("f");

  stage = "canvas";
  const canvas = page.locator("#game-canvas");
  if (await canvas.count() !== 1) throw new Error("Expected exactly one production WebGL canvas");

  stage = "console-errors";
  const serious = [...consoleMessages.filter(e => /^\[error\]/.test(e)), ...pageErrors]
    .filter(e => !/favicon|Failed to load resource.*404/i.test(e));
  if (serious.length) throw new Error(`Browser errors:\n${serious.join("\n")}`);
} catch (error) {
  fatal = error?.stack || String(error);
  throw error;
} finally {
  if (!screenshotError) {
    try { await page.screenshot({ path: "smoke-game-final.png", fullPage: false, animations: "disabled", timeout: 30_000 }); } catch {}
  }
  const report = {
    ok: !fatal,
    stage,
    fatal,
    screenshotError,
    pre,
    before,
    afterWalk,
    flight,
    consoleMessages,
    pageErrors,
  };
  await writeFile("smoke-report.json", JSON.stringify(report, null, 2));
  console.log("JC_SMOKE_REPORT=" + JSON.stringify(report));
  await browser.close();
}
