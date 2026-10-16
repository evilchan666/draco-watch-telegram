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
const output=path.join(root,'../runtime/world-042-20261016/browser');
const sourceFiles=['index.html','styles.css','app.js','environment.js','environment-bubbles.js','chamber.js','client-state.js'];
const hashes=()=>Object.fromEntries(sourceFiles.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const sourceHashes=hashes();
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'draco-handset-composition-'));
const port=19375;
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
  for(const spec of [{name:'portrait',width:412,height:840},{name:'landscape',width:840,height:360}]){
    await call('Emulation.setDeviceMetricsOverride',{width:spec.width,height:spec.height,deviceScaleFactor:2,mobile:true});
    await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
    await wait("window.__environment&&document.getElementById('connection-label').textContent==='Connected'&&__lastRender?.world===true");
    await evaluate('onDracoAppInfo({fontScale:1.5});');await wait('__environment.performance.draws>0');await sleep(150);
    let geometry=await evaluate(`(()=>{const r=__rect(document.getElementById('environment-canvas'));return {r,width:innerWidth,height:innerHeight,nav:__visible(document.querySelector('.bottom-nav')),hud:__visible(document.querySelector('.world-hud')),body:__visible(document.querySelector('.world-local-body')),overflow:document.body.scrollWidth>innerWidth+1,controls:['world-walk','world-talk','world-connection'].map(id=>({id,...__rect(document.getElementById(id))}))}})()`);
    check(Math.abs(geometry.r.x)<1&&Math.abs(geometry.r.y)<1&&Math.abs(geometry.r.width-spec.width)<1&&Math.abs(geometry.r.height-spec.height)<1,spec.name+': world fills viewport',geometry);
    check(!geometry.nav&&geometry.hud&&geometry.body&&!geometry.overflow,spec.name+': world owns screen; local body and controls visible',geometry);
    check(geometry.controls.every(r=>r.x>=0&&r.y>=0&&r.right<=spec.width+1&&r.bottom<=spec.height+1&&r.width>=44&&r.height>=44),spec.name+': accessible HUD controls fit viewport',geometry.controls);
    await evaluate('onDracoInsets({worldSafe:{left:32,top:50,right:24,bottom:18},keyboardVisible:false})');await sleep(80);
    check(await evaluate("(()=>{const l=document.querySelector('.world-top').getBoundingClientRect(),p=document.getElementById('world-walk').getBoundingClientRect();return l.top>=49&&l.left>=31&&l.right<=innerWidth-23&&p.left>=31;})()"),spec.name+': camera cutout is reserved for HUD only, not canvas');
    await evaluate('onDracoInsets({worldSafe:{left:0,top:0,right:0,bottom:0},keyboardVisible:false})');await sleep(80);
    await screenshot(spec.name+'-spawn');
    const before=await pose(),pad=geometry.controls[0],x=pad.x+pad.width/2,y=pad.y+pad.height/2;
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-pad.height*.28,id:1}]});await sleep(450);
    await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(100);
    const moved=await pose();check(Math.hypot(moved.x-before.x,moved.z-before.z)>.3,spec.name+': actual touch pad walks local avatar',{before,moved});
    const yaw=moved.yaw;await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:spec.width*.7,y:spec.height*.38,id:2}]});await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:spec.width*.5,y:spec.height*.4,id:2}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(100);
    check(Math.abs((await pose()).yaw-yaw)>.1,spec.name+': touch drag looks without orbiting player');
    const stable=await pose();await evaluate('for(let i=0;i<20;i++)onDracoSnapshot(__snapshot());');await sleep(150);
    const refreshed=await pose();check(Math.hypot(refreshed.x-stable.x,refreshed.z-stable.z)<.001&&Math.abs(refreshed.yaw-stable.yaw)<.001,spec.name+': feed updates retain player and look direction');
    for(const id of ['main','forge','atlas','aera-new','vvv','daedalus']){
      await evaluate(`document.querySelector('.world-menu-button').click();document.querySelector('.world-agent[data-agent="${id}"]').click()`);await sleep(120);
      const saved=await pose();await evaluate("document.getElementById('world-talk').click()");await wait(`__lastRender.chat===true&&__lastRender.agent==='${id}'&&__lastRender.can.attachments===true&&__lastRender.can.voice===true`);
      check(await evaluate(`__lastRender.sessionId===__sessions['${id}']&&__lastRender.can.voice&&__lastRender.can.attachments&&Array.isArray(__lastRender.pins)&&Array.isArray(__lastRender.work)&&__lastRender.world===false`),spec.name+': '+id+' opens full session-bound native conversation');
      await evaluate("onDracoTelegramAction({action:'composer',data:{agent:__lastRender.agent,sessionId:__lastRender.sessionId}})");await wait("!!document.getElementById('native-return')");
      check(await evaluate("!__lastRender.visible&&document.body.classList.contains('chat-open')"),spec.name+': '+id+' full attachment/outbox composer reachable');
      await evaluate("document.getElementById('command-dialog').showModal();DracoWatch.back()");
      check(await evaluate("!document.getElementById('command-dialog').open&&!!document.getElementById('native-return')&&document.body.classList.contains('chat-open')"),spec.name+': '+id+' nested dialog Back retains full composer');
      await evaluate("DracoWatch.back()");await wait('__lastRender.visible===true&&__lastRender.chat===true');
      await evaluate("onDracoTelegramAction({action:'back'})");await wait('__lastRender.world===true&&__lastRender.chat===false');
      const returned=await pose();check(Math.hypot(returned.x-saved.x,returned.z-saved.z)<.001&&Math.abs(returned.yaw-saved.yaw)<.001,spec.name+': '+id+' returns to exact local pose');
      check(await evaluate("!document.getElementById('native-return')&&__environment.diagnostics().player.movement.x===0&&__environment.diagnostics().player.movement.z===0"),spec.name+': '+id+' no hidden movement or composer exit trap');
    }
    await evaluate("document.querySelector('.world-menu-button').click()");await wait('__lastRender.world===false');
    check(await evaluate("document.getElementById('world-menu').getAttribute('aria-labelledby')==='world-menu-title'&&document.getElementById('world-menu-title').textContent.includes(document.getElementById('world-talk').textContent.replace('Talk to ',''))"),spec.name+': menu names and captures HUD agent target');
    check(await evaluate("__lastRender.visible===false&&document.getElementById('world-menu').open"),spec.name+': menu leaves immersive world and stops movement');
    await evaluate("DracoWatch.back();DracoWatch.view('settings')");await wait("document.body.dataset.view==='settings'&&__lastRender.world===false");
    await evaluate('DracoWatch.back()');await wait('__lastRender.world===true');
    check(await evaluate("document.body.dataset.view==='environment'"),spec.name+': auxiliary screen Back returns to world');
    await evaluate("onDracoConnection({state:'connecting',message:'Connecting fixture'})");await wait("document.getElementById('world-connection').textContent==='Connecting…'&&__lastRender.live===false");
    check(await evaluate("document.getElementById('world-connection').textContent==='Connecting…'"),spec.name+': connecting is not falsely reported as offline failure');
    await evaluate('__connected=false;onDracoSnapshot(__snapshot())');await wait("document.getElementById('world-connection').dataset.live==='false'&&__lastRender.live===false");
    check(await evaluate("!__lastRender.live&&document.getElementById('world-connection').textContent.includes('reconnect')"),spec.name+': connection failure visible in world, not a LIVE STATE claim');
    const offline=await pose();await evaluate('__environment.setMovement(0,1)');await sleep(250);await evaluate('__environment.setMovement(0,0)');const offlineMoved=await pose();
    check(Math.hypot(offlineMoved.x-offline.x,offlineMoved.z-offline.z)>.05,spec.name+': offline world navigation remains available');
    await evaluate("__connected=true;onDracoSnapshot(__snapshot());__environment.resetPlayer();");await sleep(150);await screenshot(spec.name+'-final');
  }
  check(errors.length===0,'No browser script errors',errors);
  check(JSON.stringify(sourceHashes)===JSON.stringify(hashes()),'Source remains unchanged throughout evidence run');
  fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({checks,observations,errors,sourceHashes,endedHashes:hashes()},null,2));
  console.log(JSON.stringify({checks,errors,output}));
}catch(error){
  try{await capture?.('failure');}catch{}
  fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(error),checks,observations,errors,sourceHashes},null,2));throw error;
}finally{ws?.close();chromium.kill();await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
