// Real app DOM + native payload, isolated synthetic transport only. No production input or audio.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ui=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'watch-local-conversation-3474-'));
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://fixture.local').pathname;
  const file=path.resolve(ui,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(ui+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=spawn('/usr/bin/chromium',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
const results=[],errors=[],network=[];
let ws;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  let port;
  for(let i=0;i<100;i++){try{port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);if(port)break;}catch{}await pause(50);}
  assert.ok(port,'isolated Chromium started');
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  ws=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let serial=0;
  const pending=new Map();
  ws.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
    if(message.method==='Network.requestWillBeSent')network.push(message.params.request.url);
    const task=pending.get(message.id);if(!task)return;
    pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);
  };
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{
    const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  };
  const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(50);}throw Error('App DOM condition failed: '+expression);};
  const check=async(expression,label)=>results.push({label,passed:await evaluate(expression)===true});
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:412,height:892,deviceScaleFactor:3,mobile:true});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__requests=[];window.__calls=[];window.__last={};window.__session='physical-atlas';window.__extra=[];
    window.__today=new Date();__today.setHours(0,0,0,0);window.__base=__today.getTime();
    const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[__base+8*3600000]));}static now(){return __base+8*3600000;}};
    window.__long='ORIGINAL LONG BODY\\n'+('literal **detail** '.repeat(1800))+'\\nEND OF ORIGINAL REQUEST';
    window.__original='First exact request\\n**literal body**, not a receipt placeholder.';
    window.__make=(id,text,state,at,extra={})=>({id,agent:'atlas',path:'/v1/message',state,at,note:'Specific admission detail',body:{agent:'atlas',sessionId:'physical-atlas',idempotencyKey:id,text,mode:'send'},...extra});
    if(!localStorage.getItem('draco-watch-client-v2'))localStorage.setItem('draco-watch-client-v2',JSON.stringify({drafts:{atlas:'New saved draft'},preferences:{automaticSpeech:false,echoToTelegram:false},outbox:[
      __make('request-yesterday',__original,'accepted',__base-8*3600000),
      __make('request-today','Repeated body','accepted',__base+6*3600000+51*60000),
      __make('request-distinct','Repeated body','accepted',__base+6*3600000+53*60000),
      __make('request-rejected','Rejected original body','rejected',__base+6*3600000+54*60000),
      __make('request-long',__long,'accepted',__base+6*3600000+55*60000),
      __make('request-uncertain','Unconfirmed exact request','uncertain',__base+6*3600000+56*60000),
      __make('request-old','DO NOT IMPORT OLD SESSION','accepted',__base,{body:{agent:'atlas',sessionId:'previous-atlas',idempotencyKey:'request-old',text:'DO NOT IMPORT OLD SESSION'}}),
      __make('request-other','DO NOT IMPORT OTHER AGENT','accepted',__base,{agent:'forge',body:{agent:'forge',sessionId:'physical-forge',idempotencyKey:'request-other',text:'DO NOT IMPORT OTHER AGENT'}}),
      __make('stop-control','DO NOT IMPORT STOP','accepted',__base,{path:'/v1/abort'})]}));
    window.__caps={send:true,queue:true,steer:false,strictSteer:false,abort:true,attachments:true,voice:true,reply:true,speech:true,commands:true};
    window.__message=(id,text,timestamp,extra={})=>({id,agent:'atlas',sessionId:__session,role:'assistant',kind:'reply',text,timestamp,publicAttested:true,source:'authenticated-native-history',...extra});
    window.__messages=()=>[__message('public-early','Readable report before the local request.',__base+6*3600000+50*60000),__message('public-between','Readable report between local requests.',__base+6*3600000+52*60000),...__extra];
    window.__snapshot=()=>({connected:true,lastSuccess:Date.now(),selectedAgent:'atlas',agents:['main','forge','atlas','aera-new','vvv','daedalus'].map(id=>({id,status:id==='atlas'?'active':'idle',conversationStatus:id==='atlas'?'active':'idle',sessionKey:'agent:'+id+':telegram:direct:8745908879',sessionId:id==='atlas'?__session:'physical-'+id,historyAvailable:true,capabilities:__caps,controlTargets:[],telemetry:{activeSessions:id==='atlas'?1:0,queuedSessions:0}})),conversation:__messages(),historyState:{status:'complete'},historyHasMore:false});
    window.__emit=()=>onDracoSnapshot(__snapshot());
    window.DracoNative={refresh(){setTimeout(__emit,5)},request(id,method,path,json){const body=json?JSON.parse(json):null;__requests.push({id,method,path,body});if(method==='GET')setTimeout(()=>onDracoResponse({id,ok:true,status:200,data:{...__caps,agent:'atlas',sessionId:__session,messages:__messages(),historyState:{status:'complete'}}}),5)},renderTelegram(json){__last=JSON.parse(json)},stopMedia(){},copyText(text){__calls.push({method:'copy',text})},shareText(text){__calls.push({method:'share',text})},playMedia(){__calls.push({method:'play'})}};
    window.__act=(action,data={})=>onDracoTelegramAction({action,data:{agent:'atlas',sessionId:__session,sessionKey:'agent:atlas:telegram:direct:8745908879',...data}});
  `});
  await call('Page.navigate',{url:origin+'/'});
  await wait('!!window.DracoWatch&&document.getElementById("connection-label").textContent==="Connected"');
  await evaluate('DracoWatch.select("atlas")');await wait('__last.chat&&__last.messages?.length===8');
  const local='document.querySelector("[data-message-id=request-yesterday][data-local-submission=true]")';
  await check(local+'.querySelector(".message-text").textContent===__original&&'+local+'.querySelector(".request-custody").open===false&&!document.querySelector(".submission-receipt")','accepted original body is visible before compact closed custody detail, never replaced by placeholder');
  await check('__last.messages.filter(m=>m.localSubmission).length===6&&__last.messages.filter(m=>m.localSubmission).every(m=>!m.canPin&&!m.canReply&&!m.canRead&&!m.media.length&&m.kind==="Local request")','native receives exact local request rows with no public/audio/control grants');
  await check('__last.messages.map(m=>m.id).join("|") === "request-yesterday|public-early|request-today|public-between|request-distinct|request-rejected|request-long|request-uncertain"','public and local rows are one chronological stream, not appended receipts');
  await check('document.querySelectorAll(".conversation-day").length===2&&new Set([...document.querySelectorAll(".conversation-day")].map(n=>n.dataset.day)).size===2','fallback displays stable separate calendar days across 16:00 yesterday and 06:50 today');
  await check('!document.getElementById("conversation-list").textContent.includes("DO NOT IMPORT")&&__last.messages.every(m=>m.id!=="stop-control")','other agents, replacement sessions and abort controls never become conversation bodies');
  await check('__last.messages.find(m=>m.id==="request-rejected").submissionState==="rejected"&&__last.messages.find(m=>m.id==="request-uncertain").submissionNote.includes("Admission unconfirmed")&&__last.draft==="New saved draft"','rejected and uncertain requests keep exact visible bodies and saved newer draft');
  await evaluate(local+'.querySelector(".message-menu").click()');
  await check('[...document.querySelectorAll("#message-action-list button")].every(b=>!/[Rr]eply|[Rr]ead|[Pp]in/.test(b.textContent))','local fallback menu cannot reply, read or pin');
  await evaluate('document.getElementById("message-actions-close").click();__before=JSON.stringify(JSON.parse(localStorage.getItem("draco-watch-client-v2")));__beforeNode=document.querySelector("[data-message-id=request-yesterday]");__emit()');
  await check('__before===JSON.stringify(JSON.parse(localStorage.getItem("draco-watch-client-v2")))&&__beforeNode===document.querySelector("[data-message-id=request-yesterday]")','unchanged refresh neither rewrites submission custody nor replaces rendered rows');
  await evaluate('__extra=[__message("native-original",__original,__base-8*3600000,{role:"user",requestId:"request-yesterday"})];__emit()');await pause(100);
  await check('__last.messages.filter(m=>m.id==="native-original"||m.id==="request-yesterday").length===1&&__last.messages.find(m=>m.id==="native-original").canPin','exact authenticated request key and body reconcile to source-owned native record');
  await evaluate('__extra=[__message("legacy-same",__original,__base-8*3600000,{role:"user",idempotencyKey:"request-yesterday"})];__emit()');await pause(100);
  await check('__last.messages.some(m=>m.id==="request-yesterday"&&m.localSubmission)&&__last.messages.some(m=>m.id==="legacy-same")','same body and legacy idempotency field cannot reconcile by inference');
  await evaluate('__extra=[__message("conflicting-key","Different original body",__base-8*3600000,{role:"user",requestId:"request-yesterday"})];__emit()');await pause(100);
  await check('__last.messages.some(m=>m.id==="request-yesterday"&&m.localSubmission)&&__last.messages.some(m=>m.id==="conflicting-key")','conflicting exact key retains separately labelled original custody');
  await evaluate('__extra=[];__emit()');await pause(100);
  await check('__last.messages.find(m=>m.id==="request-yesterday").localSubmission&&__last.messages.find(m=>m.id==="request-yesterday").canPin===false','withdrawn source cannot leave local row with authenticated public capability');
  await evaluate('__act("full",{id:"request-long",localSubmission:true})');await pause(100);
  await check('document.querySelector("[data-message-id=request-long][data-local-submission=true] .message-text").textContent===__long&&!__last.visible','native local full route shows original bounded body in fallback, without synthesizing or retargeting');
  await evaluate('document.getElementById("native-return").click();__act("copy",{id:"request-yesterday",localSubmission:true});__act("pin",{id:"request-yesterday",localSubmission:true});__act("read",{id:"request-yesterday",localSubmission:true});__act("reply",{id:"request-yesterday",localSubmission:true});__act("media",{id:"request-yesterday",localSubmission:true,index:0})');await pause(100);
  await check('__calls.some(c=>c.method==="copy"&&c.text===__original)&&JSON.parse(localStorage.getItem("draco-watch-client-v2")).pins.length===0&&__last.replyLabel===""&&__requests.every(r=>r.method==="GET"||r.path==="/v1/diagnostics")&&!__calls.some(c=>c.method==="play")','exact local copy works; forged public, speech and media actions grant nothing');
  await evaluate('__act("retry",{id:"request-uncertain"})');await pause(100);
  await check('__last.messages.find(m=>m.id==="request-uncertain").submissionState==="pending"&&__requests.filter(r=>r.path==="/v1/message").length===1&&__requests.filter(r=>r.path==="/v1/message").at(-1).body.text==="Unconfirmed exact request"','explicit retry keeps same original ID and visible pending body, without automatic replay');
  await evaluate('onDracoResponse({id:"request-uncertain",ok:true,status:200,data:{status:"queued"}})');await pause(100);
  await check('__last.messages.find(m=>m.id==="request-uncertain").submissionState==="accepted"&&__last.outbox.length===0&&__last.draft==="New saved draft"&&__last.actionNote.includes("Send and Queue")&&__last.actionNote.includes("follow-up")&&!__last.can.steer','late admission preserves newer draft, removes duplicate receipt, explains ordinary input and retains strict Steer refusal');
  await evaluate('__act("draft",{text:"Brand-new exact request"});__act("send",{text:"Brand-new exact request",mode:"send"})');await pause(100);
  await check('__last.messages.at(-1).localSubmission&&__last.messages.at(-1).text==="Brand-new exact request"&&__last.messages.at(-1).submissionState==="pending"','new explicit Send immediately shows exact original body before admission');
  await evaluate('onDracoResponse({id:__requests.filter(r=>r.path==="/v1/message").at(-1).id,ok:false,uncertain:false,error:"Rejected fixture input",data:{dispatched:false}})');await pause(100);
  await check('__last.messages.at(-1).submissionState==="rejected"&&__last.draft==="Brand-new exact request"','rejected current input remains visible and saved, with no read/start/completion inference');
  await evaluate('const s=__snapshot();s.historyState={status:"partial",reason:"phone-page-budget",unresolvedCount:2};onDracoSnapshot(s)');await pause(100);
  await check('__last.historyNote.includes("2 unresolved source items")&&__last.historyNote.includes("phone page limit")&&__last.historyNote.includes("Refresh to retry")','partial banner names supplied unresolved source-item count, actual coverage reason and recovery without guessing missing record identities');
  await evaluate('const u=__snapshot();u.historyState={status:"unavailable",reason:"revalidation-pending",unresolvedCount:3};onDracoSnapshot(u)');await pause(100);
  await check('__last.historyNote.includes("History unavailable")&&__last.historyNote.includes("3 unresolved source items")&&__last.historyNote.includes("source revalidation pending")&&__last.messages.some(m=>m.id==="request-yesterday"&&m.localSubmission)&&!__last.can.send','unavailable snapshot retains known local bodies and supplied safe source-item count/reason while disabling live actions');
  await evaluate('const hiddenReason=__snapshot();hiddenReason.historyState={status:"partial",reason:"SECRET PRIVATE STRING"};onDracoSnapshot(hiddenReason)');await pause(100);
  await check('!__last.historyNote.includes("SECRET PRIVATE STRING")&&__last.historyNote.includes("individual missing record identities not supplied")','arbitrary coverage reason is never exposed or turned into guessed affected record IDs');
  await evaluate('__oldSession=__session;__session="replacement-atlas";__emit()');await pause(100);
  await check('__last.messages.every(m=>!m.localSubmission)&&!document.getElementById("conversation-list").textContent.includes(__original)','session replacement cannot import previous local request bodies');
  await evaluate('__copies=__calls.length;__act("copy",{id:"request-yesterday",localSubmission:true,sessionId:__oldSession})');await pause(100);
  await check('__calls.length===__copies','stale native exact-session local copy action cannot retarget replacement history');
  await call('Page.reload');await wait('!!window.DracoWatch&&document.getElementById("connection-label").textContent==="Connected"');
  await evaluate('DracoWatch.select("atlas")');await wait('__last.chat');
  await check('__last.draft==="Brand-new exact request"&&__last.messages.some(m=>m.text===__original&&m.localSubmission)&&__requests.every(r=>r.method==="GET"||r.path==="/v1/diagnostics")','reload retains original current-session requests and saved draft, with no automatic input replay');
  await evaluate('__extra=Array.from({length:55},(_,i)=>__message("scroll-report-"+i,"Visible public scroll report "+i+" long detail ".repeat(12),Date.now()+1000+i));__emit()');await pause(120);
  await evaluate('document.getElementById("message-scroll").scrollTop=0;__readingTop=document.getElementById("message-scroll").scrollTop;__extra.push(__message("scroll-new-report","New authenticated report arrives while reading above.",Date.now()+5000));__emit()');await pause(120);
  await check('!document.getElementById("new-messages").hidden&&document.getElementById("message-scroll").scrollTop===__readingTop','new-message indicator stays available while reading even when bounded 50-row window replaces an equal-height row');
  await evaluate('__emit()');await pause(100);
  await check('!document.getElementById("new-messages").hidden','unchanged refresh does not erase the unread-latest indicator');
  await evaluate('document.getElementById("new-messages").click()');await pause(100);
  await check('document.getElementById("new-messages").hidden&&document.getElementById("message-scroll").scrollHeight-document.getElementById("message-scroll").clientHeight-document.getElementById("message-scroll").scrollTop<60','explicit jump-to-latest scrolls to the latest merged message');
  results.push({label:'all browser traffic stayed on isolated fixture and no real audio/speech/production request occurred',passed:network.every(url=>url.startsWith(origin+'/')||url.startsWith('data:'))&&await evaluate('__calls.every(c=>["copy","share"].includes(c.method))')});
  results.push({label:'no uncaught application errors',passed:errors.length===0});
}catch(error){results.push({label:'browser harness completed without an exception',passed:false,error:error.stack||String(error)});}
finally{
  ws?.close();browser.kill();await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),pause(1500)]);
  await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});
}
const failed=results.filter(result=>!result.passed);
console.log(JSON.stringify({boundary:'real app DOM/native payload, synthetic isolated transport only',checks:results.length,passed:failed.length===0,results,errors,productionInput:false,synthesis:false,realMedia:false},null,2));
if(failed.length)process.exitCode=1;
