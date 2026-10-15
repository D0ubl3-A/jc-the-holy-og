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
export function buildGtaVegasCity(worldRoot,lowSpec,skins=null,playerPos=null){
  // Keep the existing light Strip starter town outside the 595 Library cells,
  // but skin its structures with the *same* named-neighborhood art direction.
  const count=lowSpec?100:220;
  const group=new THREE.Group();
  group.name="GTA_VEGAS_LIGHTWEIGHT_CITY";
  const geometry=skins?.geometry||new THREE.BoxGeometry(1,1,1);
  const center=gtaVegasToWorld(GTA_VEGAS_CENTER.lat,GTA_VEGAS_CENTER.lng);
  function seeded(i){const n=Math.sin(i*913.71+17.3)*43758.5453;return n-Math.floor(n);}
  const records=[],counts=new Map();
  for(let i=0;i<count;i++){
    let px=(seeded(i*7+3)-0.5)*1400;
    let pz=(seeded(i*11+8)-0.5)*1750;
    if(Math.abs(px)<37)px+=px<0?-55:55;
    const h=9+seeded(i*5+1)*82;
    const w=6+seeded(i*13+2)*21,d=6+seeded(i*17+7)*26;
    const x=center.x+px,z=center.z+pz;
    const col=8+Math.floor(x/100),row=8+Math.floor(-z/100);
    const style=skins?skins.index(col,row,i,Math.round(h*100),x,z,Math.round(w*100)):0;
    records.push({x,z,h,w,d,style});
    counts.set(style,(counts.get(style)||0)+1);
  }
  const meshes=new Map();
  const fallbackMaterial=new THREE.MeshStandardMaterial({color:0x656d79,roughness:0.82,metalness:0.12});
  for(const [style,n] of counts){
    const mesh=new THREE.InstancedMesh(geometry,skins?skins.materials[style]:fallbackMaterial,n);
    mesh.name="JC_NEIGHBORHOOD_STARTER_"+style;
    mesh.frustumCulled=false;
    mesh.castShadow=false;mesh.receiveShadow=false;
    meshes.set(style,{mesh,used:0});
    group.add(mesh);
  }
  const dummy=new THREE.Object3D();
  for(const rec of records){
    const slot=meshes.get(rec.style);
    dummy.position.set(rec.x,rec.h/2,rec.z);
    dummy.scale.set(rec.w,rec.h,rec.d);
    dummy.updateMatrix();
    slot.mesh.setMatrixAt(slot.used++,dummy.matrix);
  }
  for(const slot of meshes.values())slot.mesh.instanceMatrix.needsUpdate=true;
  worldRoot.add(group);

  // A deliberate, close-range first Strip block gives the player readable
  // real-world scale and a photoreal facade at street level. The wider city
  // remains instanced and lightweight for mobile devices.
  if(playerPos){
    const block=new THREE.Group();
    block.name="JC_STRIP_FIRST_BLOCK_PHOTOREAL";
    const firstBlockColliders=[];
    const facadeTexture=new THREE.TextureLoader().load(
      "./jc-the-holy-og-assets/textures/strip-photoreal-hotel-v1.jpg?rev=jc-strip-photo-v1",
      texture=>{
        texture.colorSpace=THREE.SRGBColorSpace;
        texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
        texture.anisotropy=8;
        texture.needsUpdate=true;
      }
    );
    facadeTexture.colorSpace=THREE.SRGBColorSpace;
    facadeTexture.wrapS=facadeTexture.wrapT=THREE.RepeatWrapping;
    const facade=new THREE.MeshStandardMaterial({
      map:facadeTexture,color:0xf4e9d7,roughness:0.42,metalness:0.16
    });
    const roof=new THREE.MeshStandardMaterial({color:0x54585b,roughness:0.9,metalness:0.12});
    const underside=new THREE.MeshStandardMaterial({color:0x393a3b,roughness:1});
    const buildingGeometry=new THREE.BoxGeometry(1,1,1);
    const buildingMaterials=[facade,facade,roof,underside,facade,facade];
    const buildings=[
      {x:-31,z:83,w:30,d:27,h:30},
      {x:0,z:88,w:38,d:30,h:39},
      {x:32,z:82,w:27,d:25,h:27}
    ];
    const towers=new THREE.InstancedMesh(buildingGeometry,buildingMaterials,buildings.length);
    towers.name="JC_STRIP_PHOTOREAL_HOTEL_TOWERS";
    towers.castShadow=false;towers.receiveShadow=true;towers.frustumCulled=false;
    const dummy=new THREE.Object3D();
    for(let i=0;i<buildings.length;i++){
      const b=buildings[i];
      dummy.position.set(playerPos.x+b.x,b.h/2,playerPos.z+b.z);
      dummy.scale.set(b.w,b.h,b.d);
      dummy.updateMatrix();
      towers.setMatrixAt(i,dummy.matrix);
      firstBlockColliders.push(new THREE.Box3(
        new THREE.Vector3(playerPos.x+b.x-b.w/2,0,playerPos.z+b.z-b.d/2),
        new THREE.Vector3(playerPos.x+b.x+b.w/2,b.h,playerPos.z+b.z+b.d/2)
      ));
    }
    towers.instanceMatrix.needsUpdate=true;
    block.add(towers);

    const podium=new THREE.Mesh(
      new THREE.BoxGeometry(92,6,15),
      [facade,facade,roof,underside,facade,facade]
    );
    podium.name="JC_STRIP_PHOTOREAL_CASINO_PODIUM";
    podium.position.set(playerPos.x,3,playerPos.z+62);
    podium.castShadow=false;podium.receiveShadow=true;
    block.add(podium);
    firstBlockColliders.push(new THREE.Box3().setFromObject(podium));
    for(const box of firstBlockColliders)box.userData={indestructible:true,source:"JC_STRIP_FIRST_BLOCK"};

    const roofUnits=new THREE.InstancedMesh(
      new THREE.BoxGeometry(1,1,1),
      new THREE.MeshStandardMaterial({color:0x707677,roughness:0.78,metalness:0.28}),
      9
    );
    roofUnits.name="JC_STRIP_PHOTOREAL_ROOFTOP_EQUIPMENT";
    roofUnits.castShadow=false;roofUnits.receiveShadow=true;
    let unit=0;
    for(const b of buildings){
      for(let n=0;n<3;n++){
        dummy.position.set(
          playerPos.x+b.x+(n-1)*b.w*0.24,
          b.h+0.55,
          playerPos.z+b.z+(n%2?4:-4)
        );
        dummy.scale.set(2.8,1.1,2.2);
        dummy.updateMatrix();
        roofUnits.setMatrixAt(unit++,dummy.matrix);
      }
    }
    roofUnits.instanceMatrix.needsUpdate=true;
    block.add(roofUnits);
    group.add(block);
  }
  window.JC_GTA_MAP_WORLD={
    mode:"GPS-ALIGNED CITY WITH PHOTOREAL FIRST STRIP BLOCK",
    buildings:count+(playerPos?3:0),groups:meshes.size+(playerPos?3:0),worldRoot:group,
    firstBlockColliders:playerPos?firstBlockColliders:[],
    source:"aaronalltonai-ship-it/gta-vegas",
    geoSystem:"GPS to JC EPSG:32611 local approximation"
  };
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

