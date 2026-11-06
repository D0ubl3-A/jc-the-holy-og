#!/usr/bin/env node
// JC production planner: reserves frame IDs; it does NOT render images.
// Usage: node tools/jc-frame-plan.mjs [output-directory]
// No dependencies. Deterministic, restartable manifests for three workers.
import fs from 'node:fs';
import path from 'node:path';
const out = path.resolve(process.argv[2] || 'generated/jc-frame-plan');
const categories = [
 ['jc-motion',12,15000,0],['divine-abilities',18,25000,0],
 ['npc-police-enemies',18,30000,1],['vehicles',12,20000,1],
 ['casino-signage',20,40000,0],['weather',10,15000,1],
 ['destruction',14,25000,2],['heaven-hell',16,30000,2],
 ['water-fire-electricity',10,15000,1],['missions',10,20000,2],
 ['ui-equipment',10,15000,1]
];
const lanes = ['jc-character-powers','vegas-world-traffic','vfx-weather-supernatural'];
const groups=[]; let globalFrame=0;
for(const [category,n,total,lane] of categories) {
 for(let i=0;i<n;i++) {
  const count=Math.floor(total/n)+(i<total%n?1:0);
  groups.push({id:`${category}-${String(i+1).padStart(2,'0')}`,category,lane:lanes[lane],start:globalFrame,count});
  globalFrame+=count;
 }
}
if(groups.length!==150 || globalFrame!==250000) throw Error('Production budget mismatch');
fs.mkdirSync(out,{recursive:true});
const batchSize=10000, batches=[];
for(let start=0;start<globalFrame;start+=batchSize){
 const end=Math.min(start+batchSize,globalFrame);
 const overlaps=groups.filter(g=>g.start<end && g.start+g.count>start)
  .map(g=>({group:g.id,start:Math.max(start,g.start),count:Math.min(end,g.start+g.count)-Math.max(start,g.start)}));
 batches.push({id:`batch-${String(batches.length+1).padStart(3,'0')}`,start,count:end-start,groups:overlaps,
 status:'planned',rendered:0,validated:0});
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({
 schema:1,description:'Reserved source-frame IDs, not generated frames',
 targetFrames:globalFrame,verifiedFrames:0,groups,batches
},null,2)+'\n');
for(const [i,lane] of lanes.entries()) {
 const jobs=groups.filter(g=>g.lane===lane);
 fs.writeFileSync(path.join(out,`${lane}.json`),JSON.stringify({
 lane,minuteOffset:i*20,requestedFramesPerRun:10000,
 scheduleNote:'External scheduler required; GitHub Actions cron is not guaranteed to fire exactly on the minute.',
 groups:jobs,renderedFrames:0
 },null,2)+'\n');
}
console.log(`Planned ${globalFrame} source frames, ${groups.length} groups, ${batches.length} batches. Generated frames: 0. Output: ${out}`);
