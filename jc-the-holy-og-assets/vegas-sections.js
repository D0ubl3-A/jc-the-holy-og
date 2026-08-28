window.JC_VEGAS_SECTIONS={
  version:13,
  coordinateSystem:"strip-anchor-local",
  fullStrip:true,
  realDetailVersion:"district-streaming-v1+usgs-relief-v1+osm-street-context-v1+south-strip-west-focus-v1",
  productionFocus:{
    id:"south-strip-west",
    section:"strip-south",
    side:"west",
    status:"finish-first",
    priority:1,
    goal:"One polished, continuously playable South Strip side before expanding detail elsewhere.",
    landmarks:["MANDALAY BAY","LUXOR","EXCALIBUR","NEW YORK-NEW YORK","PARK MGM","ARIA"],
    requirements:["source-grounded footprints","correct boulevard-side placement","continuous sidewalk and road-edge collision","street-level grounding","night lighting","entrance/forecourt readability","no road overlap","stable desktop and mobile streaming"],
    deferUntilPass:["strip-core detail expansion","strip-north detail expansion","outer district visual polish"]
  },
  runtimeDistrictPacks:{
    status:"ready",
    crs:"EPSG:32611",
    sourceRegistryBuildings:627349,
    selectedRuntimeBuildings:43500,
    districts:{strip:8000,downtown:6500,"paradise-east":6500,henderson:8500,"west-vegas":7000,"north-vegas":7000},
    runtime:"real-vegas-district-runtime.js",
    collisionRuntime:"real-vegas-collision-runtime.js",
    policy:"proximity load + tile merge; source-grounded footprints; source height retained; exact-footprint collision replaces procedural collision inside active real districts"
  },
  terrainRelief:{
    status:"ready",
    source:"USGS 3DEP Bare Earth DEM",
    crs:"EPSG:32611",
    runtimeGrid:[176,176],
    sourcePixelSizeM:10,
    sourceElevationRangeM:[453.859,1168.606],
    gameplaySafeUrbanFlattenRadiusM:11000,
    blendEndM:14500,
    runtime:"real-terrain-relief-runtime.js"
  },
  streetContext:{status:"ready",source:"OpenStreetMap road names",runtime:"real-street-context-runtime.js",policy:"only source road names present in OSM are rendered; proximity culled for mobile"},
  alignment:{
    southStrip:{
      status:"satellite-footprints-v3",
      imageryService:"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
      bbox4326:[-115.1827,36.0877,-115.1627,36.1083],
      gameCenter:[0,3150],
      debugToggle:"V",
      footprintToggle:"F",
      geometryEvidence:"SOURCE_CONFIRMED",
      heightEvidence:"ESTIMATED",
      exactFootprintsPending:false,
      architecturePending:true,
      productionSide:"west"
    }
  },
  sections:[
    {id:"strip-south",label:"SOUTH STRIP",status:"production-focus",focusSide:"west",alignment:"satellite-footprints-v3",anchor:"strip",offset:[0,2850],half:[1500,1900],streamRadius:3600,landmarks:["MANDALAY BAY","LUXOR","EXCALIBUR","NEW YORK-NEW YORK","PARK MGM","ARIA","MGM GRAND","ALLEGIANT STADIUM"],focusLandmarks:["MANDALAY BAY","LUXOR","EXCALIBUR","NEW YORK-NEW YORK","PARK MGM","ARIA"],realDetail:"strip-pack-8000"},
    {id:"strip-core",label:"CENTRAL STRIP",status:"implemented-deferred-polish",anchor:"strip",offset:[0,200],half:[1500,1850],streamRadius:3600,landmarks:["BELLAGIO","CAESARS PALACE","FLAMINGO","THE VENETIAN","THE SPHERE","WYNN LAS VEGAS"],realDetail:"strip-pack-8000"},
    {id:"strip-north",label:"NORTH STRIP",status:"implemented-deferred-polish",anchor:"strip",offset:[0,-2850],half:[1500,1900],streamRadius:3600,landmarks:["FONTAINEBLEAU","SAHARA","THE STRAT","ARTS DISTRICT GATE","DOWNTOWN GATE"],realDetail:"strip-pack-8000"},
    {id:"downtown",label:"DOWNTOWN LAS VEGAS",status:"implemented",detail:"district-pack-v1",anchor:"world",offset:[-250,-5200],half:[1350,900],streamRadius:2600,landmarks:["fremont-core"],sourceGrounded:{buildings:6500,sourceCandidates:21802,tiles:42,crs:"EPSG:32611",runtime:"real-vegas-district-runtime.js"}},
    {id:"paradise-east",label:"PARADISE EAST",status:"planned",realDetail:"runtime-pack-ready-6500",anchor:"world",offset:[1950,-150],half:[1100,1600],streamRadius:2700,landmarks:["convention-zone"]},
    {id:"west-resorts",label:"WEST RESORTS",status:"planned",realDetail:"runtime-pack-ready-7000",anchor:"world",offset:[-1900,-150],half:[1050,1700],streamRadius:2700,landmarks:["resort-belt"]},
    {id:"outer-vegas",label:"OUTER LAS VEGAS",status:"planned",realDetail:"henderson-and-north-packs-ready+usgs-relief",anchor:"world",offset:[0,0],half:[5200,5200],streamRadius:6200,landmarks:["valley-grid"]}
  ]
};

window.JC_SATELLITE_ALIGNMENT=window.JC_VEGAS_SECTIONS.alignment;
window.JC_SOUTH_STRIP_FOCUS=window.JC_VEGAS_SECTIONS.productionFocus;
window.JC_SOUTH_STRIP_GEO_ANCHORS=[
  {name:"MANDALAY BAY",lat:36.09201,lon:-115.17482,evidence:"supported",source:"OSM-derived building reference",focusSide:"west"},
  {name:"LUXOR",lat:36.09547,lon:-115.17580,evidence:"supported",source:"OSM-derived building reference",focusSide:"west"},
  {name:"EXCALIBUR",lat:36.09900,lon:-115.17530,evidence:"supported",source:"map/geospatial reference",focusSide:"west"},
  {name:"NEW YORK-NEW YORK",lat:36.10215,lon:-115.17459,evidence:"supported",source:"OSM-derived building reference",focusSide:"west"},
  {name:"PARK MGM",lat:36.10473,lon:-115.17524,evidence:"supported",source:"OSM-derived building reference",focusSide:"west"},
  {name:"MGM GRAND",lat:36.10271,lon:-115.16985,evidence:"supported",source:"OSM-derived building reference",markerOnly:true},
  {name:"ALLEGIANT STADIUM",lat:36.09074,lon:-115.18333,evidence:"supported",source:"OSM-derived building reference",markerOnly:true}
];

window.JC_RENAMED_LANDMARKS=window.JC_VEGAS_SECTIONS.sections
  .filter(section=>section.id.startsWith("strip-"))
  .flatMap(section=>section.landmarks.map(name=>({name,section:section.id,status:section.status})));
window.JC_FULL_STRIP={
  status:"playable",
  productionFocus:"south-strip-west",
  southToNorthWorldSpan:8400,
  sections:["strip-south","strip-core","strip-north"],
  features:["OSM boulevard spine","continuous collision surface","sidewalks","crosswalks","streetlights","HD model streaming","mobile performance caps","South Strip satellite calibration overlay","South Strip west-side finish-first production focus","natural non-inverted keyboard/mobile steering","260 source-confirmed Zone 1 building footprints","source-confirmed Allegiant Stadium footprint","persistent static grounding anchors","8,000-building source-grounded Strip runtime pack","6,500-building Downtown/Fremont runtime pack","43,500 source-grounded runtime buildings across six Vegas districts","source-grounded exact-footprint district collision","proximity-loaded merged 1km detail tiles","USGS 3DEP outer-valley terrain relief","source-grounded OSM street-name context"],
  verification:{identity:"supported",geometry:"source-grounded-footprints-plus-provisional-architecture",southStripAlignment:"satellite-footprints-v3",southStripFocusSide:"west",southStripFootprints:"SOURCE_CONFIRMED",allegiantFootprint:"SOURCE_CONFIRMED",runtimeStripPack:"SOURCE_CONFIRMED_8000",runtimeDowntownPack:"SOURCE_CONFIRMED_6500",runtimeDistrictTotal:"SOURCE_CONFIRMED_43500",runtimeCollision:"SOURCE_FOOTPRINT_MATCHED",terrainSource:"USGS_3DEP_VERIFIED",terrainUrbanMode:"PLAYABILITY_FLATTENED_CORE",streetNames:"OSM_SOURCE_CONFIRMED",southStripHeights:"ESTIMATED",southStripArchitecture:"UNKNOWN",exactFootprintsPending:false,seamGapTargetMeters:0.25,staticGrounding:"enabled",steeringInversion:false}
};
// Parser-inserted modules patch Three.js before the main game module initializes.
// V toggles satellite calibration. F toggles the main source-confirmed Zone 1 footprint layer.
document.write('<script type="module" src="./jc-the-holy-og-assets/full-strip-runtime.js"><\/script>');
document.write('<script type="module" src="./jc-the-holy-og-assets/satellite-alignment-runtime.js"><\/script>');
document.write('<script type="module" src="./jc-the-holy-og-assets/zone1-footprint-runtime.js"><\/script>');
document.write('<script type="module" src="./jc-the-holy-og-assets/zone1-allegiant-runtime.js"><\/script>');
document.write('<script type="module" src="./jc-the-holy-og-assets/static-grounding-runtime.js"><\/script>');
document.write('<script src="./jc-the-holy-og-assets/steering-normalizer-runtime.js"><\/script>');
document.write('<script type="module" src="./jc-the-holy-og-assets/movement-animation-runtime.js"><\/script>');
document.write('<script type="module" src="./jc-the-holy-og-assets/real-vegas-district-runtime.js"><\/script>');
document.write('<script type="module" src="./jc-the-holy-og-assets/real-vegas-collision-runtime.js"><\/script>');
document.write('<script type="module" src="./jc-the-holy-og-assets/real-terrain-relief-runtime.js"><\/script>');
document.write('<script type="module" src="./jc-the-holy-og-assets/real-street-context-runtime.js"><\/script>');
