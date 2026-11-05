/* =====================================================================
   SOUND: everything is synthesized (no sound files). Ball clicks, cushion
   thumps, pocket drops, a cue strike, little jingles and an optional
   chiptune loop. Volumes come from the settings (saved on the phone).
   ===================================================================== */
const SET={sfx:0.8,music:0.5,...(()=>{try{return JSON.parse(localStorage.getItem("eb-set")||"{}");}catch(e){return {};}})()};
function saveSet(){try{localStorage.setItem("eb-set",JSON.stringify(SET));}catch(e){}}
let AC=null,SFXG=null,MUSG=null,NOISE=null;
function audioInit(){
  if(AC){if(AC.state==="suspended")AC.resume();return;}
  try{
    AC=new (window.AudioContext||window.webkitAudioContext)();
    SFXG=AC.createGain();SFXG.gain.value=SET.sfx;SFXG.connect(AC.destination);
    MUSG=AC.createGain();MUSG.gain.value=SET.music*0.22;MUSG.connect(AC.destination);
    const n=AC.sampleRate*1.5, buf=AC.createBuffer(1,n,AC.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=Math.random()*2-1; NOISE=buf;
    if(SET.music>0) musicStart();
  }catch(e){AC=null;}
}
function applyVolumes(){if(!AC)return;SFXG.gain.value=SET.sfx;MUSG.gain.value=SET.music*0.22;if(SET.music>0)musicStart();else musicStop();}
function tn(o){   /* one tone: o={f0,f1,dur,type,vol,delay,a,dest} */
  if(!AC||(!o.dest&&SET.sfx<=0)) return;
  const t=AC.currentTime+(o.delay||0), osc=AC.createOscillator(), g=AC.createGain();
  osc.type=o.type||"sine"; osc.frequency.setValueAtTime(o.f0,t); if(o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20,o.f1),t+o.dur);
  const a=o.a||0.004; g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(o.vol||0.2,t+a); g.gain.exponentialRampToValueAtTime(0.0001,t+o.dur);
  osc.connect(g); g.connect(o.dest||SFXG); osc.start(t); osc.stop(t+o.dur+0.05);
}
function nz(o){   /* a burst of filtered noise: o={dur,vol,hp,lp,delay,rate} */
  if(!AC||(!o.dest&&SET.sfx<=0)||!NOISE) return;
  const t=AC.currentTime+(o.delay||0), src=AC.createBufferSource(), g=AC.createGain();
  src.buffer=NOISE; src.playbackRate.value=o.rate||1; let last=src;
  if(o.hp){const f=AC.createBiquadFilter();f.type="highpass";f.frequency.value=o.hp;last.connect(f);last=f;}
  if(o.lp){const f=AC.createBiquadFilter();f.type="lowpass";f.frequency.value=o.lp;last.connect(f);last=f;}
  g.gain.setValueAtTime(o.vol||0.2,t); g.gain.exponentialRampToValueAtTime(0.0001,t+o.dur);
  last.connect(g); g.connect(o.dest||SFXG); src.start(t,Math.random()*0.5); src.stop(t+o.dur+0.05);
}
const SFX={
  cue(p){nz({dur:0.05,vol:0.25+0.3*p,hp:2500});tn({f0:1100,f1:500,dur:0.06,type:"triangle",vol:0.18+0.2*p});tn({f0:140,f1:70,dur:0.09,type:"sine",vol:0.25*p+0.05});},
  ball(v){const k=Math.min(1,v/380);if(k<0.03)return;const f=1500+Math.random()*500;
    tn({f0:f,f1:f*0.9,dur:0.07,type:"sine",vol:0.06+0.22*k});tn({f0:f*1.9,dur:0.04,type:"triangle",vol:0.03+0.1*k});nz({dur:0.018,vol:0.04+0.14*k,hp:3500});
    if(k>0.5) tn({f0:190,f1:110,dur:0.07,type:"sine",vol:0.12*k});},
  rail(v){const k=Math.min(1,v/300);if(k<0.04)return;nz({dur:0.07,vol:0.05+0.18*k,lp:900,hp:90});tn({f0:150,f1:80,dur:0.09,type:"sine",vol:0.05+0.16*k});},
  pocket(){nz({dur:0.32,vol:0.2,lp:700,hp:120,rate:0.7});tn({f0:260,f1:90,dur:0.22,type:"sine",vol:0.16});tn({f0:700,f1:300,dur:0.05,type:"triangle",vol:0.1,delay:0.26});nz({dur:0.05,vol:0.14,lp:1500,delay:0.27});},
  click(){tn({f0:880,f1:660,dur:0.05,type:"square",vol:0.07});},
  tick(){tn({f0:1500,dur:0.03,type:"square",vol:0.04});},
  place(){tn({f0:520,f1:780,dur:0.08,type:"triangle",vol:0.12});},
  foul(){tn({f0:220,f1:150,dur:0.22,type:"sawtooth",vol:0.09});tn({f0:185,f1:120,dur:0.28,type:"sawtooth",vol:0.09,delay:0.12});},
  turn(){tn({f0:660,dur:0.07,type:"square",vol:0.07});tn({f0:880,dur:0.1,type:"square",vol:0.07,delay:0.08});},
  win(){[523,659,784,1047,784,1047,1319].forEach((f,i)=>tn({f0:f,dur:0.16,type:"square",vol:0.1,delay:i*0.11}));},
  lose(){[392,349,294,262].forEach((f,i)=>tn({f0:f,f1:f*0.97,dur:0.28,type:"triangle",vol:0.14,delay:i*0.2}));},
  chat(){tn({f0:988,dur:0.06,type:"triangle",vol:0.09});tn({f0:1319,dur:0.1,type:"triangle",vol:0.09,delay:0.07});},
};
/* ---- a small chiptune loop, scheduled a little ahead of time ---- */
let musT=0,musStep=0,musNext=0;
const BASS=[110,110,0,110,131,131,0,131,98,98,0,98,123,123,0,123], LEAD=[440,0,523,0,659,0,523,0,392,0,494,0,587,0,494,0];
function musicStart(){if(!AC||musT)return;musNext=AC.currentTime+0.1;musStep=0;musT=setInterval(musicTick,120);}
function musicStop(){clearInterval(musT);musT=0;}
function musicTick(){
  if(!AC||document.visibilityState!=="visible") return;
  const spb=60/92/2;   /* eighth notes at 92 bpm */
  while(musNext<AC.currentTime+0.35){
    const i=musStep%16, t=musNext-AC.currentTime;
    if(BASS[i]) tn({f0:BASS[i]/2,dur:spb*0.9,type:"triangle",vol:0.5,delay:t,dest:MUSG,a:0.01});
    if(LEAD[i]&&((musStep>>4)&1)) tn({f0:LEAD[i],dur:spb*0.8,type:"square",vol:0.18,delay:t,dest:MUSG,a:0.01});
    if(i%4===2) nz({dur:0.04,vol:0.12,hp:6000,delay:t,dest:MUSG});
    if(i%8===0) nz({dur:0.09,vol:0.2,lp:300,delay:t,dest:MUSG});
    musNext+=spb; musStep++;
  }
}
