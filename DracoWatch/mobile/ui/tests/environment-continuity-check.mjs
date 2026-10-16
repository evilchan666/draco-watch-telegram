// Isolated real Chromium fixtures. Never connects to a gateway or sends a live prompt.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),profile=fs.mkdtempSync(path.join(os.tmpdir(),'draco-environment-ui-'));
const port=19319;
const server=http.createServer((req,res)=>{const file=path.join(root,req.url==='/'?'index.html':req.url.split('?')[0]);if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const chromium=spawn('/usr/bin/chromium',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let ws;let checks=0;
const check=(condition,label)=>{assert.ok(condition,label);checks++;};
try{
  let pages;
  for(let attempt=0;attempt<80;attempt++){try{pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();if(pages.some(page=>page.type==='page'))break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  const page=pages?.find(page=>page.type==='page');assert.ok(page,'Isolated Chromium started');
  ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let serial=0;const pending=new Map(),errors=[];
  ws.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);const task=pending.get(msg.id);if(!task)return;pending.delete(msg.id);msg.error?task.reject(Error(msg.error.message)):task.resolve(msg.result);};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
  const wait=async expression=>{for(let attempt=0;attempt<80;attempt++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Browser condition failed: '+expression+' '+JSON.stringify({errors,dom:await evaluate("({url:location.href,label:document.getElementById('connection-label')?.textContent,scripts:[...document.scripts].map(script=>script.src),watch:!!window.DracoWatch,roster:document.querySelectorAll('.agent-card').length})")}));};
  await call('Page.enable');await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:360,height:712,deviceScaleFactor:3,mobile:true});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`
    Object.defineProperty(window,'DracoEnvironment',{configurable:true,set(api){Object.defineProperty(window,'DracoEnvironment',{value:{...api,Environment:class extends api.Environment{constructor(...args){super(...args);if(args[0]?.id==='environment-canvas')window.__environment=this;}}},writable:true,configurable:true});}});
    Object.defineProperty(window,'DracoEnvironmentBubbles',{configurable:true,set(api){Object.defineProperty(window,'DracoEnvironmentBubbles',{value:{...api,Bubbles:class extends api.Bubbles{constructor(...args){super(...args);window.__bubbles=this;}}},writable:true,configurable:true});}});
    window.__requests=[];window.__nativeCalls=[];window.__fixtureConnected=true;
    window.__caps={send:true,queue:true,steer:true,abort:true,attachments:true,voice:true,reply:true,speech:true,commands:true};
    window.__snapshot=(agent='atlas')=>({version:2,connected:window.__fixtureConnected,lastSuccess:Date.now(),selectedAgent:agent,agents:['main','forge','atlas','aera-new','vvv','daedalus'].map((id,i)=>({id,status:i===2?'active':'idle',sessionKey:'fixture:'+id,sessionId:'session:'+id,controlTargets:[{agent:id,sessionKey:'fixture:'+id,sessionId:'session:'+id,runId:'run:'+id,scope:'conversation'}],capabilities:window.__caps,telemetry:{activeSessions:i===2?1:0,queuedSessions:0,model:'FIXTURE ONLY'}})),fleetActivity:['main','forge','atlas','aera-new','vvv','daedalus'].map(id=>({agent:id,id:'report:'+id,role:'assistant',text:'PUBLIC FIXTURE: Checking '+id+' progress. <img src=x onerror=alert(1)>',timestamp:Date.now()-60000,sessionId:'session:'+id})),conversation:[{id:'public-1',role:'assistant',text:'Public fixture. <img src=x onerror=alert(1)> https://example.com',timestamp:Date.now(),sessionId:'session:'+agent,media:[{kind:'audio',label:'Approved voice reply',mimeType:'audio/wav',index:0,downloadAvailable:true,url:'/v1/media?agent='+agent+'&sessionId=session:'+agent+'&messageId=public-1&index=0'}]}],historyState:{status:'complete'},historyHasMore:true,total:1});
    window.DracoNative={refresh(agent){setTimeout(()=>onDracoSnapshot(__snapshot(agent)),5)},request(id,method,path,json){const body=json?JSON.parse(json):null;__requests.push({id,method,path,body});if(method==='GET')setTimeout(()=>onDracoResponse({id,ok:true,status:200,data:path.startsWith('/v1/capabilities')?{...__caps,agent:path.split('agent=')[1],sessionId:'session:'+path.split('agent=')[1]}:{agent:path.split('agent=')[1].split('&')[0],sessionId:'session:'+path.split('agent=')[1].split('&')[0],messages:[{id:'older-public',role:'assistant',text:'OLDER PUBLIC MESSAGE',timestamp:Date.now()-3600000,sessionId:'session:'+path.split('agent=')[1].split('&')[0]},...__snapshot(path.split('agent=')[1].split('&')[0]).conversation],hasMore:false,total:2,historyState:{status:'complete'}}}),5)},chooseAttachment(agent){__nativeCalls.push('chooseAttachment:'+agent)},startRecording(agent){__recordingAgent=agent;__nativeCalls.push('startRecording:'+agent);setTimeout(()=>onDracoAttachment({state:'recording',agent}),5)},stopRecording(){__nativeCalls.push('stopRecording');setTimeout(()=>onDracoAttachment({state:'ready',agent:__recordingAgent,id:'voice-native-id',name:'Voice note.m4a',mimeType:'audio/mp4',sizeBytes:100,durationMs:3000}),5)},previewAttachment(id){__nativeCalls.push('preview:'+id)},releaseAttachment(id){__nativeCalls.push('release:'+id)},cancelAttachment(id){__nativeCalls.push('cancel:'+id)},playMedia(path,id){__nativeCalls.push('play:'+id)},stopMedia(){__nativeCalls.push('stopMedia')},copyText(text){__nativeCalls.push('copy')},shareText(text){__nativeCalls.push('share')},openLink(url){__nativeCalls.push('link')},checkUpdates(){__nativeCalls.push('update')},installUpdate(){__nativeCalls.push('install')},setNotifications(enabled){__nativeCalls.push('notifications:'+enabled)},uninstall(){__nativeCalls.push('uninstall')},hideKeyboard(){__nativeCalls.push('hideKeyboard')},openSettings(){__nativeCalls.push('settings')}};`});

  await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
  await wait("window.DracoWatch && document.getElementById('connection-label').textContent==='Connected'");


  const samples=[];
  for(const [width,height,scale] of [[320,640,1],[360,712,1],[412,816,1],[412,816,1.5],[780,360,1]]){
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:3,mobile:true});
    await evaluate(`document.documentElement.style.fontSize='${16*scale}px';window.__fixed=__snapshot();__fixed.agents=__fixed.agents.map(a=>({...a,status:'active'}));onDracoSnapshot(__fixed);DracoWatch.view('environment')`);
    await new Promise(r=>setTimeout(r,100));
    const sample=await evaluate(`(()=>{__environment.stopFrame();let mode=__bubbles.layer.dataset.packing,changes=0,travel=0,previous=new Map();for(let i=0;i<600;i++){__environment.advance(.05);__bubbles.lastLayout=0;__environment.draw();if(i%60===0)__bubbles.layout(true);const next=__bubbles.layer.dataset.packing;if(mode!==next)changes++;mode=next;for(const [id,card] of __bubbles.cards){const xy=card.button.style.transform;if(previous.has(id)&&previous.get(id)!==xy)travel++;previous.set(id,xy)}}return {changes,travel,mode,width:__environment.width,height:__environment.height}})()`);
    samples.push({width,height,scale,...sample});
  }
  console.log(JSON.stringify(samples));check(samples.every(sample=>sample.changes<=1),'A fixed geometry settles into one report layout throughout 30 seconds of movement and ten snapshot-equivalent forced layouts');
  await evaluate(`window.__resets=0;for(const key of ['width','height']){const d=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,key);Object.defineProperty(__environment.canvas,key,{configurable:true,get(){return d.get.call(this)},set(v){__resets++;d.set.call(this,v)}})};for(let n=0;n<30;n++)__environment.fitViewport()`);
  check(await evaluate('__resets===0'),'Repeated unchanged viewport callbacks preserve the canvas backing store');
  const resized=await evaluate(`(()=>{__environment.dprLimit=1;__environment.resize();return __resets})()`);check(resized>0,'A genuine drawing-resolution change still resizes the backing store');
  await evaluate(`const zoom=__environment.zoom;__environment.show(false);__environment.show(true);__environment.setZoom(zoom+.25)`);
  check(await evaluate('__environment.zoom>1 && __environment.active'),'Hide/reopen and explicit camera zoom remain functional');
  check(await evaluate(`(()=>{const d=__environment.diagnostics();return d.renderer==='canvas2d-top-down'&&d.drawSamples>0&&d.drawSamples<=120&&d.frameSamples<=120&&d.resizes>0&&d.scope.includes('not GPU')&&!JSON.stringify(d).includes('PUBLIC FIXTURE')})()`),'Debugger timings are bounded, renderer-specific and contain no report bodies');
  check(errors.length===0,'No runtime errors in the sustained motion and viewport flow');
  console.log('PASS '+checks+' Environment continuity checks; isolated synthetic transport, not handset acceptance');
}finally{ws?.close();chromium.kill('SIGTERM');await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>chromium.exitCode!==null?resolve():chromium.once('exit',resolve));fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
