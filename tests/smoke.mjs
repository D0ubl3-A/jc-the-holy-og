import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({
  headless: false,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--disable-dev-shm-usage",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-features=CalculateNativeWinOcclusion",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.bringToFront();
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });

const consoleMessages = [];
const pageErrors = [];
const badResponses = [];
page.on("console", msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", err => pageErrors.push(err.stack || err.message));
page.on("response", response => {
  if (response.status() >= 400) badResponses.push({ status: response.status(), url: response.url() });
});

let stage = "launch";
let pre = null;
let before = null;
let afterWalk = null;
let flight = null;
let fatal = null;
let screenshotError = null;
let inputEvents = [];
let animationTicks = null;

try {
  stage = "navigate";
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.bringToFront();

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
  await page.waitForTimeout(500);

  animationTicks = await page.evaluate(async () => {
    let count = 0;
    await new Promise(resolve => {
      const started = performance.now();
      const tick = () => {
        count++;
        if (performance.now() - started >= 500) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return count;
  });

  await page.evaluate(() => {
    window.__jcSmokeInputs = [];
    window.addEventListener("keydown", e => window.__jcSmokeInputs.push({ type: "down", code: e.code, key: e.key, time: performance.now() }));
    window.addEventListener("keyup", e => window.__jcSmokeInputs.push({ type: "up", code: e.code, key: e.key, time: performance.now() }));
  });

  stage = "movement";
  before = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  await page.keyboard.down("w");
  try {
    await page.waitForFunction(
      origin => {
        const state = JSON.parse(window.render_game_to_text());
        return Math.hypot(state.player.x - origin.x, state.player.z - origin.z) >= 1;
      },
      { x: before.player.x, z: before.player.z },
      { timeout: 18_000, polling: 100 }
    );
  } finally {
    await page.keyboard.up("w");
  }
  await page.waitForTimeout(150);
  afterWalk = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  inputEvents = await page.evaluate(() => window.__jcSmokeInputs || []);
  const moved = Math.hypot(afterWalk.player.x - before.player.x, afterWalk.player.z - before.player.z);
  if (moved < 1) throw new Error(`Player movement failed: ${moved}; rAF=${animationTicks}; inputs=${JSON.stringify(inputEvents)}; before=${JSON.stringify(before.player)} after=${JSON.stringify(afterWalk.player)}`);

  stage = "flight";
  await page.keyboard.press("f");
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).player.flying === true, null, { timeout: 5_000, polling: 100 });
  flight = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  inputEvents = await page.evaluate(() => window.__jcSmokeInputs || []);
  await page.keyboard.press("f");

  stage = "canvas";
  const canvas = page.locator("#game-canvas");
  if (await canvas.count() !== 1) throw new Error("Expected exactly one production WebGL canvas");

  stage = "resource-errors";
  const nonFaviconResponses = badResponses.filter(r => !/\/favicon\.ico(?:$|\?)/i.test(r.url));
  if (nonFaviconResponses.length) throw new Error(`HTTP resource failures:\n${JSON.stringify(nonFaviconResponses, null, 2)}`);

  stage = "console-errors";
  const seriousPageErrors = [...pageErrors];
  if (seriousPageErrors.length) throw new Error(`Page errors:\n${seriousPageErrors.join("\n")}`);

  stage = "capture";
  try {
    const result = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    await writeFile("smoke-game.png", Buffer.from(result.data, "base64"));
  } catch (error) {
    screenshotError = error?.stack || String(error);
  }
} catch (error) {
  fatal = error?.stack || String(error);
  throw error;
} finally {
  inputEvents = inputEvents.length ? inputEvents : await page.evaluate(() => window.__jcSmokeInputs || []).catch(() => []);
  const report = {
    ok: !fatal,
    stage,
    fatal,
    screenshotError,
    animationTicks,
    inputEvents,
    badResponses,
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
