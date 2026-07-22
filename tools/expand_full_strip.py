from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SECTIONS = ROOT / "jc-the-holy-og-assets" / "vegas-sections.js"
STATUS = ROOT / "vegas-rebuild-status.json"


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Required patch target missing: {label}")
    return text.replace(old, new)


index = INDEX.read_text(encoding="utf-8")
index = replace_required(index, "BUILDING THE 3D STRIP", "STREAMING THE FULL LAS VEGAS STRIP", "loading label")
index = replace_required(
    index,
    "survive Heaven Havoc across a full 3D Vegas-inspired world.",
    "survive Heaven Havoc across the complete playable Strip, from the south gateway through the central resorts to the north tower corridor.",
    "menu pitch",
)
index = replace_required(
    index,
    "E ENTER/EXIT • CLICK FIRE • Q DASH • SPACE GRACE • T TIME • M MAP",
    "E ENTER/EXIT • F FLY • G JC/SATAN • CLICK FIRE • Q DASH • SPACE GRACE • T TIME • M MAP",
    "desktop controls",
)
index = replace_required(index, "STRIP HD: PROXIMITY LOAD", "FULL STRIP HD: PROXIMITY LOAD", "initial stream label")

landmark_code = r'''function makeFullStripResort(g,label,accent,seed,profile="tower"){
  const palettes=[[0x10263d,0x3ed8ff],[0x3b1717,0xff5a45],[0x33260d,0xffcf55],[0x142b21,0x58e69c],[0x25153c,0xb778ff],[0x332018,0xff9d4a]],p=palettes[seed%palettes.length],base=p[0],glow=p[1],towerMat=new THREE.MeshStandardMaterial({color:base,metalness:.48,roughness:.26,emissive:new THREE.Color(glow).multiplyScalar(.12),emissiveIntensity:1.15}),trimMat=new THREE.MeshStandardMaterial({color:glow,metalness:.7,roughness:.18,emissive:glow,emissiveIntensity:1.5});
  landmarkBox(g,104,10,64,0x17191f,0,5,0);
  if(profile==="twin"||profile==="castle"){
    for(const x of[-30,30]){const h=92+(seed%4)*11,q=new THREE.Mesh(new THREE.BoxGeometry(38,h,38),towerMat);q.position.set(x,h/2,0);q.castShadow=true;g.add(q);for(let y=14;y<h-5;y+=10)landmarkBox(g,40,1.1,40,glow,x,y,0,glow)}
    if(profile==="castle")for(const x of[-42,-14,14,42]){const spire=new THREE.Mesh(new THREE.ConeGeometry(8,28,6),trimMat);spire.position.set(x,119,0);g.add(spire)}
  }else if(profile==="spire"){
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(9,17,154,12),towerMat);shaft.position.y=77;g.add(shaft);const pod=new THREE.Mesh(new THREE.CylinderGeometry(40,30,22,18),trimMat);pod.position.y=143;g.add(pod);const needle=new THREE.Mesh(new THREE.CylinderGeometry(1.2,3.5,86,10),trimMat);needle.position.y=196;g.add(needle);
  }else if(profile==="dome"){
    const dome=new THREE.Mesh(new THREE.SphereGeometry(48,24,16,0,Math.PI*2,0,Math.PI*.56),towerMat);dome.position.y=12;g.add(dome);for(const x of[-38,38]){const h=82+(seed%3)*14,q=new THREE.Mesh(new THREE.BoxGeometry(28,h,34),towerMat);q.position.set(x,h/2,-8);g.add(q)}
  }else if(profile==="arena"){
    const bowl=new THREE.Mesh(new THREE.CylinderGeometry(58,66,34,32),towerMat);bowl.position.y=17;g.add(bowl);const ring=new THREE.Mesh(new THREE.TorusGeometry(58,3.5,10,48),trimMat);ring.rotation.x=Math.PI/2;ring.position.y=34;g.add(ring);
  }else if(profile==="pyramid"){
    const pyramid=new THREE.Mesh(new THREE.ConeGeometry(58,104,4),towerMat);pyramid.position.y=52;pyramid.rotation.y=Math.PI/4;g.add(pyramid);const beam=new THREE.Mesh(new THREE.CylinderGeometry(.7,2.4,180,10),new THREE.MeshBasicMaterial({color:glow,transparent:true,opacity:.68}));beam.position.y=194;g.add(beam);
  }else{
    for(let i=-3;i<=3;i++){const h=92-Math.abs(i)*7+(seed%4)*8,q=new THREE.Mesh(new THREE.BoxGeometry(17,h,38),towerMat);q.position.set(i*14,h/2,Math.abs(i)*2);q.rotation.y=i*.025;g.add(q)}
  }
  for(const x of[-48,48]){const beacon=new THREE.PointLight(glow,night?42:12,110,2);beacon.position.set(x,12,24);g.add(beacon)}
  addLandmarkSign(g,label,accent,profile==="spire"?132:profile==="arena"?54:72,34);
}
function buildRenamedLandmarks(parent){
  const root=new THREE.Group();root.name="FULL STRIP LANDMARK STREAM";root.position.set(stripAnchor.x,0,stripAnchor.z);root.rotation.y=stripAnchor.a||0;parent.add(root);
  const specs=[
    ["SOUTH GATE","#55e8ff",-155,4050,"spire"],["THE PYRAMID","#ffe26f",155,3600,"pyramid"],["GOLDEN BAY","#ffd25c",-155,3150,"tower"],["KINGDOM CASTLE","#ff7a51",155,2700,"castle"],["SUNSET ARENA","#ff5b45",-155,2250,"arena"],["EMERALD CITY","#56efa0",155,1800,"twin"],
    ["CLOWN TOWN","#ffb21c",-155,1320,"twin"],["ROYAL PALACE","#f2c14a",155,880,"castle"],["NGM","#39ff9b",-155,440,"tower"],["THE WIN","#ff9f43",155,0,"tower"],["THE PINE","#60e0a1",-155,-440,"twin"],["NEON FOUNTAINS","#58d8ff",155,-900,"dome"],
    ["SKY SPIRE","#78e9ff",-155,-1500,"spire"],["SAHARA CROWN","#ffc75d",155,-2050,"castle"],["STRATOS KING","#b990ff",-155,-2600,"spire"],["NORTH ARENA","#ff6655",155,-3100,"arena"],["NORTH GATE","#60e8ff",-155,-3700,"twin"]
  ];
  for(let i=0;i<specs.length;i++){const [name,accent,x,z,profile]=specs[i],g=new THREE.Group();g.name=name;g.position.set(x,0,z);root.add(g);makeFullStripResort(g,name,accent,i,profile)}
  root.userData.sections={south:specs.slice(0,6).map(v=>v[0]),core:specs.slice(6,12).map(v=>v[0]),north:specs.slice(12).map(v=>v[0])};
}'''

pattern = r"function buildRenamedLandmarks\(parent\)\{.*?\}\nfunction buildStripSection"
index, count = re.subn(pattern, landmark_code + "\nfunction buildStripSection", index, count=1, flags=re.S)
if count != 1:
    raise RuntimeError("Could not replace central-only landmark builder")

index = replace_required(index, "<1850&&[\"primary\"", "<4700&&[\"primary\"", "full Strip road radius")
index = replace_required(index, "i<(isMobile?10:22)", "i<(isMobile?18:42)", "full Strip traffic population")
index = replace_required(index, "<3300;for(const signal", "<5450;for(const signal", "full Strip infrastructure streaming radius")
index = replace_required(index, "target=kind===\"city\"?WORLD*.92:4400", "target=kind===\"city\"?WORLD*.92:7800", "full Strip GLB scale")
index = replace_required(index, "<2700;if(saved>=20)", "<5250;if(saved>=20)", "full Strip HD visibility radius")
index = replace_required(index, '"STRIP HD: "+(stripLayer?', '"FULL STRIP HD: "+(stripLayer?', "runtime stream label")
index = replace_required(index, '"<br>STRIP HD: PROXIMITY LOAD"', '"<br>FULL STRIP HD: PROXIMITY LOAD"', "city progress label")
index = replace_required(index, '"<br>STRIP HD: "+Math.round', '"<br>FULL STRIP HD: "+Math.round', "strip progress label")

# Expand minimap labels to make the entire north/south corridor legible.
index = replace_required(
    index,
    'for(const m of[{x:220,z:-260,n:"SPHERE"},{x:-260,z:150,n:"PYRAMID"},{x:-80,z:-720,n:"TOWER"}])',
    'for(const m of[{x:155,z:3600,n:"SOUTH"},{x:-155,z:2250,n:"ARENA"},{x:155,z:880,n:"PALACE"},{x:155,z:0,n:"CORE"},{x:155,z:-900,n:"FOUNTAINS"},{x:-155,z:-2600,n:"SPIRE"},{x:-155,z:-3700,n:"NORTH"}])',
    "full Strip minimap markers",
)

INDEX.write_text(index, encoding="utf-8")

sections_js = '''window.JC_VEGAS_SECTIONS={
  version:2,
  coordinateSystem:"strip-anchor-local",
  fullStrip:true,
  sections:[
    {id:"strip-south",label:"SOUTH STRIP",status:"implemented",anchor:"strip",offset:[0,2850],half:[1500,1900],streamRadius:3300,landmarks:["SOUTH GATE","THE PYRAMID","GOLDEN BAY","KINGDOM CASTLE","SUNSET ARENA","EMERALD CITY"]},
    {id:"strip-core",label:"CENTRAL STRIP",status:"implemented",anchor:"strip",offset:[0,200],half:[1500,1850],streamRadius:3300,landmarks:["CLOWN TOWN","ROYAL PALACE","NGM","THE WIN","THE PINE","NEON FOUNTAINS"]},
    {id:"strip-north",label:"NORTH STRIP",status:"implemented",anchor:"strip",offset:[0,-2850],half:[1500,1900],streamRadius:3300,landmarks:["SKY SPIRE","SAHARA CROWN","STRATOS KING","NORTH ARENA","NORTH GATE"]},
    {id:"downtown",label:"DOWNTOWN LAS VEGAS",status:"planned",anchor:"world",offset:[-250,-5200],half:[1350,900],streamRadius:2600,landmarks:["fremont-core"]},
    {id:"paradise-east",label:"PARADISE EAST",status:"planned",anchor:"world",offset:[1950,-150],half:[1100,1600],streamRadius:2700,landmarks:["convention-zone"]},
    {id:"west-resorts",label:"WEST RESORTS",status:"planned",anchor:"world",offset:[-1900,-150],half:[1050,1700],streamRadius:2700,landmarks:["resort-belt"]},
    {id:"outer-vegas",label:"OUTER LAS VEGAS",status:"planned",anchor:"world",offset:[0,0],half:[5200,5200],streamRadius:6200,landmarks:["valley-grid"]}
  ]
};
window.JC_RENAMED_LANDMARKS=window.JC_VEGAS_SECTIONS.sections.filter(v=>v.id.startsWith("strip-")).flatMap(v=>v.landmarks.map(name=>({name,section:v.id,status:"implemented"})));
window.JC_FULL_STRIP={status:"playable",southToNorthWorldSpan:8100,sections:["strip-south","strip-core","strip-north"],features:["road graph","sidewalks","crosswalks","traffic signals","moving traffic","pedestrian routing","HD GLB proximity streaming","procedural resort landmarks"]};
'''
SECTIONS.write_text(sections_js, encoding="utf-8")

status = {
    "objective": "playable complete Las Vegas Strip corridor",
    "current_section": "full-strip",
    "section_state": "implemented",
    "implemented": [
        "fixed stripAnchor initialization crash",
        "south, central, and north Strip streaming districts",
        "8,100 world-unit south-to-north playable corridor",
        "17 original resort and entertainment landmarks",
        "expanded Strip road-graph radius",
        "full-corridor sidewalks and crosswalks",
        "expanded traffic signals and moving vehicle population",
        "sidewalk-bound pedestrian routing across the corridor",
        "expanded HD Strip GLB scale and visibility radius",
        "full-corridor minimap markers",
        "desktop and mobile performance caps",
    ],
    "planned_sections": ["downtown", "paradise-east", "west-resorts", "outer-vegas"],
    "updatedAt": datetime.now(timezone.utc).isoformat(),
}
STATUS.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")

print("Full Strip production patch applied successfully.")
