import * as THREE from "three";

// Geographic gameplay contract adapted from aaronalltonai-ship-it/gta-vegas,
// src/App.tsx (VEGAS_CENTER, AREA_51, tunnels, stations and lat/lng routing).
// Both its scene and JC use real Las Vegas lat/lng. JC's older world coordinates
// are UTM Zone 11N in tenths of a meter, so match GPS to that origin.
// The local affine UTM approximation is accurate near metropolitan Las Vegas;
// long-distance targets (Area 51) are map navigation, not exact survey geometry.
export const GTA_VEGAS_CENTER={lat:36.1126,lng:-115.1767};
const CENTER_E=664104.303079381,CENTER_N=3997976.780308683;
const ORIGIN_E=656949.782,ORIGIN_N=3991561.814;
const E_LON=90013.36198,E_LAT=-2081.32356,N_LON=1688.85862,N_LAT=110934.00293;
const determinant=E_LON*N_LAT-E_LAT*N_LON;
export function gtaVegasToWorld(lat,lng){
  const dy=Number(lat)-GTA_VEGAS_CENTER.lat,dx=Number(lng)-GTA_VEGAS_CENTER.lng;
  const east=CENTER_E+dx*E_LON+dy*E_LAT;
  const north=CENTER_N+dx*N_LON+dy*N_LAT;
  return {x:(east-ORIGIN_E)*0.1,z:-(north-ORIGIN_N)*0.1};
}
export function gtaWorldToVegas(x,z){
  const de=ORIGIN_E+Number(x)*10-CENTER_E;
  const dn=ORIGIN_N-Number(z)*10-CENTER_N;
  const dx=(de*N_LAT-dn*E_LAT)/determinant;
  const dy=(dn*E_LON-de*N_LON)/determinant;
  return {lat:GTA_VEGAS_CENTER.lat+dy,lng:GTA_VEGAS_CENTER.lng+dx};
}
export const GTA_VEGAS_LANDMARKS=[
  {name:"BELLAGIO / STRIP",lat:36.1126,lng:-115.1767,kind:"casino"},
  {name:"LUXOR",lat:36.09547,lng:-115.17580,kind:"landmark"},
  {name:"ALLEGIANT STADIUM",lat:36.0909,lng:-115.1833,kind:"landmark"},
  {name:"FREMONT STREET",lat:36.1706,lng:-115.1439,kind:"district"},
  {name:"STRIP SUBSTATION",lat:36.1025,lng:-115.1728,kind:"police"},
  {name:"LVPD CENTRAL",lat:36.1675,lng:-115.1485,kind:"police"},
  {name:"FLAMINGO WASH",lat:36.1178,lng:-115.1710,kind:"tunnel"},
  {name:"TROPICANA WASH",lat:36.1015,lng:-115.1675,kind:"tunnel"},
  {name:"KOVAL ACCESS",lat:36.1141,lng:-115.1625,kind:"tunnel"},
  {name:"SAHARA WASH",lat:36.1425,lng:-115.1560,kind:"tunnel"},
  {name:"AREA 51",lat:37.2350,lng:-115.8111,kind:"distant"}
];
// GTA Vegas original draws 100 procedural structures. Precreate an instanced
// equivalent, with stable seeded positions, for ONE draw call instead of loading
// 262 MB of building geometry on mobile. Stylized, not real parcel footprints.
export function buildGtaVegasCity(worldRoot,lowSpec){
  const count=lowSpec?100:220;
  const group=new THREE.Group();group.name="GTA_VEGAS_LIGHTWEIGHT_CITY";
  const geo=new THREE.BoxGeometry(1,1,1);
  const material=new THREE.MeshStandardMaterial({color:0x44556a,metalness:0.18,roughness:0.5});
  const buildings=new THREE.InstancedMesh(geo,material,count);
  buildings.name="STYLIZED_SOURCE_GAME_BUILDINGS";
  buildings.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  buildings.frustumCulled=false;
  const dummy=new THREE.Object3D(),color=new THREE.Color();
  const center=gtaVegasToWorld(GTA_VEGAS_CENTER.lat,GTA_VEGAS_CENTER.lng);
  const seen=[];
  function seeded(i){const n=Math.sin(i*913.71+17.3)*43758.5453;return n-Math.floor(n)}
  for(let i=0;i<count;i++){
    let px=(seeded(i*7+3)-0.5)*1400;
    let pz=(seeded(i*11+8)-0.5)*1750;
    // Keep Las Vegas Boulevard and JC's starting road corridor open.
    if(Math.abs(px)<37)px+=px<0?-55:55;
    const h=9+seeded(i*5+1)*82;
    const w=6+seeded(i*13+2)*21, d=6+seeded(i*17+7)*26;
    dummy.position.set(center.x+px,h/2,center.z+pz);
    dummy.scale.set(w,h,d);dummy.updateMatrix();
    buildings.setMatrixAt(i,dummy.matrix);
    const tone=i%8;
    color.setHSL(tone===0?0.09:tone===1?0.56:0.61,0.18+tone*0.025,0.17+(i%7)*0.027);
    buildings.setColorAt(i,color);
    seen.push({x:dummy.position.x,z:dummy.position.z,height:h});
  }
  buildings.instanceMatrix.needsUpdate=true;
  if(buildings.instanceColor)buildings.instanceColor.needsUpdate=true;
  group.add(buildings);
  worldRoot.add(group);
  window.JC_GTA_MAP_WORLD={mode:"GPS-ALIGNED LIGHT CITY",buildings:count,worldRoot:group,
    source:"aaronalltonai-ship-it/gta-vegas",geoSystem:"GPS to JC EPSG:32611 local approximation"};
  return group;
}

export function initializeGtaVegasMap({player,onTarget,onTravel}){
  const container=document.getElementById("jcGeoMap");
  const output=document.getElementById("jcGeoLocation");
  const dock=document.getElementById("jcGeoPanel");
  const expand=document.getElementById("jcGeoExpand");
  const go=document.getElementById("jcGeoGo");
  if(!container||!dock)return {update(){}};
  const l=window.L;
  if(!l){
    container.textContent="Map tiles unavailable. JC flight and powers remain active.";
    return {update(){
      if(output){const g=gtaWorldToVegas(player.pos.x,player.pos.z);output.textContent=g.lat.toFixed(5)+", "+g.lng.toFixed(5);}
    }};
  }
  const map=l.map(container,{center:[GTA_VEGAS_CENTER.lat,GTA_VEGAS_CENTER.lng],zoom:14,
    zoomControl:false,attributionControl:true,preferCanvas:true,worldCopyJump:false});
  // No API key is committed to a public GitHub Pages site. Use actual OSM
  // street geography with visible attribution; this is not Google map imagery.
  l.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
    minZoom:10,maxZoom:18,maxNativeZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
    updateWhenIdle:true,keepBuffer:1
  }).addTo(map);
  l.control.zoom({position:"bottomright"}).addTo(map);
  const start=gtaWorldToVegas(player.pos.x,player.pos.z);
  const icon=l.divIcon({className:"jc-gps-icon",html:'<span aria-label="JC position">JC</span>',
    iconSize:[30,30],iconAnchor:[15,15]});
  const playerMarker=l.marker([start.lat,start.lng],{icon,interactive:false}).addTo(map);
  let targetMarker=null;
  let expanded=false,selected=null,lastUpdate=0,lastFocus=0;
  const markerLayer=l.layerGroup().addTo(map);
  for(const target of GTA_VEGAS_LANDMARKS){
    l.circleMarker([target.lat,target.lng],{radius:target.kind==="distant"?4:5,
      color:target.kind==="police"?"#9dc7ff":"#f6ce74",weight:1,
      fillColor:target.kind==="police"?"#4776bf":"#c48e37",fillOpacity:0.85})
      .bindTooltip(target.name,{direction:"top"}).on("click",()=>choose(target)).addTo(markerLayer);
  }
  function choose(place){
    selected=place;
    if(targetMarker)map.removeLayer(targetMarker);
    targetMarker=l.circleMarker([place.lat,place.lng],{radius:10,color:"#ffe67e",weight:3,fillOpacity:.12}).addTo(map);
    if(onTarget)onTarget(place);
    go.disabled=false;
    go.textContent="HYPER TO "+(place.name.length>16?place.name.slice(0,16):place.name);
    go.title="Uses JC solar charge";
  }
  map.on("click",e=>choose({name:"MAP WAYPOINT",lat:e.latlng.lat,lng:e.latlng.lng,kind:"waypoint"}));
  if(expand)expand.addEventListener("click",()=>{
    expanded=!expanded;dock.classList.toggle("expanded",expanded);
    expand.textContent=expanded?"CLOSE MAP":"EXPAND MAP";
    expand.setAttribute("aria-expanded",String(expanded));
    setTimeout(()=>map.invalidateSize({pan:false}),80);
  });
  if(go)go.addEventListener("click",()=>{if(selected&&onTravel)onTravel(selected);});
  map.whenReady(()=>map.invalidateSize({pan:false}));
  return {
    map,select:choose,
    update(force=false){
      const now=performance.now();
      if(!force&&now-lastUpdate<750)return;
      lastUpdate=now;
      const g=gtaWorldToVegas(player.pos.x,player.pos.z);
      playerMarker.setLatLng([g.lat,g.lng]);
      if(output)output.textContent=g.lat.toFixed(5)+", "+g.lng.toFixed(5);
      if(!map.dragging.enabled())return;
      if((!expanded&&now-lastFocus>5500)||force){
        map.panTo([g.lat,g.lng],{animate:false});
        lastFocus=now;
      }
    },
    destroy(){map.remove();}
  };
}
