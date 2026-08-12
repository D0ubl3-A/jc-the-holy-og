window.JC_VEGAS_SECTIONS={
  version:3,
  coordinateSystem:"strip-anchor-local",
  fullStrip:true,
  sections:[
    {id:"strip-south",label:"SOUTH STRIP",status:"implemented",anchor:"strip",offset:[0,2850],half:[1500,1900],streamRadius:3600,landmarks:["MANDALAY BAY","LUXOR","EXCALIBUR","NEW YORK-NEW YORK","PARK MGM","ARIA"]},
    {id:"strip-core",label:"CENTRAL STRIP",status:"implemented",anchor:"strip",offset:[0,200],half:[1500,1850],streamRadius:3600,landmarks:["BELLAGIO","CAESARS PALACE","FLAMINGO","THE VENETIAN","THE SPHERE","WYNN LAS VEGAS"]},
    {id:"strip-north",label:"NORTH STRIP",status:"implemented",anchor:"strip",offset:[0,-2850],half:[1500,1900],streamRadius:3600,landmarks:["FONTAINEBLEAU","SAHARA","THE STRAT","ARTS DISTRICT GATE","DOWNTOWN GATE"]},
    {id:"downtown",label:"DOWNTOWN LAS VEGAS",status:"planned",anchor:"world",offset:[-250,-5200],half:[1350,900],streamRadius:2600,landmarks:["fremont-core"]},
    {id:"paradise-east",label:"PARADISE EAST",status:"planned",anchor:"world",offset:[1950,-150],half:[1100,1600],streamRadius:2700,landmarks:["convention-zone"]},
    {id:"west-resorts",label:"WEST RESORTS",status:"planned",anchor:"world",offset:[-1900,-150],half:[1050,1700],streamRadius:2700,landmarks:["resort-belt"]},
    {id:"outer-vegas",label:"OUTER LAS VEGAS",status:"planned",anchor:"world",offset:[0,0],half:[5200,5200],streamRadius:6200,landmarks:["valley-grid"]}
  ]
};
window.JC_RENAMED_LANDMARKS=window.JC_VEGAS_SECTIONS.sections
  .filter(section=>section.id.startsWith("strip-"))
  .flatMap(section=>section.landmarks.map(name=>({name,section:section.id,status:"implemented"})));
window.JC_FULL_STRIP={
  status:"playable",
  southToNorthWorldSpan:8400,
  sections:["strip-south","strip-core","strip-north"],
  features:["OSM boulevard spine","continuous collision surface","sidewalks","crosswalks","streetlights","17 evidence-tagged landmark districts","HD model streaming","mobile performance caps"],
  verification:{identity:"supported",geometry:"provisional",exactFootprintsPending:true,seamGapTargetMeters:0.25}
};
// This module is parser-inserted before the main game module, so it can patch
// Three.js safely and repair the legacy Strip anchor bug before initialization.
document.write('<script type="module" src="./jc-the-holy-og-assets/full-strip-runtime.js"><\/script>');
