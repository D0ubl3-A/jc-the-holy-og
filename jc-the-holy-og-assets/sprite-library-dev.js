// JC sprite library: development-only until release gates pass.
const manifestURL = './production/sprites/manifest_0001-2000.json';
const knownTextures = [
 {label:'Existing character atlas',url:'./jc-the-holy-og-assets/character-atlas.png'},
 {label:'Existing JC city atlas',url:'./jc-the-holy-og-assets/jc-3d-city-atlas.png'}
];
export async function initSpriteLibrary(){
 const btn=document.createElement('button');btn.textContent='SPRITE LIBRARY (DEV)';
 Object.assign(btn.style,{position:'fixed',right:'12px',bottom:'12px',zIndex:'40',padding:'9px',background:'#1b2230',color:'white',border:'1px solid #ffd45a'});
 const panel=document.createElement('section');
 Object.assign(panel.style,{display:'none',position:'fixed',right:'12px',bottom:'54px',width:'min(390px,90vw)',maxHeight:'65vh',overflow:'auto',background:'#0d1016',color:'white',padding:'15px',zIndex:'40',border:'1px solid #ffd45a',font:'13px Arial'});
 btn.onclick=()=>panel.style.display=panel.style.display==='none'?'block':'none';
 document.body.append(btn,panel);
 const heading=document.createElement('h3');heading.textContent='JC sprite library — development only';panel.append(heading);
 const status=document.createElement('p');status.textContent='Verified production sprites: 0 / 2,000. No unverified candidate is loaded as a release character.';panel.append(status);
 try {
   const response=await fetch(manifestURL,{cache:'no-store'});if(!response.ok)throw Error('Manifest HTTP '+response.status);
   const raw=await response.json();const entries=Array.isArray(raw)?raw:Array.isArray(raw.assets)?raw.assets:Array.isArray(raw.sprites)?raw.sprites:null;
   const p=document.createElement('p');p.textContent=entries?'Manifest records available: '+entries.length:'Manifest available (non-array schema).';panel.append(p);
 }catch(e){const p=document.createElement('p');p.textContent='Manifest unavailable: '+e.message;panel.append(p)}
 for(const item of knownTextures){
   const img=new Image();img.loading='lazy';img.alt=item.label;img.style.cssText='width:100%;max-height:160px;object-fit:contain;background:#222;margin-top:8px';
   const caption=document.createElement('div');caption.textContent=item.label+' — existing game texture, not a verified 0001–2000 master';
   panel.append(caption,img);img.src=item.url;
   img.onerror=()=>{caption.textContent=item.label+' — asset not accessible';img.remove()};
 }
}
