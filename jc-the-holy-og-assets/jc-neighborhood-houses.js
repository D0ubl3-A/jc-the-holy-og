import * as THREE from "three";

/**
 * Neighborhood house archetypes, with roofs and street-facing garage details.
 * Procedural interpretations of local housing styles, not building-by-building
 * photographic reconstruction. Exact source footprint locations are retained.
 * Geometry & materials are shared across all near and sky instanced tiles.
 */
const HOUSE_KINDS=new Set([
  "desert-tract","suburban","mature-residential","planned-residential",
  "modern-residential","historic","hillside-villa","resort-villa"
]);
const roofForms={
  "desert-tract":["lowhip","gable","lowhip"],
  "suburban":["gable","lowhip","gable"],
  "mature-residential":["gable","gable","lowhip"],
  "planned-residential":["hip","hip","lowhip"],
  "modern-residential":["parapet","lowhip","parapet"],
  "historic":["gable","lowhip","gable"],
  "hillside-villa":["hip","hip","gable"],
  "resort-villa":["hip","hip","parapet"]
};
function makeRoofGeometry(kind){
  const faces=[];
  function surface(a,b,c,d=null){
    // Large roof panel triangles, UVs normalized to repeat original tile.
    function vertex(x){return [x[0],x[1],x[2],x[0]+.5,x[2]+.5];}
    const poly=d?[a,b,c,a,c,d]:[a,b,c];
    for(const pt of poly)faces.push(...vertex(pt));
  }
  const A=[-.54,0,-.54], B=[.54,0,-.54], C=[.54,0,.54],D=[-.54,0,.54];
  if(kind==="gable"){
    const E=[0,1,-.54],F=[0,1,.54];
    surface(A,E,F,D);surface(E,B,C,F);
    surface(A,B,E);surface(D,F,C);
  }else if(kind==="parapet"){
    const e=[-.48,.22,-.48],f=[.48,.22,-.48],g=[.48,.22,.48],h=[-.48,.22,.48];
    surface(A,B,f,e);surface(B,C,g,f);surface(C,D,h,g);surface(D,A,e,h);
    surface(e,f,g,h);
  }else {
    const height=kind==="lowhip"?.47:1;
    const E=[-.18,height,0],F=[.18,height,0];
    surface(A,B,F,E);surface(D,E,F,C);
    surface(A,E,D);surface(B,C,F);
  }
  const position=[],uv=[];
  for(let i=0;i<faces.length;i+=5){
    position.push(faces[i],faces[i+1],faces[i+2]);
    uv.push(faces[i+3],faces[i+4]);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(position,3));
  geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
  geometry.computeVertexNormals();
  return geometry;
}
const forms=new Map(["gable","hip","lowhip","parapet"].map(k=>[k,makeRoofGeometry(k)]));
const garageGeo=new THREE.BoxGeometry(1,1,1);
const garageMaterials=[
  new THREE.MeshStandardMaterial({color:0xddd6cb,roughness:.83}),
  new THREE.MeshStandardMaterial({color:0x9b948b,roughness:.9}),
  new THREE.MeshStandardMaterial({color:0xb5bbbc,roughness:.84}),
  new THREE.MeshStandardMaterial({color:0xb0a390,roughness:.83})
];
function houseFor(rec,skins){
  const idx=Math.floor(rec.style/skins.stylesPerNeighborhood);
  const zone=skins.zones[idx];
  if(!zone||!HOUSE_KINDS.has(zone.kind))return null;
  const h=rec.h,w=rec.w,d=rec.d;
  // Do not turn high-rises, warehouses or tiny objects into tract houses.
  if(h<.57||h>5.5||w<.7||d<.7||w>13||d>13)return null;
  const v=rec.style%skins.stylesPerNeighborhood;
  const form=roofForms[zone.kind][v];
  const rise=Math.min(h*.32,Math.min(w,d)*.31,form==="parapet"?.27:.69);
  if(rise<.06)return null;
  const garage=(zone.kind!=="historic"||v===1)&&h>=.9&&Math.min(w,d)>=1.3;
  return {form,zone,zoneIndex:idx,rise,garage};
}
export function attachNeighborhoodHouses(parent,records,skins,{sky=false,lowSpec=false}={}){
  const roofs=new Map(),garage=new Map();
  let roofCount=0,garageCount=0;
  for(const rec of records){
    const spec=houseFor(rec,skins);
    if(!spec)continue;
    const roofKey=spec.zoneIndex+"|"+spec.form;
    if(!roofs.has(roofKey))roofs.set(roofKey,{spec,records:[]});
    roofs.get(roofKey).records.push({rec,spec});
    roofCount++;
    if(!sky&&spec.garage&&(!lowSpec||Math.floor(rec.x*3+rec.z*7)%2===0)){
      const mat=Math.abs(spec.zoneIndex)%garageMaterials.length;
      if(!garage.has(mat))garage.set(mat,[]);
      garage.get(mat).push({rec,spec});
      garageCount++;
    }
  }
  const group=new THREE.Group();
  group.name="JC_NEIGHBORHOOD_REAL_HOUSE_ROOFS";
  const dummy=new THREE.Object3D();
  for(const [key,entry] of roofs){
    const {spec,records:items}=entry;
    const geo=forms.get(spec.form);
    const roofMat=skins.materials[spec.zoneIndex*skins.stylesPerNeighborhood][1];
    const mesh=new THREE.InstancedMesh(geo,roofMat,items.length);
    mesh.name="NEIGHBORHOOD_"+spec.zone.name.replace(/\s+/g,"_")+"_ROOF_"+spec.form;
    mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;
    // Original geo is source footprint; roof occupies top ~15-30% of height.
    for(let i=0;i<items.length;i++){
      const {rec,spec:shape}=items[i];
      dummy.position.set(rec.x,rec.h-shape.rise,rec.z);
      dummy.rotation.set(0,0,0);
      dummy.scale.set(rec.w,shape.rise,rec.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
    group.add(mesh);
  }
  if(!sky){
    for(const [id,items] of garage){
      const mesh=new THREE.InstancedMesh(garageGeo,garageMaterials[id],items.length);
      mesh.frustumCulled=false;mesh.castShadow=false;
      mesh.name="NEIGHBORHOOD_GARAGE_DETAILS_"+id;
      for(let i=0;i<items.length;i++){
        const {rec,spec}=items[i],alongX=Math.abs(Math.floor(rec.x*2+rec.z*7))%2===0;
        const houseHeight=rec.h-spec.rise;
        dummy.position.set(rec.x,Math.max(.15,houseHeight*.29),
          rec.z+(alongX?rec.d*.5+.012:0));
        if(!alongX)dummy.position.x=rec.x+rec.w*.5+.012;
        dummy.scale.set(alongX?rec.w*.42:.025,
          Math.min(houseHeight*.55,.42),
          alongX?.025:rec.d*.42);
        dummy.updateMatrix();
        mesh.setMatrixAt(i,dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;
      group.add(mesh);
    }
  }
  parent.add(group);
  window.JC_HOUSE_ARCHETYPES={
    source:"25 approximate geographic neighborhood zones",
    forms:Object.keys(roofForms),roofCount,garageCount,
    method:"source footprints plus procedurally varied regional roof silhouettes"
  };
  return {group,roofCount,garageCount,dispose(){
    parent.remove(group);
    group.traverse(o=>{if(o.isInstancedMesh)o.dispose()});
  }};
}
export function houseBodyHeight(record,skins){
  const spec=houseFor(record,skins);
  return spec?Math.max(.15,record.h-spec.rise):record.h;
}
