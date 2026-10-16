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

const root=path.resolve(process.env.DRACO_SOAK_SOURCE_ROOT||path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const output=path.resolve(process.env.DRACO_SOAK_OUTPUT||'mobile/runtime/hour-060-20261016/soak');
const sourceFiles=['index.html','styles.css','app.js','environment.js','environment-bubbles.js','chamber.js','client-state.js'];
const hashes=()=>Object.fromEntries(sourceFiles.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const sourceHashes=hashes();
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'draco-handset-composition-'));
let port;
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
  const file=path.join(root,req.url==='/'?'index.html':req.url.split('?')[0]);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const chromium=spawn('/usr/bin/chromium',['--headless=new','--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let ws,capture,checks=0;
const observations=[],errors=[];
const check=(condition,label,details)=>{observations.push({label,passed:!!condition,...(details?{details}:{})});if(!process.env.DRACO_SOAK_BASELINE)assert.ok(condition,label+(details?' '+JSON.stringify(details):''));checks++;};
try{
  let pages;
  for(let attempt=0;attempt<80&&!port;attempt++){try{port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);}catch{}if(!port)await new Promise(resolve=>setTimeout(resolve,100));}
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
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},15000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:error=>{clearTimeout(timer);reject(error)}});ws.send(JSON.stringify({id,method,params}));});
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
    window.__renders=[];window.__caps={send:true,queue:true,steer:false,abort:true,attachments:true,voice:true,reply:true,speech:true,commands:true};
    window.__snapshot=(agent='atlas')=>({version:2,connected:__connected,lastSuccess:Date.now(),selectedAgent:agent,agents:__ids.map(id=>({id,status:!__allIdle&&id==='atlas'?'active':'idle',sessionKey:'fixture:'+id,sessionId:__sessions[id],controlTargets:[{agent:id,sessionKey:'fixture:'+id,sessionId:__sessions[id],runId:'run:'+id,scope:'conversation'}],capabilities:__caps,telemetry:{activeSessions:!__allIdle&&id==='atlas'?1:0,queuedSessions:0,model:'SYNTHETIC FIXTURE'}})),fleetActivity:__ids.map(id=>({agent:id,role:'assistant',...__speech[id]})),conversation:[{id:'conversation:'+agent,role:'assistant',text:'Retained conversation '+agent,timestamp:__epoch-1000,sessionId:__sessions[agent]}],historyState:{status:'complete'},historyHasMore:false,total:1});
    window.DracoNative={renderTelegram(json){__renders.push(JSON.parse(json));window.__lastRender=__renders.at(-1)},refresh(agent){setTimeout(()=>onDracoSnapshot(__snapshot(agent)),1)},request(id,method,route,json){__requests.push({method,route,body:json?JSON.parse(json):null});if(method==='GET'){const agent=new URL('http://fixture'+route).searchParams.get('agent')||'atlas';setTimeout(()=>onDracoResponse({id,ok:true,status:200,data:route.startsWith('/v1/capabilities')?{...__caps,agent,sessionId:__sessions[agent]}:{agent,sessionId:__sessions[agent],messages:__snapshot(agent).conversation,hasMore:false,total:1,historyState:{status:'complete'}}}),1)}},stopMedia(){},hideKeyboard(){}};
    window.__rect=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
    window.__visible=element=>!!element&&!element.hidden&&!!element.getClientRects().length&&getComputedStyle(element).display!=='none'&&getComputedStyle(element).visibility!=='hidden';
    window.__profileGeometry=()=>{const nav=__rect(document.querySelector('.bottom-nav')),canvas=__rect(document.getElementById('environment-canvas')),stage=__rect(document.getElementById('environment-stage')),inspection=__rect(document.querySelector('.spatial-inspector')),actions=__rect(document.querySelector('.spatial-actions'));return {viewport:{width:innerWidth,height:innerHeight},nav,canvas,stage,inspection,actions,bodyWidth:document.body.scrollWidth,scrollY,agents:[...document.querySelectorAll('.environment-agent')].map(el=>({id:el.dataset.agent,...__rect(el),visible:__visible(el),label:el.getAttribute('aria-label')})),toolbar:__rect(document.querySelector('.environment-toolbar')),labels:[...__environment.labelNodes].map(([id,el])=>({id,...__rect(el),visible:__visible(el)})),actors:[...__environment.actors].map(([id,actor])=>{const index=__ids.indexOf(id),p=__environment.actorPosition(null,index,actor),point=__environment.project([p.x,p.y+.6,p.z]);return {id,x:point.x+canvas.x,y:point.y+canvas.y,depth:point.depth}})}};
  `});


  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const pose=()=>evaluate('({...__environment.diagnostics().player})');
  const tap=async(x,y)=>{await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};

  await call('Emulation.setDeviceMetricsOverride',{width:412,height:840,deviceScaleFactor:2,mobile:true});
  await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
  await wait("window.__environment&&__lastRender?.world===true&&__environment.performance.draws>0");
  check(await evaluate("!!__environment.gl&&__environment.diagnostics().renderer==='webgl-first-person'"),'Measured main path is actual WebGL, not a silent compatibility fallback');
  await evaluate(`window.__soakStart=performance.now();window.__soakClock=setInterval(()=>__elapsed=performance.now()-__soakStart,100);window.__allIdle=true;onDracoSnapshot(__snapshot());`);
  await sleep(500);
  const phases=[];
  const sample=()=>evaluate('({...__environment.diagnostics(),pose:{...__environment.diagnostics().player}})');
  let start=await sample();await sleep(12000);let end=await sample();phases.push({phase:'idle-12s',start,end});
  check(end.draws-start.draws<=8,'Idle static world draws only bounded periodic observations, not continuous animation',{draws:end.draws-start.draws});
  const retained=await pose();
  await evaluate('window.__soakFeed=setInterval(()=>onDracoSnapshot(__snapshot()),200)');
  start=await sample();await sleep(20000);end=await sample();phases.push({phase:'same-feed-5Hz-20s',start,end});
  check(Math.hypot(end.pose.x-retained.x,end.pose.z-retained.z)<.0001&&Math.abs(end.pose.yaw-retained.yaw)<.0001,'100 unchanged observations never reset player');
  check(end.meshBuilds===start.meshBuilds&&end.resizes===start.resizes,'Feed does not rebuild room or resize backing store');
  await evaluate('__environment.setMovement(0,1)');start=await sample();await sleep(20000);await evaluate('__environment.stopMovement()');end=await sample();phases.push({phase:'walk-to-collision-20s',start,end});
  check(end.pose.collision==='clear'&&Math.abs(end.pose.x)<7&&Math.abs(end.pose.z)<10,'Held walking respects room and station collision',end.pose);
  await evaluate('clearInterval(__soakFeed);__allIdle=false;document.getElementById("reduce-motion").checked=false;document.getElementById("reduce-motion").dispatchEvent(new Event("change"));onDracoSnapshot(__snapshot());__environment.resetPlayer()');
  start=await sample();await sleep(12000);end=await sample();phases.push({phase:'active-ambient-12s',start,end});
  check(end.draws-start.draws>30&&end.meshBuilds===start.meshBuilds,'Live motion uses retained geometry');
  const old=await pose();await evaluate("(document.getElementById('world-operations-open')||document.querySelector('.world-menu-button')).click()");await sleep(400);
  start=await sample();await sleep(1000);end=await sample();
  check(end.draws-start.draws<=2&&!end.active,'Reading operations suspends world draw and movement');
  await evaluate('DracoWatch.back()');await sleep(300);
  const returned=await pose();check(Math.hypot(returned.x-old.x,returned.z-old.z)<.001,'Operations return retains local pose');
  await evaluate('window.__soakContext=__environment.gl?.getExtension("WEBGL_lose_context");__soakContext?.loseContext()');await sleep(300);
  check(await evaluate('__environment.lost'),'Graphics-loss state is explicit');
  await evaluate('__soakContext.restoreContext()');await wait('__environment.lost===false&&__environment.performance.draws>'+end.draws);await screenshot('recovered-world');
  check(await evaluate('__environment.gl.getError()===0'),'Recovered WebGL reports no error');
  await evaluate('clearInterval(__soakClock);__allIdle=true;document.getElementById("reduce-motion").checked=true;document.getElementById("reduce-motion").dispatchEvent(new Event("change"));onDracoSnapshot(__snapshot())');await sleep(300);
  start=await sample();await sleep(2000);end=await sample();check(end.draws-start.draws<=2,'Recovered world settles again at idle');
  check(errors.length===0,'No script exceptions during sustained update/movement',errors);
  check(JSON.stringify(sourceHashes)===JSON.stringify(hashes()),'Source unchanged throughout soak');
  fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({checks,phases,observations,errors,sourceHashes,scope:'Isolated Chromium/SwiftShader WebView-equivalent CPU intervals, not physical handset FPS or current gateway acceptance'},null,2));
  console.log(JSON.stringify({checks,errors,output,phases:phases.map(p=>({phase:p.phase,draws:p.end.draws-p.start.draws,cpu:p.end.drawCpuP95Ms,interval:p.end.rafIntervalP95Ms}))}));
}catch(error){try{await capture?.('failure');}catch{}fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(error),checks,observations,errors,sourceHashes},null,2));throw error;
}finally{ws?.close();chromium.kill();await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
