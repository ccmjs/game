import { sprites } from "./art.mjs";
const S = 48;
const at = (object, col, row, properties = {}) => ({ object, x:(col+.5)*S, y:(row+.5)*S, ...properties });
const room = (title, cells, obstacles, sentinels, nextRoom) => {
  const tiles = Array.from({length:11},(_,r)=>Array.from({length:20},(_,c)=>r===0||r===10||c===0||c===19||c===10&&r!==5 ? "#" : "."));
  for(const [c,r] of obstacles) tiles[r][c]="#";
  return { title, width:960,height:528,tileSize:S,background:"#102334",tiles:tiles.map(row=>row.join("")),
    legend:{"#":{type:"wall"},".":null},tileTypes:{wall:{sprite:"wall",solid:true}},
    properties:{nextRoom,total:cells.length},instances:[at("director",1,1),at("drone",2,5),at("gate",10,5),at("portal",17,5),
      ...cells.map(([c,r])=>at("cell",c,r)),...sentinels.map(([c,r,min,max])=>at("sentinel",c,r,{minX:min*S+24,maxX:max*S+24}))] };
};
export const demoDefinition = {
  id:"orbit-workshop",schemaVersion:1,version:1,title:"Orbitwerkstatt",
  description:"Ein kleiner Reparaturroboter. Zwei stillgelegte Decks. Bring die Station wieder zum Leuchten.",
  labels:{eyebrow:"Eine kleine Reise durchs All",room:"Deck",next:"Zum nächsten Deck",resultTitle:"Energie wiederhergestellt",footer:"Antippen, entdecken, ausprobieren. Deine nächste Spielidee beginnt hier."},
  width:960,height:528,fps:60,seed:347,initialRoom:"charging_bay",view:{zoom:1},sprites,
  globals:{score:0,remaining:0,collected:0,tool:"move",pulseReadyAt:0,pulseStatus:"bereit",gateStatus:"geschlossen"},
  hud:[{label:"Energie fehlt",path:"globals.remaining"},{label:"Punkte",path:"globals.score"},{label:"Impuls",path:"globals.pulseStatus"},{label:"Schleuse",path:"globals.gateStatus"}],
  tools:[
    {id:"move",label:"Ansteuern",sprite:"move",key:"1",hint:"Tippe auf ein freies Feld oder eine Energiezelle. Der Roboter findet seinen Weg. Auch Pfeiltasten und WASD funktionieren."},
    {id:"pulse",label:"Impuls",sprite:"pulse",key:"2",hint:"Öffnet die nahe Schleuse und hält Wächter kurz an. Danach lädt der Impuls vier Sekunden nach. Tastenkürzel: E."},
  ],
  help:["Sammle alle leuchtenden Energiezellen und steuere dann das violette Portal an.","Tippe auf ein Ziel, um automatisch dorthin zu fliegen. Mit Pfeiltasten oder WASD steuerst du selbst.","Die Schleuse öffnet und schließt im Takt. Ein Impuls in ihrer Nähe öffnet sie sofort; er hält auch Wächter drei Sekunden lang an.","Ein Kontakt mit einem Wächter kostet fünf Punkte. Der Roboter ist danach kurz geschützt. Du kannst immer weiterspielen.","Speichern und Laden bewahren deinen Fortschritt. Pause hält auch Schleusen und Impulse an."],
  objects:{
    director:{visible:false,events:{roomStart:[{type:"orbit.startRoom"}],step:[{type:"orbit.update"}],pointer:[{type:"orbit.pointer"}],"command:tool":[{type:"orbit.tool"}],"keyDown:e":[{type:"orbit.pulse"}],"keyDown:E":[{type:"orbit.pulse"}]}},
    drone:{sprite:"drone",width:26,height:26,depth:0,properties:{route:[],destination:null,protectedUntil:0},events:{
      step:[{type:"orbit.fly"}],
      "collision:cell":[{type:"score",value:10},{type:"add",target:"global",path:"remaining",value:-1},{type:"add",target:"global",path:"collected",value:1},
        {type:"spawn",object:"spark",x:{ref:"other.x"},y:{ref:"other.y"}},{type:"destroy",target:"other"},{type:"orbit.collected"}],
      "collision:sentinel":[{type:"orbit.bump"}],
      "collision:portal":[{type:"if",condition:{op:"eq",args:[{ref:"global.remaining"},0]},then:[{type:"finish",result:{score:{ref:"global.score"},nextRoom:{ref:"state.room.nextRoom"},title:"Deck wieder am Netz!"}}]}]}},
    cell:{sprite:"cell",width:24,height:24,depth:3},
    gate:{sprite:"gate",width:38,height:48,depth:2,solid:true,events:{create:[{type:"alarm",name:"open",seconds:2.4}],"alarm:open":[{type:"orbit.openGate"}],"alarm:close":[{type:"orbit.closeGate"}]}},
    portal:{sprite:"portal",width:36,height:36,depth:4},
    sentinel:{sprite:"sentinel",width:28,height:28,depth:1,properties:{stunnedUntil:0,direction:1},events:{step:[{type:"orbit.patrol"}],"collision:tile":[{type:"orbit.reverseGuard"}]}},
    spark:{sprite:"spark",width:22,height:22,depth:-1,events:{create:[{type:"alarm",name:"fade",seconds:.45}],step:[{type:"add",path:"alpha",value:{op:"mul",args:[{ref:"dt"},-2]}}],"alarm:fade":[{type:"destroy"}]}},
    ripple:{visible:false,properties:{bornAt:0},events:{create:[{type:"alarm",name:"fade",seconds:.6}],"alarm:fade":[{type:"destroy"}]}},
  },
  rooms:{
    charging_bay:room("01 · Ladestation",[[3,2],[7,3],[6,8],[12,2],[16,4],[15,8]],[[4,4],[4,5],[4,6],[7,6],[7,7],[14,3],[14,4],[14,5],[14,6]],[],"mirror_garden"),
    mirror_garden:room("02 · Spiegelgarten",[[3,2],[7,2],[7,8],[3,8],[12,2],[16,2],[12,8],[16,8]],[[5,2],[5,3],[5,4],[5,7],[5,8],[7,7],[8,7],[14,2],[14,3],[14,7],[14,8]],[[6,5,3,8],[15,6,12,17]],null),
  },
};
