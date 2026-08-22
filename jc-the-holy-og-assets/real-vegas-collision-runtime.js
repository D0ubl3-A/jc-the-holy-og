const KEY="__JC_REAL_VEGAS_COLLISION_V1__";
const DISTRICT_KEY="__JC_REAL_VEGAS_DISTRICTS_V1__";
const C={minE:648949.782,minN:3983561.814,maxE:683949.782,maxN:4018561.814};

if(!window[KEY]){
 const stats=window[KEY]={installed:true,checks:0,hits:0,lastDistrict:null};
 function districtState(){return window[DISTRICT_KEY]||null}
 function active(){const s=districtState();return !!(s?.ready&&s.active&&s.activeDistrict&&s.districts?.has(s.activeDistrict))}
 function gameToUtm(x,z){const s=districtState(),c=s?.contract;if(!c)return null;const sx=x/c.scale+c.cx,sz=z/c.scale+c.cz;if(c.projected)return[sx,sz];const e=C.minE+((sx-c.minX)/(c.maxX-c.minX))*(C.maxE-C.minE),n=C.minN+((sz-c.minZ)/(c.maxZ-c.minZ))*(C.maxN-C.minN);return[e,n]}
 function tileId(e,n){const x=Math.max(0,Math.min(34,Math.floor((e-C.minE)/1000))),y=Math.max(0,Math.min(34,Math.floor((n-C.minN)/1000)));return[x,y]}
 function pointInRing(x,y,ring,origin,unit){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const xi=origin[0]+ring[i][0]*unit,yi=origin[1]+ring[i][1]*unit,xj=origin[0]+ring[j][0]*unit,yj=origin[1]+ring[j][1]*unit;const hit=((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/((yj-yi)||1e-9)+xi);if(hit)inside=!inside}return inside}
 function buildingContains(x,y,b,pack){for(const ring of b.r||[])if(ring.length>=3&&pointInRing(x,y,ring,pack.origin_utm,Number(pack.unit_m||.1)))return true;return false}
 function nearbyRows(d,e,n){const [tx,ty]=tileId(e,n),rows=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=tx+dx,y=ty+dy;if(x<0||x>34||y<0||y>34)continue;const id=`Tile_LV_X${String(x).padStart(3,"0")}_Y${String(y).padStart(3,"0")}`,tile=d.tiles.get(id);if(tile?.rows)rows.push(...tile.rows)}return rows}
 function collides(pos,rGame=0){if(!active())return false;const s=districtState(),d=s.districts.get(s.activeDistrict),utm=gameToUtm(Number(pos.x),Number(pos.z));if(!utm)return false;stats.checks++;stats.lastDistrict=s.activeDistrict;const scaleGamePerMeter=s.contract.projected?s.contract.scale:(10010/35000),r=Math.max(0,Number(rGame)||0)/Math.max(.0001,scaleGamePerMeter),samples=[[0,0],[r,0],[-r,0],[0,r],[0,-r]];const rows=nearbyRows(d,utm[0],utm[1]);for(const b of rows)for(const q of samples)if(buildingContains(utm[0]+q[0],utm[1]+q[1],b,d.pack)){stats.hits++;return true}return false}
 window.JC_REAL_VEGAS_COLLISION={active,collides,status:()=>({...stats,active:active(),district:districtState()?.activeDistrict||null})};
}
