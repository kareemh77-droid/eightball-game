/* =====================================================================
   ONLINE: friends, challenges and turn-by-turn games through the same
   game server Spellsiege uses. Pool games have their own player profile
   (own friend code) so they never show up in Spellsiege's lists.
   A "turn" is everything one player does before the turn passes: the
   shots go to the server as a short list; the other phone replays them
   from the start position, then snaps to the saved table.
   ===================================================================== */
const NET={srv:null,prof:null,me:null,err:"",subOK:false,pollT:0,gpT:0,busy:false};
let G=null, visit=null, flushing=false;
const LSJ=(k,v)=>{try{if(v===undefined){const s=localStorage.getItem(k);return s?JSON.parse(s):null;}if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,JSON.stringify(v));}catch(e){}return null;};
NET.prof=LSJ("eb-profile");
function normSrv(t){
  t=String(t||"").trim(); if(!t) return null;
  if(!/^https?:\/\//i.test(t)) t="https://"+t;
  try{const u=new URL(t);if(u.protocol!=="https:"&&!/^(localhost|127\.0\.0\.1)$/.test(u.hostname))return null;return u.origin;}catch(e){return null;}
}
function srvBase(){
  if(NET.srv) return NET.srv;
  let q=null; try{q=new URLSearchParams(location.search).get("srv");}catch(e){}
  const o=normSrv(q)||normSrv(LSJ("eb-server"));
  NET.srv=o||SRV_BAKED||null; return NET.srv;
}
async function api(action,data,noAuth){
  const base=srvBase(); if(!base){const e=new Error("The game server isn't set up yet.");e.nosrv=true;throw e;}
  const body=Object.assign({},data||{}); if(!noAuth&&NET.prof){body.pid=NET.prof.pid;body.secret=NET.prof.secret;}
  let r;
  try{r=await fetch(base+"/api/"+action,{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(body)});}
  catch(e){const er=new Error("Can't reach the game server. Check your internet connection.");er.net=true;throw er;}
  let j={}; try{j=await r.json();}catch(e){}
  if(!r.ok){const er=new Error(j.error||("The game server answered "+r.status));er.status=r.status;if(r.status>=500&&!j.error)er.net=true;throw er;}
  return j;
}

/* ---- phone alerts ---- */
const isIOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const standalone=matchMedia("(display-mode: standalone)").matches||matchMedia("(display-mode: fullscreen)").matches||navigator.standalone===true;
const pushCapable=()=>"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window&&location.protocol==="https:";
function b64uBytes(s){s=String(s).replace(/-/g,"+").replace(/_/g,"/");s+="===".slice((s.length+3)%4);const b=atob(s),o=new Uint8Array(b.length);for(let i=0;i<b.length;i++)o[i]=b.charCodeAt(i);return o;}
function bytesB64u(buf){const b=new Uint8Array(buf);let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
function alertInfo(){
  if(!pushCapable()) return {k:"no",t:isIOS&&!standalone?"For turn alerts on iPhone: in Safari tap Share, then Add to Home Screen, and open 8-Ball from your Home Screen.":"This browser can't show turn alerts. Chrome works on Android; on iPhone use the Home Screen app."};
  if(Notification.permission==="denied") return {k:"denied",t:"Turn alerts are blocked. Allow notifications for 8-Ball in your phone's Settings, then come back here."};
  if(Notification.permission==="granted"&&NET.subOK) return {k:"on",t:"Turn alerts are on for this phone."};
  return {k:"off",t:"Get an alert when it's your turn, even with the game closed."};
}
const swReady=()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,rej)=>setTimeout(()=>rej(new Error("the offline helper isn't running; reload the page")),8000))]);
async function syncPush(loud){
  if(!NET.prof||!pushCapable()||Notification.permission!=="granted") return;
  try{
    const reg=await swReady(), key=(await api("vapid",{},true)).key;
    let sub=await reg.pushManager.getSubscription();
    if(sub&&sub.options&&sub.options.applicationServerKey&&bytesB64u(sub.options.applicationServerKey)!==key){await sub.unsubscribe().catch(()=>{});sub=null;}
    if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uBytes(key)});
    await api("subscribe",{sub:sub.toJSON()}); NET.subOK=true;
  }catch(e){NET.subOK=false;if(loud)netMsg("Couldn't turn on alerts: "+e.message);}
}
function enableAlerts(){
  let p=null; try{p=Notification.requestPermission();}catch(e){}
  Promise.resolve(p).then(async perm=>{
    perm=perm||Notification.permission;
    if(perm!=="granted"){netMsg("Alerts weren't allowed. You can still play; just check back here for your turns.");frRender();return;}
    netMsg("Turning on alerts…"); await syncPush(true); if(NET.subOK)netMsg(""); frRender();
  });
}
function setBadge(n){try{if(navigator.setAppBadge){if(n>0)navigator.setAppBadge(n).catch(()=>{});else navigator.clearAppBadge().catch(()=>{});}}catch(e){}}

/* ---- the player, friends and the game list ---- */
const poolGames=()=>NET.me?NET.me.games.filter(g=>g.world===POOL_WORLD):[];
const myTurnGames=()=>poolGames().filter(g=>(g.status==="active"&&g.turn===g.me)||(g.status==="invite"&&g.me===1));
async function netRefresh(){
  if(!NET.prof){frRender();return;}
  try{
    NET.me=await api("me"); NET.err="";
    if(NET.me.name&&NET.me.name!==NET.prof.name){NET.prof.name=NET.me.name;LSJ("eb-profile",NET.prof);}
    setBadge(myTurnGames().length);
  }catch(e){
    if(e.status===401){NET.prof=null;LSJ("eb-profile",null);NET.me=null;NET.err="The game server doesn't know this phone any more (it may have been reset). Make a new profile below.";}
    else NET.err=e.message;
  }
  frRender(); menuNote();
}
async function netRegister(name){
  const r=await api("register",{name},true);
  NET.prof={pid:r.pid,secret:r.secret,code:r.code,name:r.name}; LSJ("eb-profile",NET.prof); NET.err=""; return r;
}
async function netAddFriend(code){return api("addfriend",{code});}
async function netChallenge(friendId){
  return api("challenge",{friend:friendId,world:POOL_WORLD,theme:0,band:null,ver:EB_VER});
}
async function netAccept(gs){
  const g=await api("game",{gid:gs.id}); if(g.status!=="invite"){netRefresh();return;}
  const seed=(Math.floor(Math.random()*2e9)+1)|0, S0=newTable(seed,1), enc=JSON.stringify(S0);
  await api("respond",{gid:g.id,accept:true,state:enc,seq:S0.n,turn:S0.turn,ver:EB_VER});
  enterGame(Object.assign({},g,{status:"active",state:enc,seq:S0.n,turn:S0.turn,prev:null,log:null,lastBy:-1,winner:-2}));
}
async function netDecline(g){try{await api("respond",{gid:g.id,accept:false});}catch(e){netMsg(e.message);}netRefresh();}
async function netHide(g){try{await api("hide",{gid:g.id});}catch(e){netMsg(e.message);}netRefresh();}
async function netOpen(gid){
  try{const g=await api("game",{gid});if(g.status==="invite"){netRefresh();return;}enterGame(g);}
  catch(e){netMsg(e.message);}
}

/* ---- playing a turn-by-turn game ---- */
const outbox=()=>LSJ("eb-outbox")||{};
function markSeen(id,seq){const s=LSJ("eb-seen")||{};if((s[id]||0)<seq){s[id]=seq;LSJ("eb-seen",s);}}
const wipGet=()=>LSJ("eb-wip");
function wipSet(){if(visit)LSJ("eb-wip",visit);else LSJ("eb-wip",null);}
function enterGame(g){
  leaveGame();
  G={id:g.id,me:g.me,opp:g.opp,seq:g.seq,status:g.status,winner:g.winner,chat:0,forfeit:false};
  mode="online"; myIdx=g.me; names=["",""]; names[myIdx]=(NET.prof&&NET.prof.name)||"YOU"; names[1-myIdx]=g.opp.name||"FRIEND";
  let stateStr=g.state; const ob=outbox()[g.id];
  if(ob&&ob.base>=g.seq){stateStr=ob.state;G.seq=ob.seq;if(ob.winner!==-2)G.status="over";}   /* our turn hasn't reached the server yet */
  let fin=null; try{fin=JSON.parse(stateStr);}catch(e){}
  if(!fin||!fin.b){G=null;mode="cpu";netMsg("This game couldn't be loaded.");return;}
  hideMenu(); startOnlineUi(); netChatLoad();
  if(g.status==="over"&&fin.win===-2&&g.winner>=-1){fin.win=g.winner;G.forfeit=true;fin.why="Gave up";}
  const seen=(LSJ("eb-seen")||{})[g.id]||0;
  /* an unfinished turn of ours (we shot, but the turn hadn't passed yet) */
  const wip=wipGet();
  if(!ob&&wip&&wip.gid===g.id&&wip.base===g.seq&&g.status==="active"&&g.turn===g.me){
    try{
      let T=JSON.parse(wip.prev); for(const s of wip.shots){const sh=unpackShot(s);const b16=T.b.map(p=>p?p.slice():0);if(sh.h)b16[0]=sh.h.slice();T=judge(T,simulateShot(b16,sh)).S;}
      visit=wip; S=T; replaying=false; markSeen(g.id,g.seq);
      if(S.turn!==myIdx||S.win!==-2) visitSend();   /* the turn had already passed when the app closed: send it now */
      beginTurn(); netPollStart(); return;
    }catch(e){visit=null;wipSet();}
  }
  if(!ob&&g.log&&g.prev&&g.lastBy>=0&&g.lastBy!==g.me&&seen<g.seq&&g.lver===EB_VER&&!G.forfeit){
    let shots=null,S0=null; try{shots=JSON.parse(g.log);S0=JSON.parse(g.prev);}catch(e){}
    if(shots&&shots.length&&S0&&S0.b){
      S=S0; repStart(S0,shots,JSON.stringify(fin),()=>{markSeen(g.id,g.seq);beginTurn();}); netPollStart(); return;
    }
  }
  S=fin; replaying=false; markSeen(g.id,g.seq); beginTurn(); netPollStart();
  if(g.ver>EB_VER) netMsg("Your friend has a newer version of 8-Ball. Reload the page to update.");
  if(ob) flushOutbox(false);
}
function leaveGame(){
  clearInterval(NET.gpT); G=null; visit=null; rep=null; replaying=false; showReplayTag(false);
}
function visitBegin(){
  if(!G) return;
  if(visit&&visit.gid===G.id&&visit.base===G.seq) return;
  visit={gid:G.id,base:G.seq,prev:JSON.stringify(S),shots:[]}; wipSet();
}
function visitShot(shot){ if(!visit) return; visit.shots.push(packShot(shot)); wipSet(); }
function visitSend(){
  if(!G||!visit) return;
  const body={gid:G.id,base:visit.base,seq:S.n,turn:S.turn,winner:S.win,state:JSON.stringify(S),prev:visit.prev,log:JSON.stringify(visit.shots),ver:EB_VER};
  G.seq=S.n; if(S.win!==-2) G.status="over";
  const ob=outbox(); ob[G.id]=body; LSJ("eb-outbox",ob);
  visit=null; wipSet(); markSeen(body.gid,body.seq);
  flushOutbox(true);
}
function netGameOver(){ if(G&&visit) visitSend(); }
async function flushOutbox(fromTurn){
  if(flushing) return; const ob=outbox(), ids=Object.keys(ob); if(!ids.length) return;
  flushing=true;
  for(const id of ids){
    const body=ob[id];
    try{
      await api("turn",body); const o2=outbox(); delete o2[id]; LSJ("eb-outbox",o2);
      if(fromTurn&&G&&G.id===id) toast(body.winner===-2?"Turn sent. "+G.opp.name+" gets an alert.":"Result sent.","#9ff6ff");
    }catch(e){
      if(e.net||e.nosrv){if(fromTurn)toast("No connection. Your turn is saved and will be sent when you're back online.","#ffb04a");setTimeout(()=>flushOutbox(false),15000);break;}
      const o2=outbox(); delete o2[id]; LSJ("eb-outbox",o2);
      if(G&&G.id===id){toast(e.message,"#ff8a6a");api("game",{gid:id}).then(g=>{if(G&&G.id===id&&!visit)enterGame(g);}).catch(()=>{});}
    }
  }
  flushing=false;
}
function netPollStart(){clearInterval(NET.gpT);NET.gpT=setInterval(netPoll,4000);}
async function netPoll(){
  if(!G||mode!=="online"){clearInterval(NET.gpT);return;}
  if(document.visibilityState!=="visible") return;
  const id=G.id;
  try{
    const p=await api("peek",{gid:id});
    if(!G||G.id!==id) return;
    if((p.chat|0)>(G.chat|0)) netChatNew();
    if(rep||replaying||visit||flushing||outbox()[id]||phase==="roll"||phase==="script") return;
    if(p.seq>G.seq||(p.status==="over"&&G.status!=="over")){const g=await api("game",{gid:id});if(G&&G.id===id&&!rep&&!visit&&phase!=="roll")enterGame(g);}
  }catch(e){}
}
addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&G)netPoll();});
async function netForfeit(){
  if(!G) return; const id=G.id;
  try{await api("forfeit",{gid:id});}catch(e){toast(e.message,"#ff8a6a");return;}
  try{const g=await api("game",{gid:id});enterGame(g);}catch(e){}
}
/* ---- chat in a game ---- */
async function netChatLoad(){
  if(!G) return; const id=G.id; chatLog.length=0; chatUnread=0; chatRender(); chatDot();
  try{
    const r=await api("chat",{gid:id,after:0}); if(!G||G.id!==id) return;
    const seen=(LSJ("eb-chatseen")||{})[id]||0; let unread=0,last=null; chatLog.length=0;
    for(const m of r.msgs){chatLog.push({mine:m.team===myIdx,text:m.text});if(m.team!==myIdx&&m.id>seen){unread++;last=m.text;}G.chat=Math.max(G.chat|0,m.id);}
    if(chatLog.length>40) chatLog.splice(0,chatLog.length-40);
    chatRender(); chatUnread=unread; chatDot(); if(unread) chatPopup(last);
  }catch(e){}
}
let chatFetching=false;
async function netChatNew(){
  if(!G||chatFetching) return; const id=G.id; chatFetching=true;
  try{
    const r=await api("chat",{gid:id,after:G.chat|0}); if(!G||G.id!==id) return;
    for(const m of r.msgs){
      G.chat=Math.max(G.chat|0,m.id);
      if(m.team===myIdx) continue;
      chatLog.push({mine:false,text:m.text}); if(chatLog.length>40) chatLog.shift();
      if(!chatIsOpen()){chatUnread++;chatDot();chatPopup(m.text);} else netChatSeen();
      SFX.chat();
    }
    chatRender();
  }catch(e){}
  chatFetching=false;
}
function netChatSeen(){if(!G)return;const s=LSJ("eb-chatseen")||{};s[G.id]=G.chat|0;LSJ("eb-chatseen",s);}
async function netSay(text){
  if(!G) return; chatLog.push({mine:true,text}); chatRender();
  try{const r=await api("say",{gid:G.id,text}); if(r&&r.id) G.chat=Math.max(G.chat|0,r.id);}catch(e){toast(e.message,"#ff8a6a");}
}
