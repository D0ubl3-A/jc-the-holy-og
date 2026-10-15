/* JC Battle Rap launcher. Loads the arena only on demand, preserving the current world session. */
(function(){
'use strict';
if(document.getElementById('jcRapOpen'))return;
var open=document.createElement('button');
open.type='button';open.id='jcRapOpen';open.textContent='🎤 JC VS DEVIL • RAP BATTLE';
open.setAttribute('aria-label','Open JC versus the Devil battle rap mode');
open.style.cssText='position:fixed;right:12px;top:76px;z-index:19;padding:12px 13px;max-width:200px;border:2px solid #ffe08e;border-radius:11px;background:linear-gradient(120deg,#572342,#221b32);color:#fff;font:900 12px/1.25 Arial,sans-serif;box-shadow:0 5px 22px #0009;cursor:pointer;letter-spacing:.03em;touch-action:manipulation';
document.body.appendChild(open);
var veil=null,frame=null,priorFocus=null;
function closeBattle(){
 if(!veil)return;
 veil.remove();veil=null;frame=null;
 open.focus();document.body.style.removeProperty('overscroll-behavior');
}
function openBattle(){
 if(veil)return;
 priorFocus=document.activeElement;
 veil=document.createElement('div');veil.id='jcRapOverlay';veil.setAttribute('role','dialog');veil.setAttribute('aria-label','JC versus the Devil battle rap');veil.setAttribute('aria-modal','true');
 veil.style.cssText='position:fixed;inset:0;background:#090810;z-index:1000;display:flex;flex-direction:column';
 var bar=document.createElement('div');bar.style.cssText='flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;padding:5px 12px;background:#130e1c;border-bottom:1px solid #594b59;color:#ffde85;font:900 11px Arial';
 var title=document.createElement('span');title.textContent='JC THE HOLY OG // BATTLE RAP';
 var close=document.createElement('button');close.type='button';close.textContent='BACK TO GAME ✕';close.style.cssText='min-height:40px;background:#322638;color:white;border:1px solid #806677;border-radius:8px;padding:8px 12px;font:bold 12px Arial;cursor:pointer';close.addEventListener('click',closeBattle);
 bar.append(title,close);
 frame=document.createElement('iframe');frame.title='JC vs Devil playable battle rap';frame.src='./battle-rap.html';frame.setAttribute('allow','autoplay');frame.style.cssText='border:0;flex:1 1 auto;width:100%;min-height:0';
 veil.append(bar,frame);document.body.appendChild(veil);document.body.style.overscrollBehavior='none';close.focus()
}
open.addEventListener('click',openBattle);
addEventListener('message',function(ev){
 if(veil&&frame&&ev.source===frame.contentWindow&&ev.origin===location.origin&&ev.data&&ev.data.type==='jc:close-rap-battle')closeBattle()
});
addEventListener('keydown',function(ev){if(!veil)return;if(ev.key==='Escape'){ev.preventDefault();closeBattle()}});
})();
