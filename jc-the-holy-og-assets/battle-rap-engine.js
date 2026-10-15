/* Battle Rap: JC freestyles clean, Devil answers; no API key is ever stored here. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const prompts=[
  "I own these neon streets, got the whole town in a trance.\nYour halo's just a nightlight — you don't stand a chance.",
  "I wear the crown in Vegas, every billboard bears my name.\nYou speak about redemption? You'll have to win my game.",
  "I'm the whisper in the mirror, I'm the voice behind each door.\nYou can win a thousand hearts — I keep coming back for more."
];
const stopWords=new Set('the and that with this your from have they them were what when that just more than into here over each will would could about because there where then their been come time like only dont a an are you for not but who its how out one two can all she he i me we my our your to of at in on is it am as be do did get got by or so if now up down was had has'.split(' '));
const modelEndpoint=typeof window.JC_RAP_AI_ENDPOINT==='string'?window.JC_RAP_AI_ENDPOINT.trim():'';
const state={phase:'ready',round:0,jc:0,devil:0,session:0,mic:null,listening:false,voiceFinal:'',audio:null,beatId:null,step:0,sound:false,history:[]};
function set(id,value){$(id).textContent=String(value)}
function addVerseLine(who,verse,mode){
  set('speaker',who);set('cue',mode);set('verse',verse);
}
function setCrowd(){
 const percent=state.jc+state.devil?Math.round(state.jc*100/(state.jc+state.devil)):50;
 set('crowdText',percent+'%');$('crowdFill').style.width=percent+'%';
}
function updateScores(){
 set('jcScore',state.jc);set('devilScore',state.devil);
 set('round',state.phase==='finished'?'FINAL VERDICT':'ROUND '+(state.round+1)+' / '+prompts.length);
 setCrowd();
}
function setMode(label){set('mode',label)}
function stopMic(){
 const mic=state.mic;state.mic=null;state.listening=false;
 if(mic){mic.onend=null;mic.onresult=null;mic.onerror=null;try{mic.stop()}catch(_e){}}
 set('micBtn','MIC: OFF');$('micBtn').setAttribute('aria-pressed','false')
}
function setMessage(message){set('guardStatus',message)}
function setControls(active){
 $('submitBar').disabled=!active;$('barInput').disabled=!active;
 $('micBtn').disabled=!active||!(window.SpeechRecognition||window.webkitSpeechRecognition);
}
function showRound(){
 state.phase='input';stopMic();$('result').hidden=true;$('restart').hidden=true;$('primary').hidden=true;
 $('playerArea').hidden=false;$('jcRecap').hidden=true;$('barInput').value='';
 $('charCount').textContent='0 / 600';setControls(true);
 addVerseLine('THE DEVIL // ROUND '+(state.round+1),prompts[state.round],'DEVIL CHALLENGES JC');
 set('prompt','YOUR TURN — FREESTYLE WITH NO CURSING');
 setMessage('STRICT CLEAN-LANGUAGE RULE: JC loses immediately if a curse is performed.');
 updateScores();$('barInput').focus({preventScroll:true});
}
function wordsOf(v){return (v.toLowerCase().match(/[a-z']+/g)||[])}
function gradeVerse(v){
 const lines=v.split(/\n+/).map(s=>s.trim()).filter(Boolean);
 const words=wordsOf(v);const unique=new Set(words);
 const theme=['devil','crown','throne','vegas','soul','truth','freedom','light','dark','night','lie','lies','city','holy','heaven','king','redeem','chain','fire'];
 const topic=theme.filter(w=>unique.has(w)).length;
 const endings=lines.map(line=>(wordsOf(line).slice(-1)[0]||'')).filter(Boolean);
 let rhyme=0;for(let i=1;i<endings.length;i++){const a=endings[i-1],b=endings[i];if(a!==b&&a.length>3&&b.length>3&&a.slice(-3)===b.slice(-3))rhyme+=10;}
 const punchline=/\b(but|yet|while|instead|never|can't|cannot|ain't|not|without|even)\b/i.test(v)?10:0;
 return Math.min(105,Math.round(35+Math.min(words.length,38)*.8+Math.min(lines.length,4)*5+Math.min(topic,3)*5+Math.min(rhyme,15)+punchline+(unique.size>15?4:0)));
}
function localReply(verse,round){
 const words=wordsOf(verse).filter(x=>x.length>=4&&!stopWords.has(x));
 const topic=words.find(x=>['light','crown','truth','freedom','city','vegas','soul','king','throne','night','fire','chain','darkness','redeem','heaven'].includes(x))||'light';
 const openings=[
   ["You mentioned "+topic+", but I still own these lights.","You swing a shining sentence — I survive a thousand nights."],
   ["You keep talking "+topic+" like the crowd is yours to claim.","I bend the neon shadows, let the whole Strip chant my name."],
   ["I heard you bring up "+topic+" — every syllable hit the floor.","But to tear down my kingdom, you'll need something more."]
 ];
 const choice=openings[round%openings.length];
 return choice.join('\n');
}
function validModelReply(value){
 return typeof value==='string'&&value.trim().length>=10&&value.length<=700?value.trim():null
}
async function devilReply(verse,round,history){
 if(!modelEndpoint)return {reply:localReply(verse,round),origin:'LOCAL RIVAL • RULE-BASED'};
 // Only allow configured HTTPS or same-origin endpoints; never pass keys in client code.
 let url;
 try{url=new URL(modelEndpoint,location.href);if(url.protocol!=='https:'&&url.origin!==location.origin)throw Error('HTTPS required')}catch(_e){return {reply:localReply(verse,round),origin:'LOCAL RIVAL • INVALID AI URL'}}
 try{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),9000);
  try{
   const response=await fetch(url.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({verse,round:round+1,history:history.slice(-4)}),signal:controller.signal,credentials:'omit',cache:'no-store'});
   if(!response.ok)throw Error('AI returned '+response.status);
   const data=await response.json();
   const reply=validModelReply(data.reply);
   if(!reply)throw Error('Empty AI reply');
   return {reply,origin:'LIVE AI DEVIL'};
  }finally{clearTimeout(timeout)}
 }catch(e){console.warn('JC: AI unavailable, using local rival',e);return {reply:localReply(verse,round),origin:'LOCAL RIVAL • AI UNAVAILABLE'}}
}
function showLoss(){
 state.session++;stopMic();state.phase='finished';$('playerArea').hidden=true;$('primary').hidden=true;
 $('restart').hidden=false;$('result').hidden=false;$('jcRecap').hidden=true;
 set('round','DISQUALIFIED');set('prompt','BATTLE OVER — JC BROKE THE CLEAN-LANGUAGE RULE');
 addVerseLine('THE DEVIL // VICTORY','"You had the stage, but you broke the rule.\nI take this crown; keep your next verse cool."','INSTANT LOSS');
 set('resultTitle','JC LOSES — CURSE DETECTED');
 set('resultText','No profanity allowed, including disguised spellings. The round ends immediately.');set('resultScore','THE DEVIL WINS BY DISQUALIFICATION');
 setCrowd()
}
function finish(){
 state.phase='finished';$('playerArea').hidden=true;$('primary').hidden=true;$('restart').hidden=false;
 $('result').hidden=false;set('round','FINAL VERDICT');
 const win=state.jc>state.devil,tie=state.jc===state.devil;
 set('prompt',win?'JC TAKES BACK THE STRIP':tie?'DRAW — THE CROWD WANTS MORE':'THE DEVIL KEEPS THE MIC');
 set('resultTitle',win?'JC WINS — NO CURSES':tie?'DRAW BATTLE':'THE DEVIL WINS');
 set('resultText',win?'Clean bars and strong responses won the crowd.':tie?'Clean verses, but both sides scored the same.':'JC kept it clean, but the Devil scored higher this time.');
 set('resultScore','FINAL: JC '+state.jc+' / DEVIL '+state.devil);
 updateScores()
}
async function submitBar(e){
 if(e)e.preventDefault();
 if(state.phase!=='input')return;
 const verse=$('barInput').value.trim();
 if(!verse){setMessage('Write or speak JC’s bars first.');$('barInput').focus();return}
 if(verse.length>600){setMessage('Maximum 600 characters per round.');return}
 // Non-negotiable: check BEFORE calling the AI or scoring. No retry for a performed curse.
 if(window.JCRapGuard.detectProfanity(verse).detected){showLoss();return}
 stopMic();state.phase='waiting';setControls(false);
 set('prompt','THE DEVIL IS PREPARING HIS RESPONSE…');set('guardStatus','CLEAN VERSE ACCEPTED');
 $('jcRecap').hidden=false;set('jcBars',verse);
 const score=gradeVerse(verse);const round=state.round;const ticket=state.session;
 const response=await devilReply(verse,round,state.history);
 if(ticket!==state.session||state.phase!=='waiting')return;
 const rivalScore=[72,78,84][round];state.jc+=score;state.devil+=rivalScore;
 state.history.push({jc:verse,devil:response.reply});
 state.phase='after';$('playerArea').hidden=true;
 addVerseLine('THE DEVIL // COUNTERATTACK',response.reply,response.origin);
 $('result').hidden=false;
 set('resultTitle',score>rivalScore?'JC TAKES THE ROUND':score===rivalScore?'ROUND DRAW':'DEVIL TAKES THE ROUND');
 set('resultText','JC kept his verse clean. The Devil answered.');
 set('resultScore','JC +'+score+' / DEVIL +'+rivalScore);
 set('prompt','ROUND '+(round+1)+' COMPLETE — '+response.origin);
 $('primary').hidden=false;set('primary',round===prompts.length-1?'FINAL VERDICT':'NEXT ROUND');
 updateScores();
}
function toggleMic(){
 if(state.phase!=='input')return;
 if(state.listening){stopMic();return}
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Recognition){setMessage('Speech recognition is unavailable on this browser. Type your verse.');return}
 try{
  const mic=new Recognition();mic.lang='en-US';mic.continuous=true;mic.interimResults=true;state.mic=mic;state.listening=true;
  mic.onresult=function(event){
   if(state.phase!=='input')return;
   let final='',interim='';
   for(let i=event.resultIndex;i<event.results.length;i++){
    const item=event.results[i];
    if(item.isFinal)final+=' '+item[0].transcript;
    else interim+=' '+item[0].transcript
   }
   if(final){
    const newWords=final.trim();
    if(window.JCRapGuard.detectProfanity(newWords).detected){showLoss();return}
    const old=$('barInput').value.trim();$('barInput').value=(old?old+' ':'')+newWords;
    $('barInput').value=$('barInput').value.slice(0,600);
    updateCharCount()
   }
   if(interim.trim())setMessage('HEARING: '+interim.trim().slice(0,90)+' … (rule checked on final recognition)');
   else setMessage('Listening — clean bars only. Tap MIC again to stop.')
  };
  mic.onerror=e=>{if(state.phase==='input'){setMessage('Microphone unavailable ('+(e.error||'error')+'). You can type your verse.');stopMic()}};
  mic.onend=()=>{if(state.mic===mic){state.mic=null;state.listening=false;set('micBtn','MIC: OFF');$('micBtn').setAttribute('aria-pressed','false')}};
  mic.start();set('micBtn','MIC: ON');$('micBtn').setAttribute('aria-pressed','true');setMessage('Listening — no profanity allowed.')
 }catch(e){stopMic();setMessage('Could not start mic. Type your verse instead.')}
}
function updateCharCount(){
 const v=$('barInput').value;set('charCount',v.length+' / 600');
 if(state.phase!=='input')return;
 const bad=window.JCRapGuard.detectProfanity(v).detected;
 setMessage(bad?'CURSE IN DRAFT — submitting this will immediately lose the battle.':'CLEAN VERSE RULE: no cursing. Submit your original bars.');
 $('guardStatus').style.color=bad?'#ff7777':'#a8e9b8'
}
function start(){
 state.session++;stopMic();state.round=0;state.jc=0;state.devil=0;state.history=[];showRound();
}
function playTone(type,freq,duration,vol){
 if(!state.audio)return;
 const audio=state.audio,t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();
 o.type=type;o.frequency.setValueAtTime(freq,t);if(type==='sine')o.frequency.exponentialRampToValueAtTime(Math.max(42,freq*.55),t+duration);
 g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+duration+.03);
}
function beat(){
 if(!state.sound||!state.audio||document.hidden)return;
 const tick=state.step++%16;
 try{if(tick%4===0)playTone('sine',145,.19,.085);if(tick===4||tick===12)playTone('triangle',195,.095,.035);if(tick%2===0)playTone('square',750,.018,.004)}
 catch(e){stopAudio()}
}
function stopAudio(){
 if(state.beatId){clearInterval(state.beatId);state.beatId=null}state.sound=false;
 set('sound','BEAT: OFF');$('sound').setAttribute('aria-pressed','false')
}
function toggleAudio(){
 if(state.sound){stopAudio();return}
 const Ctx=window.AudioContext||window.webkitAudioContext;
 if(!Ctx){set('sound','AUDIO UNAVAILABLE');return}
 try{if(!state.audio)state.audio=new Ctx();state.audio.resume();state.sound=true;state.step=0;set('sound','BEAT: ON');$('sound').setAttribute('aria-pressed','true');beat();state.beatId=setInterval(beat,175)}
 catch(e){stopAudio()}
}
function leave(){
 state.session++;stopMic();stopAudio();
 if(window.parent!==window)window.parent.postMessage({type:'jc:close-rap-battle'},location.origin);
 else location.href='./index.html'
}
$('primary').addEventListener('click',()=>{
 if(state.phase==='ready')start();
 else if(state.phase==='after'){state.round++;if(state.round>=prompts.length)finish();else showRound()}
});
$('rapForm').addEventListener('submit',submitBar);
$('barInput').addEventListener('input',updateCharCount);
$('micBtn').addEventListener('click',toggleMic);
$('restart').addEventListener('click',start);
$('sound').addEventListener('click',toggleAudio);
$('leave').addEventListener('click',leave);
addEventListener('keydown',e=>{if(e.key==='Escape'){leave();return}if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&state.phase==='input'){e.preventDefault();submitBar()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMic();if(state.sound)stopAudio()}});
addEventListener('pagehide',()=>{state.session++;stopMic();stopAudio()});
setMode(modelEndpoint?'AI ENDPOINT CONFIGURED':'LOCAL RIVAL (AI NOT CONNECTED)');
$('micBtn').disabled=!(window.SpeechRecognition||window.webkitSpeechRecognition);
updateScores();
})();