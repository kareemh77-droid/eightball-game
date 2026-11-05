/* =====================================================================
   START-UP
   ===================================================================== */
function checkRotate(){
  const portrait=coarse&&window.innerHeight>window.innerWidth*1.05;
  $("rotate").hidden=!portrait; $("rotBtn").hidden=!canLock;
}
$("rotBtn").addEventListener("click",goLandscape);
addEventListener("resize",()=>{layout();checkRotate();});
addEventListener("orientationchange",()=>setTimeout(()=>{layout();checkRotate();},200));
document.addEventListener("contextmenu",e=>e.preventDefault());
if("serviceWorker" in navigator&&location.protocol==="https:") navigator.serviceWorker.register("eightball-sw.js",{scope:"./eightball.html"}).catch(()=>{});
if("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message",e=>{if(e.data&&e.data.t==="open"&&e.data.g){if(mode==="online"&&G&&G.id===e.data.g){netPoll();}else netOpen(e.data.g);}});
document.fonts&&document.fonts.load("10px 'Pool Pixel'").catch(()=>{});
buildBalls(); buildTable(0); layout(); checkRotate();
showPanel("main");
requestAnimationFrame(frame);
(async function(){
  /* opened from a turn alert, or just come back: find out what is waiting */
  if(NET.prof){
    await netRefresh(); menuNote(); syncPush(false);
    let g=null; try{g=new URLSearchParams(location.search).get("g");}catch(e){}
    if(g){ netOpen(g); try{history.replaceState(null,"",location.pathname);}catch(e){} }
  }
})();
/* a way for the test scripts to look inside */
function __auto(lvl){
  if(!canAct()) return false; const sh=cpuPlan(S,lvl);
  if(phase==="place"){startAim();}
  if(sh.h) cuePos=sh.h.slice();
  aimA=Math.atan2(sh.uy,sh.ux); power=sh.p; pull=sh.p; spin=[sh.sx,sh.sy]; fire(); return true;
}
window.__eb={get BALLS(){return BALLS;},ctl:()=>CTL,pt:(x,y)=>{const d=window.devicePixelRatio||1;return [x*PS/d,y*PS/d];},get FX(){return FX;},get FY(){return FY;},refresh:netRefresh,open:netOpen,get NET(){return NET;},tick:(dt,n)=>{for(let i=0;i<(n||1);i++)update(dt);},auto:__auto,get S(){return S;},get phase(){return phase;},get mode(){return mode;},get G(){return G;},get power(){return power;},get spin(){return spin;},set aim(v){aimA=v;},get aim(){return aimA;},
  set pw(v){power=v;pull=v;},fire:()=>fire(),get cue(){return cuePos;},get sim(){return sim;},get rep(){return rep;},newCpu,newLocal,planFor:(lvl)=>cpuPlan(S,lvl),
  setS:s=>{S=s;beginTurn();},get names(){return names;},get replaying(){return replaying;},get anim(){return anim;},get msg(){return msgText;}};
