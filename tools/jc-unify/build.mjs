/**
 * JC unified-world GLB export.
 *
 * Takes every checked-in root C##_R##.glb, applies the SAME scale and global
 * tile-grid transform as the playable Three.js renderer, and puts all meshes
 * under one glTF scene. Never mutate or flatten the originals: the runtime
 * still streams those for browsers and mobile devices.
 *
 * node tools/jc-unify/build.mjs [repositoryRoot] [outputGlb]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { getBounds, mergeDocuments, unpartition } from '@gltf-transform/functions';

const root = path.resolve(process.argv[2] || '.');
const output = path.resolve(process.argv[3] || path.join(root, 'dist', 'JC-UNIFIED-CITY.glb'));
const pattern = /^C(\d+)_R(\d+)\.glb$/i;
const TILE_SCALE = 0.1, TILE_SIZE = 100, ORIGIN_COL = 8, ORIGIN_ROW = 8;
const names = (await fs.readdir(root)).filter(n => pattern.test(n)).sort();
if (!names.length) throw new Error('No root C##_R##.glb files: refusing empty city');
const source = new NodeIO();
const target = new Document();
const united = target.createScene('JC — ONE CONTINUOUS LAS VEGAS WORLD');
target.getRoot().setDefaultScene(united);
let merged = 0;
let totalSourceBytes = 0;
let countWithGeometry = 0;
const ledger = [];

for (const name of names) {
  const [, cs, rs] = pattern.exec(name);
  const col = Number(cs), row = Number(rs);
  const file = path.join(root, name);
  const stat = await fs.stat(file);
  const doc = await source.read(file);
  const scenes = doc.getRoot().listScenes();
  if (!scenes.length) throw new Error(name + ' has no scene');
  const scene = doc.getRoot().getDefaultScene() || scenes[0];
  const bounds = getBounds(scene);
  const minY = Number.isFinite(bounds.min[1]) ? bounds.min[1] : 0;
  const contents = scene.listChildren().length;
  if (contents) countWithGeometry++;
  // Map local 1000m tile contents into the same 100m world cell as JC runtime.
  // Set both transform and exact shared floor before adding to one scene.
  const tileRoot = target.createNode(name.replace(/\.glb$/i, ''))
    .setTranslation([(col - ORIGIN_COL) * TILE_SIZE, -minY * TILE_SCALE, -(row - ORIGIN_ROW) * TILE_SIZE])
    .setScale([TILE_SCALE, TILE_SCALE, TILE_SCALE])
    .setExtras({ source: name, col, row, originalBytes: stat.size, provenance: 'JC checked-in GLB' });
  const mapped = mergeDocuments(target, doc);
  const imported = mapped.get(scene);
  if (!imported) throw new Error(name + ' scene was not merged');
  for (const child of imported.listChildren()) tileRoot.addChild(child);
  united.addChild(tileRoot);
  imported.dispose();
  merged++;
  totalSourceBytes += stat.size;
  ledger.push({ file: name, col, row, bytes: stat.size, children: contents });
  if (merged % 10 === 0 || merged === names.length) {
    console.log('Merged', merged, '/', names.length, name);
  }
}
if (merged !== names.length) throw new Error('Incomplete city merge');
await target.transform(unpartition());
await fs.mkdir(path.dirname(output), { recursive: true });
await source.write(output, target);
const outputStat = await fs.stat(output);
if (!outputStat.size) throw new Error('Empty united model');
const manifest = {
  schema: 'jc-unified-world-v1', kind: 'one-scene-glb-export',
  scene: 'JC — ONE CONTINUOUS LAS VEGAS WORLD',
  sourceTileCount: names.length, mergedTileCount: merged, nonemptySceneCount: countWithGeometry,
  sourceBytes: totalSourceBytes, outputBytes: outputStat.size,
  tileSourceSizeMeters: 1000, worldScale: TILE_SCALE, origin: { col: ORIGIN_COL, row: ORIGIN_ROW },
  note: 'Single GLB offline/export asset. Browser gameplay uses LOD + selective loading to prevent mobile GPU overload.',
  tiles: ledger
};
const indexPath = path.join(path.dirname(output), 'JC-UNIFIED-CITY-manifest.json');
await fs.writeFile(indexPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ success: true, output, indexPath, mergedTiles: merged, outputMB: +(outputStat.size / 1048576).toFixed(1) }, null, 2));
