// Changed native Telegram bridge only. Synthetic authenticated projections and a
// fake Android transport: no gateway, model input, production media or synthesis.
// Run: node mobile/ui/tests/telegram-native.spec.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ui=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'watch-telegram-bridge-'));
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://fixture.local').pathname,file=path.resolve(ui,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(ui+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=spawn('/usr/bin/chromium',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let ws,checks=0;const failures=[],errors=[];
const check=(value,label,detail)=>{checks++;if(!value)failures.push({label,...(detail===undefined?{}:{detail})});};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  let port;for(let i=0;i<100;i++){try{port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);if(port)break;}catch{}await pause(100);}
  assert.ok(port,'isolated Chromium started');
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  ws=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let serial=0;const pending=new Map();
  ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);const task=pending.get(message.id);if(!task)return;pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
  const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(50);}throw Error('Bridge fixture condition failed: '+expression+' '+JSON.stringify(errors));};
  const act=async(action,data={})=>{await evaluate(`__act(${JSON.stringify(action)},${JSON.stringify(data)})`);await pause(90);};
  const expect=async(expression,label)=>{const result=await evaluate(expression);check(result,label);};
  await call('Page.enable');await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:412,height:900,deviceScaleFactor:3,mobile:true});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__requests=[];window.__calls=[];window.__renders=[];window.__speech=[];window.__failStorage=false;
    window.__agents=['main','forge','atlas','aera-new','vvv','daedalus'];window.__sessions=Object.fromEntries(__agents.map(id=>[id,'physical:'+id]));
    window.__caps={send:true,queue:true,steer:true,strictSteer:false,abort:true,attachments:true,voice:true,reply:true,speech:true,commands:true};
    window.__now=Date.now();window.__extra=[];window.__text={};
    window.__messages=agent=>{const sessionId=__sessions[agent],source='authenticated-native-history',base={agent,sessionId,source,publicAttested:true,role:'assistant',timestamp:__now-1000};return [
      {...base,id:'public:'+sessionId,kind:'reply',text:__text[agent]||'Readable '+agent+' report.'},
      {...base,id:'audio:'+sessionId,kind:'media',text:'',media:[{kind:'audio',label:'Approved attachment',index:0,downloadAvailable:true,url:'/v1/media?agent='+agent+'&sessionId='+encodeURIComponent(sessionId)+'&messageId='+encodeURIComponent('audio:'+sessionId)+'&index=0'}]},
      {...base,id:'unavailable:'+sessionId,kind:'media',text:'',media:[{kind:'audio',index:0,downloadAvailable:false,unavailableReason:'No accepted bytes'}]},
      {...base,id:'long:'+sessionId,kind:'reply',text:'Long readable '+('public detail '.repeat(2100))+'END OF FULL REPORT'},...__extra];};
    window.__work=agent=>{const sessionId=__sessions[agent];return {id:'work:'+sessionId,agent,sessionId,sessionKey:'fixture:'+agent,role:'assistant',source:'authenticated-tool-status',publicAttested:true,kind:'Tool finished',text:'Memory search returned 3 matches',runId:'run:'+sessionId,callId:'call:'+sessionId,timestamp:__now,evidenceRevision:'e'.repeat(64),observation:{version:1,agent,sessionId,sessionKey:'fixture:'+agent,runId:'run:'+sessionId,callId:'call:'+sessionId,tool:'memory_search',phase:'result',result:{matchCount:3},gaps:['private-query-withheld']}};};
    window.__snapshot=(agent='atlas')=>({version:2,connected:true,lastSuccess:Date.now(),selectedAgent:agent,
      agents:__agents.map(id=>({id,status:id==='atlas'?'active':'idle',sessionKey:'fixture:'+id,sessionId:__sessions[id],historyAvailable:true,capabilities:__caps,controlTargets:[{agent:id,sessionKey:'fixture:'+id,sessionId:__sessions[id],runId:'run:'+__sessions[id],scope:'conversation'}],telemetry:{activeSessions:id==='atlas'?1:0,queuedSessions:0}})),
      conversation:__messages(agent),historyState:{status:'complete'},historyHasMore:true,total:4,
      fleetActivity:__agents.map(id=>({...__messages(id)[0],kind:'Confirmed report'})),workActivity:__agents.map(__work),
      fleetCoverage:__agents.map(agent=>({agent,available:true,status:'recorded-window',work:{available:true,partial:true}}))});
    window.__act=(action,extra={})=>onDracoTelegramAction({action,data:{agent:__last.agent,sessionId:__last.sessionId,runId:__last.controlRunId,...extra}});
    const originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(__failStorage)throw Error('Quota');return originalSet.call(this,key,value)};
    window.confirm=()=>true;
    window.DracoNative={
      renderTelegram(json){const row=JSON.parse(json);__renders.push(row);window.__last=row;},
      refresh(agent){setTimeout(()=>onDracoSnapshot(__snapshot(agent)),0)},
      request(id,method,path,json){const body=json?JSON.parse(json):null;__requests.push({id,method,path,body});
        if(path.startsWith('/v1/capabilities')){const agent=new URLSearchParams(path.split('?')[1]).get('agent');setTimeout(()=>onDracoResponse({id,ok:true,data:{...__caps,agent,sessionId:__sessions[agent]}}),0);}
        else if(path.startsWith('/v1/history')){const agent=new URLSearchParams(path.split('?')[1]).get('agent');setTimeout(()=>onDracoResponse({id,ok:true,data:{agent,sessionId:__sessions[agent],messages:__messages(agent),historyState:{status:'complete'},hasMore:false,total:4}}),0);}
        else if(path==='/v1/speech')__speech.push({id,body});
      },
      playMedia(path,id){__calls.push({method:'playMedia',path,id})},stopMedia(){__calls.push({method:'stopMedia'})},
      setPlaybackRate(rate){__calls.push({method:'rate',rate})},hideKeyboard(){},openSettings(){__calls.push({method:'settings'})},
      copyText(text){__calls.push({method:'copy',text})},shareText(text){__calls.push({method:'share',text})},
      chooseAttachment(agent){__calls.push({method:'chooseAttachment',agent})},startRecording(agent){__calls.push({method:'record',agent})},stopRecording(){__calls.push({method:'stopRecording'})},
      previewAttachment(id){__calls.push({method:'previewAttachment',id})},cancelAttachment(id){__calls.push({method:'cancelAttachment',id})},releaseAttachment(id){__calls.push({method:'releaseAttachment',id})},
      openLink(url){__calls.push({method:'link',url})}
    };`});
  const url='http://127.0.0.1:'+server.address().port+'/';
  await call('Page.navigate',{url});await wait('!!window.DracoWatch&&window.__last?.live');
  await expect('__last.visible&&!__last.chat&&__last.roster.length===6&&__last.activity.length===12','native roster and all six public/work streams render');
  await act('openChat',{agent:'forge'});await wait('__last.chat&&__last.agent==="forge"&&__last.can.speech');
  await expect('__last.sessionId==="physical:forge"&&__last.messages.every(m=>m.id.includes("physical:forge"))&&__last.work[0].detail.includes("call:physical:forge")','native chat contains exact physical-session messages and safe tool identity');
  await act('pin',{id:'public:physical:forge'});await act('pin',{id:'work:physical:forge'});
  await expect('__last.pins.length===2&&__last.pins[0].runId==="run:physical:forge"&&__last.pinHistory.length===2&&__last.pins.every(p=>p.scope==="device-local")','native messages and operational events pin with exact device-local identity');
  await act('pin',{id:'public:physical:forge'});await act('unpin',{id:'public:physical:forge'});
  await expect('__last.pins.length===1&&__last.pinHistory.length===3&&__last.pinHistory[0].action==="unpin"','duplicate pin is idempotent and unpin history remains visible');
  await act('pin',{id:'public:physical:forge'});await act('goto',{id:'public:physical:forge'});
  await expect('__last.focusMessageId==="public:physical:forge"','pin navigation focuses the exact loaded message');
  await act('draft',{text:'Saved native draft'});await call('Page.reload');await wait('!!window.DracoWatch&&window.__last?.live');await act('openChat',{agent:'forge'});
  await expect('__last.draft==="Saved native draft"&&__last.pins.length===2&&__last.pinHistory.length===4&&__requests.every(r=>r.method==="GET")','native draft, pin history and active pins survive recreation without sending');
  await evaluate('__text.forge="Updated same-message progress";onDracoSnapshot(__snapshot("forge"))');await pause(90);
  await expect('__last.pins.find(p=>p.messageId==="public:physical:forge").text==="Updated same-message progress"&&__last.pins.find(p=>p.messageId==="public:physical:forge").sourceAvailable&&JSON.parse(localStorage.getItem("draco-watch-client-v2")).pins.find(p=>p.messageId==="public:physical:forge").text==="Readable forge report."','pin banner resolves a live same-ID revision without rewriting the retained user-selected snapshot');
  await act('goto',{id:'work:physical:forge'});
  await expect('__last.focusMessageId==="work:physical:forge"||__last.view==="activity"','pinned operational event navigation reaches its work evidence');
  await act('view',{view:'chamber'});await expect('!__last.visible&&__last.view==="chamber"','Chamber is an accessible WebView fallback, not covered by native chat');
  await act('view',{view:'environment'});await expect('!__last.visible&&__last.view==="environment"','Environment and graphics remain accessible outside native chat');
  await act('openChat',{agent:'forge'});await act('tools');await expect('!__last.visible&&document.getElementById("conversation-actions-dialog").open','native tools menu yields to the existing accessible dialog');
  await evaluate('document.getElementById("conversation-actions-close").click()');await wait('__last.visible');
  await act('full',{id:'long:physical:forge'});await expect('!__last.visible&&document.getElementById("conversation-list").textContent.includes("END OF FULL REPORT")','full long text opens the exact readable fallback without truncation');
  await evaluate('DracoWatch.back()');await wait('__last.visible');
  await act('send',{mode:'steer'});
  await expect('!__requests.some(r=>r.method==="POST")&&__last.draft==="Saved native draft"&&document.getElementById("toast").textContent.includes("Nothing was sent or queued")','unsupported Steer dispatches nothing and retains native draft');
  await evaluate('window.__oldRun=__last.controlRunId;const next=__snapshot("forge");next.agents.find(a=>a.id==="forge").controlTargets[0].runId="different-active-run";onDracoSnapshot(next)');await pause(90);
  await act('stop',{runId:'run:physical:forge'});await act('send',{mode:'steer',runId:'run:physical:forge'});
  await expect('!__requests.some(r=>r.method==="POST")&&__last.controlRunId==="different-active-run"&&document.getElementById("toast").textContent.includes("displayed run changed")','same-session run replacement rejects stale Stop/Steer instead of targeting the newer run');
  await evaluate('onDracoSnapshot(__snapshot("forge"))');await pause(90);
  await act('reply',{id:'public:physical:forge'});await act('send',{mode:'queue'});
  await expect('__requests.filter(r=>r.path==="/v1/message").length===1&&__requests.find(r=>r.path==="/v1/message").body.agent==="forge"&&__requests.find(r=>r.path==="/v1/message").body.sessionId==="physical:forge"&&__requests.find(r=>r.path==="/v1/message").body.replyToId==="public:physical:forge"&&__requests.find(r=>r.path==="/v1/message").body.mode==="queue"','native reply/send uses the exact selected agent, physical session, message and deliberate Queue mode');
  await evaluate('window.__sent=__requests.find(r=>r.path==="/v1/message");onDracoResponse({id:__sent.id,ok:false,error:"ACK lost"})');await pause(90);
  await act('draft',{text:'New unsent text'});await act('send',{mode:'send'});
  await expect('__requests.filter(r=>r.path==="/v1/message").length===1&&__last.outbox[0].state==="uncertain"&&__last.outbox[0].retry&&__last.draft==="New unsent text"','uncertain original outbox blocks a new send without destroying the newer native draft');
  await evaluate('window.__old={agent:"forge",sessionId:"physical:forge"};window.__before=__requests.length;window.__beforeCalls=__calls.length');
  await act('openChat',{agent:'atlas'});
  for(const action of ['draft','send','pin','unpin','reply','read','media','retry'])await act(action,{agent:'forge',sessionId:'physical:forge',id:'public:physical:forge',mode:'send',text:'WRONG RECIPIENT',index:0});
  await expect('__last.agent==="atlas"&&__last.draft!=="WRONG RECIPIENT"&&!__last.pins.length&&__requests.filter(r=>r.method==="POST").length===1&&__calls.filter(r=>r.method==="playMedia").length===0','stale native controls cannot retarget mutation, reply, read, retry or playback to another agent');
  await act('read',{id:'public:physical:atlas'});
  await expect('__speech.length===1&&__speech[0].body.agent==="atlas"&&__speech[0].body.sessionId==="physical:atlas"&&__speech[0].body.messageId==="public:physical:atlas"','deliberate Read aloud requests the exact readable current-session reply');
  await evaluate('const speech=__speech[0];onDracoResponse({id:speech.id,ok:true,data:{...speech.body,path:"/v1/speech/"+"a".repeat(64)}})');await pause(90);
  await expect('__calls.some(r=>r.method==="playMedia"&&r.path==="/v1/speech/"+"a".repeat(64))','matching synthetic speech asset reaches native playback');
  await act('stopAudio');await act('media',{id:'audio:physical:atlas',index:0});
  await expect('__calls.some(r=>r.method==="playMedia"&&r.id==="audio:physical:atlas:0"&&r.path.includes("agent=atlas")&&r.path.includes("sessionId=physical%3Aatlas"))','manual attachment playback keeps exact agent/session/message/index identity');
  await evaluate('window.__playsBefore=__calls.filter(r=>r.method==="playMedia").length');await act('media',{id:'unavailable:physical:atlas',index:0});await act('media',{id:'audio:physical:atlas',index:9});await act('read',{id:'work:physical:atlas'});
  await expect('__calls.filter(r=>r.method==="playMedia").length===__playsBefore&&__speech.length===1','unavailable media, wrong index and tool output cannot trigger playback or synthetic speech');
  for(const rate of [.5,.75,1,1.25,1.5,2])await act('speed',{rate});
  await expect('[.5,.75,1,1.25,1.5,2].every(rate=>__calls.some(r=>r.method==="rate"&&r.rate===rate))&&JSON.parse(localStorage.getItem("draco-watch-client-v2")).preferences.playbackRate===2','all six native speed choices persist and reach the existing player without regeneration');
  await act('pin',{id:'public:physical:atlas'});await evaluate('window.__failStorage=true');await act('unpin',{id:'public:physical:atlas'});await evaluate('window.__failStorage=false');
  await expect('__last.pins.some(p=>p.messageId==="public:physical:atlas")&&document.getElementById("toast").textContent.includes("could not be saved")','native unpin rolls back on storage failure instead of falsely removing the pin');
  await evaluate('window.__beforeDisconnectPosts=__requests.filter(r=>r.method==="POST").length;window.__beforeDisconnectPlays=__calls.filter(r=>r.method==="playMedia").length;onDracoConnection({state:"offline"})');await pause(90);
  await expect('!__last.live&&!__last.can.send&&__last.messages.length===4&&__last.pins.length===1&&__last.historyNote.includes("Last received")','disconnect retains readable chat/pins with stale label and disabled live controls');
  await evaluate('onDracoSnapshot(__snapshot("atlas"))');await pause(90);
  await expect('__last.live&&__requests.filter(r=>r.method==="POST").length===__beforeDisconnectPosts&&__calls.filter(r=>r.method==="playMedia").length===__beforeDisconnectPlays','reconnect refreshes projection without replaying uncertain input or old audio');
  await evaluate('window.__extra=[{...__messages("atlas")[0],id:"FOREIGN",sessionId:"other-session",text:"FOREIGN SESSION TEXT"},{...__messages("atlas")[0],id:"PRIVATE",publicAttested:false,text:"PRIVATE TEXT"},{...__messages("atlas")[0],id:"RAW",source:"raw-tool",text:"RAW TOOL TEXT"}];onDracoSnapshot(__snapshot("atlas"))');await pause(90);
  await expect('__last.messages.every(m=>!["FOREIGN","PRIVATE","RAW"].includes(m.id))','native payload excludes wrong-session, private and raw-source rows even if supplied in a damaged conversation');
  await evaluate('__extra=[];onDracoSnapshot(__snapshot("atlas"))');await act('reply',{id:'public:physical:atlas'});await act('draft',{text:'Reply after session change'});
  await evaluate('__sessions.atlas="physical:atlas:v2";onDracoSnapshot(__snapshot("atlas"))');await pause(100);
  await expect('__last.sessionId==="physical:atlas:v2"&&__last.pins.length===0&&!__last.replyLabel&&!__last.focusMessageId','physical-session replacement clears old reply/focus and never carries local pins into the new session');
  await act('send',{agent:'atlas',sessionId:'physical:atlas',mode:'send'});
  await expect('__requests.filter(r=>r.path==="/v1/message").length===1','old physical-session native send is refused, not retargeted');
  await act('send',{mode:'send'});
  await expect('__requests.filter(r=>r.path==="/v1/message").length===2&&!__requests.filter(r=>r.path==="/v1/message").at(-1).body.replyToId&&__requests.filter(r=>r.path==="/v1/message").at(-1).body.sessionId==="physical:atlas:v2"','a deliberate new-session send never carries the previous session reply target');
  await evaluate('const sent=__requests.filter(r=>r.path==="/v1/message").at(-1);onDracoResponse({id:sent.id,ok:true,data:{status:"queued"}})');await pause(100);
  await expect('__last.draft===""&&__last.outbox.at(-1).state==="accepted"&&__last.outbox.at(-1).note.includes("queued")','exact-ID acceptance clears only the matching native draft and stays an admission receipt');
  await act('draft',{text:'x'.repeat(17000)});
  await expect('__last.draft.length<=16000&&__last.draft===JSON.parse(localStorage.getItem("draco-watch-client-v2")).drafts.atlas','native draft length uses the same durable 16000-character bound as the existing composer');
  await evaluate('__act("draft",{text:""});__act("openChat",{agent:"forge"})');await pause(120);
  await expect('__last.outbox[0].id===__sent.id&&__last.outbox[0].state==="uncertain"&&__last.draft==="New unsent text"','other-agent acceptance and session rollover preserve the original uncertain submission and newer draft');
  await evaluate('__extra=Array.from({length:100},(_,i)=>({...__messages("forge")[0],id:"history-"+i,text:"Public historical "+i}));onDracoSnapshot(__snapshot("forge"))');
  await act('goto',{id:'public:physical:forge'});await expect('__last.messages.some(m=>m.id==="public:physical:forge")','pin navigation can select an older loaded message beyond the latest 50-row window');
  await evaluate('__extra=[];onDracoSnapshot(__snapshot("forge"))');await pause(90);
  await expect('__last.messages.length>0&&__last.messages.length<=4&&__last.messages.some(m=>m.id==="public:physical:forge")','a narrowed current history clamps the native window and preserves its requested current anchor');
  check(errors.length===0,'bridge has no uncaught browser errors',errors);
  console.log(JSON.stringify({checks,passed:failures.length===0,failures,productionInput:false,synthesis:false,realMedia:false},null,2));
  if(failures.length)process.exitCode=1;
}finally{
  ws?.close();browser.kill();await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),pause(1500)]);
  await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});
}
