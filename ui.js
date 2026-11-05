/* =====================================================================
   MENUS AND PANELS (plain page elements over the canvas)
   ===================================================================== */
const $=id=>document.getElementById(id);
function mk(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
function btn(label,fn,primary){const b=mk("button","btn"+(primary?" act":""),label);b.type="button";b.addEventListener("click",()=>{audioInit();SFX.click();fn(b);});return b;}
function opt(title,sub,fn,primary){const b=mk("button","opt"+(primary?" primary":""));b.type="button";b.appendChild(document.createTextNode(title));if(sub)b.appendChild(mk("small",null,sub));b.addEventListener("click",()=>{audioInit();SFX.click();goLandscape();fn(b);});return b;}
let toastT=0;
function toast(t,col){const e=$("toast");e.textContent=t;e.style.color=col||"var(--cream)";e.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove("show"),3200);}
const coarse=matchMedia("(pointer: coarse)").matches;
function goLandscape(){
  if(!coarse) return;
  const el=document.documentElement, req=el.requestFullscreen||el.webkitRequestFullscreen;
  const lock=()=>{try{if(screen.orientation&&screen.orientation.lock)screen.orientation.lock("landscape").catch(()=>{});}catch(e){}};
  if(document.fullscreenElement||document.webkitFullscreenElement){lock();return;}
  if(!req) return;
  try{const p=req.call(el,{navigationUI:"hide"});if(p&&p.then)p.then(lock).catch(()=>{});else lock();}catch(e){}
}
const canLock=!!((document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen)&&screen.orientation&&screen.orientation.lock);

/* ---- the title menu ---- */
let menuPanel="main";
function hideMenu(){const m=$("menu");m.hidden=true;m.textContent="";menuPanel="";clearInterval(NET.pollT);}
function showPanel(name){
  menuPanel=name; const m=$("menu"); m.textContent=""; m.style.justifyContent=name==="main"?"flex-end":"center"; m.classList.toggle("titleOn",name==="main");
  if(name==="main") panelMain(m); else if(name==="cpu") panelCpu(m); else if(name==="friends") panelFriends(m);
  else if(name==="how") panelHow(m); else if(name==="sound") panelSound(m);
}
function card(m,wide){const c=mk("div","card px"+(wide?" wide":""));m.appendChild(c);return c;}
function backBtn(c,to,title){const h=mk("div","head"),b=btn("‹ Back",()=>showPanel(to||"main"));b.classList.add("back");h.appendChild(b);if(title)h.appendChild(mk("h2",null,title));c.appendChild(h);}
function panelMain(m){
  const c=card(m); c.style.width="min(380px,52vw)"; c.style.marginRight="max(2vw,6px)";
  const o=mk("div","opts"); c.appendChild(o);
  const sv=loadLocal();
  if(sv&&sv.S&&sv.S.win===-2) o.appendChild(opt("Continue",sv.mode==="cpu"?"Your game vs the computer":"Your 2-player game",()=>resumeLocal(sv),true));
  o.appendChild(opt("Play the computer","Easy, medium or hard",()=>showPanel("cpu"),!sv));
  o.appendChild(opt("2 players","Pass the phone back and forth",()=>newLocal()));
  const f=opt("Play friends online","Take turns, even when you're apart",()=>{showPanel("friends");netRefresh();});f.id="goFriends";o.appendChild(f);
  const row=mk("div","tog"); row.appendChild(opt("How to play","",()=>showPanel("how"))); row.appendChild(opt("Sound","",()=>showPanel("sound"))); c.appendChild(row);
  const note=mk("p","note"); note.id="menuNote"; c.appendChild(note);
  if(!standalone&&coarse){const tip=mk("p","note");tip.innerHTML=isIOS?"<b>Play it like an app:</b> tap Share in Safari, then <b>Add to Home Screen</b>.":"<b>Play it like an app:</b> open the browser menu, then <b>Add to Home screen</b>.";c.appendChild(tip);}
  menuNote();
}
function menuNote(){
  const n=$("menuNote"); if(!n) return; const k=NET.prof&&NET.me?myTurnGames().length:0;
  n.textContent=k?(k+(k>1?" games wait":" game waits")+" for you online."):"v"+verName(EB_VER);
  const b=$("goFriends"); if(b) b.classList.toggle("primary",k>0);
}
function panelCpu(m){
  const c=card(m); backBtn(c,"main","Play the computer");
  const o=mk("div","opts"); c.appendChild(o);
  CPU_LEVELS.forEach((L,i)=>o.appendChild(opt(L.name,["Takes it easy and misses a lot","A fair game","Plans ahead and rarely misses"][i],()=>newCpu(i),i===1)));
}
function panelHow(m){
  const c=card(m,true); backBtn(c,"main","How to play");
  const p=(h,t)=>{const e=mk("p");const b=mk("b",null,h+" ");e.appendChild(b);e.appendChild(document.createTextNode(t));c.appendChild(e);};
  p("Aim:","Drag on the table (or tap) and the cue points that way. The little arrow buttons turn it in tiny steps. The dotted line shows where the cue ball goes; the yellow line is where the ball it hits will go.");
  p("Shoot:","Pull the POWER bar down and let go. A short pull is a soft shot. Slide it back up to the top to cancel.");
  p("Spin:","Tap the white circle. Top is follow (the cue ball rolls on after a hit), bottom is draw (it pulls back), sides add english off the rails.");
  p("Rules:","Pocket all of your group (solids 1-7 or stripes 9-15), then sink the 8 ball. The first ball you pocket after the break picks your group. Keep shooting while you pocket your balls.");
  p("Fouls:","Scratching, missing every ball, hitting the wrong ball first, or no ball touching a rail after contact gives your opponent the cue ball anywhere. Sinking the 8 early, or scratching on it, loses the game.");
  p("Online:","Take your turn whenever you like. Your friend gets an alert, watches your shots replay, then takes theirs.");
}
function panelSound(m){
  const c=card(m); backBtn(c,"main","Sound");
  const slider=(label,key)=>{
    const r=mk("div","vrow"),h=mk("div","vhead"),out=mk("output"),ctl=mk("div","vctl");h.append(mk("span",null,label),out);
    const dn=mk("button","vstep","−"),up=mk("button","vstep","+"),rg=mk("input");rg.type="range";rg.min=0;rg.max=100;rg.step=5;
    const set=v=>{v=clamp(v,0,100);SET[key]=v/100;rg.value=v;out.textContent=v+"%";saveSet();audioInit();applyVolumes();};
    dn.type=up.type="button"; dn.onclick=()=>set(Math.round(SET[key]*100)-10); up.onclick=()=>set(Math.round(SET[key]*100)+10); rg.oninput=()=>set(+rg.value);
    ctl.append(dn,rg,up);r.append(h,ctl);c.appendChild(r);set(Math.round(SET[key]*100));
  };
  slider("Sound effects","sfx"); slider("Music","music");
}

/* ---- starting games ---- */
function newCpu(level){
  cpuLevel=level; const seed=(Math.floor(Math.random()*2e9)+1)|0;
  const first=(Math.random()<0.5)?0:1;
  hideMenu(); audioInit(); applyVolumes();
  startTable("cpu",seed,first,[(NET.prof&&NET.prof.name)||"YOU","CPU"],0);
}
function newLocal(){
  const seed=(Math.floor(Math.random()*2e9)+1)|0; hideMenu(); audioInit(); applyVolumes();
  startTable("local",seed,0,["PLAYER 1","PLAYER 2"],0);
}
function resumeLocal(sv){
  hideMenu(); audioInit(); applyVolumes(); cpuLevel=sv.cpuLevel|0; mode=sv.mode; names=sv.names; S=sv.S; myIdx=0; replaying=false; rep=null; beginTurn();
}
function startOnlineUi(){ $("chat").hidden=true; }

/* ---- the friends page ---- */
const FR_DRAFT={};
function netMsg(t){const m=$("frMsg");if(m)m.textContent=t||"";else if(t)toast(t);}
function frInput(k,o){const inp=mk("input");Object.assign(inp,o||{});inp.dataset.k=k;if(FR_DRAFT[k])inp.value=FR_DRAFT[k];inp.addEventListener("input",()=>{FR_DRAFT[k]=inp.value;});return inp;}
function frTyping(){const a=document.activeElement,box=$("frBody");return !!(a&&box&&a.tagName==="INPUT"&&box.contains(a));}
document.addEventListener("focusout",e=>{const box=$("frBody");if(!box||!box.contains(e.target))return;setTimeout(()=>{if(NET.pendRender&&!frTyping()&&menuPanel==="friends"){NET.pendRender=false;frRender();}},300);});
function ago(t){if(!t)return "";const s=(Date.now()-t)/1000;return s<150?"online now":s<3600?Math.round(s/60)+" min ago":s<86400?Math.round(s/3600)+" h ago":Math.round(s/86400)+" d ago";}
function frRow(title,sub,btns,hot){const r=mk("div","frRow"+(hot?" hot":""));const t=mk("div","t",title);if(sub)t.appendChild(mk("small",null,sub));r.appendChild(t);for(const b of btns||[])r.appendChild(b);return r;}
function frSec(box,title){const s=mk("div","frSec");s.appendChild(mk("h3",null,title));box.appendChild(s);return s;}
function panelFriends(m){
  const c=card(m,true); backBtn(c,"main","Play friends online");
  const msg=mk("p","note warn"); msg.id="frMsg"; c.appendChild(msg);
  const body=mk("div","fbody"); body.id="frBody"; c.appendChild(body);
  frRender(true);
  clearInterval(NET.pollT); NET.pollT=setInterval(()=>{if(menuPanel==="friends"&&document.visibilityState==="visible")netRefresh();else if(menuPanel!=="friends")clearInterval(NET.pollT);},8000);
}
function frRender(force){
  const box=$("frBody"); if(!box||menuPanel!=="friends") return;
  if(!force&&frTyping()){NET.pendRender=true;return;}
  NET.pendRender=false; box.textContent="";
  if(NET.err) box.appendChild(mk("p","note warn",NET.err));
  if(!srvBase()){box.appendChild(mk("p",null,"Online games need the game server address. Ask whoever set up the game."));return;}
  if(!NET.prof){
    box.appendChild(mk("p",null,"Play your friends one turn at a time. Take your turn whenever you like; they get an alert when it's theirs. Games are saved on the server until someone wins or gives up."));
    box.appendChild(mk("p","note","Pick the name your friends will see. 8-Ball keeps its own friend list, separate from Spellsiege:"));
    const row=mk("div","inrow"),inp=frInput("name",{maxLength:16,placeholder:"Your name",autocomplete:"off",spellcheck:false});
    const go=btn("Create",async b=>{inp.blur();const n=inp.value.trim();if(!n){netMsg("Type a name first.");return;}b.disabled=true;
      try{await netRegister(n);delete FR_DRAFT.name;netMsg("");frRender(true);await netRefresh();}catch(e){netMsg(e.message);b.disabled=false;}},true);
    inp.addEventListener("keydown",e=>{if(e.key==="Enter")go.click();});
    row.append(inp,go); box.appendChild(row); return;
  }
  box.appendChild(frRow("You: "+NET.prof.name,"Your friend code: "+NET.prof.code,[btn("Share",shareCode)]));
  const al=alertInfo();
  box.appendChild(frRow(al.k==="on"?"Turn alerts: on":"Turn alerts",al.t,al.k==="off"?[btn("Turn on",enableAlerts,true)]:[],al.k==="off"));
  const me=NET.me; if(!me){box.appendChild(mk("p","note","Loading…"));return;}
  const GS=poolGames(), fn=g=>g.opp.name;
  const mine=GS.filter(g=>(g.status==="invite"&&g.me===1)||(g.status==="active"&&g.turn===g.me));
  const theirs=GS.filter(g=>(g.status==="invite"&&g.me===0)||(g.status==="active"&&g.turn!==g.me));
  const done=GS.filter(g=>g.status==="over").slice(0,6);
  if(mine.length){const s=frSec(box,"Your move");for(const g of mine){
    if(g.status==="invite") s.appendChild(frRow(fn(g)+" challenges you!","8-ball · you break",[btn("Accept",b=>{b.disabled=true;netAccept(g).catch(e=>{netMsg(e.message);netRefresh();});},true),btn("No",b=>{b.disabled=true;netDecline(g);})],true));
    else s.appendChild(frRow("vs "+fn(g),"Your turn",[btn("Play",()=>netOpen(g.id),true)],true));}}
  if(theirs.length){const s=frSec(box,"Waiting for them");for(const g of theirs){
    if(g.status==="invite") s.appendChild(frRow("Challenge sent to "+fn(g),"Waiting for them to accept",[btn("Cancel",b=>{b.disabled=true;netDecline(g);})]));
    else s.appendChild(frRow("vs "+fn(g),fn(g)+"'s turn",[btn("Look",()=>netOpen(g.id))]));}}
  if(done.length){const s=frSec(box,"Finished");for(const g of done){
    const res=g.winner===g.me?"You won":fn(g)+" won";
    s.appendChild(frRow(res+" vs "+fn(g),"",[btn("Rematch",async b=>{b.disabled=true;try{await netChallenge(g.opp.id);toast("Challenge sent to "+fn(g)+".","#9ff6ff");}catch(e){netMsg(e.message);}netRefresh();}),btn("✕",b=>{b.disabled=true;netHide(g);})]));}}
  const fs=frSec(box,"Friends");
  if(!me.friends.length) fs.appendChild(mk("p","note","No friends yet. Swap friend codes with someone: you each type in the other's code once."));
  for(const f of me.friends) fs.appendChild(frRow(f.name,ago(f.seen)||"Friend code "+f.code,[btn("Challenge",async b=>{b.disabled=true;try{await netChallenge(f.id);toast("Challenge sent to "+f.name+". You'll get an alert when they accept.","#9ff6ff");}catch(e){netMsg(e.message);}netRefresh();},true)]));
  const row=mk("div","inrow"),inp=frInput("code",{maxLength:8,placeholder:"FRIEND CODE",autocomplete:"off",spellcheck:false});inp.setAttribute("autocapitalize","characters");
  const go=btn("Add",async b=>{inp.blur();const c=inp.value.toUpperCase().replace(/[^A-Z0-9]/g,"");if(c.length<4){netMsg("Friend codes are 6 letters and numbers.");return;}b.disabled=true;
    try{const r=await netAddFriend(c);netMsg(r.friend.name+" is now your friend.");inp.value="";delete FR_DRAFT.code;await netRefresh();}catch(e){netMsg(e.message);b.disabled=false;}});
  inp.addEventListener("keydown",e=>{if(e.key==="Enter")go.click();});
  row.append(inp,go); fs.appendChild(row);
}
function shareCode(){
  const t="Add me on 8-Ball! My friend code is "+NET.prof.code+". "+location.origin+location.pathname;
  if(navigator.share) navigator.share({text:t}).catch(()=>{});
  else if(navigator.clipboard) navigator.clipboard.writeText(t).then(()=>netMsg("Copied. Paste it to your friend.")).catch(()=>netMsg("Your friend code is "+NET.prof.code));
  else netMsg("Your friend code is "+NET.prof.code);
}

/* ---- pause menu ---- */
function setOvl(){ovl=($("pause").hidden?0:1)+($("chat").hidden?0:1);}
function openPause(){
  if(!S||phase==="title") return;
  const p=$("pause"); p.hidden=false; p.textContent=""; setOvl();
  const c=card(p); c.appendChild(mk("h2",null,"Paused"));
  const o=mk("div","opts"); c.appendChild(o);
  o.appendChild(opt("Resume","",closePause,true));
  const row=mk("div","tog"); row.appendChild(opt("How to play","",()=>pauseSub("how"))); row.appendChild(opt("Sound","",()=>pauseSub("sound"))); c.appendChild(row);
  if(mode==="online"&&G&&G.status==="active") o.appendChild(opt("Give up","You lose this game",()=>{closePause();netForfeit();}));
  o.appendChild(opt("Quit to menu",mode==="online"?"Your game stays saved on the server":"This game is saved so you can continue",()=>{closePause();quitToMenu();}));
}
function pauseSub(w){
  const p=$("pause"); p.textContent=""; const m=p;
  if(w==="how") panelHow(m); else panelSound(m);
  const c=m.firstChild; const b=c.querySelector(".back"); if(b){const nb=btn("‹ Back",openPause);nb.classList.add("back");b.replaceWith(nb);}
}
function closePause(){const p=$("pause");p.hidden=true;p.textContent="";setOvl();}
function quitToMenu(){
  const wasOnline=mode==="online"; saveLocal(); leaveGame(); $("over").hidden=true; $("over").textContent="";
  closeChat(); S=null; phase="title"; sim=null; anim=null; timers.length=0; replaying=false;
  const m=$("menu"); m.hidden=false; showPanel(wasOnline?"friends":"main"); if(wasOnline) netRefresh();
}

/* ---- game over ---- */
function showOver(){
  const o=$("over"); o.hidden=false; o.textContent=""; const c=card(o);
  const w=S.win, mine=mode==="local"?true:mode==="cpu"?w===0:w===myIdx;
  c.appendChild(mk("h2",null,mode==="local"?names[w]+" wins!":mine?"You win!":names[w]+" wins"));
  if(S.why) c.appendChild(mk("p",null,S.why));
  const row=mk("div","tog"); c.appendChild(row);
  if(mode==="online"&&G){
    row.appendChild(opt("Rematch","",async b=>{b.disabled=true;try{await netChallenge(G.opp.id);toast("Challenge sent to "+G.opp.name+".","#9ff6ff");}catch(e){toast(e.message,"#ff8a6a");}b.disabled=false;}));
  } else {
    row.appendChild(opt("Rematch","",()=>{o.hidden=true;o.textContent="";const seed=(Math.floor(Math.random()*2e9)+1)|0;startTable(mode,seed,mode==="cpu"?(Math.random()<0.5?0:1):0,names,0);},true));
  }
  row.appendChild(opt("Menu","",()=>{o.hidden=true;o.textContent="";quitToMenu();}));
}

/* ---- chat (online games) ---- */
const chatLog=[]; const CHAT_QUICK=["Nice shot!","Ouch","GG","Oops"];
const chatIsOpen=()=>!$("chat").hidden;
function chatRender(){
  const box=$("chatLog"); box.textContent="";
  for(const c of chatLog){const d=mk("div","cm "+(c.mine?"me":"fr"));d.appendChild(mk("b",null,c.mine?"You":(G?G.opp.name:"Friend")));d.appendChild(mk("span",null,": "+c.text));box.appendChild(d);}
  box.scrollTop=box.scrollHeight;
}
function chatDot(){chatUnread=chatUnread|0;}
function chatPopup(t){const p=$("chatPop");p.textContent=(G?G.opp.name:"Friend")+": "+t;p.hidden=false;clearTimeout(chatPopT);chatPopT=setTimeout(()=>{p.hidden=true;},4500);}
let chatPopT=0;
function openChat(){
  if(mode!=="online") return; const c=$("chat"); c.hidden=false; chatUnread=0; $("chatPop").hidden=true; chatRender(); netChatSeen(); setOvl();
}
function closeChat(){$("chat").hidden=true;$("chatIn").blur();setOvl();}
(function(){
  const q=$("chatQ"); for(const t of CHAT_QUICK){const b=mk("button",null,t);b.type="button";b.addEventListener("click",()=>netSay(t));q.appendChild(b);}
  const send=()=>{const i=$("chatIn"),t=i.value.replace(/\s+/g," ").trim();if(!t)return;i.value="";netSay(t.slice(0,120));};
  $("chatSend").addEventListener("click",send); $("chatIn").addEventListener("keydown",e=>{if(e.key==="Enter")send();e.stopPropagation();});
  $("chatX").addEventListener("click",closeChat); $("chatPop").addEventListener("click",()=>{$("chatPop").hidden=true;openChat();});
})();
