'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const guardSource=fs.readFileSync(path.join(root,'jc-the-holy-og-assets/rap-guard.js'),'utf8');
const context={};
vm.runInNewContext(guardSource,context,{timeout:1000});
const guard=context.JCRapGuard;
assert.ok(guard,'guard exported to global');
const examples=[
 ['I bring light to the city',false],
 ['classical rap on stage',false],
 ["He'll never win",false],
 ["she'll rise above",false],
 ['hello vegas',false],
 ['The whole world hears',false],
 ['This line is hell',true],
 ['damn',true],
 ['crap',true],
 ['Sh!t',true],
 ['sh*t',true],
 ['f*ck',true],
 ['b*tch',true],
 ['f.u.c.k',true],
 ['f u c k',true],
 ['mother-fucker',true],
 ['You little b!tch',true],
 ['bullsh1t',true],
 ['a55hole',true],
 ['My crown will never fall',false]
];
for(const [line,expected] of examples){
 assert.equal(guard.detectProfanity(line).detected,expected,JSON.stringify(line));
}
const html=fs.readFileSync(path.join(root,'battle-rap.html'),'utf8');
const engine=fs.readFileSync(path.join(root,'jc-the-holy-og-assets/battle-rap-engine.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'workers/jc-rap-ai.js'),'utf8');
new vm.Script(engine,{filename:'battle-rap-engine.js'});
for(const id of ['rapForm','barInput','submitBar','micBtn','guardStatus','jcBars','result','primary','restart','mode']){
 assert.ok(html.includes('id="'+id+'"'),'Missing game element '+id);
}
for(const name of ['rap-guard.js','battle-rap-engine.js','rap-config.js']){
 assert.ok(html.includes(name),'Missing runtime script '+name);
}
assert.ok(engine.includes('if(window.JCRapGuard.detectProfanity(verse).detected){showLoss();return}'),'Must disqualify before response');
assert.ok(worker.includes('globalThis.JCRapGuard.detectProfanity(input).detected'),'Worker must use shared guard');
assert.ok(worker.includes('env.OPENAI_API_KEY'),'Model token must stay server-side');
console.log('PASS JC Battle Rap profanity, markup, model proxy checks ('+examples.length+' language cases)');
