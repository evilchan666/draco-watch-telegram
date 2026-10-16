// Isolated S25-sized browser composition/gesture fixtures, never a live gateway.
// This catches CSS/scene geometry; Android/WebView and physical-phone rendering
// remain separate evidence. No production input, audio, or accepted-device claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output=path.join(root,'../runtime/spatial-041-20261016/handset-browser');
const sourceFiles=['index.html','styles.css','app.js','environment.js','environment-bubbles.js','chamber.js','client-state.js'];
const hashes=()=>Object.fromEntries(sourceFiles.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const sourceHashes=hashes();
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'draco-handset-composition-'));
const port=19341;
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
  const file=path.join(root,req.url==='/'?'index.html':req.url.split('?')[0]);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const chromium=spawn('/usr/bin/chromium',['--headless=new','--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let ws,capture,checks=0;
const observations=[],errors=[];
const check=(condition,label,details)=>{observations.push({label,passed:!!condition,...(details?{details}:{})});assert.ok(condition,label+(details?' '+JSON.stringify(details):''));checks++;};
try{
  let pages;
  for(let attempt=0;attempt<80;attempt++){
    try{pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();if(pages.some(page=>page.type==='page'))break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  const page=pages?.find(page=>page.type==='page');assert.ok(page,'Isolated Chromium started');
  ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let serial=0;const pending=new Map();
  ws.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
    const task=pending.get(message.id);if(!task)return;pending.delete(message.id);
    message.error?task.reject(Error(message.error.message)):task.resolve(message.result);
  };
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{
    const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  };
  const wait=async expression=>{
    for(let attempt=0;attempt<80;attempt++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,100));}
    throw Error('Browser condition failed: '+expression+' '+JSON.stringify(errors));
  };
  const screenshot=async name=>{const result=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(result.data,'base64'));};capture=screenshot;
  await call('Page.enable');await call('Runtime.enable');
  await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`
    Object.defineProperty(window,'DracoEnvironment',{configurable:true,set(api){Object.defineProperty(window,'DracoEnvironment',{value:{...api,Environment:class extends api.Environment{constructor(...args){super(...args);if(args[0]?.id==='environment-canvas')window.__environment=this;}}},writable:true,configurable:true});}});
    Object.defineProperty(window,'DracoEnvironmentBubbles',{configurable:true,set(api){Object.defineProperty(window,'DracoEnvironmentBubbles',{value:{...api,Bubbles:class extends api.Bubbles{constructor(...args){super(...args);window.__inspector=this;}}},writable:true,configurable:true});}});
    window.__epoch=Date.now();window.__elapsed=0;Date.now=()=>__epoch+__elapsed;
    window.__ids=['main','forge','atlas','aera-new','vvv','daedalus'];window.__requests=[];window.__connected=true;window.__allIdle=false;
    window.__sessions=Object.fromEntries(__ids.map(id=>[id,'session:'+id]));
    window.__speech=Object.fromEntries(__ids.map(id=>[id,{id:'public:'+id,text:'HANDSET FIXTURE '+id+' retained public update. '+'Public observation with retained evidence. '.repeat(80),timestamp:__epoch-1000,sessionId:__sessions[id]}]));
    window.__caps={send:true,queue:true,steer:false,abort:true,attachments:true,voice:true,reply:true,speech:true,commands:true};
    window.__snapshot=(agent='atlas')=>({version:2,connected:__connected,lastSuccess:Date.now(),selectedAgent:agent,agents:__ids.map(id=>({id,status:!__allIdle&&id==='atlas'?'active':'idle',sessionKey:'fixture:'+id,sessionId:__sessions[id],controlTargets:[{agent:id,sessionKey:'fixture:'+id,sessionId:__sessions[id],runId:'run:'+id,scope:'conversation'}],capabilities:__caps,telemetry:{activeSessions:!__allIdle&&id==='atlas'?1:0,queuedSessions:0,model:'SYNTHETIC FIXTURE'}})),fleetActivity:__ids.map(id=>({agent:id,role:'assistant',...__speech[id]})),conversation:[{id:'conversation:'+agent,role:'assistant',text:'Retained conversation '+agent,timestamp:__epoch-1000,sessionId:__sessions[agent]}],historyState:{status:'complete'},historyHasMore:false,total:1});
    window.DracoNative={refresh(agent){setTimeout(()=>onDracoSnapshot(__snapshot(agent)),1)},request(id,method,route,json){__requests.push({method,route,body:json?JSON.parse(json):null});if(method==='GET'){const agent=new URL('http://fixture'+route).searchParams.get('agent')||'atlas';setTimeout(()=>onDracoResponse({id,ok:true,status:200,data:route.startsWith('/v1/capabilities')?{...__caps,agent,sessionId:__sessions[agent]}:{agent,sessionId:__sessions[agent],messages:__snapshot(agent).conversation,hasMore:false,total:1,historyState:{status:'complete'}}}),1)}},stopMedia(){},hideKeyboard(){}};
    window.__rect=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
    window.__visible=element=>!!element&&!element.hidden&&!!element.getClientRects().length&&getComputedStyle(element).display!=='none'&&getComputedStyle(element).visibility!=='hidden';
    window.__profileGeometry=()=>{const nav=__rect(document.querySelector('.bottom-nav')),canvas=__rect(document.getElementById('environment-canvas')),stage=__rect(document.getElementById('environment-stage')),inspection=__rect(document.querySelector('.spatial-inspector')),actions=__rect(document.querySelector('.spatial-actions'));return {viewport:{width:innerWidth,height:innerHeight},nav,canvas,stage,inspection,actions,bodyWidth:document.body.scrollWidth,scrollY,agents:[...document.querySelectorAll('.environment-agent')].map(el=>({id:el.dataset.agent,...__rect(el),visible:__visible(el),label:el.getAttribute('aria-label')})),toolbar:__rect(document.querySelector('.environment-toolbar')),labels:[...__environment.labelNodes].map(([id,el])=>({id,...__rect(el),visible:__visible(el)})),actors:[...__environment.actors].map(([id,actor])=>{const index=__ids.indexOf(id),p=__environment.actorPosition(null,index,actor),point=__environment.project([p.x,p.y+.6,p.z]);return {id,x:point.x+canvas.x,y:point.y+canvas.y,depth:point.depth}})}};
  `});

  // Browser uses the app's own 150% font preference and native scale contract;
  // this is not a substitute for Android WebView accessibility textZoom checks.
  // Independent viewport findings are collected together, so one short viewport
  // does not conceal a different landscape defect and cause repeated rebuilds.
  const profileCheck=(...args)=>{try{check(...args);}catch{/* Report all profiles below. */}};
  for(const spec of [{name:'portrait-100',width:412,height:840,scale:100,nativeScale:1},{name:'portrait-150',width:412,height:840,scale:150,nativeScale:1.5},{name:'portrait-small-150',width:360,height:712,scale:150,nativeScale:1.5},{name:'portrait-compact-100',width:384,height:800,scale:100,nativeScale:1},{name:'landscape-100',width:840,height:412,scale:100,nativeScale:1},{name:'landscape-150',width:840,height:412,scale:150,nativeScale:1.5},{name:'landscape-short-native150-app100',width:841,height:360,scale:100,nativeScale:1.5},{name:'landscape-short-native150-app150',width:841,height:360,scale:150,nativeScale:1.5}]){
    await call('Emulation.setDeviceMetricsOverride',{width:spec.width,height:spec.height,deviceScaleFactor:3.5,mobile:true});
    await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
    await wait("window.DracoWatch&&document.getElementById('connection-label').textContent==='Connected'");
    await evaluate(`onDracoAppInfo({fontScale:${spec.nativeScale}});const scale=document.getElementById('display-scale');scale.value=${spec.scale};scale.dispatchEvent(new Event('input',{bubbles:true}));DracoWatch.view('environment');__environment.fit();window.scrollTo(0,0)`);
    await wait('__environment.performance.draws>1');
    await new Promise(resolve=>setTimeout(resolve,150));
    const geometry=await evaluate('__profileGeometry()');
    await screenshot(spec.name);
    profileCheck(geometry.bodyWidth<=spec.width+1,spec.name+': no horizontal page overflow',geometry);
    profileCheck(geometry.agents.length===6&&geometry.agents.every(agent=>agent.visible&&agent.x>=0&&agent.right<=spec.width+1&&agent.y>=0&&agent.bottom<=geometry.nav.y+1&&agent.height>=43),spec.name+': all six destinations directly visible with 44px touch height',geometry.agents);
    profileCheck(geometry.agents.every(agent=>agent.label.includes(agent.id==='atlas'?'Run open':'No open run')&&agent.label.includes('Inspect agent')),spec.name+': all destinations retain the full accessible occupancy state',geometry.agents);
    profileCheck(geometry.actions.bottom<=geometry.nav.y+1&&geometry.actions.bottom<=geometry.inspection.bottom+1&&geometry.inspection.x>=0&&geometry.inspection.right<=spec.width+1,spec.name+': selected inspection actions fit inside inspection and above navigation without page scroll',geometry);
    const shortLandscape=spec.width>spec.height&&spec.height<=390;
    const minimumScene=shortLandscape?150:spec.width>spec.height?175:spec.height<740&&spec.scale>=150?160:220;
    profileCheck(geometry.canvas.height>=minimumScene,spec.name+': controls leave a useful scene height',geometry.canvas);
    profileCheck(geometry.toolbar.height<=52,spec.name+': camera toolbar does not consume multiple rows by default',geometry.toolbar);
    const visibleLabels=geometry.labels.filter(label=>label.visible),expectedLabels=shortLandscape?1:6;
    profileCheck(visibleLabels.length===expectedLabels&&(!shortLandscape||visibleLabels[0].id==='atlas')&&visibleLabels.every(label=>label.x>=geometry.canvas.x-1&&label.right<=geometry.canvas.right+1&&label.y>=geometry.canvas.y-1&&label.bottom<=geometry.canvas.bottom+1),spec.name+(shortLandscape?': short overview shows the selected name without duplicate-label crowding':': Fit keeps all six names inside the overview'),geometry.labels);
    profileCheck(geometry.actors.length===6&&geometry.actors.every(actor=>actor.depth>0&&actor.x>=geometry.canvas.x+12&&actor.x<=geometry.canvas.right-12&&actor.y>=geometry.canvas.y+12&&actor.y<=geometry.canvas.bottom-12),spec.name+': Fit keeps all six actor centres away from scene crop edges',geometry.actors);
    await evaluate("document.querySelector('.environment-agent[data-agent=daedalus]').click()");
    profileCheck(await evaluate("document.querySelector('.spatial-inspector h3').textContent==='Daedalus'&&!document.body.classList.contains('chat-open')"),spec.name+': last agent is reachable without scrolling or opening chat');
    await evaluate("document.querySelector('.environment-agent[data-agent=atlas]').click()");
    if(shortLandscape){
      await evaluate("document.getElementById('environment-camera-toggle').click()");
      const focus=await evaluate("(()=>{const button=document.querySelector('[aria-label=\"Focus camera on selected agent\"]');return {...__rect(button),visible:__visible(button),nav:document.querySelector('.bottom-nav').getBoundingClientRect().top}})()");
      profileCheck(focus.visible&&focus.height>=43&&focus.y>=geometry.stage.y&&focus.bottom<=geometry.nav.y+1,spec.name+': short scene retains an explicit accessible Focus control',focus);
      await evaluate("document.querySelector('[aria-label=\"Focus camera on selected agent\"]').click()");
      profileCheck(await evaluate("__environment.focused==='atlas'&&!document.body.classList.contains('chat-open')"),spec.name+': explicit Focus remains operational');
      await evaluate("document.getElementById('environment-fit').click()");
    }
    const readerAccess=await evaluate("(()=>{const button=document.querySelector('.spatial-read');return {...__rect(button),visible:__visible(button),nav:document.querySelector('.bottom-nav').getBoundingClientRect().top}})()");
    profileCheck(readerAccess.visible&&readerAccess.height>=43&&readerAccess.bottom<=readerAccess.nav+1,spec.name+': full observation has an explicit visible 44px reader target',readerAccess);
    await evaluate("document.querySelector('.spatial-read').click()");
    const reader=await evaluate("(()=>{const dialog=document.getElementById('spatial-observation-reader'),body=dialog.querySelector('.spatial-reader-body'),report=dialog.querySelector('.spatial-reader-report');return {open:dialog.open,dialog:__rect(dialog),body:__rect(body),fullReport:report.textContent===__speech.atlas.text,scrollable:body.scrollHeight>body.clientHeight}})()");
    profileCheck(reader.open&&reader.dialog.y>=0&&reader.dialog.bottom<=spec.height+1&&reader.body.height>=80&&reader.fullReport&&reader.scrollable,spec.name+': full exact observation is readable and scrollable in a bounded reader',reader);
    await screenshot(spec.name+'-reader');
    await evaluate("onDracoSnapshot(__snapshot())");
    profileCheck(await evaluate("document.getElementById('spatial-observation-reader').open"),spec.name+': same-session refresh leaves the reader open');
    await evaluate("document.querySelector('.spatial-reader-head button').click()");
    await evaluate("window.__retainedDock=document.querySelector('.spatial-inspector');window.__retainedCamera=JSON.stringify(__environment.diagnostics().camera);window.__retainedMessage=__retainedDock.dataset.messageId;for(let n=0;n<50;n++)onDracoSnapshot(__snapshot())");
    profileCheck(await evaluate("document.querySelector('.spatial-inspector')===__retainedDock&&JSON.stringify(__environment.diagnostics().camera)===__retainedCamera&&__retainedDock.dataset.messageId===__retainedMessage"),spec.name+': repeated feed updates retain camera, dock node and selected report');
  }

  // Actual trusted Chromium touch input, not direct camera-field mutation.
  await call('Emulation.setDeviceMetricsOverride',{width:412,height:840,deviceScaleFactor:3.5,mobile:true});
  await evaluate("DracoWatch.view('environment');__environment.fit();window.scrollTo(0,0)");
  await new Promise(resolve=>setTimeout(resolve,100));
  for(const id of ['main','forge','atlas','aera-new','vvv','daedalus']){
    const target=await evaluate(`(()=>{const r=__environment.canvas.getBoundingClientRect(),hit=__environment.hits.find(hit=>hit.id===${JSON.stringify(id)});return {x:r.x+hit.x,y:r.y+hit.y,name:DracoChamber.SPECS.find(spec=>spec.id===${JSON.stringify(id)}).name}})()`);
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:target.x,y:target.y,id:1}]});
    await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    check(await evaluate(`document.querySelector('.spatial-inspector h3').textContent===${JSON.stringify(target.name)}&&!document.body.classList.contains('chat-open')`),'Trusted creature-centre tap inspects exact '+id+' identity without opening chat');
  }
  await evaluate("document.querySelector('.environment-agent[data-agent=atlas]').click()");
  await evaluate("document.querySelector('.spatial-read').click();__sessions.atlas='session:atlas-reader-replaced';onDracoSnapshot(__snapshot())");
  check(await evaluate("!document.getElementById('spatial-observation-reader').open"),'Replacement physical session closes the prior owner-bound observation reader');
  const canvas=await evaluate('__rect(__environment.canvas)');
  const x=canvas.x+canvas.width/2,y=canvas.y+canvas.height*.6;
  const priorCamera=await evaluate('JSON.stringify(__environment.diagnostics().camera)');
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+70,y:y-20,id:1}]});
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  check(priorCamera!==await evaluate('JSON.stringify(__environment.diagnostics().camera)'),'Trusted drag changes the camera');
  check(await evaluate("!document.body.classList.contains('chat-open')"),'Camera drag does not accidentally activate conversation');
  // Returning one finger after pinch must not be interpreted as an agent tap.
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-35,y,id:1},{x:x+35,y,id:2}]});
  await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-130,y:y-10,id:1},{x:x+130,y:y+10,id:2}]});
  await evaluate("__sessions.atlas='session:atlas-replaced';onDracoSnapshot(__snapshot())");
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{x:x+130,y:y+10,id:2}]});
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  check(await evaluate('__environment.zoom<=1.25'),'One coarse pinch sample cannot telescope the overview into a cropped 255% close-up');
  check(await evaluate("!document.body.classList.contains('chat-open')"),'Pinch/session replacement cannot redirect the gesture into chat');
  check(await evaluate("!document.querySelector('.spatial-report').textContent.includes('HANDSET FIXTURE atlas')"),'Replacement physical session drops the prior session report');
  await evaluate("document.getElementById('environment-fit').click()");await new Promise(resolve=>setTimeout(resolve,100));
  const fitted=await evaluate('__profileGeometry()');
  check(fitted.labels.every(label=>label.visible&&label.x>=fitted.canvas.x-1&&label.right<=fitted.canvas.right+1&&label.y>=fitted.canvas.y-1&&label.bottom<=fitted.canvas.bottom+1),'Overview restores all destinations after an extreme pinch');
  await evaluate("document.getElementById('environment-camera-toggle').click();document.querySelector('[aria-label=\"Focus camera on selected agent\"]').click();document.getElementById('environment-zoom-in').click()");
  check(await evaluate("__environment.focused==='atlas'&&!document.body.classList.contains('chat-open')"),'Deliberate focus survives a zoom adjustment without opening chat');
  await evaluate("document.getElementById('environment-fit').click()");
  check(await evaluate("!__environment.focused&&document.getElementById('environment-camera-panel').hidden"),'Overview leaves focus mode and closes optional camera controls');

  await evaluate("__connected=false;onDracoSnapshot(__snapshot());__environment.stopFrame();window.__frozen=JSON.stringify([...__environment.actors].map(([id,actor],index)=>__environment.actorPosition(null,index,actor)));__environment.advance(30)");
  check(await evaluate("!__environment.live&&[...document.querySelectorAll('.environment-agent')].every(button=>button.dataset.status==='unknown')&&document.getElementById('environment-state').textContent.includes('UNOBSERVED')"),'Disconnected scene/destinations explicitly remain unknown, not idle');
  check(await evaluate("__frozen===JSON.stringify([...__environment.actors].map(([id,actor],index)=>__environment.actorPosition(null,index,actor)))"),'Disconnected actors do not imply working through movement');
  await evaluate("document.querySelector('.spatial-read').click()");
  check(await evaluate("(()=>{const report=document.querySelector('.spatial-reader-report');return !__visible(report)||!report.textContent.includes('HANDSET FIXTURE')})()"),'Disconnected observation reader does not display a stale public report as live');
  await evaluate("document.querySelector('.spatial-reader-head button').click()");

  await evaluate("__connected=true;__allIdle=true;__speech.atlas={id:'idle-report',text:'FRESH PUBLIC IDLE PREVIEW',timestamp:Date.now(),sessionId:__sessions.atlas};onDracoSnapshot(__snapshot());document.querySelector('.environment-agent[data-agent=atlas]').click()");
  check(await evaluate("document.querySelector('.spatial-report').textContent.includes('FRESH PUBLIC IDLE PREVIEW')"),'Fresh idle speech appears in the retained inspector');
  await evaluate("document.querySelector('.spatial-read').click()");
  await evaluate("__elapsed+=59000;for(let n=0;n<10;n++)onDracoSnapshot(__snapshot())");
  check(await evaluate("document.querySelector('.spatial-inspector').dataset.messageId==='idle-report'"),'Unchanged polling does not prematurely remove fresh idle speech');
  await evaluate("__elapsed+=1001;onDracoSnapshot(__snapshot())");
  check(await evaluate("!document.querySelector('.spatial-inspector').dataset.messageId"),'Idle preview expires after 60 seconds despite unchanged refreshes');
  check(await evaluate("(()=>{const report=document.querySelector('.spatial-reader-report');return !__visible(report)||!report.textContent.includes('FRESH PUBLIC IDLE PREVIEW')})()"),'An already-open observation reader does not preserve visible expired public speech');
  await evaluate("document.querySelector('.spatial-reader-head button').click()");
  check(await evaluate("document.querySelector('.spatial-actions').querySelectorAll('button').length===2&&__visible(document.querySelector('.spatial-actions'))"),'Idle expiry retains conversation/work access');
  await evaluate("__speech.atlas={id:'new-idle-report',text:'NEWER PUBLIC IDLE PREVIEW',timestamp:Date.now(),sessionId:__sessions.atlas};onDracoSnapshot(__snapshot())");
  check(await evaluate("document.querySelector('.spatial-inspector').dataset.messageId==='new-idle-report'"),'A genuinely new public idle report can reappear');
  await evaluate("if(!__visible(document.getElementById('environment-speech')))document.getElementById('environment-camera-toggle').click()");
  check(await evaluate("__visible(document.getElementById('environment-speech'))&&document.getElementById('environment-speech').getBoundingClientRect().height>=43"),'Camera disclosure exposes the retained manual preview control with 44px target');
  await evaluate("document.getElementById('environment-speech').click();onDracoSnapshot(__snapshot());DracoWatch.view('settings');DracoWatch.view('environment')");
  check(await evaluate("document.getElementById('environment-speech').getAttribute('aria-pressed')==='false'&&getComputedStyle(document.querySelector('.spatial-report-detail')).display==='none'&&__visible(document.querySelector('.spatial-actions'))"),'Manual preview-off survives refresh/navigation without hiding inspection actions');
  await evaluate("document.querySelector('.spatial-read').click()");
  check(await evaluate("(()=>{const report=document.querySelector('.spatial-reader-report');return !__visible(report)||!report.textContent.includes('NEWER PUBLIC IDLE PREVIEW')})()"),'Manual public-preview preference also applies to the expanded observation reader');
  await evaluate("document.querySelector('.spatial-reader-head button').click()");
  check(await evaluate("__requests.every(request=>request.method==='GET'||request.route.startsWith('/v1/diagnostics'))"),'No gesture/inspection fixture issues agent input or live controls');
  check(errors.length===0,'No script exceptions in handset composition and touch flow',errors);
  check(JSON.stringify(sourceHashes)===JSON.stringify(hashes()),'All loaded application source remains unchanged across the fixture');
  const profileFailures=observations.filter(observation=>!observation.passed);
  assert.equal(profileFailures.length,0,'Handset viewport failures: '+profileFailures.map(failure=>failure.label).join('; '));
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({checks,scope:'Synthetic Chromium CSS/scene/touch geometry only; not Android or physical handset smoothness',sourceHashes,observations,errors},null,2));
  console.log('PASS '+checks+' handset composition/gesture checks; synthetic browser, not phone acceptance');
}catch(error){
  if(ws?.readyState===WebSocket.OPEN){try{await capture?.('failure');}catch{}}
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({checks,error:String(error),sourceHashes,observations,errors},null,2));
  throw error;
}finally{
  ws?.close();chromium.kill('SIGTERM');await new Promise(resolve=>server.close(resolve));
  await new Promise(resolve=>chromium.exitCode!==null?resolve():chromium.once('exit',resolve));
  fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
