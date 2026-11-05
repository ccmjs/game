/** Canvas decoration reads simulation time and never changes saved state. */
export function draw(game,ctx,phase){
  if(phase==="background"){
    const light=ctx.createRadialGradient(470,230,20,470,230,650);light.addColorStop(0,"#183c49");light.addColorStop(1,"#0b172a");ctx.fillStyle=light;ctx.fillRect(0,0,960,528);
    for(let row=1;row<10;row++)for(let col=1;col<19;col++){
      const x=col*48,y=row*48;ctx.fillStyle=(row+col)%2?"rgba(96,159,167,.028)":"rgba(193,223,220,.035)";ctx.fillRect(x+2,y+2,44,44);
      ctx.strokeStyle="rgba(153,208,210,.05)";ctx.lineWidth=1;ctx.strokeRect(x+1.5,y+1.5,45,45);
      if((row*19+col)%9===0){ctx.fillStyle="#416577";ctx.fillRect(x+7,y+7,3,3);}
    }
    for(const cell of game.find("cell")){const glow=ctx.createRadialGradient(cell.x,cell.y,2,cell.x,cell.y,60);glow.addColorStop(0,"rgba(95,239,190,.13)");glow.addColorStop(1,"rgba(95,239,190,0)");ctx.fillStyle=glow;ctx.fillRect(cell.x-60,cell.y-60,120,120);}
    const portal=game.find("portal")[0];if(portal){ctx.strokeStyle=game.state.globals.remaining?"#5b547f":"#b8a1f5";ctx.lineWidth=1;ctx.setLineDash([3,6]);ctx.beginPath();ctx.arc(portal.x,portal.y,42,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    ctx.font="600 9px ui-sans-serif,system-ui";ctx.textAlign="center";
    ctx.fillStyle="#6c929e";ctx.fillText("START",120,302);ctx.fillStyle="#aa97d0";ctx.fillText("PORTAL",840,316);
  }
  if(phase==="world"){
    const drone=game.find("drone")[0];
    if(drone?.destination){ctx.save();ctx.strokeStyle="rgba(132,231,210,.32)";ctx.lineWidth=2;ctx.setLineDash([2,7]);ctx.beginPath();ctx.moveTo(drone.x,drone.y);for(const node of drone.route||[])ctx.lineTo(node.x,node.y);ctx.stroke();ctx.setLineDash([]);const x=(drone.destination.col+.5)*48,y=(drone.destination.row+.5)*48;ctx.strokeStyle="#a6e7d8";ctx.beginPath();ctx.arc(x,y,15+Math.sin(game.state.time*4)*2,0,Math.PI*2);ctx.stroke();ctx.restore();}
    for(const pulse of game.find("ripple")){const progress=Math.min(1,(game.state.time-pulse.bornAt)/.6);ctx.save();ctx.globalAlpha=(1-progress)*.7;ctx.strokeStyle="#b2ffe5";ctx.lineWidth=4*(1-progress)+1;ctx.beginPath();ctx.arc(pulse.x,pulse.y,12+143*progress,0,Math.PI*2);ctx.stroke();ctx.restore();}
    for(const guard of game.find("sentinel"))if(guard.stunnedUntil>game.state.time){ctx.save();ctx.fillStyle="#d3c4ff";ctx.font="bold 15px system-ui";ctx.fillText("· · ·",guard.x,guard.y-28);ctx.restore();}
  }
}
