/* =====================================================================
   SHOT PHYSICS. One class, Sim, steps the table at a fixed 240 Hz.
   Balls are discs (radius BR): rolling friction, ball-ball collisions,
   cushions made of straight pieces with jaw tips at the pockets, and six
   pockets. The cue ball can carry top/back spin (follow and draw after it
   hits a ball) and side spin (English on the cushions).
   Deterministic: only + - * / and sqrt.
   ===================================================================== */
const STEP=1/240, VMAX=780, FRIC_A=26, FRIC_K=0.24, E_BALL=0.96, E_CUSH=0.76, SIDE_K=0.30, TOP_K=0.50, TOP_DECAY=0.999, MAX_STEPS=240*28;
const SEGS=[   /* x1,y1,x2,y2 and the normal that points onto the table */
  [GC,0,TW/2-GS,0,0,1],[TW/2+GS,0,TW-GC,0,0,1],
  [GC,TH,TW/2-GS,TH,0,-1],[TW/2+GS,TH,TW-GC,TH,0,-1],
  [0,GC,0,TH-GC,1,0],[TW,GC,TW,TH-GC,-1,0]];
const POCKET_XY=[[-4,-4],[TW+4,-4],[-4,TH+4],[TW+4,TH+4],[TW/2,-6],[TW/2,TH+6]];   /* where a ball drops out of sight */
/* which pocket a ball centre is in, or -1 */
function pocketAt(x,y){
  if(x<GC-1&&y<GC-1) return 0; if(x>TW-GC+1&&y<GC-1) return 1;
  if(x<GC-1&&y>TH-GC+1) return 2; if(x>TW-GC+1&&y>TH-GC+1) return 3;
  const dx=x-TW/2; if(dx*dx+sqr(y+5)<110) return 4; if(dx*dx+sqr(y-TH-5)<110) return 5;
  return -1;
}
class Sim{
  /* balls: array of 16 [x,y] (or 0 when pocketed) */
  constructor(b16,events){
    this.b=[]; for(let i=0;i<16;i++){const p=b16[i];this.b.push({id:i,x:p?p[0]:0,y:p?p[1]:0,vx:0,vy:0,alive:!!p,top:0,side:0});}
    this.ev=events?[]:null; this.steps=0; this.firstHit=-1; this.railAfter=false; this.pocketed=[]; this.cueHitAny=false;
  }
  shoot(ux,uy,power,sx,sy){
    const c=this.b[0], v=Math.max(24,VMAX*power);
    c.vx=ux*v; c.vy=uy*v; c.top=clamp(sy,-1,1); c.side=clamp(sx,-1,1);
    if(this.ev) this.ev.push({k:"cue",p:power,x:c.x,y:c.y});
  }
  moving(){for(let i=0;i<16;i++){const b=this.b[i];if(b.alive&&(b.vx!==0||b.vy!==0))return true;}return false;}
  step(){
    const B=this.b; this.steps++;
    /* move and slow down */
    for(let i=0;i<16;i++){
      const b=B[i]; if(!b.alive||(b.vx===0&&b.vy===0)) continue;
      b.x+=b.vx*STEP; b.y+=b.vy*STEP;
      const sp=Math.sqrt(b.vx*b.vx+b.vy*b.vy), nd=sp-(FRIC_A+FRIC_K*sp)*STEP;
      if(nd<=0){b.vx=0;b.vy=0;} else {const s=nd/sp;b.vx*=s;b.vy*=s;}
      if(b.top!==0) b.top*=TOP_DECAY;
    }
    /* cushions */
    for(let i=0;i<16;i++){
      const b=B[i]; if(!b.alive||(b.vx===0&&b.vy===0)) continue;
      if(b.x>BR+1&&b.x<TW-BR-1&&b.y>BR+1&&b.y<TH-BR-1) continue;
      for(let s=0;s<6;s++){
        const g=SEGS[s];
        const cx=clamp(b.x,g[0]<g[2]?g[0]:g[2],g[0]<g[2]?g[2]:g[0]), cy=clamp(b.y,g[1]<g[3]?g[1]:g[3],g[1]<g[3]?g[3]:g[1]);
        let dx=b.x-cx, dy=b.y-cy; const d2=dx*dx+dy*dy;
        if(d2>=BR*BR) continue;
        if((b.x-cx)*g[4]+(b.y-cy)*g[5]<-BR) continue;   /* far on the wrong side: it is already in a pocket */
        let d=Math.sqrt(d2), nx,ny;
        if(d<1e-6){nx=g[4];ny=g[5];d=0;} else {nx=dx/d;ny=dy/d;}
        b.x+=nx*(BR-d); b.y+=ny*(BR-d);
        const vn=b.vx*nx+b.vy*ny;
        if(vn<0){
          const tx=-ny, ty=nx, vt=b.vx*tx+b.vy*ty;
          let nvn=-vn*E_CUSH, nvt=vt*0.985;
          if(b.side!==0){   /* English: kick the ball sideways along the cushion, to the right of its old travel direction */
            const sp=Math.sqrt(b.vx*b.vx+b.vy*b.vy)||1, rx=-b.vy/sp, ry=b.vx/sp, along=rx*tx+ry*ty;
            nvt+=(along>=0?1:-1)*b.side*(-vn)*SIDE_K; b.side*=0.55;
          }
          b.vx=nx*nvn+tx*nvt; b.vy=ny*nvn+ty*nvt;
          if(this.firstHit>=0) this.railAfter=true;
          if(this.ev&&-vn>12) this.ev.push({k:"rail",v:-vn,x:b.x,y:b.y});
        }
      }
    }
    /* balls against balls */
    for(let i=0;i<16;i++){
      const a=B[i]; if(!a.alive) continue;
      for(let j=i+1;j<16;j++){
        const c=B[j]; if(!c.alive) continue;
        if(a.vx===0&&a.vy===0&&c.vx===0&&c.vy===0) continue;
        const dx=c.x-a.x; if(dx>2*BR||dx<-2*BR) continue;
        const dy=c.y-a.y; if(dy>2*BR||dy<-2*BR) continue;
        const d2=dx*dx+dy*dy; if(d2>=4*BR*BR) continue;
        const d=Math.sqrt(d2)||0.0001, nx=dx/d, ny=dy/d;
        const dvn=(c.vx-a.vx)*nx+(c.vy-a.vy)*ny;
        const ov=(2*BR-d)*0.5; a.x-=nx*ov; a.y-=ny*ov; c.x+=nx*ov; c.y+=ny*ov;
        if(dvn<0){
          const cue=i===0?a:null, sp0=cue?Math.sqrt(a.vx*a.vx+a.vy*a.vy):0, d0x=cue&&sp0>0?a.vx/sp0:0, d0y=cue&&sp0>0?a.vy/sp0:0;
          const jj=-(1+E_BALL)*dvn*0.5;
          a.vx-=jj*nx; a.vy-=jj*ny; c.vx+=jj*nx; c.vy+=jj*ny;
          if(i===0){
            if(this.firstHit<0) this.firstHit=j;
            if(a.top!==0){const k=a.top*TOP_K*sp0; a.vx+=d0x*k; a.vy+=d0y*k; a.top=0;}   /* follow / draw */
          }
          if(this.ev) this.ev.push({k:"ball",v:-dvn,x:(a.x+c.x)*0.5,y:(a.y+c.y)*0.5,a:i,b:j});
        }
      }
    }
    /* pockets */
    for(let i=0;i<16;i++){
      const b=B[i]; if(!b.alive) continue;
      const p=pocketAt(b.x,b.y);
      if(p>=0){b.alive=false;b.vx=0;b.vy=0;this.pocketed.push(i);if(this.ev)this.ev.push({k:"pocket",ball:i,p,x:b.x,y:b.y});}
    }
  }
  /* what is left on the table, as [x,y] or 0 */
  snapshot(){return this.b.map(b=>b.alive?[q2(b.x),q2(b.y)]:0);}
}
/* a whole shot at once (used by the CPU, the tests and the replay check) */
function simulateShot(b16,shot){
  const s=new Sim(b16,false);
  s.shoot(shot.ux,shot.uy,shot.p,shot.sx||0,shot.sy||0);
  while(s.steps<MAX_STEPS){s.step();if(!s.moving())break;}
  return {balls:s.snapshot(),firstHit:s.firstHit,railAfter:s.railAfter,pocketed:s.pocketed.slice(),steps:s.steps};
}
