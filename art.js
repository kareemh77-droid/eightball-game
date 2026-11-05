/* =====================================================================
   PIXEL ART, drawn with code: the table, the balls, the cue, the logo.
   Every picture is built pixel by pixel on small canvases at the game's
   internal resolution, then the game scales the whole frame up with no
   smoothing, so it stays chunky.
   ===================================================================== */
const hexRGB=h=>{h=h.replace("#","");return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];};
const rgbHex=(r,g,b)=>"#"+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("");
const shade=(h,k)=>{const c=hexRGB(h);return k>=0?rgbHex(c[0]+(255-c[0])*k,c[1]+(255-c[1])*k,c[2]+(255-c[2])*k):rgbHex(c[0]*(1+k),c[1]*(1+k),c[2]*(1+k));};
const mix=(a,b,t)=>{const x=hexRGB(a),y=hexRGB(b);return rgbHex(x[0]+(y[0]-x[0])*t,x[1]+(y[1]-x[1])*t,x[2]+(y[2]-x[2])*t);};
function mkCanvas(w,h){const c=document.createElement("canvas");c.width=w;c.height=h;const g=c.getContext("2d");g.imageSmoothingEnabled=false;return [c,g];}
const R_=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x,y,w,h);};

/* ---- tiny 3x5 digits for the balls (the "1" is two pixels wide so 10-15 fit) ---- */
const DIG={
  "0":["###","#.#","#.#","#.#","###"],"1":[".#","##",".#",".#",".#"],"2":["###","..#","###","#..","###"],"3":["###","..#","###","..#","###"],
  "4":["#.#","#.#","###","..#","..#"],"5":["###","#..","###","..#","###"],"6":["###","#..","###","#.#","###"],"7":["###","..#",".#.",".#.",".#."],
  "8":["###","#.#","###","#.#","###"],"9":["###","#.#","###","..#","###"]};
function drawDigits(g,txt,cx,cy,col){   /* centred on cx,cy */
  let w=0; for(const ch of txt) w+=DIG[ch][0].length+1; w-=1;
  let x=Math.round(cx-w/2); const y=Math.round(cy-2.5);
  for(const ch of txt){const d=DIG[ch];for(let r=0;r<5;r++)for(let c=0;c<d[r].length;c++) if(d[r][c]==="#") R_(g,x+c,y+r,1,1,col);x+=d[0].length+1;}
}

/* ---- the balls: 10x10 pixel spheres with a highlight, a number disc and (for stripes) a band ---- */
const BALLS=[];
function ballBase(n){return n===0?"#f4f0e4":n===8?"#1a1a22":BALL_COL[n>8?n-8:n];}
function makeBall(n){
  const D=BR*2, [c,g]=mkCanvas(D,D), base=ballBase(n), white="#f4f0e4";
  const stripe=n>8, lx=-0.45, ly=-0.55, lz=0.7;
  const rad=D/2, num=n>0?String(n):"";
  for(let y=0;y<D;y++)for(let x=0;x<D;x++){
    const dx=(x+0.5-rad)/rad, dy=(y+0.5-rad)/rad, r2=dx*dx+dy*dy;
    if(r2>1.0) continue;
    const dz=Math.sqrt(Math.max(0,1-r2)), lam=dx*lx+dy*ly+dz*lz;
    let body=base;
    if(stripe){const band=Math.abs(y+0.5-rad)<2.7; body=band?base:white;}
    const t=lam>0.72?0.32:lam>0.32?0:lam>0?-0.22:-0.42;
    let col=shade(body,t);
    if(r2>0.72) col=shade(body,-0.62);                          /* dark rim */
    R_(g,x,y,1,1,col);
  }
  /* number disc */
  if(n>0){
    const cx=rad,cy=rad;
    for(let y=0;y<D;y++)for(let x=0;x<D;x++){const dx=x+0.5-cx,dy=y+0.5-cy;if(dx*dx+dy*dy<=(n>9?9.3:7.6))R_(g,x,y,1,1,"#f6f2e8");}
    drawDigits(g,num,cx,cy,"#14141a");
  }
  /* shine */
  R_(g,2,2,2,1,"#ffffff"); R_(g,2,3,1,1,"#ffffff");
  return c;
}
function buildBalls(){for(let n=0;n<16;n++) BALLS[n]=makeBall(n);}

/* ---- the table: wood rails, brass-pearl sights, felt, cushions, pockets (416 x 220 pixels) ---- */
const TBL_W=TW+RAILW*2, TBL_H=TH+RAILW*2;
let TABLE_CV=null;
function buildTable(theme){
  const T=theme||{felt:"#2c8f52",wood:"#7b4522"};
  const [c,g]=mkCanvas(TBL_W,TBL_H), rnd=mulberry32(77);
  const wood=T.wood, woodL=shade(wood,0.22), woodD=shade(wood,-0.35), woodDD=shade(wood,-0.6), felt=T.felt, feltD=shade(felt,-0.12), feltL=shade(felt,0.07), cush=shade(felt,-0.38), cushL=shade(felt,-0.16);
  /* wood body with grain */
  R_(g,0,0,TBL_W,TBL_H,wood);
  for(let i=0;i<260;i++){const x=Math.floor(rnd()*TBL_W),y=Math.floor(rnd()*TBL_H),l=6+Math.floor(rnd()*14);R_(g,x,y,l,1,rnd()<0.55?woodD:woodL);}
  R_(g,0,0,TBL_W,1,woodL); R_(g,0,1,TBL_W,1,mix(wood,woodL,0.5));
  R_(g,0,TBL_H-2,TBL_W,2,woodD); R_(g,0,TBL_H-1,TBL_W,1,woodDD);
  R_(g,0,0,1,TBL_H,woodL); R_(g,TBL_W-1,0,1,TBL_H,woodD);
  /* the dark edge around the whole table */
  g.clearRect(0,0,2,1);g.clearRect(TBL_W-2,0,2,1);g.clearRect(0,TBL_H-1,2,1);g.clearRect(TBL_W-2,TBL_H-1,2,1);g.clearRect(0,0,1,2);g.clearRect(TBL_W-1,0,1,2);g.clearRect(0,TBL_H-2,1,2);g.clearRect(TBL_W-1,TBL_H-2,1,2);
  /* a thin gold line around the felt, like the cartridge-style panels in Spellsiege */
  R_(g,RAILW-6,RAILW-6,TW+12,1,"#c9a24a");R_(g,RAILW-6,RAILW+TH+5,TW+12,1,"#c9a24a");R_(g,RAILW-6,RAILW-6,1,TH+12,"#c9a24a");R_(g,RAILW+TW+5,RAILW-6,1,TH+12,"#c9a24a");
  /* felt */
  R_(g,RAILW,RAILW,TW,TH,felt);
  for(let y=0;y<TH;y++)for(let x=0;x<TW;x++){
    const r=rnd(); let col=null;
    if(r<0.07) col=feltD; else if(r>0.95) col=feltL;
    /* a soft shadow where the felt meets the cushions, drawn as a dither */
    const e=Math.min(x,y,TW-1-x,TH-1-y);
    if(e<5&&((x+y)&1)===0&&r<0.9-e*0.15) col=feltD;
    if(e<2) col=feltD;
    if(col) R_(g,RAILW+x,RAILW+y,1,1,col);
  }
  /* spots and the head string */
  const ox=RAILW, oy=RAILW;
  for(let y=6;y<TH-6;y+=4) R_(g,ox+HEAD_X,oy+y,1,1,feltL);
  for(const [sx,sy] of [[HEAD_X,MID_Y],[FOOT_X,MID_Y],[TW/2,MID_Y]]){R_(g,ox+sx-1,oy+sy,3,1,feltL);R_(g,ox+sx,oy+sy-1,1,3,feltL);}
  /* pockets: leather ring, then the black hole */
  const hole=(px,py,rr)=>{for(let y=-rr-2;y<=rr+2;y++)for(let x=-rr-2;x<=rr+2;x++){const d=Math.sqrt(x*x+y*y);const X=Math.round(px+x),Y=Math.round(py+y);if(X<0||Y<0||X>=TBL_W||Y>=TBL_H)continue;
      if(d<=rr) R_(g,X,Y,1,1,"#0a0a0e"); else if(d<=rr+1.6) R_(g,X,Y,1,1,"#2a1c12"); else if(d<=rr+2.4) R_(g,X,Y,1,1,"#4a3220");}};
  hole(ox-3.5,oy-3.5,10.5); hole(ox+TW+3.5,oy-3.5,10.5); hole(ox-3.5,oy+TH+3.5,10.5); hole(ox+TW+3.5,oy+TH+3.5,10.5);
  hole(ox+TW/2,oy-5,9.2); hole(ox+TW/2,oy+TH+5,9.2);
  /* cushions: a trapezoid along each rail piece (wider at the wood, narrow at the felt) with angled jaw ends */
  const th=5;
  for(const [x0,y0,x1,y1,nx,ny] of SEGS){
    for(let k=0;k<th;k++){
      const col=k===0?cushL:k===th-1?shade(cush,-0.3):cush;
      if(ny!==0){const row=ny>0?-1-k:TH+k;for(let x=Math.round(x0)-k;x<Math.round(x1)+k;x++) R_(g,ox+x,oy+row,1,1,col);}
      else{const cx=nx>0?-1-k:TW+k;for(let y=Math.round(y0)-k;y<Math.round(y1)+k;y++) R_(g,ox+cx,oy+y,1,1,col);}
    }
  }
  /* pearl sights */
  const dia=(x,y)=>{R_(g,x-1,y,3,1,"#f2ead6");R_(g,x,y-1,1,3,"#f2ead6");R_(g,x,y,1,1,"#c9b88a");};
  for(let k=1;k<8;k++){if(k===4)continue;const x=ox+Math.round(TW*k/8);dia(x,oy-RAILW/2-3);dia(x,oy+TH+RAILW/2+3);}
  for(let k=1;k<4;k++){const y=oy+Math.round(TH*k/4);dia(ox-RAILW/2-3,y);dia(ox+TW+RAILW/2+3,y);}
  TABLE_CV=c; return c;
}

/* ---- the floor around the table: dim checkered tiles ---- */
function drawFloor(g,w,h,t){
  R_(g,0,0,w,h,"#120f1c");
  for(let y=0;y<h;y+=16)for(let x=0;x<w;x+=16){ if(((x+y)>>4)&1) R_(g,x,y,16,16,"#161224"); }
  for(let y=0;y<h;y+=16) R_(g,0,y,w,1,"#0e0b17");
  for(let x=0;x<w;x+=16) R_(g,x,0,1,h,"#0e0b17");
}

/* ---- pixel plumbing used by the game ---- */
function pline(g,x0,y0,x1,y1,col,th){   /* a line plotted pixel by pixel (no smoothing) */
  x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
  const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1; let err=dx+dy; g.fillStyle=col; th=th||1;
  for(let n=0;n<2000;n++){
    g.fillRect(x0-(th>>1),y0-(th>>1),th,th);
    if(x0===x1&&y0===y1)break; const e2=2*err; if(e2>=dy){err+=dy;x0+=sx;} if(e2<=dx){err+=dx;y0+=sy;}
  }
}
function pcircle(g,cx,cy,r,col,fill){
  g.fillStyle=col; cx=Math.round(cx);cy=Math.round(cy);
  for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){const d=Math.sqrt(x*x+y*y);if(fill?d<=r+0.3:Math.abs(d-r)<0.6)g.fillRect(cx+x,cy+y,1,1);}
}
function pdots(g,x0,y0,x1,y1,col,gap){   /* dotted line */
  const dx=x1-x0,dy=y1-y0,L=Math.sqrt(dx*dx+dy*dy)||1; g.fillStyle=col;
  for(let d=0;d<=L;d+=gap) g.fillRect(Math.round(x0+dx/L*d),Math.round(y0+dy/L*d),1,1);
}
/* text with the pixel font at whole-pixel sizes (10px = one font pixel per screen pixel) */
function ptext(g,txt,x,y,col,size,align,outline){
  g.font=(size||10)+"px 'Pool Pixel'"; g.textAlign=align||"left"; g.textBaseline="alphabetic";
  x=Math.round(x);y=Math.round(y);
  if(outline){g.fillStyle=outline;for(const [ox,oy] of [[-1,0],[1,0],[0,-1],[0,1]]) g.fillText(txt,x+ox*((size||10)/10),y+oy*((size||10)/10));}
  g.fillStyle=col; g.fillText(txt,x,y);
}
const ptw=(g,txt,size)=>{g.font=(size||10)+"px 'Pool Pixel'";return Math.round(g.measureText(txt).width);};
