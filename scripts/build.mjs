import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { build } from "esbuild";

let html = await readFile("index.html", "utf8");
const sections = await readFile(
  "public/jc-the-holy-og-assets/vegas-sections.js",
  "utf8",
);
const osmRoads = await readFile(
  "public/jc-the-holy-og-assets/vegas-roads.js",
  "utf8",
);
const reconstructionStatusHtml = await readFile(
  "public/status/index.html",
  "utf8",
);
const reconstructionStatusFiles = {};
for (const entry of await readdir("public/status/data", { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  reconstructionStatusFiles[`/status/data/${entry.name}`] = await readFile(
    `public/status/data/${entry.name}`,
    "utf8",
  );
}

html = html
  .replace(
    '<script src="./jc-the-holy-og-assets/vegas-roads.js"></script>',
    `<script>${osmRoads}</script>`,
  )
  .replace(
    '<script src="./jc-the-holy-og-assets/vegas-sections.js"></script>',
    `<script>${sections}</script>`,
  );

const moduleMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!moduleMatch) throw new Error("Game module was not found in index.html");
const moduleSource = moduleMatch[1]
  .replace(
    'from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js"',
    'from "three/examples/jsm/loaders/GLTFLoader.js"',
  )
  .replace(
    'from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/meshopt_decoder.module.js"',
    'from "three/examples/jsm/libs/meshopt_decoder.module.js"',
  );
// The legacy game source contains a duplicated helper and an incorrectly
// immutable route list. Normalize those two build-time defects without
// changing the gameplay source or asset layout.
let trafficVehicleDeclaration = 0;
const normalizedModuleSource = moduleSource
  .replace(/function makeTrafficVehicle\(index\)\{/g, (match) => {
    trafficVehicleDeclaration += 1;
    return trafficVehicleDeclaration === 1
      ? match
      : "function makeTrafficVehicleLegacy(index){";
  })
  .replace("const buildingPortals=[],trafficActors=[],trafficSignals=[],stripSidewalkRoutes=[];", "const buildingPortals=[],trafficActors=[],trafficSignals=[];let stripSidewalkRoutes=[];");
const bundled = await build({
  stdin: {
    contents: normalizedModuleSource,
    resolveDir: process.cwd(),
    sourcefile: "game-entry.js",
    loader: "js",
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  write: false,
  legalComments: "none",
});
const bundledSource = bundled.outputFiles[0].text;
const bundleHash = createHash("sha256")
  .update(bundledSource)
  .digest("hex")
  .slice(0, 12);
const bundlePath = `/assets/game.${bundleHash}.js`;
html = html
  .replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, "")
  .replace(
    moduleMatch[0],
    `<script type="module" src="${bundlePath}"></script>`,
  );

const libraryAssetDirectory = "public/library-assets";
const mimeTypes = {
  ".glb": "model/gltf-binary",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};
async function collectLibraryAssets(
  directory,
  routePrefix = "/library-assets",
) {
  const assets = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = `${directory}/${entry.name}`;
    const route = `${routePrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      Object.assign(assets, await collectLibraryAssets(filePath, route));
      continue;
    }
    const extension = entry.name.slice(entry.name.lastIndexOf("."));
    const body = await readFile(filePath);
    assets[route] = {
      body: body.toString("base64"),
      contentType: mimeTypes[extension] || "application/octet-stream",
      etag: `"${createHash("sha256").update(body).digest("hex").slice(0, 24)}"`,
      size: (await stat(filePath)).size,
    };
  }
  return assets;
}
const libraryAssets = await collectLibraryAssets(libraryAssetDirectory);
const worker = [
  "const GAME_HTML = " + JSON.stringify(html) + ";",
  "const GAME_JS = " + JSON.stringify(bundledSource) + ";",
  "const BUNDLE_PATH = " + JSON.stringify(bundlePath) + ";",
  "const STATUS_HTML = " + JSON.stringify(reconstructionStatusHtml) + ";",
  "const STATUS_FILES = " + JSON.stringify(reconstructionStatusFiles) + ";",
  "const LIBRARY_ASSETS = " + JSON.stringify(libraryAssets) + ";",
  "const decodedAssets = new Map();",
  "function decodeAsset(path, encoded) {",
  "  let body = decodedAssets.get(path);",
  "  if (body) return body;",
  "  const binary = atob(encoded);",
  "  body = new Uint8Array(binary.length);",
  "  for (let i = 0; i < binary.length; i++) body[i] = binary.charCodeAt(i);",
  "  decodedAssets.set(path, body);",
  "  return body;",
  "}",
  "export default {",
  "  async fetch(request) {",
  "    const url = new URL(request.url);",
  "    if (url.pathname === '/health') {",
  "      return Response.json({ ok: true, game: 'JC The Holy OG' });",
  "    }",
  "    if (url.pathname === '/status' || url.pathname === '/status/' || url.pathname === '/status/index.html') {",
  "      return new Response(request.method === 'HEAD' ? null : STATUS_HTML, {",
  "        status: 200,",
  "        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' }",
  "      });",
  "    }",
  "    if (Object.prototype.hasOwnProperty.call(STATUS_FILES, url.pathname)) {",
  "      const contentType = url.pathname.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8';",
  "      return new Response(request.method === 'HEAD' ? null : STATUS_FILES[url.pathname], {",
  "        status: 200,",
  "        headers: { 'content-type': contentType, 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' }",
  "      });",
  "    }",
  "    if (url.pathname === BUNDLE_PATH) {",
  "      return new Response(request.method === 'HEAD' ? null : GAME_JS, {",
  "        status: 200,",
  "        headers: {",
  "          'content-type': 'text/javascript; charset=utf-8',",
  "          'cache-control': 'public, max-age=31536000, immutable',",
  "          'x-content-type-options': 'nosniff'",
  "        }",
  "      });",
  "    }",
  "    const libraryAsset = LIBRARY_ASSETS[url.pathname];",
  "    if (libraryAsset) {",
  "      const notModified = request.headers.get('if-none-match') === libraryAsset.etag;",
  "      if (notModified) return new Response(null, { status: 304, headers: { etag: libraryAsset.etag } });",
  "      return new Response(request.method === 'HEAD' ? null : decodeAsset(url.pathname, libraryAsset.body), {",
  "        status: 200,",
  "        headers: {",
  "          'content-type': libraryAsset.contentType,",
  "          'content-length': String(libraryAsset.size),",
  "          'cache-control': 'public, max-age=31536000, immutable',",
  "          etag: libraryAsset.etag,",
  "          'x-content-type-options': 'nosniff'",
  "        }",
  "      });",
  "    }",
  "    if (url.pathname === '/' || url.pathname === '/index.html') {",
  "      return new Response(request.method === 'HEAD' ? null : GAME_HTML, {",
  "        status: 200,",
  "        headers: {",
  "          'content-type': 'text/html; charset=utf-8',",
  "          'cache-control': 'no-cache',",
  "          'x-content-type-options': 'nosniff'",
  "        }",
  "      });",
  "    }",
  "    return new Response(request.method === 'HEAD' ? null : 'Not found', {",
  "      status: 404,",
  "      headers: {",
  "        'content-type': 'text/plain; charset=utf-8',",
  "        'cache-control': 'no-store',",
  "        'x-content-type-options': 'nosniff'",
  "      }",
  "    });",
  "  }",
  "};",
  "",
].join("\n");

await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await writeFile("dist/server/index.js", worker, "utf8");
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
