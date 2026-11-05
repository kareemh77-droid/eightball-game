/* =====================================================================
   PLAY: the game flow (whose turn, aiming, shooting, replaying a friend's
   shots), the touch controls, and the frame loop.
   phase: title | place | aim | script (a cue stroke is being shown) | roll (balls moving)
          | cpu (the computer is thinking) | wait (online: the friend is shooting) | over
   ===================================================================== */
let S=null, phase="title", mode="cpu", names=["PLAYER 1","PLAYER 2"], myIdx=0, cpuLevel=1;
let sim=null, cuePos=[HEAD_X,MID_Y], aimA=0, pull=0, power=0, spin=[0,0], cueShow=true;
let replaying=false, chatUnread=0, msgText="", msgT=0, anim=null, rep=null, accT=0, ovl=0, fineDir=0, fineT=0;
const timers=[];
const after=(sec,fn)=>{timers.push({t:sec,fn});};
const isHuman=p=>mode==="local"||(mode==="cpu"?p===0:p===myIdx);
const canAct=()=>!!S&&!replaying&&ovl===0&&(phase==="aim"||phase==="place")&&isHuman(S.turn);
const ease=k=>k<0?0:k>1?1:k*k*(3-2*k);

/* ---- what the status strip on the top rail says ---- */
function statusText(){
  if(!S||phase==="title"||phase==="over") return "";
  if(msgT>0&&msgText) return msgText;
  const who=(names[S.turn]||"").toUpperCase().slice(0,9);
  if(phase==="place") return canAct()?(S.hand===1?"PLACE BEHIND LINE":"PLACE THE CUE BALL"):who+" PLACES";
  if(phase==="aim") return mode==="local"?who+" TO SHOOT":(S.brk?"YOUR BREAK":"YOUR SHOT");
  if(phase==="cpu") return who+" IS THINKING";
  if(phase==="wait") return "WAITING FOR "+who;
  if((phase==="script"||phase==="roll")&&(replaying||!isHuman(S.turn))) return who+"'S SHOT";
  return "";
}
function say(t,sec){msgText=t;msgT=sec||2.2;}

/* ---- starting a table ---- */
function startTable(m,seed,first,nm,my){
  mode=m; names=nm; myIdx=my|0; S=newTable(seed,first); replaying=false; rep=null; sim=null; anim=null; timers.length=0;
  beginTurn(); saveLocal();
}
function beginTurn(){
  sim=null; anim=null; accT=0; pull=0; power=0; spin=[0,0]; fineDir=0;
  if(!S) return;
  if(S.win!==-2){endGame();return;}
  cuePos=S.b[0].slice();
  if(isHuman(S.turn)){
    if(mode==="online") visitBegin();
    if(S.hand&&!S.brk) startPlace(); else startAim();
  } else if(mode==="cpu"){
    phase="cpu"; cueShow=false; after(0.9,cpuTurn);
  } else { phase="wait"; cueShow=false; }
  saveLocal();
}
function startAim(){
  phase="aim"; cueShow=true; power=0; pull=0; spin=[0,0]; cuePos=S.b[0].slice(); aimA=defaultAim();
}
function startPlace(keep){
  phase="place"; cueShow=false; cuePos=(keep&&cueSpotOK(S,cuePos[0],cuePos[1]))?cuePos.slice():placeDefault();
}
function placeDefault(){
  let c=S.b[0].slice(); if(cueSpotOK(S,c[0],c[1])) return c;
  for(let r=0;r<60;r+=2) for(let k=0;k<12;k++){const a=k*0.5236,x=q2(c[0]+Math.cos(a)*r),y=q2(c[1]+Math.sin(a)*r);if(cueSpotOK(S,x,y)) return [x,y];}
  return c;
}
function legalTargets(S0,who){
  const t=targetOf(S0,who), out=[];
  for(let i=1;i<16;i++){ if(!S0.b[i]) continue; if(t==="open"?i!==8:t==="eight"?i===8:groupOf(i)===t) out.push(i); }
  return out;
}
function defaultAim(){
  const c=cuePos, L=legalTargets(S,S.turn); let best=-1,bd=1e9;
  for(const i of L){const p=S.b[i],d=sqr(p[0]-c[0])+sqr(p[1]-c[1]);if(d<bd){bd=d;best=i;}}
  if(S.brk||best<0) return Math.atan2(MID_Y-c[1],FOOT_X-c[0]);
  return Math.atan2(S.b[best][1]-c[1],S.b[best][0]-c[0]);
}

/* ---- shooting ---- */
function fire(){
  if(!canAct()||phase!=="aim"||power<0.04){power=0;pull=0;return;}
  const raw={ux:Math.cos(aimA),uy:Math.sin(aimA),p:power,sx:spin[0],sy:spin[1],h:S.hand>0?cuePos:null};
  const shot=unpackShot(packShot(raw));
  if(mode==="online") visitShot(shot);
  strike(shot);
}
/* the cue slides forward, then the balls start to move */
function strike(shot){
  phase="script"; cueShow=true; aimA=Math.atan2(shot.uy,shot.ux); spin=[shot.sx,shot.sy]; power=shot.p;
  anim={stage:"strike",t:0,shot,from:pull};
}
function startSim(shot){
  const b16=S.b.map(p=>p?p.slice():0); if(shot.h) b16[0]=shot.h.slice();
  sim=new Sim(b16,true); sim.shoot(shot.ux,shot.uy,shot.p,shot.sx,shot.sy);
  phase="roll"; cueShow=false; accT=0; pull=0; power=0;
}
function rollStep(dt){
  accT=Math.min(accT+dt,0.06); let n=Math.floor(accT*240); accT-=n/240; let done=false;
  while(n-->0){sim.step(); if(!sim.moving()||sim.steps>=MAX_STEPS){done=true;break;}}
  for(const e of sim.ev) fxEvent(e);
  sim.ev.length=0;
  if(done) finishShot();
}
function fxEvent(e){
  if(e.k==="cue"){SFX.cue(e.p);addSpark(e.x,e.y,4,"#cfe8ff");}
  else if(e.k==="ball"){SFX.ball(e.v);if(e.v>180)addSpark(e.x,e.y,Math.min(6,Math.round(e.v/90)));}
  else if(e.k==="rail") SFX.rail(e.v);
  else if(e.k==="pocket"){SFX.pocket();const xy=POCKET_XY[e.p];SINKS.push({n:e.ball,x:e.x,y:e.y,tx:xy[0],ty:xy[1],t:0});addSpark(xy[0],xy[1],8,"#ffd45a");}
}
function finishShot(){
  const res={balls:sim.snapshot(),firstHit:sim.firstHit,railAfter:sim.railAfter,pocketed:sim.pocketed.slice()};
  const was=S.turn, J=judge(S,res); S=J.S; sim=null; accT=0; cuePos=S.b[0].slice();
  if(S.win!==-2){ after(0.9,()=>replaying?repNext():(mode==="online"&&visitSend(),beginTurn())); return; }
  if(J.foul){
    SFX.foul(); addCall("FOUL","#ff6a5a",20,1.5);
    const n=(J.notes[0]||""); say(n.startsWith("Scratch")?"SCRATCH":n.startsWith("No ball hit")?"MISSED THE BALLS":n.startsWith("No ball reached")?"NO BALL HIT A RAIL":n.startsWith("Hit the wrong ball:")?"THE 8 COMES LAST":n.startsWith("Hit")?"WRONG BALL FIRST":"FOUL",2.6);
  }
  if(!J.foul&&S.n>0&&J.continues) say("SHOOT AGAIN",1.6);
  /* the table was open and this pot picked the groups */
  const gAfter=S.groups[was]; if(gAfter>=0&&anim_openBefore){say(names[was].toUpperCase().slice(0,9)+": "+GROUP_NAME[gAfter],2.6);}
  anim_openBefore=false;
  if(S.turn!==was&&!J.foul) SFX.turn();
  after(replaying?0.7:0.85,()=>{ if(replaying) repNext(); else {if(mode==="online"&&(S.turn!==myIdx)) visitSend(); beginTurn();} });
}
let anim_openBefore=false;
function animStep(dt){
  const a=anim; a.t+=dt;
  if(a.stage==="draw"){            /* the cue is drawn back (a replayed or computer shot) */
    const k=a.t/a.dur; pull=a.shot.p*ease(k);
    if(k>=1){a.stage="hold";a.t=0;}
  } else if(a.stage==="hold"){
    if(a.t>=0.18){a.stage="strike";a.t=0;a.from=pull;}
  } else if(a.stage==="strike"){
    const k=Math.min(1,a.t/0.07); pull=a.from*(1-k)-0.09*k;
    if(k>=1){const shot=a.shot; anim=null; anim_openBefore=S.groups[0]<0&&!S.brk; startSim(shot);}
  }
}
/* a shot played by the screen (the computer's, or a friend's being replayed) */
function scriptShot(shot){
  phase="script"; cueShow=true; sim=null;
  cuePos=(shot.h?shot.h.slice():S.b[0].slice()); if(shot.h) SFX.place();
  aimA=Math.atan2(shot.uy,shot.ux); spin=[shot.sx,shot.sy]; power=shot.p; pull=0;
  anim={stage:"draw",t:0,dur:0.35+0.5*shot.p,shot};
}
function cpuTurn(){
  if(phase!=="cpu") return;
  const sh=cpuPlan(S,cpuLevel); scriptShot(sh);
}

/* ---- watching a friend's shots (online) ---- */
function repStart(S0,shots,authStr,done){
  rep={S0,shots,i:0,auth:authStr,done}; S=JSON.parse(JSON.stringify(S0)); replaying=true; timers.length=0;
  names=names.slice(); cueShow=false; phase="script"; showReplayTag(true);
  after(0.9,repNext);
}
function repNext(){
  if(!rep) return;
  if(rep.i>=rep.shots.length){repFinish();return;}
  scriptShot(unpackShot(rep.shots[rep.i++]));
}
function repFinish(){
  const r=rep; rep=null; replaying=false; showReplayTag(false); anim=null; sim=null;
  const mine=JSON.stringify(S);
  S=JSON.parse(r.auth); if(mine!==r.auth) window.__ebMismatch=(window.__ebMismatch|0)+1;
  if(r.done) r.done(); else beginTurn();
}
function repSkip(){
  if(!rep) return; timers.length=0; anim=null; sim=null; repFinish();
}
function showReplayTag(on){const t=document.getElementById("replayTag");if(!t)return;t.hidden=!on;if(on)t.textContent="Watching "+(names[1-myIdx]||"your friend")+"'s turn";}

/* ---- the end of a game ---- */
function endGame(){
  phase="over"; cueShow=false; sim=null; anim=null;
  const w=S.win, mine=mode==="local"?true:mode==="cpu"?w===0:w===myIdx;
  if(mode==="local") SFX.win(); else if(mine) SFX.win(); else SFX.lose();
  const nm=names[w].toUpperCase().slice(0,12);
  addCall(mode==="local"?nm+" WINS":mine?"YOU WIN!":"YOU LOSE",mine?"#7dff8a":"#ff6a5a",20,3);
  if(mode==="online") netGameOver(); else clearLocal();
  showOver();
}

/* ---- saving a game against the computer or a friend on this phone ---- */
function saveLocal(){
  if(mode==="online"||!S||S.win!==-2) return;
  try{localStorage.setItem("eb-save",JSON.stringify({mode,names,cpuLevel,S}));}catch(e){}
}
function clearLocal(){try{localStorage.removeItem("eb-save");}catch(e){}}
function loadLocal(){try{return JSON.parse(localStorage.getItem("eb-save")||"null");}catch(e){return null;}}

/* ---- touch / mouse controls ---- */
const ptrs=new Map();
function tablePt(bx,by){return [bx-FX,by-FY];}
function overTable(bx,by){return bx>=OX&&bx<OX+TBL_W&&by>=OY&&by<OY+TBL_H;}
function setAimFrom(bx,by){
  const [tx,ty]=tablePt(bx,by); const dx=tx-cuePos[0],dy=ty-cuePos[1];
  if(dx*dx+dy*dy>25) aimA=Math.atan2(dy,dx);
}
let touchLift=0;
function setPlaceFrom(bx,by){
  let [tx,ty]=tablePt(bx,by); ty-=touchLift;   /* with a finger, the ball sits just above it so you can see it */ const maxX=S.hand===1?HEAD_X:TW-BR;
  tx=q2(clamp(tx,BR,maxX)); ty=q2(clamp(ty,BR,TH-BR)); cuePos=[tx,ty];
}
function setSpinFrom(bx,by){
  const Sp=CTL.spin; let sx=(bx-Sp.cx)/(Sp.r-3), sy=-(by-Sp.cy)/(Sp.r-3); const l=Math.sqrt(sx*sx+sy*sy); if(l>1){sx/=l;sy/=l;}
  spin=[Math.round(sx*100)/100,Math.round(sy*100)/100];
}
function setPowerFrom(by){const P=CTL.power; power=clamp((by-P.y)/P.h,0,1); pull=power;}
cv.addEventListener("pointerdown",e=>{
  audioInit(); e.preventDefault(); if(phase==="title"||!S) return;
  const [x,y]=toBuf(e.clientX,e.clientY); touchLift=e.pointerType==="touch"?9:0;
  try{cv.setPointerCapture(e.pointerId);}catch(_){}
  if(inRect(CTL.menu,x,y)){SFX.click();ptrs.set(e.pointerId,{k:"menu"});return;}
  if(mode==="online"&&inRect(CTL.chat,x,y)&&ovl===0){SFX.click();ptrs.set(e.pointerId,{k:"chat"});return;}
  if(replaying&&inRect(CTL.skip,x,y)){SFX.click();ptrs.set(e.pointerId,{k:"skip"});return;}
  if(!canAct()) return;
  if((phase==="place"||(phase==="aim"&&S.hand>0))&&inRect(CTL.ok,x,y)){ptrs.set(e.pointerId,{k:"ok"});return;}
  if(phase==="place"){ if(overTable(x,y)){setPlaceFrom(x,y);ptrs.set(e.pointerId,{k:"place"});} return; }
  /* aiming */
  const P=CTL.power;
  if(x>=P.x-11&&x<=P.x+P.w+11&&y>=P.y-12&&y<=P.y+P.h+14){setPowerFrom(y);ptrs.set(e.pointerId,{k:"power"});return;}
  for(const [nm,d] of [["fineL",-1],["fineR",1]]) if(inRect(CTL[nm],x,y)){fineDir=d;fineT=0;aimA+=d*0.0017;ptrs.set(e.pointerId,{k:"fine",d});return;}
  const Sp=CTL.spin; if(sqr(x-Sp.cx)+sqr(y-Sp.cy)<=sqr(Sp.r+4)){setSpinFrom(x,y);ptrs.set(e.pointerId,{k:"spin"});return;}
  if(overTable(x,y)){setAimFrom(x,y);ptrs.set(e.pointerId,{k:"aim"});}
});
cv.addEventListener("pointermove",e=>{
  const p=ptrs.get(e.pointerId); if(!p||!S) return; const [x,y]=toBuf(e.clientX,e.clientY);
  if(!canAct()&&p.k!=="menu"&&p.k!=="chat"&&p.k!=="skip") return;
  if(p.k==="power") setPowerFrom(y); else if(p.k==="aim") setAimFrom(x,y); else if(p.k==="spin") setSpinFrom(x,y);
  else if(p.k==="place") setPlaceFrom(x,y);
});
function ptrUp(e,cancel){
  const p=ptrs.get(e.pointerId); if(!p) return; ptrs.delete(e.pointerId); const [x,y]=toBuf(e.clientX,e.clientY);
  if(p.k==="power"){ if(cancel||power<0.04){power=0;pull=0;} else fire(); }
  else if(p.k==="fine") fineDir=0;
  else if(p.k==="menu"&&!cancel&&inRect(CTL.menu,x,y)) openPause();
  else if(p.k==="chat"&&!cancel&&inRect(CTL.chat,x,y)) openChat();
  else if(p.k==="skip"&&!cancel&&inRect(CTL.skip,x,y)) repSkip();
  else if(p.k==="ok"&&!cancel&&inRect(CTL.ok,x,y)&&canAct()){
    if(phase==="place"){if(cueSpotOK(S,cuePos[0],cuePos[1])){SFX.place();const keep=cuePos.slice();startAim();cuePos=keep;aimA=defaultAim();}}
    else {SFX.click();startPlace(true);}
  }
}
cv.addEventListener("pointerup",e=>ptrUp(e,false));
cv.addEventListener("pointercancel",e=>ptrUp(e,true));
/* keyboard, for playing on a computer */
const keys={};
addEventListener("keydown",e=>{
  if(e.target&&e.target.tagName==="INPUT") return; keys[e.key]=true;
  if(!canAct()||phase!=="aim") return;
  if(e.key==="ArrowUp"){power=clamp(power+0.05,0,1);pull=power;e.preventDefault();}
  else if(e.key==="ArrowDown"){power=clamp(power-0.05,0,1);pull=power;e.preventDefault();}
  else if(e.key===" "||e.key==="Enter"){e.preventDefault();if(power<0.04){power=0.5;pull=0.5;}fire();}
});
addEventListener("keyup",e=>{keys[e.key]=false;});

/* ---- the frame loop ---- */
let lastTs=0;
function update(dt){
  stepFx(dt); if(msgT>0) msgT-=dt;
  for(let i=timers.length-1;i>=0;i--){const t=timers[i];t.t-=dt;if(t.t<=0){timers.splice(i,1);t.fn();}}
  if(S&&canAct()&&phase==="aim"){
    let d=fineDir; if(keys.ArrowLeft) d=-1; else if(keys.ArrowRight) d=1;
    if(d){fineT+=dt;aimA+=d*(0.04+Math.min(0.26,fineT*0.13))*dt;}   /* a slow turn that speeds up the longer you hold */
    else fineT=0;
  }
  if(anim) animStep(dt);
  if(phase==="roll"&&sim) rollStep(dt);
}
function frame(ts){
  const dt=Math.min(0.05,Math.max(0,(ts-lastTs)/1000||0.016)); lastTs=ts;
  update(dt);
  if(phase==="title"||!S) drawTitle(dt); else drawGame();
  blit(); requestAnimationFrame(frame);
}
