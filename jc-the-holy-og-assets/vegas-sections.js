window.JC_VEGAS_SECTIONS={
  version:7,
  coordinateSystem:"strip-anchor-local",
  fullStrip:true,
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
      architecturePending:true
    }
  },
  sections:[
    {id:"strip-south",label:"SOUTH STRIP",status:"implemented",alignment:"satellite-footprints-v3",anchor:"strip",offset:[0,2850],half:[1500,1900],streamRadius:3600,landmarks:["MANDALAY BAY","LUXOR","EXCALIBUR","NEW YORK-NEW YORK","PARK MGM","ARIA","MGM GRAND","ALLEGIANT STADIUM"]},
    {id:"strip-core",label:"CENTRAL STRIP",status:"implemented",anchor:"strip",offset:[0,200],half:[1500,1850],streamRadius:3600,landmarks:["BELLAGIO","CAESARS PALACE","FLAMINGO","THE VENETIAN","THE SPHERE","WYNN LAS VEGAS"]},
    {id:"strip-north",label:"NORTH STRIP",status:"implemented",anchor:"strip",offset:[0,-2850],half:[1500,1900],streamRadius:3600,landmarks:["FONTAINEBLEAU","SAHARA","THE STRAT","ARTS DISTRICT GATE","DOWNTOWN GATE"]},
    {id:"downtown",label:"DOWNTOWN LAS VEGAS",status:"planned",anchor:"world",offset:[-250,-5200],half:[1350,900],streamRadius:2600,landmarks:["fremont-core"]},
    {id:"paradise-east",label:"PARADISE EAST",status:"planned",anchor:"world",offset:[1950,-150],half:[1100,1600],streamRadius:2700,landmarks:["convention-zone"]},
    {id:"west-resorts",label:"WEST RESORTS",status:"planned",anchor:"world",offset:[-1900,-150],half:[1050,1700],streamRadius:2700,landmarks:["resort-belt"]},
    {id:"outer-vegas",label:"OUTER LAS VEGAS",status:"planned",anchor:"world",offset:[0,0],half:[5200,5200],streamRadius:6200,landmarks:["valley-grid"]}
  ]
};

window.JC_SATELLITE_ALIGNMENT=window.JC_VEGAS_SECTIONS.alignment;
window.JC_SOUTH_STRIP_GEO_ANCHORS=[
  {name:"MANDALAY BAY",lat:36.09201,lon:-115.17482,evidence:"supported",source:"OSM-derived building reference"},
  {name:"LUXOR",lat:36.09547,lon:-115.17580,evidence:"supported",source:"OSM-derived building reference"},
  {name:"EXCALIBUR",lat:36.09900,lon:-115.17530,evidence:"supported",source:"map/geospatial reference"},
  {name:"NEW YORK-NEW YORK",lat:36.10215,lon:-115.17459,evidence:"supported",source:"OSM-derived building reference"},
  {name:"PARK MGM",lat:36.10473,lon:-115.17524,evidence:"supported",source:"OSM-derived building reference"},
  {name:"MGM GRAND",lat:36.10271,lon:-115.16985,evidence:"supported",source:"OSM-derived building reference",markerOnly:true},
  {name:"ALLEGIANT STADIUM",lat:36.09074,lon:-115.18333,evidence:"supported",source:"OSM-derived building reference",markerOnly:true}
];

window.JC_RENAMED_LANDMARKS=window.JC_VEGAS_SECTIONS.sections
  .filter(section=>section.id.startsWith("strip-"))
  .flatMap(section=>section.landmarks.map(name=>({name,section:section.id,status:"implemented"})));
window.JC_FULL_STRIP={
  status:"playable",
  southToNorthWorldSpan:8400,
  sections:["strip-south","strip-core","strip-north"],
  features:["OSM boulevard spine","continuous collision surface","sidewalks","crosswalks","streetlights","evidence-tagged landmark districts","HD model streaming","mobile performance caps","South Strip satellite calibration overlay","260 source-confirmed Zone 1 building footprints","source-confirmed Allegiant Stadium footprint","persistent static grounding anchors"],
  verification:{identity:"supported",geometry:"provisional-overall",southStripAlignment:"satellite-footprints-v3",southStripFootprints:"SOURCE_CONFIRMED",allegiantFootprint:"SOURCE_CONFIRMED",southStripHeights:"ESTIMATED",southStripArchitecture:"UNKNOWN",exactFootprintsPending:false,seamGapTargetMeters:0.25,staticGrounding:"enabled"}
};
// Parser-inserted modules patch Three.js before the main game module initializes.
// V toggles satellite calibration. F toggles the main source-confirmed Zone 1 footprint layer.
document.write('<script type="module" src="./jc-the-holy-og-assets/full-strip-runtime.js"><\/script>');
document.write('<script type="module" src="./jc-the-holy-og-assets/satellite-alignment-runtime.js"><\/script>');
document.write('<script type="module" src="./jc-the-holy-og-assets/zone1-footprint-runtime.js"><\/script>');
document.write('<script type="module" src="./jc-the-holy-og-assets/zone1-allegiant-runtime.js"><\/script>');
document.write('<script type="module" src="./jc-the-holy-og-assets/static-grounding-runtime.js"><\/script>');
