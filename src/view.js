/* =====================================================================
   VIEW: the screen layout and everything that is drawn on the canvas.
   The game is drawn into a small "buffer" canvas (about 500 x 235 pixels)
   and that is scaled up to the real screen with no smoothing.
   ===================================================================== */
const cv=document.getElementById("cv"), dctx=cv.getContext("2d");
const buf=document.createElement("canvas"), bg=buf.getContext("2d");
let BW=0,BH=0,PS=1,OX=0,OY=0,FX=0,FY=0,floorCv=null,CTL={};
const MARGIN=46;
function layout(){
  const dpr=window.devicePixelRatio||1, cw=window.innerWidth, ch=window.innerHeight;
  const dw=Math.max(2,Math.round(cw*dpr)), dh=Math.max(2,Math.round(ch*dpr));
  PS=Math.max(1,Math.min(dh*0.975/TBL_H,dw/(TBL_W+2*MARGIN)));
  PS=Math.floor(PS*8)/8;
  BW=Math.ceil(dw/PS); BH=Math.ceil(dh/PS);
  buf.width=BW; buf.height=BH; bg.imageSmoothingEnabled=false;
  cv.width=dw; cv.height=dh; cv.style.width=cw+"px"; cv.style.height=ch+"px"; dctx.imageSmoothingEnabled=false;
  OX=Math.floor((BW-TBL_W)/2); OY=Math.floor((BH-TBL_H)/2); FX=OX+RAILW; FY=OY+RAILW;
  const [fc,fg]=mkCanvas(BW,BH); drawFloor(fg,BW,BH); floorCv=fc;
  const lm=OX, rm=BW-OX-TBL_W, lx=Math.round(lm/2), rx=Math.round(BW-rm/2);
  CTL={
    power:{x:lx-7,y:OY+22,w:14,h:TBL_H-80},
    fineL:{x:lx-21,y:OY+TBL_H-48,w:19,h:15},fineR:{x:lx+2,y:OY+TBL_H-48,w:19,h:15},
    spin:{cx:rx,cy:OY+58,r:15},
    menu:{x:rx-19,y:OY+3,w:38,h:14},
    ok:{x:rx-19,y:OY+TBL_H-70,w:38,h:18},
    chat:{x:rx-19,y:OY+TBL_H-46,w:38,h:15},
    skip:{x:rx-19,y:OY+TBL_H-24,w:38,h:15},
  };
}
const inRect=(r,x,y)=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;
function toBuf(clientX,clientY){const dpr=window.devicePixelRatio||1;return [clientX*dpr/PS,clientY*dpr/PS];}
function blit(){dctx.imageSmoothingEnabled=false;dctx.clearRect(0,0,cv.width,cv.height);dctx.drawImage(buf,0,0,BW,BH,0,0,BW*PS,BH*PS);}

/* ---- little panels in the Spellsiege cartridge style: dark slate with a gold border ---- */
function pbox(g,x,y,w,h,hot){
  R_(g,x,y,w,h,"#161324"); R_(g,x,y,w,1,hot?"#ffd45a":"#c9a24a");R_(g,x,y+h-1,w,1,hot?"#b88a22":"#8a6418");R_(g,x,y,1,h,hot?"#ffd45a":"#c9a24a");R_(g,x+w-1,y,1,h,hot?"#b88a22":"#8a6418");
  R_(g,x+1,y+1,w-2,1,"rgba(255,236,190,0.12)");
}
function pbtn(g,r,label,hot,dim){
  pbox(g,r.x,r.y,r.w,r.h,hot); if(dim){g.globalAlpha=0.4;}
  ptext(g,label,r.x+r.w/2,r.y+r.h/2+3.5,hot?"#ffd45a":"#f6efe0",10,"center"); g.globalAlpha=1;
}
/* mini balls for the player cards */
const MINI=[];
function miniBall(n){
  if(MINI[n]) return MINI[n];
  const [c,g]=mkCanvas(7,7), col=n===8?"#1a1a22":n===0?"#f4f0e4":BALL_COL[n>8?n-8:n], st=n>8;
  for(let y=0;y<7;y++)for(let x=0;x<7;x++){
    const dx=x-3,dy=y-3,d=dx*dx+dy*dy; if(d>9.5) continue;
    let c2=st&&Math.abs(dy)>1?"#f4f0e4":col; if(d>6) c2=shade(c2,-0.4); else if(dx<0&&dy<0) c2=shade(c2,0.25);
    R_(g,x,y,1,1,c2);
  }
  R_(g,3,3,1,1,"#f6f2e8"); MINI[n]=c; return c;
}

/* ---- effects: tiny particles and floating call-outs ---- */
const FXS=[], CALLS=[], SINKS=[];
function addSpark(x,y,n,col){for(let i=0;i<n;i++){const a=Math.random()*6.283,s=20+Math.random()*50;FXS.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:0,life:0.25+Math.random()*0.2,c:col||"#fff6d0"});}}
function addCall(txt,col,size,life){CALLS.push({txt,col:col||"#ffd45a",size:size||20,t:0,life:life||1.6});}
function stepFx(dt){
  for(let i=FXS.length-1;i>=0;i--){const f=FXS[i];f.t+=dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.vx*=0.94;f.vy*=0.94;if(f.t>f.life)FXS.splice(i,1);}
  for(let i=CALLS.length-1;i>=0;i--){CALLS[i].t+=dt;if(CALLS[i].t>CALLS[i].life)CALLS.splice(i,1);}
  for(let i=SINKS.length-1;i>=0;i--){SINKS[i].t+=dt;if(SINKS[i].t>0.45)SINKS.splice(i,1);}
}

/* ---- the balls ---- */
function ballList(){   /* what to draw: [n,x,y] */
  const out=[];
  if(sim&&phase==="roll"||(sim&&phase==="script"&&sim.steps>0)){for(const b of sim.b) if(b.alive) out.push([b.id,b.x,b.y]);return out;}
  if(!S) return out;
  for(let i=0;i<16;i++){const p=S.b[i];if(!p)continue;let x=p[0],y=p[1];if(i===0&&(phase==="place"||phase==="aim"||phase==="script"||phase==="wait"||phase==="cpu")&&cuePos){x=cuePos[0];y=cuePos[1];}out.push([i,x,y]);}
  return out;
}
function drawBalls(g){
  const L=ballList();
  for(const [n,x,y] of L){   /* shadows first so balls never get shadowed by neighbours */
    const bx=FX+Math.round(x-BR), by=FY+Math.round(y-BR);
    g.globalAlpha=0.34; R_(g,bx+2,by+9,7,1,"#000");R_(g,bx+1,by+8,9,1,"#000");R_(g,bx+2,by+10,6,1,"#000"); g.globalAlpha=1;
  }
  for(const [n,x,y] of L){
    const bx=FX+Math.round(x-BR), by=FY+Math.round(y-BR);
    g.drawImage(BALLS[n],bx,by);
    if(n===0&&phase==="place"){const ok=cueSpotOK(S,x,y);pcircle(g,FX+x,FY+y,BR+3,ok?"#7dff8a":"#ff6a5a",false);}
  }
  for(const s of SINKS){   /* a ball dropping into a pocket */
    const k=s.t/0.45, sz=Math.max(1,Math.round(10*(1-k))), px=FX+s.x+(s.tx-s.x)*k, py=FY+s.y+(s.ty-s.y)*k;
    g.drawImage(BALLS[s.n],0,0,10,10,Math.round(px-sz/2),Math.round(py-sz/2),sz,sz);
  }
}

/* ---- the aim guide: a dotted line to the first thing the cue ball touches, the ghost ball, and where both balls go ---- */
function traceAim(c,ux,uy){
  let best=1e9,hit=-1;
  for(let i=1;i<16;i++){
    const p=S.b[i]; if(!p) continue;
    const fx=p[0]-c[0], fy=p[1]-c[1], pr=fx*ux+fy*uy; if(pr<=0) continue;
    const d2=fx*fx+fy*fy-pr*pr; if(d2>=4*BR*BR) continue;
    const t=pr-Math.sqrt(4*BR*BR-d2); if(t<best){best=t;hit=i;}
  }
  let tc=1e9;
  if(ux>0) tc=Math.min(tc,(TW-BR-c[0])/ux); else if(ux<0) tc=Math.min(tc,(BR-c[0])/ux);
  if(uy>0) tc=Math.min(tc,(TH-BR-c[1])/uy); else if(uy<0) tc=Math.min(tc,(BR-c[1])/uy);
  if(tc<best){best=tc;hit=-1;}
  return {t:Math.max(0,best),hit};
}
function drawGuide(g){
  if(phase!=="aim"||!S) return;
  const c=cuePos, ux=Math.cos(aimA), uy=Math.sin(aimA), tr=traceAim(c,ux,uy);
  const ex=c[0]+ux*tr.t, ey=c[1]+uy*tr.t;
  pdots(g,FX+c[0]+ux*(BR+2),FY+c[1]+uy*(BR+2),FX+ex,FY+ey,"#f4f0e4",3);
  pcircle(g,FX+ex,FY+ey,BR,"#f4f0e4",false);
  if(tr.hit>=0){
    const p=S.b[tr.hit], nx=(p[0]-ex)/(2*BR), ny=(p[1]-ey)/(2*BR);
    pdots(g,FX+p[0],FY+p[1],FX+p[0]+nx*34,FY+p[1]+ny*34,"#ffd45a",3);              /* where the object ball goes */
    let tx=ux-(ux*nx+uy*ny)*nx, ty=uy-(uy*nx+uy*ny)*ny; const tl=Math.sqrt(tx*tx+ty*ty);
    if(tl>0.05){tx/=tl;ty/=tl;const L=18*Math.min(1,tl*1.4);pdots(g,FX+ex,FY+ey,FX+ex+tx*L,FY+ey+ty*L,"#9ff6ff",3);}   /* and the cue ball */
  } else if(tr.t>8){
    const rx=(ex<=BR+0.5||ex>=TW-BR-0.5)?-ux:ux, ry=(ey<=BR+0.5||ey>=TH-BR-0.5)?-uy:uy;
    pdots(g,FX+ex,FY+ey,FX+ex+rx*30,FY+ey+ry*30,"#f4f0e4",4);
  }
}
/* ---- the cue stick: pulled back with the power ---- */
function drawCue(g){
  if(!S||!(phase==="aim"||phase==="script"||phase==="cpu"||phase==="wait")) return;
  if(phase==="wait"&&!cueShow) return;
  const c=cuePos, ux=Math.cos(aimA), uy=Math.sin(aimA), gap=BR+3+pull*52;
  const x0=FX+c[0]-ux*gap, y0=FY+c[1]-uy*gap, len=118;
  g.save(); g.beginPath(); g.rect(OX+2,OY+2,TBL_W-4,TBL_H-4); g.clip();
  for(let i=0;i<len;i+=1){
    const x=x0-ux*i, y=y0-uy*i;
    let col; const f=i/len;
    if(i<2) col="#8ad0ff"; else if(i<5) col="#f4f0e4"; else if(f<0.62) col=i%7<1?"#c9a066":"#e8c98a"; else if(f<0.70) col="#c9a24a"; else col=f<0.74?"#3a2010":"#5a3118";
    const th=f<0.62?2:3;
    g.fillStyle=col; g.fillRect(Math.round(x)-1,Math.round(y)-1,th,th);
    if(th===3&&f>0.74&&i%9<2){g.fillStyle="#7a4a24";g.fillRect(Math.round(x)-1,Math.round(y)-1,3,3);}
  }
  g.restore();
}
/* ---- player cards on the top rail ---- */
function drawHud(g){
  if(!S) return;
  const ty=OY+9, act=S.turn;
  for(let p=0;p<2;p++){
    const left=p===0, nm=(names[p]||"").toUpperCase().slice(0,9), on=act===p&&S.win===-2;
    const col=S.win===p?"#7dff8a":on?"#ffd45a":"#b9b0d0", grp=S.groups[p];
    const tw=ptw(g,nm), open="OPEN", ow=ptw(g,open), iw=grp>=0?55:ow, w=tw+6+iw+(on?7:0)+6;
    const x0=left?OX+24:OX+TBL_W-24-w;
    R_(g,x0,OY+2,w,10,"rgba(10,8,18,0.82)"); R_(g,x0,OY+2,w,1,on?"#ffd45a":"#4a4266"); R_(g,x0,OY+11,w,1,on?"#8a6418":"#2a2440");
    let x=x0+4;
    if(on){R_(g,x,OY+5,3,4,"#ffd45a");x+=6;}
    ptext(g,nm,x,ty,col,10,"left"); x+=tw+6;
    if(grp>=0) drawGroupIcons(g,x,OY+3,grp); else ptext(g,open,x,ty,"#8a82a4",10,"left");
  }
  /* what is going on, floating at the top of the felt */
  const st=statusText(); if(st){const w=ptw(g,st)+12,x=Math.round(BW/2-w/2);R_(g,x,FY+3,w,11,"rgba(10,8,18,0.72)");R_(g,x,FY+3,w,1,"#c9a24a");R_(g,x,FY+13,w,1,"#8a6418");ptext(g,st,BW/2,FY+11,"#f6efe0",10,"center");}
}
function drawGroupIcons(g,x,y,grp){
  for(let i=0;i<7;i++){const n=grp===0?i+1:i+9,gone=!S.b[n];g.globalAlpha=gone?0.28:1;g.drawImage(miniBall(n),x+i*8,y);g.globalAlpha=1;}
}
/* ---- controls down the two margins ---- */
function drawControls(g){
  if(!S) return;
  const human=canAct(), P=CTL.power;
  /* power bar */
  pbox(g,P.x-2,P.y-12,P.w+4,P.h+24,false); ptext(g,"POWER",P.x+P.w/2,P.y-4,"#c9a24a",10,"center");
  R_(g,P.x,P.y,P.w,P.h,"#0b0912");
  const fh=Math.round(power*P.h);
  for(let y=0;y<fh;y++){const k=y/P.h;R_(g,P.x+1,P.y+y,P.w-2,1,k<0.5?"#5fd06a":k<0.8?"#f2c230":"#ef5a43");}
  for(let k=1;k<10;k++) R_(g,P.x+(k%5===0?0:P.w-4),P.y+Math.round(P.h*k/10),k%5===0?P.w:4,1,"rgba(255,255,255,0.35)");
  const hy=P.y+fh;
  if(human&&phase==="aim"){R_(g,P.x-4,hy-2,P.w+8,5,"#3a2010");R_(g,P.x-4,hy-2,P.w+8,1,"#c9a24a");R_(g,P.x-4,hy+2,P.w+8,1,"#8a6418");if(power<0.03) ptext(g,"PULL",P.x+P.w/2,P.y+16,"#ffd45a",10,"center");}
  /* fine aim */
  pbtn(g,CTL.fineL,"",false,!human||phase!=="aim"); pbtn(g,CTL.fineR,"",false,!human||phase!=="aim");
  tri(g,CTL.fineL.x+CTL.fineL.w/2,CTL.fineL.y+CTL.fineL.h/2,1); tri(g,CTL.fineR.x+CTL.fineR.w/2,CTL.fineR.y+CTL.fineR.h/2,-1);
  /* spin */
  const Sp=CTL.spin; ptext(g,"SPIN",Sp.cx,Sp.cy-Sp.r-5,"#c9a24a",10,"center");
  pcircle(g,Sp.cx,Sp.cy,Sp.r+1,"#c9a24a",false);
  for(let y=-Sp.r;y<=Sp.r;y++)for(let x=-Sp.r;x<=Sp.r;x++){const d=Math.sqrt(x*x+y*y);if(d>Sp.r)continue;R_(g,Sp.cx+x,Sp.cy+y,1,1,d>Sp.r-1.5?"#b8b2a0":(x+y<-Sp.r*0.4?"#fffaf0":"#f4f0e4"));}
  R_(g,Sp.cx-Sp.r+3,Sp.cy,Sp.r*2-5,1,"rgba(40,40,60,0.25)");R_(g,Sp.cx,Sp.cy-Sp.r+3,1,Sp.r*2-5,"rgba(40,40,60,0.25)");
  const dx=Math.round(Sp.cx+spin[0]*(Sp.r-4)), dy=Math.round(Sp.cy-spin[1]*(Sp.r-4));
  R_(g,dx-2,dy-2,5,5,"#14141a");R_(g,dx-1,dy-1,3,3,"#ef5a43");
  /* buttons */
  pbtn(g,CTL.menu,"MENU",false);
  if(phase==="place"&&human){const okk=cueSpotOK(S,cuePos[0],cuePos[1]);pbtn(g,CTL.ok,"OK",okk,!okk);}
  else if(phase==="aim"&&human&&S.hand>0) pbtn(g,CTL.ok,"MOVE",false);
  if(mode==="online") pbtn(g,CTL.chat,chatUnread?"CHAT*":"CHAT",chatUnread>0);
  if(replaying) pbtn(g,CTL.skip,"SKIP",false);
}
function tri(g,cx,cy,dir){for(let i=0;i<4;i++) R_(g,cx-dir*(i-1)-(dir>0?0:0),cy-3+i,1,7-2*i,"#f6efe0");}
/* ---- call-outs in the middle of the felt, and the title card ---- */
function drawCalls(g){
  for(const c of CALLS){
    const k=c.t/c.life, a=k<0.12?k/0.12:k>0.75?1-(k-0.75)/0.25:1, rise=Math.round(k*10);
    g.globalAlpha=Math.max(0,a);
    ptext(g,c.txt,FX+TW/2,FY+TH/2-rise,c.col,c.size,"center","#120f1c");
    g.globalAlpha=1;
  }
}
function drawFxParts(g){for(const f of FXS){g.globalAlpha=Math.max(0,1-f.t/f.life);R_(g,Math.round(FX+f.x),Math.round(FY+f.y),1,1,f.c);}g.globalAlpha=1;}
function drawGame(){
  const g=bg; g.drawImage(floorCv,0,0); g.drawImage(TABLE_CV,OX,OY);
  if(phase==="place"&&S&&S.hand===1){g.globalAlpha=0.08;R_(g,FX,FY,HEAD_X,TH,"#fff");g.globalAlpha=1;}
  drawBalls(g); drawGuide(g); drawCue(g); drawFxParts(g); drawCalls(g); drawHud(g); drawControls(g);
}
/* ---- title card: the logo, a rack of balls ---- */
let titleT=0;
function drawTitle(dt){
  titleT+=dt; const g=bg; g.drawImage(floorCv,0,0);
  const cx=Math.round(BW*0.27), top=Math.round(BH*0.14);
  /* the rack, drawn at double size so it stays chunky */
  const by=top+70, order=[1,9,2,10,8,3,11,4,12,5,13,6,14,7,15]; let k=0;
  for(let r=0;r<5;r++)for(let c=0;c<=r;c++){const n=order[k++];const bob=Math.round(Math.sin(titleT*2+k*0.6)*1.5);
    g.globalAlpha=0.3;R_(g,cx+(c-r/2)*21-9,by+r*18+bob+17,18,2,"#000");g.globalAlpha=1;
    g.drawImage(BALLS[n],0,0,10,10,cx+Math.round((c-r/2)*21)-10,by+r*18+bob-1,20,20);}
  const cby=by+60+Math.round(Math.sin(titleT*2)*1.5); g.drawImage(BALLS[0],0,0,10,10,cx-98,cby,20,20);
  /* logo: 8-BALL in big pixels with a gold gradient and a dark outline */
  const txt="8-BALL", size=40, w=ptw(g,txt,size), x=cx-w/2, y=top+40;
  g.font=size+"px 'Pool Pixel'";g.textAlign="left";
  for(const [ox,oy] of [[-4,0],[4,0],[0,-4],[0,4],[-4,-4],[4,4],[-4,4],[4,-4],[0,8],[4,8],[-4,8]]){g.fillStyle="#0a0812";g.fillText(txt,x+ox,y+oy);}
  const gr=g.createLinearGradient(0,y-28,0,y);gr.addColorStop(0,"#fff3b0");gr.addColorStop(0.5,"#e8b84a");gr.addColorStop(1,"#a86a14");g.fillStyle=gr;g.fillText(txt,x,y);
  ptext(g,"PIXEL POOL",cx,y+18,"#9ff6ff",10,"center");
}
