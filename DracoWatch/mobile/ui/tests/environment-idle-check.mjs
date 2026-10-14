// Operator3423: real app DOM and durable client preferences, synthetic native
// transport only. No private hooks, gateway, agent input, TTS or real media.
// Run: node mobile/ui/tests/environment-idle-check.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ui=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'watch-environment-idle-3423-'));
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
  const emit=async expression=>{await evaluate(expression+';__emit()');await pause(60);};
  const openEnvironment=async()=>{await evaluate('DracoWatch.view("environment")');await wait('!document.getElementById("view-environment").hidden');};
  const atlas='document.querySelector(".environment-bubble[data-agent=atlas]")';
  const shown=`!${atlas}.hidden&&!${atlas}.closest('.environment-bubbles').hidden`;
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:412,height:892,deviceScaleFactor:3,mobile:true});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__fixture=JSON.parse(sessionStorage.getItem('idle-fixture-3423')||'null')||{
      now:1791960000000,session:'physical:atlas:one',status:'idle',
      report:{id:'public:atlas:one',sessionId:'physical:atlas:one',text:'Original public Atlas report.',at:1791959999000}};
    const NativeDate=Date;
    window.Date=class extends NativeDate{
      constructor(...args){super(...(args.length?args:[__fixture.now]));}
      static now(){return __fixture.now;}
    };
    if(!localStorage.getItem('draco-watch-client-v2'))localStorage.setItem('draco-watch-client-v2',JSON.stringify({version:2,preferences:{automaticSpeech:false,motion:true,environmentBubbles:true}}));
    window.__requests=JSON.parse(sessionStorage.getItem('idle-requests-3423')||'[]');
    window.__calls=JSON.parse(sessionStorage.getItem('idle-calls-3423')||'[]');
    window.__recordCall=call=>{__calls.push(call);sessionStorage.setItem('idle-calls-3423',JSON.stringify(__calls));};
    window.__caps={send:false,queue:false,steer:false,abort:false,attachments:false,voice:false,reply:false,speech:false,commands:false};
    window.__agents=['main','forge','atlas','aera-new','vvv','daedalus'];
    window.__snapshot=(selected='atlas')=>{
      const report=__fixture.report;
      const messages=__agents.map(agent=>({id:agent==='atlas'?report.id:'public:'+agent+':one',agent,
        sessionId:agent==='atlas'?report.sessionId:'physical:'+agent+':one',source:'authenticated-native-history',
        publicAttested:true,role:'assistant',channel:'final',kind:'Confirmed report',
        text:agent==='atlas'?report.text:'Public '+agent+' fixture report.',timestamp:agent==='atlas'?report.at:1791959999000}));
      return {version:2,connected:true,lastSuccess:Date.now(),capturedAt:Date.now(),selectedAgent:selected,
        agents:__agents.map(id=>({id,status:id==='atlas'?__fixture.status:'idle',sessionKey:'fixture:'+id,
          sessionId:id==='atlas'?__fixture.session:'physical:'+id+':one',capabilities:__caps,historyAvailable:true,controlTargets:[]})),
        conversation:messages.filter(message=>message.agent===selected&&message.sessionId===(selected==='atlas'?__fixture.session:'physical:'+selected+':one')),
        fleetActivity:messages,workActivity:[],historyState:{status:'complete'},historyHasMore:false,
        fleetCoverage:__agents.map(agent=>({agent,available:true,status:'recorded-window'}))};
    };
    window.__emit=()=>{sessionStorage.setItem('idle-fixture-3423',JSON.stringify(__fixture));onDracoSnapshot(__snapshot());};
    window.DracoNative={
      refresh(agent){__recordCall({method:'refresh',agent});setTimeout(()=>onDracoSnapshot(__snapshot(agent)),0);},
      request(id,method,path,json){__requests.push({id,method,path,json});sessionStorage.setItem('idle-requests-3423',JSON.stringify(__requests));
        if(method==='GET'&&path.startsWith('/v1/capabilities?')){
          const agent=new URLSearchParams(path.split('?')[1]).get('agent');
          setTimeout(()=>onDracoResponse({id,ok:true,data:{...__caps,agent,sessionId:agent==='atlas'?__fixture.session:'physical:'+agent+':one'}}),0);
        }
      },
      playMedia(...args){__recordCall({method:'playMedia',args});},stopMedia(){__recordCall({method:'stopMedia'});},
      setPlaybackRate(rate){__recordCall({method:'setPlaybackRate',rate});},hideKeyboard(){}
    };
  `});
  await call('Page.navigate',{url:origin+'/'});
  await wait('!!window.DracoWatch&&document.getElementById("connection-label").textContent==="Connected"');
  await openEnvironment();
  await check('document.querySelectorAll(".environment-bubble").length===6&&[...document.querySelectorAll(".environment-bubble")].every(button=>!button.hidden&&!button.closest(".environment-bubbles").hidden&&button.dataset.kind==="report")','real app renders all six synthetic public reports while observed idle');

  await emit('__fixture.now+=59999');
  await check(`${shown}&&${atlas}.dataset.messageId==='public:atlas:one'`,'unchanged report stays visible immediately before the 60-second idle deadline');
  await emit('__fixture.now+=1');
  await check(`${atlas}.hidden&&[...document.querySelectorAll('.environment-bubble')].every(button=>button.hidden)&&document.querySelector('.environment-bubbles').hidden`,'at exactly 60 seconds, the existing refresh hides idle speech and an empty bubble layer');

  await evaluate('onDracoConnection({state:"offline"});__fixture.now+=5000;__emit();__emit()');await pause(60);
  await check(`${atlas}.hidden&&document.getElementById('connection-label').textContent==='Connected'`,'repeated same-session snapshots and offline/reconnect do not renew expired speech');
  await evaluate('DracoWatch.view("chats");DracoWatch.view("environment")');
  await call('Page.reload');
  await wait('!!window.DracoWatch&&document.getElementById("connection-label").textContent==="Connected"');
  await openEnvironment();
  await check(`${atlas}.hidden&&JSON.parse(localStorage.getItem('draco-environment-idle-v1')).rows.find(([id])=>id==='atlas')[1].expiredMessageId==='public:atlas:one'`,'hiding/reopening the real view and reloading preserve the absolute expiry identity');

  await emit('__fixture.report={id:"public:atlas:two",sessionId:__fixture.session,text:"Genuinely newer public Atlas report.",at:__fixture.now}');
  await check(`${shown}&&${atlas}.dataset.status==='idle'&&${atlas}.dataset.messageId==='public:atlas:two'&&${atlas}.textContent.includes('Genuinely newer public Atlas report.')`,'genuinely newer public text re-shows a still-idle creature without restarting its work');
  await emit('__fixture.now+=59999');
  const freshBefore=await evaluate(shown);
  await emit('__fixture.now+=1');
  await check(`${JSON.stringify(freshBefore)}&&${atlas}.hidden`,'the fresh report gets its own 60-second deadline; unchanged refreshes cannot extend it');
  await emit('__fixture.status="active"');
  await check(`${shown}&&${atlas}.dataset.kind==='state'&&!${atlas}.dataset.messageId&&!${atlas}.textContent.includes('Genuinely newer public Atlas report.')&&${atlas}.textContent.includes('No new public update')`,'becoming active exposes observed status but does not resurrect expired words');

  await emit('__fixture.session="physical:atlas:two";__fixture.status="idle"');
  await check(`${shown}&&${atlas}.dataset.kind==='state'&&!${atlas}.dataset.messageId&&!${atlas}.textContent.includes('public Atlas report.')`,'physical-session replacement rejects the old feed row rather than showing old-session speech');
  await emit('__fixture.report={id:"public:atlas:three",sessionId:__fixture.session,text:"Current-session public report only.",at:__fixture.now}');
  await check(`${shown}&&${atlas}.dataset.kind==='report'&&${atlas}.dataset.messageId==='public:atlas:three'&&${atlas}.textContent.includes('Current-session public report only.')`,'a new current-physical-session public report is admitted after replacement');

  await evaluate('document.getElementById("environment-speech").click()');
  await check('document.querySelector(".environment-bubbles").hidden&&document.getElementById("environment-speech").getAttribute("aria-pressed")==="false"&&JSON.parse(localStorage.getItem("draco-watch-client-v2")).preferences.environmentBubbles===false','manual off hides the real layer and durably saves the client preference');
  await call('Page.reload');
  await wait('!!window.DracoWatch&&document.getElementById("connection-label").textContent==="Connected"');
  await openEnvironment();await emit('__fixture.now+=1');
  await check('document.querySelector(".environment-bubbles").hidden&&document.getElementById("environment-speech").getAttribute("aria-pressed")==="false"&&JSON.parse(localStorage.getItem("draco-watch-client-v2")).preferences.environmentBubbles===false','page recreation and fresh transport hydration cannot override the saved manual-off setting');
  await evaluate('document.getElementById("environment-speech").click()');
  await check(`${shown}&&${atlas}.dataset.messageId==='public:atlas:three'&&document.getElementById('environment-speech').getAttribute('aria-pressed')==='true'&&JSON.parse(localStorage.getItem('draco-watch-client-v2')).preferences.environmentBubbles===true`,'only an explicit manual-on action restores the still-current unexpired report');
  await check('__requests.every(request=>request.method==="GET"&&request.path.startsWith("/v1/capabilities?"))&&!__calls.some(call=>call.method==="playMedia")','the complete DOM flow makes no agent input, speech-generation or audio-playback request');
  results.push({label:'all browser requests stayed on the isolated fixture and no uncaught application errors occurred',passed:network.every(url=>url.startsWith(origin+'/')||url.startsWith('data:'))&&errors.length===0});
}catch(error){results.push({label:'browser harness completed without an exception',passed:false,error:error.stack||String(error)});}
finally{
  ws?.close();browser.kill();await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),pause(1500)]);
  await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});
}
const failed=results.filter(result=>!result.passed);
console.log(JSON.stringify({boundary:'real app DOM, fake native snapshot transport, isolated Chromium',checks:results.length,passed:failed.length===0,results,errors,productionInput:false,synthesis:false,realMedia:false},null,2));
if(failed.length)process.exitCode=1;
