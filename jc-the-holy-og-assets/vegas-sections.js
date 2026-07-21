window.JC_VEGAS_SECTIONS={
  version:1,
  coordinateSystem:"strip-anchor-local",
  sections:[
    {id:"strip-core",label:"CENTRAL STRIP",status:"in_progress",anchor:"strip",offset:[0,0],half:[1150,1450],streamRadius:2900,landmarks:["sphere-zone","pyramid-zone","tower-zone"]},
    {id:"strip-south",label:"SOUTH STRIP",status:"planned",anchor:"strip",offset:[0,2200],half:[1250,850],streamRadius:2600,landmarks:["airport-gateway"]},
    {id:"strip-north",label:"NORTH STRIP",status:"planned",anchor:"strip",offset:[0,-2200],half:[1250,850],streamRadius:2600,landmarks:["resort-corridor"]},
    {id:"downtown",label:"DOWNTOWN LAS VEGAS",status:"planned",anchor:"world",offset:[-250,-2450],half:[1350,900],streamRadius:2600,landmarks:["fremont-core"]},
    {id:"paradise-east",label:"PARADISE EAST",status:"planned",anchor:"world",offset:[1950,-150],half:[1100,1600],streamRadius:2700,landmarks:["convention-zone"]},
    {id:"west-resorts",label:"WEST RESORTS",status:"planned",anchor:"world",offset:[-1900,-150],half:[1050,1700],streamRadius:2700,landmarks:["resort-belt"]},
    {id:"outer-vegas",label:"OUTER LAS VEGAS",status:"planned",anchor:"world",offset:[0,0],half:[3450,3450],streamRadius:5000,landmarks:["valley-grid"]}
  ]
};
window.JC_RENAMED_LANDMARKS=[
  {sourceArchetype:"circus resort",name:"CLOWN TOWN",section:"strip-core",status:"implemented"},
  {sourceArchetype:"classical palace resort",name:"ROYAL PALACE",section:"strip-core",status:"implemented"},
  {sourceArchetype:"green mega-resort",name:"NGM",section:"strip-core",status:"implemented"},
  {sourceArchetype:"curved bronze luxury towers",name:"THE WIN",section:"strip-core",status:"implemented"},
  {sourceArchetype:"twin resort towers",name:"THE PINE",section:"strip-core",status:"implemented"},
  {sourceArchetype:"pyramid resort",name:"THE PYRAMID",section:"strip-core",status:"implemented"}
];
if(window.JC_VEGAS_SECTIONS&&Array.isArray(window.JC_VEGAS_SECTIONS.sections)){const s=window.JC_VEGAS_SECTIONS.sections.find(v=>v.id==="strip-core");if(s)s.landmarks=window.JC_RENAMED_LANDMARKS.map(v=>v.name)}