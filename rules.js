/* =====================================================================
   RULES: the rack, the table state that is saved and sent to the other
   phone, and judge(), which turns a finished shot into the next state.
   Standard 8-ball: solids and stripes, the table is open until someone
   legally pockets a ball after the break, fouls give the other player the
   cue ball anywhere, and the 8 wins or loses the game.
   State S (plain data, goes to the server as JSON):
     v:1  seed  n (shots so far)  turn (0 or 1: who shoots next)
     groups:[g0,g1]  -1 open, 0 solids, 1 stripes
     hand: 0 none, 1 cue ball behind the head string, 2 anywhere
     brk: true until the break shot has been taken
     b: 16 entries, [x,y] on the table or 0 when pocketed
     win: -2 playing, 0/1 the winner   why: short text for the last result
   ===================================================================== */
function rackPositions(){
  const out=[], dx=BR*1.7320508*1.0015, dy=BR*2.004;
  for(let r=0;r<5;r++) for(let c=0;c<=r;c++) out.push([q2(FOOT_X+r*dx),q2(MID_Y+(c-r/2)*dy)]);
  return out;
}
function newTable(seed,firstShooter){
  const rnd=mulberry32(seed|0), pos=rackPositions(), spots=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14];
  const nums=[1,2,3,4,5,6,7,9,10,11,12,13,14,15];
  for(let i=nums.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=nums[i];nums[i]=nums[j];nums[j]=t;}
  const at=Array(15).fill(0); at[4]=8;                          /* the 8 sits in the middle of the third row */
  /* the back corners of the rack: one solid and one stripe */
  const si=nums.findIndex(n=>n<8), ti=nums.findIndex(n=>n>8);
  at[10]=nums.splice(si,1)[0]; const ti2=nums.findIndex(n=>n>8); at[14]=nums.splice(ti2,1)[0];
  if(rnd()<0.5){const t=at[10];at[10]=at[14];at[14]=t;}
  let k=0; for(let i=0;i<15;i++) if(!at[i]) at[i]=nums[k++];
  const b=Array(16).fill(0); b[0]=[HEAD_X,MID_Y];
  for(let i=0;i<15;i++) b[at[i]]=pos[i];
  return {v:1,seed:seed|0,n:0,turn:firstShooter|0,groups:[-1,-1],hand:1,brk:true,win:-2,why:"",b};
}
const cloneS=S=>JSON.parse(JSON.stringify(S));
/* how many balls of a group are still on the table */
function leftOf(S,g){let n=0;for(let i=1;i<16;i++) if(S.b[i]&&groupOf(i)===g) n++;return n;}
/* which ball(s) the shooter has to hit first: "open", a group number, or "eight" */
function targetOf(S,who){
  const g=S.groups[who]; if(g<0) return "open";
  return leftOf(S,g)>0?g:"eight";
}
function freeSpot(S,x,y,dir){   /* nearest free place for a re-spotted ball, walking along the table */
  for(let k=0;k<60;k++){
    const px=x+dir*k*2, ok=S.b.every((p,i)=>i===0?true:!p||sqr(p[0]-px)+sqr(p[1]-y)>=sqr(2*BR+0.2));
    if(ok&&px>BR&&px<TW-BR) return [q2(px),q2(y)];
  }
  return [x,y];
}
/* is a spot allowed for placing the cue ball? */
function cueSpotOK(S,x,y){
  if(x<BR||x>TW-BR||y<BR||y>TH-BR) return false;
  if(S.hand===1&&x>HEAD_X) return false;
  for(let i=1;i<16;i++){const p=S.b[i];if(p&&sqr(p[0]-x)+sqr(p[1]-y)<sqr(2*BR+0.3)) return false;}
  return pocketAt(x,y)<0;
}
/* res: {balls, firstHit, railAfter, pocketed:[ball numbers in order]}. Returns {S,foul,notes,pottedNow,continues} */
function judge(S0,res){
  const S=cloneS(S0), me=S.turn, opp=1-me, brk=S.brk, open0=S.groups[0]<0;
  const tgt=targetOf(S0,me);
  S.b=res.balls.map(p=>p?[q2(p[0]),q2(p[1])]:0);
  const pot=res.pocketed.filter(n=>n!==0), cueGone=res.pocketed.includes(0), eight=res.pocketed.includes(8);
  const notes=[]; let foul=false;
  if(cueGone){foul=true;notes.push("Scratch");}
  if(res.firstHit<0){foul=true;notes.push("No ball hit");}
  else{
    const hg=groupOf(res.firstHit);
    const legal=tgt==="open"?res.firstHit!==8:tgt==="eight"?res.firstHit===8:hg===tgt;
    if(!legal&&!brk){foul=true;notes.push(tgt==="eight"?"Hit the wrong ball: the 8 comes last":"Hit the wrong ball first");}
  }
  if(!brk&&!foul&&res.firstHit>=0&&pot.length===0&&!res.railAfter){foul=true;notes.push("No ball reached a rail");}
  S.n++; S.brk=false; S.hand=0; S.why="";
  /* the 8-ball */
  if(eight){
    if(brk){
      S.b[8]=freeSpot(S,FOOT_X,MID_Y,1);          /* the 8 on the break goes back on its spot */
      notes.push("8 spotted again");
    } else {
      const cleared=S.groups[me]>=0&&leftOf(S0,S.groups[me])===0;
      const ok=cleared&&!foul;
      S.win=ok?me:opp;
      S.why=ok?"Sank the 8 ball!":cueGone?"Scratched on the 8 ball":!cleared?"Sank the 8 too early":"Fouled on the 8 ball";
      S.turn=me; S.hand=0; if(cueGone) S.b[0]=[HEAD_X,MID_Y];
      return {S,foul,notes:[S.why],pottedNow:res.pocketed.slice(),continues:false};
    }
  }
  /* groups on an open table: the first ball legally pocketed after the break picks the group */
  if(!brk&&open0&&!foul&&pot.length){
    const first=pot.find(n=>n!==8);
    if(first!==undefined){S.groups[me]=groupOf(first);S.groups[opp]=1-groupOf(first);}
  }
  /* does the turn go on? */
  let continues=false;
  if(!foul){
    if(brk) continues=pot.some(n=>n!==8);
    else if(S.groups[me]>=0) continues=pot.some(n=>groupOf(n)===S.groups[me]);
    else continues=false;
  }
  if(cueGone){
    S.b[0]=[HEAD_X,MID_Y];
    S.hand=brk?1:2;                                   /* a scratch on the break: behind the head string */
  } else if(foul) S.hand=2;
  if(foul){S.turn=opp;S.hand=S.hand||2;}
  else if(!continues) S.turn=opp;
  if(!S.why) S.why=foul?notes.filter(Boolean).join(". "):(continues?"Shoot again":"");
  return {S,foul,notes:notes.filter(Boolean),pottedNow:res.pocketed.slice(),continues};
}
/* the shot as it travels over the wire / into a replay: everything is rounded the same way on both phones */
function packShot(sh){return {a:[Math.round(sh.ux*1e6)/1e6,Math.round(sh.uy*1e6)/1e6],p:Math.round(sh.p*1000)/1000,s:[Math.round((sh.sx||0)*100)/100,Math.round((sh.sy||0)*100)/100],h:sh.h?[q2(sh.h[0]),q2(sh.h[1])]:null};}
function unpackShot(o){return {ux:o.a[0],uy:o.a[1],p:o.p,sx:o.s[0],sy:o.s[1],h:o.h||null};}
