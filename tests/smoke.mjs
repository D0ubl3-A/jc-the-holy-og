import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"],
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

  stage = "start-game";
  await page.click("#start");
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === "playing", null, { timeout: 15_000 });
  await page.waitForTimeout(2200);

  stage = "movement";
  before = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1100);
  await page.keyboard.up("KeyW");
  afterWalk = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  const moved = Math.hypot(afterWalk.player.x - before.player.x, afterWalk.player.z - before.player.z);
  if (moved < 1) throw new Error(`Player did not move enough in smoke test: ${moved}; before=${JSON.stringify(before.player)} after=${JSON.stringify(afterWalk.player)}`);

  stage = "flight";
  await page.keyboard.press("KeyF");
  await page.waitForTimeout(350);
  flight = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  if (!flight.player.flying) throw new Error(`Flight toggle failed: ${JSON.stringify(flight.player)}`);
  await page.keyboard.press("KeyF");

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
  try { await page.screenshot({ path: "smoke-game.png", fullPage: true }); } catch {}
  const report = {
    ok: !fatal,
    stage,
    fatal,
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
