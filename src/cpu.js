/* =====================================================================
   THE COMPUTER PLAYER. It lines up every ball against every pocket,
   plays each good-looking shot through the real physics (the same code
   the game uses), judges the result with the real rules, and picks the
   best one. Easier levels look at fewer shots, pick from a wider spread
   and aim with a shakier hand.
   ===================================================================== */
const CPU_LEVELS=[
  {name:"EASY",   noise:0.040, pwrN:0.16, samples:7,  pick:4},
  {name:"MEDIUM", noise:0.015, pwrN:0.07, samples:22, pick:2},
  {name:"HARD",   noise:0.003, pwrN:0.02, samples:70, pick:1},
];
const POCKET_AIM=[[5,5],[TW-5,5],[5,TH-5],[TW-5,TH-5],[TW/2,2],[TW/2,TH-2]];
const gauss=()=>(Math.random()+Math.random()+Math.random()-1.5)/0.75;
function segClear(ax,ay,bx,by,S0,skip,rad){
  const dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy||1e-6;
  for(let i=1;i<16;i++){
    if(skip.includes(i)) continue; const p=S0.b[i]; if(!p) continue;
    let t=((p[0]-ax)*dx+(p[1]-ay)*dy)/L2; t=t<0?0:t>1?1:t;
    const qx=ax+dx*t-p[0],qy=ay+dy*t-p[1]; if(qx*qx+qy*qy<rad*rad) return false;
  }
  return true;
}
/* every sensible straight-in shot from the cue ball position c */
function genCandidates(S0,c,who){
  const out=[], T=legalTargets(S0,who);
  for(const t of T){
    const b=S0.b[t];
    for(let pk=0;pk<6;pk++){
      const pxy=POCKET_AIM[pk], dx=pxy[0]-b[0], dy=pxy[1]-b[1], dl=Math.sqrt(dx*dx+dy*dy)||1, dX=dx/dl, dY=dy/dl;
      const gx=b[0]-dX*2*BR, gy=b[1]-dY*2*BR;
      if(gx<BR||gx>TW-BR||gy<BR||gy>TH-BR) continue;
      const ux0=gx-c[0], uy0=gy-c[1], ul=Math.sqrt(ux0*ux0+uy0*uy0); if(ul<2) continue;
      const ux=ux0/ul, uy=uy0/ul, cosCut=ux*dX+uy*dY; if(cosCut<0.28) continue;
      if(!segClear(c[0],c[1],gx,gy,S0,[t],2*BR-0.6)) continue;
      if(!segClear(b[0],b[1],pxy[0],pxy[1],S0,[t],2*BR-1.2)) continue;
      const D=ul+dl, bias=cosCut*30-D*0.04;
      for(const dp of [0,0.13,0.3]) out.push({ux,uy,p:clamp(0.14+D/560+dp,0.1,1),bias,ball:t});
    }
  }
  out.sort((a,b)=>b.bias-a.bias);
  return out;
}
/* aim straight at a legal ball: always a legal first contact if the way is clear */
function directShots(S0,c,who){
  const out=[];
  for(const t of legalTargets(S0,who)){
    const b=S0.b[t], dx=b[0]-c[0], dy=b[1]-c[1], l=Math.sqrt(dx*dx+dy*dy)||1;
    for(const p of [0.35,0.6]) out.push({ux:dx/l,uy:dy/l,p,bias:-40-l*0.05,ball:t});
  }
  return out;
}
function b16With(S0,c){const b=S0.b.map(p=>p?p.slice():0);b[0]=c.slice();return b;}
function scoreResult(S0,J,who){
  const S1=J.S; let sc=0;
  if(S1.win===who) return 10000; if(S1.win!==-2) return -10000;
  if(J.foul) sc-=260;
  const myG=S1.groups[who];
  for(const n of J.pottedNow){
    if(n===0||n===8) continue;
    const mine=myG>=0?groupOf(n)===myG:true;
    if(mine) sc+=(J.foul?15:100); else sc-=(J.foul?0:45);
  }
  if(J.continues) sc+=55;
  /* leave the cue ball away from the rails when the turn goes on */
  const c=S1.b[0]; if(c&&J.continues){const e=Math.min(c[0],TW-c[0],c[1],TH-c[1]);sc+=Math.min(e,30)*0.3;}
  /* do not leave the opponent a free table: count their balls left clear of the pockets is too slow; keep it simple */
  return sc;
}
function cpuBreak(S0,L){
  const y=MID_Y+(L.pick>2?(Math.random()-0.5)*40:(Math.random()-0.5)*14), x=HEAD_X*(L.pick>2?0.6:0.9);
  const c=[q2(x),q2(y)], dx=FOOT_X-c[0], dy=MID_Y+(Math.random()-0.5)*2-c[1], l=Math.sqrt(dx*dx+dy*dy);
  const p=L.pick>2?0.82:L.pick===2?0.9:0.97;
  return unpackShot(packShot({ux:dx/l,uy:dy/l,p,sx:0,sy:0,h:S0.hand>0?c:null}));
}
function cpuPlan(S0,level){
  const L=CPU_LEVELS[level|0]||CPU_LEVELS[1], who=S0.turn, hand=S0.hand>0;
  if(S0.brk) return cpuBreak(S0,L);
  /* where the cue ball starts */
  let spots=[S0.b[0].slice()];
  if(hand){
    const pool=[], maxX=S0.hand===1?HEAD_X:TW-BR;
    for(let i=0;i<46;i++){const x=q2(BR+2+Math.random()*(maxX-BR-2)),y=q2(BR+2+Math.random()*(TH-2*BR-4));if(cueSpotOK(S0,x,y)) pool.push([x,y]);}
    if(!pool.length) pool.push(placeDefaultFor(S0));
    const scored=pool.map(p=>{const cs=genCandidates(S0,p,who);return {p,s:cs.length?cs[0].bias+cs.length*1.5:-99};}).sort((a,b)=>b.s-a.s);
    spots=scored.slice(0,L.pick>2?1:L.pick===2?3:6).map(o=>o.p);
    if(L.pick>=4) spots=[scored[Math.floor(Math.random()*scored.length)].p];
    if(L.pick===1) spots=scored.slice(0,3).map(o=>o.p);
  }
  const results=[];
  for(const c of spots){
    let cands=genCandidates(S0,c,who);
    const dir=directShots(S0,c,who);
    const pool=cands.slice(0,L.samples).concat(dir.slice(0,Math.max(3,L.samples>>2)));
    for(const k of pool){
      const shot={ux:k.ux,uy:k.uy,p:k.p,sx:0,sy:0};
      const res=simulateShot(b16With(S0,c),shot), J=judge(S0,res);
      results.push({sc:scoreResult(S0,J,who)+(k.bias||0)*0.2,shot,c});
    }
  }
  results.sort((a,b)=>b.sc-a.sc);
  if(!results.length){   /* nothing found: tap the nearest legal ball */
    const T=legalTargets(S0,who), c=spots[0]; const b=T.length?S0.b[T[0]]:[FOOT_X,MID_Y];
    const dx=b[0]-c[0],dy=b[1]-c[1],l=Math.sqrt(dx*dx+dy*dy)||1;
    return unpackShot(packShot({ux:dx/l,uy:dy/l,p:0.4,sx:0,sy:0,h:hand?c:null}));
  }
  const pickN=Math.min(L.pick,results.length), r=results[Math.floor(Math.random()*pickN)];
  const a=Math.atan2(r.shot.uy,r.shot.ux)+gauss()*L.noise, p=clamp(r.shot.p*(1+gauss()*L.pwrN),0.08,1);
  return unpackShot(packShot({ux:Math.cos(a),uy:Math.sin(a),p,sx:0,sy:0,h:hand?r.c:null}));
}
function placeDefaultFor(S0){
  const c=S0.b[0].slice(); if(cueSpotOK(S0,c[0],c[1])) return c;
  for(let r=0;r<80;r+=2) for(let k=0;k<12;k++){const a=k*0.5236,x=q2(c[0]+Math.cos(a)*r),y=q2(c[1]+Math.sin(a)*r);if(cueSpotOK(S0,x,y)) return [x,y];}
  return c;
}
