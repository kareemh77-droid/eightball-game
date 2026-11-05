/* =====================================================================
   PIXEL 8-BALL: shared constants, tiny helpers, the seeded random generator,
   and the table geometry. Nothing in here touches the page, so the same
   code runs in the tests under Node.
   The shot simulation (physics.js) is deterministic: only + - * / and sqrt,
   no trig and no Math.random, so two phones that start from the same table
   and the same shot see exactly the same result. Pictures and sounds may
   use anything.
   ===================================================================== */
const EB_VER=10;                                   /* shown as 1.0 (see verName); whole numbers so versions can be compared */
const verName=n=>(n/10).toFixed(1);
const SRV_BAKED="https://spellsiege.spellsiege-kh.workers.dev";   /* the same game server Spellsiege uses */
const POOL_WORLD=100;                              /* the server's "world" number that marks a pool game */

/* table: units are internal pixels, the playing surface runs from cushion face to cushion face */
const TW=392, TH=196, BR=5, RAILW=12;              /* length, width, ball radius, visible rail thickness */
const HEAD_X=Math.round(TW*0.25), FOOT_X=Math.round(TW*0.75), MID_Y=TH/2;
const GC=15, GS=12;                                /* corner gap and side half-gap in the cushions */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const sqr=v=>v*v;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const q2=v=>Math.round(v*100)/100;                 /* positions are kept to 0.01 so both phones hold identical numbers */
/* ball numbers: 0 cue, 1-7 solids, 8 black, 9-15 stripes */
const groupOf=n=>n===0?-2:n===8?-1:n<8?0:1;      /* 0 solids, 1 stripes, -1 the 8, -2 the cue ball */
const GROUP_NAME=["SOLIDS","STRIPES"];
const BALL_COL=["#f4f0e4","#f2c230","#2f5fd0","#e03a2e","#6a2fa8","#f08a24","#2f9a4a","#8a2a2a","#16161c"];  /* index = number, 9-15 reuse 1-7 */
