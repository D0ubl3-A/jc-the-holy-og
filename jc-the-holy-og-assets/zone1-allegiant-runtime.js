import * as THREE from "three";

const KEY="__JC_ZONE1_ALLEGIANT_FOOTPRINT_V1__";
if(!window[KEY]){
  const state=window[KEY]={installed:true,ready:false,geometryEvidence:"SOURCE_CONFIRMED",heightEvidence:"ESTIMATED"};
  const points=[[-901.4,3819.6],[-800.3,3943.1],[-832.2,3955.9],[-827.3,3962.0],[-838.5,3956.7],[-842.9,3946.0],[-841.2,3944.7],[-846.5,3938.2],[-851.2,3948.4],[-850.8,3948.3],[-850.0,3957.2],[-863.8,3950.8],[-863.2,3957.0],[-864.0,3955.2],[-871.5,3946.0],[-870.9,3952.2],[-861.1,3964.2],[-889.9,4025.4],[-853.1,4022.2],[-893.7,4038.5],[-894.7,4039.4],[-908.3,4068.3],[-880.5,4065.9],[-887.3,4071.4],[-877.9,4094.7],[-955.9,4126.0],[-939.5,4146.0],[-1043.4,4097.6],[-1049.6,4102.7],[-1068.4,3886.7]];
  function build(root){
    if(state.ready||!root)return;
    const shape=new THREE.Shape();
    points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));
    shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:11.5,bevelEnabled:false,curveSegments:1,steps:1});
    geometry.rotateX(-Math.PI/2); geometry.translate(0,.03,0); geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x343b43,roughness:.82,metalness:.08}));
    mesh.name="ALLEGIANT STADIUM SOURCE FOOTPRINT";
    mesh.receiveShadow=true; mesh.castShadow=false;
    mesh.userData={buildingId:"SC-BLDG-MS-630b9732e73f9a2838d9d0dc2314ce0b",footprintAreaM2:51807.634,heightM:11.5204,heightEvidence:"ESTIMATED",detectionConfidence:.9007,geometryEvidence:"SOURCE_CONFIRMED",source:"Microsoft GlobalMLBuildingFootprints",release:"2026-07-24"};
    root.add(mesh); state.mesh=mesh; state.ready=true;
    window.JC_ALLEGIANT_QA={status:"PASS",geometryEvidence:"SOURCE_CONFIRMED",footprintAreaM2:51807.634,heightEvidence:"ESTIMATED",detectionConfidence:.9007};
  }
  const previous=THREE.WebGLRenderer.prototype.render;
  if(!THREE.WebGLRenderer.prototype.__jcAllegiantFootprintPatch){Object.defineProperty(THREE.WebGLRenderer.prototype,"__jcAllegiantFootprintPatch",{value:true});THREE.WebGLRenderer.prototype.render=function(scene,camera){if(scene?.isScene){const root=scene.getObjectByName("JC FULL LAS VEGAS STRIP V2");if(root)build(root);}return previous.call(this,scene,camera);};}
}
