/** Small game-owned behaviours; rooms, collisions, scoring and alarms remain in the definition. */
const S=48, cell=entity=>({col:Math.floor(entity.x/S),row:Math.floor(entity.y/S)});
const message=(game,text)=>game.notify("message",{text});
const sound=(game,frequency,duration=.1)=>game.notify("sound",{frequency,duration,volume:.045,type:"sine"});
const passable=(game,col,row)=>row>0&&row<10&&col>0&&col<19&&!game.tile(col,row)&&!game.find("gate").some(gate=>gate.solid&&Math.floor(gate.x/S)===col&&Math.floor(gate.y/S)===row);
export function findRoute(game,from,to) {
  if(!passable(game,to.col,to.row))return null;
  const key=n=>`${n.col},${n.row}`, queue=[from], parents=new Map([[key(from),null]]);
  for(let i=0;i<queue.length;i++){
    const n=queue[i];if(key(n)===key(to)){const route=[];let next=n;while(next){route.unshift({x:(next.col+.5)*S,y:(next.row+.5)*S});next=parents.get(key(next));}return route;}
    for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){const next={col:n.col+dx,row:n.row+dy};if(passable(game,next.col,next.row)&&!parents.has(key(next))){parents.set(key(next),n);queue.push(next);}}
  }return null;
}
function openGate(game,gate){gate.solid=false;gate.alpha=.22;gate.alarms.close=3;delete gate.alarms.open;game.state.globals.gateStatus="offen";game.state.globals.routeRevision=(game.state.globals.routeRevision||0)+1;}
function pulse(game){const g=game.state.globals,drone=game.find("drone")[0];if(!drone)return;if(game.state.time<g.pulseReadyAt){message(game,"Der Impuls lädt noch nach. Gleich ist er wieder bereit.");return;}
  g.pulseReadyAt=game.state.time+4;game.spawn("ripple",drone.x,drone.y,{bornAt:game.state.time});sound(game,280,.25);
  for(const gate of game.find("gate"))if(Math.hypot(gate.x-drone.x,gate.y-drone.y)<=155)openGate(game,gate);
  for(const guard of game.find("sentinel"))if(Math.hypot(guard.x-drone.x,guard.y-drone.y)<=155)guard.stunnedUntil=game.state.time+3;
  message(game,"Impuls! Nahe Wächter ruhen, die nahe Schleuse öffnet sich.");
}
export const actions={
  "orbit.startRoom"(game){const g=game.state.globals;g.remaining=game.find("cell").length;g.collected=0;g.tool="move";g.pulseReadyAt=game.state.time;g.gateStatus="geschlossen";g.routeRevision=0;message(game,game.state.roomId==="charging_bay"?"Willkommen an Bord! Tippe eine leuchtende Energiezelle an und folge deinem Roboter.":"Wächter patrouillieren auf diesem Deck. Halte sie mit einem gut getimten Impuls an.");},
  "orbit.update"(game){game.state.globals.pulseStatus=game.state.time>=game.state.globals.pulseReadyAt?"bereit":`${Math.ceil(game.state.globals.pulseReadyAt-game.state.time)} s`;const portal=game.find("portal")[0];if(portal)portal.alpha=game.state.globals.remaining===0?1:.4;},
  "orbit.pointer"(game,{input}){if(input.button>0)return;const drone=game.find("drone")[0],target=cell(input);if(!drone||target.col<1||target.col>18||target.row<1||target.row>9)return;
    if(game.tile(target.col,target.row)){message(game,"Diese Kiste versperrt den Weg. Wähle ein freies Feld.");return;}
    drone.destination=target;drone.route=[];drone.routeRevision=-1;
    message(game,input.target?.object==="portal"&&game.state.globals.remaining?"Das Portal braucht erst alle Energiezellen dieses Decks.":"Ziel gesetzt. Dein Roboter findet den Weg und wartet bei Bedarf auf die Schleuse.");},
  "orbit.tool"(game,{input}){if(input.tool==="pulse")pulse(game);game.state.globals.tool="move";},
  "orbit.pulse":pulse,
  "orbit.fly"(game,{self,dt}){let dx=Number(game.keys.has("ArrowRight")||game.keys.has("d")||game.keys.has("D"))-Number(game.keys.has("ArrowLeft")||game.keys.has("a")||game.keys.has("A"));
    let dy=Number(game.keys.has("ArrowDown")||game.keys.has("s")||game.keys.has("S"))-Number(game.keys.has("ArrowUp")||game.keys.has("w")||game.keys.has("W"));
    if(dx||dy){self.destination=null;self.route=[];}else if(self.destination){
      const revision=game.state.globals.routeRevision;
      if(!self.route?.length||self.routeRevision!==revision){self.route=findRoute(game,cell(self),self.destination)||[];self.routeRevision=revision;}
      while(self.route.length&&Math.hypot(self.route[0].x-self.x,self.route[0].y-self.y)<1)self.route.shift();
      if(self.route.length){dx=self.route[0].x-self.x;dy=self.route[0].y-self.y;}else if(cell(self).col===self.destination.col&&cell(self).row===self.destination.row)self.destination=null;
    }
    const length=Math.hypot(dx,dy),speed=self.destination?Math.min(150,length/Math.max(dt,.001)):150;
    self.vx=length?dx/length*speed:0;self.vy=length?dy/length*speed:0;
    self.angle=Math.max(-8,Math.min(8,self.vx*.045));self.alpha=self.protectedUntil>game.state.time ? .55+.35*Math.sin(game.state.time*24) : 1;
  },
  "orbit.openGate"(game,{self}){openGate(game,self);},
  "orbit.closeGate"(game,{self}){const drone=game.find("drone")[0];if(drone&&Math.abs(drone.x-self.x)<42&&Math.abs(drone.y-self.y)<38){self.alarms.close=.4;return;}self.solid=true;self.alpha=1;self.alarms.open=2.4;game.state.globals.gateStatus="geschlossen";game.state.globals.routeRevision++;},
  "orbit.collected"(game){sound(game,620+game.state.globals.collected*55);if(game.state.globals.remaining===0)message(game,"Alle Energiezellen sind geborgen! Das violette Portal ist jetzt bereit.");},
  "orbit.patrol"(game,{self}){self.alpha=self.stunnedUntil>game.state.time ? .45 : 1;if(self.stunnedUntil>game.state.time){self.vx=0;return;}if(self.x>=self.maxX)self.direction=-1;if(self.x<=self.minX)self.direction=1;self.vx=self.direction*70;},
  "orbit.reverseGuard"(game,{self}){self.direction*=-1;},
  "orbit.bump"(game,{self,other}){if(self.protectedUntil>game.state.time||other.stunnedUntil>game.state.time)return;game.state.globals.score=Math.max(0,game.state.globals.score-5);self.protectedUntil=game.state.time+2.5;other.direction*=-1;sound(game,150,.16);message(game,"Ein kleiner Zusammenstoß: fünf Punkte weniger. Ein Impuls hält den Wächter an.");},
};
export function cursor(game,{x,y}){if(game.state.finished)return "default";const target=cell({x,y});return passable(game,target.col,target.row)?"crosshair":"not-allowed";}
