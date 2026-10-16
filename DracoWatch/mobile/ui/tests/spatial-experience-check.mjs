// Isolated real Chromium fixtures. Never connects to a gateway or sends a live prompt.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),profile=fs.mkdtempSync(path.join(os.tmpdir(),'draco-environment-ui-'));
const port=19329;
const output=process.env.DRACO_SPATIAL_EVIDENCE_DIR||path.join(root,'../runtime/spatial-experience-latest');
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.join(root,req.url==='/'?'index.html':req.url.split('?')[0]);if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const chromium=spawn('/usr/bin/chromium',['--headless=new','--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
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



  await evaluate("DracoWatch.view('environment')");
  await new Promise(r=>setTimeout(r,800));
  check(await evaluate("__environment.diagnostics().renderer==='webgl-perspective'"),'Actual WebGL perspective renderer initialized');
  const before=await evaluate('JSON.stringify(__environment.diagnostics().camera)');
  await evaluate('__environment.yaw+=.4;__environment.pitch=.7;__environment.setZoom(1.2)');
  await new Promise(r=>setTimeout(r,150));
  const camera=await evaluate('JSON.stringify(__environment.diagnostics().camera)');
  check(before!==camera,'Orbit changes actual perspective camera');
  await evaluate('for(let n=0;n<50;n++)onDracoSnapshot(__snapshot())');
  check(camera===await evaluate('JSON.stringify(__environment.diagnostics().camera)'),'Fifty updates preserve the chosen camera');
  check(await evaluate("document.querySelectorAll('.spatial-inspector').length===1 && document.querySelectorAll('.environment-bubble').length===0"),'One retained inspector, no moving floating reports');
  await evaluate("document.querySelector('[data-agent=forge].environment-agent').click()");
  check(await evaluate("document.querySelector('.spatial-inspector h3').textContent==='FORGE' && !document.body.classList.contains('chat-open')"),'Agent selection inspects without forcing chat');
  const sustained=await evaluate(`(()=>{__environment.stopFrame();const camera=JSON.stringify(__environment.diagnostics().camera);const builds=__environment.performance.meshBuilds;for(let i=0;i<600;i++){__environment.advance(.05);if(i%60===0)onDracoSnapshot(__snapshot());__environment.draw()}return {camera:camera===JSON.stringify(__environment.diagnostics().camera),builds:__environment.performance.meshBuilds===builds,diagnostics:__environment.diagnostics()}})()`);
  check(sustained.camera&&sustained.builds,'Thirty seconds simulated motion reuses mesh and camera');
  await evaluate("window.__resets=0;for(const key of ['width','height']){const d=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,key);Object.defineProperty(__environment.canvas,key,{configurable:true,get(){return d.get.call(this)},set(v){__resets++;d.set.call(this,v)}})};for(let n=0;n<30;n++)__environment.fitViewport()");
  check(await evaluate('__resets===0'),'Unchanged fit callbacks never clear the graphics surface');
  check(await evaluate("document.querySelector('.spatial-inspector').textContent.includes('PUBLIC FIXTURE')"),'Selected public report reaches stable readable inspector');
  await evaluate('window.scrollTo(0,0)');
  const portrait=await evaluate("(()=>{const b=document.querySelector('.spatial-actions').getBoundingClientRect(),n=document.querySelector('.bottom-nav').getBoundingClientRect();return {bottom:b.bottom,nav:n.top}})()");
  check(portrait.bottom<=portrait.nav+1,'Portrait inspector actions fit above bottom navigation');
  await call('Page.captureScreenshot',{format:'png'}).then(r=>fs.writeFileSync(path.join(output,'portrait.png'),Buffer.from(r.data,'base64')));

  // A backing-store resize clears WebGL pixels. Its one-shot repaint must not
  // disappear behind the 30fps gate when no active actor schedules another RAF.
  await evaluate(`(()=>{const quality=document.getElementById('rendering-mode');quality.value='light';quality.dispatchEvent(new Event('change'));const reduce=document.getElementById('reduce-motion');reduce.checked=true;reduce.dispatchEvent(new Event('change'));const snapshot=__snapshot();snapshot.agents=snapshot.agents.map(agent=>({...agent,status:'idle',telemetry:{...agent.telemetry,activeSessions:0}}));onDracoSnapshot(snapshot);})()`);
  await wait('__environment.performance.draws>0&&!__environment.frame&&!__environment.dirty');
  const scenePixels=async name=>{
    const clip=await evaluate("(()=>{const r=__environment.canvas.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()");
    const capture=await call('Page.captureScreenshot',{format:'png',clip});
    fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(capture.data,'base64'));
    // Decode the compositor screenshot, not readPixels after a discarded WebGL
    // buffer. HTML name overlays alone must never count as a rendered scene.
    return evaluate(`(async()=>{const image=new Image();image.src='data:image/png;base64,${capture.data}';await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;let visible=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]>12)visible++;return {nonDarkFraction:visible/(pixels.length/4),glError:__environment.gl.getError(),contextLost:__environment.gl.isContextLost(),...__environment.diagnostics()};})()`);
  };
  const idleInitial=await scenePixels('idle-initial');
  await evaluate("document.querySelector('.spatial-read').click();document.querySelector('.spatial-reader-head button').click()");
  const idleReader=await scenePixels('idle-reader-close');
  const idleResize=await evaluate(`new Promise(resolve=>{const e=__environment,start=e.performance.draws;e.requestDraw();const afterRepaint=()=>{if(e.performance.draws===start){requestAnimationFrame(afterRepaint);return;}const before=e.diagnostics(),height=e.canvas.height,stage=e.canvas.closest('#environment-stage');stage.style.height=(stage.getBoundingClientRect().height+4)+'px';e.resize();resolve({before,height,afterHeight:e.canvas.height});};requestAnimationFrame(afterRepaint);})`);
  await new Promise(resolve=>setTimeout(resolve,120));
  const idleAfterResize=await scenePixels('idle-after-resize');
  check(idleInitial.targetFps===30&&!idleInitial.motion&&idleInitial.nonDarkFraction>.5&&idleReader.nonDarkFraction>.5,'Idle reduced-motion scene remains rendered at supported 30fps through reader close');
  check(idleResize.height!==idleResize.afterHeight&&idleAfterResize.draws>idleResize.before.draws&&idleAfterResize.nonDarkFraction>.5&&idleAfterResize.glError===0&&!idleAfterResize.contextLost,'Near-frame idle backing-store resize repaints actual scene pixels without manual recovery');
  await new Promise(resolve=>setTimeout(resolve,120));
  const idleSettled=await evaluate('__environment.diagnostics()');
  check(!idleSettled.pendingPaint&&!idleSettled.pendingFrame&&idleSettled.draws===idleAfterResize.draws,'Idle repaint settles with no pending paint or animation loop');
  await evaluate("document.getElementById('environment-stage').style.height=''");
  await evaluate("DracoWatch.view('settings')");
  check(await evaluate('__environment.frame===0'),'Hidden scene cancels its only frame loop');
  await evaluate("DracoWatch.view('environment');__environment.stopFrame();onDracoSnapshot({...__snapshot(),connected:false});window.__frozen=JSON.stringify([...__environment.actors].map(([id,a],i)=>__environment.actorPosition(null,i,a)));__environment.advance(5)");
  check(await evaluate('!__environment.live && __frozen===JSON.stringify([...__environment.actors].map(([id,a],i)=>__environment.actorPosition(null,i,a)))'),'Unobserved creatures freeze, never imply idle or execution');
  await call('Emulation.setDeviceMetricsOverride',{width:860,height:412,deviceScaleFactor:2,mobile:true});
  await evaluate("onDracoSnapshot(__snapshot());__environment.fitViewport()");
  await new Promise(r=>setTimeout(r,200));
  await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}).then(r=>fs.writeFileSync(path.join(output,'landscape.png'),Buffer.from(r.data,'base64')));
  const bounds=await evaluate(`(()=>{const e=document.querySelector('.spatial-inspector'),b=e.getBoundingClientRect();return {right:b.right,width:innerWidth,body:document.body.scrollWidth}})()`);
  check(bounds.right<=bounds.width+1&&bounds.body<=bounds.width+1,'Inspection dock remains within landscape width');
  const ext=await evaluate("!!__environment.gl.getExtension('WEBGL_lose_context')");
  if(ext){
    await evaluate("window.__lossExtension=__environment.gl.getExtension('WEBGL_lose_context');__lossExtension.loseContext()");await wait('__environment.lost');
    check(await evaluate("__environment.frame===0&&document.querySelector('.spatial-render-note').textContent.includes('Conversations remain')"),'Graphics loss stops loop and leaves navigation available');
    await new Promise(r=>setTimeout(r,250));await evaluate("__lossExtension.restoreContext()");await wait('!__environment.lost');
    check(await evaluate("__environment.diagnostics().renderer==='webgl-perspective'&&__environment.performance.meshBuilds===1"),'Graphics restore reuses scene and camera');
  }
  await call('Page.addScriptToEvaluateOnNewDocument',{source:"const originalContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl'?null:originalContext.call(this,kind,...args)}"});
  await call('Page.reload');await wait("window.DracoWatch && document.getElementById('connection-label').textContent==='Connected'");
  await evaluate("DracoWatch.view('environment')");await wait('__environment.performance.draws>0');
  check(await evaluate("__environment.diagnostics().renderer==='canvas-perspective-fallback'&&Number.isFinite(__environment.point(null,0,0).x)"),'Unsupported WebGL gets an operable perspective fallback');
  check(errors.length===0,'No script exceptions in sustained camera/update/navigation flow');
  fs.writeFileSync(path.join(output,'browser-result.json'),JSON.stringify({checks,sustained,errors,bounds,portrait,idleInitial,idleReader,idleResize,idleAfterResize,idleSettled},null,2));
  console.log('PASS '+checks+' spatial experience checks; synthetic data, not handset performance');
}finally{ws?.close();chromium.kill('SIGTERM');await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>chromium.exitCode!==null?resolve():chromium.once('exit',resolve));fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
