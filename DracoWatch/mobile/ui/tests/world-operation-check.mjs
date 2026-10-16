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

const root=path.resolve(process.env.DRACO_WORLD_OPERATION_SOURCE_ROOT||path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const output=path.resolve(process.env.DRACO_WORLD_OPERATION_OUTPUT||path.join(root,'../runtime/hour-060-20261016/operations')); 
const sourceFiles=['index.html','styles.css','app.js','environment.js','environment-bubbles.js','chamber.js','client-state.js'];
const hashes=()=>Object.fromEntries(sourceFiles.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const sourceHashes=hashes();
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'draco-handset-composition-'));
let port=0;
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
const check=(condition,label,details)=>{observations.push({label,passed:!!condition,...(details?{details}:{})});assert.ok(condition,label+(details?' '+JSON.stringify(details):''));checks++;};
try{
  let pages;
  for(let attempt=0;attempt<80;attempt++){
    try{if(!port)port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();if(pages.some(page=>page.type==='page'))break;}catch{}
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
    // Explicitly audience-projected, exact physical owner/run fixtures. A tool
    // return and authored progress card never assert current process liveness.
    const originalSnapshot=window.__snapshot;window.__snapshot=(agent='atlas')=>{
      const value=originalSnapshot(agent),sessionId=__sessions.atlas,sessionKey='agent:atlas:telegram:direct:8745908879',runId='run:atlas';
      value.agents=value.agents.map(row=>({...row,sessionKey:'agent:'+row.id+':telegram:direct:8745908879',conversationStatus:row.id==='atlas'?'active':'idle',controlTargets:[{agent:row.id,sessionId:row.sessionId,sessionKey:'agent:'+row.id+':telegram:direct:8745908879',runId:'run:'+row.id,scope:'conversation'}]}));
      const event=(id,tool,phase,kind,at)=>({id,agent:'atlas',sessionKey,sessionId,runId,callId:'call:'+id,role:'assistant',text:phase==='result'?'Bounded fixture command returned':'Public fixture plan reported',kind,timestamp:at,source:'authenticated-tool-status',publicAttested:true,evidenceRevision:'e'.repeat(64),evidenceSource:{kind:'recorded-history',observedAt:Date.now(),freshUntil:Date.now()+15000},observation:{version:1,agent:'atlas',sessionKey,sessionId,runId,callId:'call:'+id,tool,toolName:tool,phase}});
      const plan=event('plan','progress_card','start','Tool started',__epoch-1500);plan.observation.taskProgress={version:1,source:'operator-progress-card',steps:[{step:'Preserve recorded state',status:'completed'},{step:'Exercise movement and reading',status:'in_progress'},{step:'Inspect Android rendering',status:'pending'}]};
      const result=event('result','bash','result','Tool finished',__epoch-1000);result.observation.command={preview:'git status --short'};result.observation.result={exitCode:0,summary:'Bounded fixture source delta retained'};
      value.workActivity=[plan,result];if(window.__extraTool){const extra=event('new-result','bash','result','Tool finished',__epoch-500);extra.text='New exact-session return in fixture. '.repeat(9);value.workActivity.push(extra);}value.fleetCoverage=__ids.map(id=>({agent:id,available:true,work:{available:true,partial:false,freshUntil:Date.now()+15000}}));return value;
    };
    __speech.atlas.excerpt=true;
    localStorage.setItem('draco-watch-client-v2',JSON.stringify({pins:[{agent:'atlas',sessionId:__sessions.atlas,messageId:'pinned:atlas',source:'authenticated-native-history',kind:'Public update',scope:'device-local',text:'Retained local pin fixture for this physical session',title:'Retained local pin fixture',timestamp:__epoch-2000,pinnedAt:__epoch}],preferences:{scale:100,motion:false,rendering:'auto',automaticSpeech:false,speechPreferenceVersion:2,worldLookSensitivity:1,worldHandedness:'right'}}));
    window.__rect=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
    window.__visible=element=>!!element&&!element.hidden&&!!element.getClientRects().length&&getComputedStyle(element).display!=='none'&&getComputedStyle(element).visibility!=='hidden';
    window.__profileGeometry=()=>{const nav=__rect(document.querySelector('.bottom-nav')),canvas=__rect(document.getElementById('environment-canvas')),stage=__rect(document.getElementById('environment-stage')),inspection=__rect(document.querySelector('.spatial-inspector')),actions=__rect(document.querySelector('.spatial-actions'));return {viewport:{width:innerWidth,height:innerHeight},nav,canvas,stage,inspection,actions,bodyWidth:document.body.scrollWidth,scrollY,agents:[...document.querySelectorAll('.environment-agent')].map(el=>({id:el.dataset.agent,...__rect(el),visible:__visible(el),label:el.getAttribute('aria-label')})),toolbar:__rect(document.querySelector('.environment-toolbar')),labels:[...__environment.labelNodes].map(([id,el])=>({id,...__rect(el),visible:__visible(el)})),actors:[...__environment.actors].map(([id,actor])=>{const index=__ids.indexOf(id),p=__environment.actorPosition(null,index,actor),point=__environment.project([p.x,p.y+.6,p.z]);return {id,x:point.x+canvas.x,y:point.y+canvas.y,depth:point.depth}})}};
  `});


  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const pose=()=>evaluate('({...__environment.diagnostics().player})');
  const tap=async(x,y)=>{await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
  for(const spec of [{name:'portrait',width:412,height:840,scale:100,fontScale:1},{name:'portrait-large',width:412,height:840,scale:150,fontScale:1.5},{name:'landscape-large',width:840,height:360,scale:150,fontScale:1.5}]){
    await call('Emulation.setDeviceMetricsOverride',{width:spec.width,height:spec.height,deviceScaleFactor:2,mobile:true});
    await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
    await wait("window.__environment&&document.getElementById('connection-label').textContent==='Connected'&&__lastRender?.world===true");
    await evaluate(`onDracoAppInfo({fontScale:${spec.fontScale}});document.getElementById('display-scale').value=${spec.scale};document.getElementById('display-scale').dispatchEvent(new Event('input'))`);await wait('__environment.performance.draws>0');await sleep(150);
    let geometry=await evaluate(`(()=>{const r=__rect(document.getElementById('environment-canvas'));return {r,width:innerWidth,height:innerHeight,nav:__visible(document.querySelector('.bottom-nav')),hud:__visible(document.querySelector('.world-hud')),body:__visible(document.querySelector('.world-local-body')),overflow:document.body.scrollWidth>innerWidth+1,controls:['world-walk','world-talk','world-connection'].map(id=>({id,...__rect(document.getElementById(id))}))}})()`);
    check(Math.abs(geometry.r.x)<1&&Math.abs(geometry.r.y)<1&&Math.abs(geometry.r.width-spec.width)<1&&Math.abs(geometry.r.height-spec.height)<1,spec.name+': world fills viewport',geometry);
    check(!geometry.nav&&geometry.hud&&geometry.body&&!geometry.overflow,spec.name+': world owns screen; local body and controls visible',geometry);
    check(geometry.controls.every(r=>r.x>=0&&r.y>=0&&r.right<=spec.width+1&&r.bottom<=spec.height+1&&r.width>=44&&r.height>=44),spec.name+': accessible HUD controls fit viewport',geometry.controls);
    await evaluate('onDracoInsets({worldSafe:{left:32,top:50,right:24,bottom:18},keyboardVisible:false})');await sleep(80);
    check(await evaluate("(()=>{const l=document.querySelector('.world-top').getBoundingClientRect(),p=document.getElementById('world-walk').getBoundingClientRect();return l.top>=49&&l.left>=31&&l.right<=innerWidth-23&&p.left>=31;})()"),spec.name+': camera cutout is reserved for HUD only, not canvas');
    await evaluate('onDracoInsets({worldSafe:{left:0,top:0,right:0,bottom:0},keyboardVisible:false})');await sleep(80);
    await screenshot(spec.name+'-spawn');
    // Operations is a captured public-session drawer, not a second message path.
    await evaluate("document.getElementById('world-operations-open').click()");await wait("document.getElementById('world-operations').open&&__environment.active===false");
    const suspendedDraws=await evaluate('__environment.performance.draws');await sleep(180);
    check(await evaluate('__environment.active===false&&__environment.performance.draws==='+suspendedDraws),spec.name+': wrist drawer suspends ambient drawing rather than burning frames underneath');
    await evaluate("onDracoLifecycle({active:false});onDracoLifecycle({active:true})");await sleep(80);
    check(await evaluate("document.getElementById('world-operations').open&&__environment.active===false&&__environment.diagnostics().player.movement.x===0&&__environment.diagnostics().player.movement.z===0"),spec.name+': lifecycle resume does not reactivate world or held movement behind wrist drawer');

    await evaluate("document.querySelector('.world-operation-agent[data-agent=vvv]').click()");await sleep(80);
    check(await evaluate("document.getElementById('world-operations').open&&document.getElementById('world-operations-title').textContent==='VVV'&&!document.querySelector('.world-operation-talk').disabled&&document.querySelector('.world-operation-report').textContent.includes('vvv retained')"),spec.name+': queued old close cannot clear explicitly rebound Operations owner');
    await evaluate("document.querySelector('.world-operation-talk').click()");await wait("__lastRender.chat===true&&__lastRender.agent==='vvv'&&__lastRender.can.voice===true&&__lastRender.can.attachments===true");
    check(await evaluate("__lastRender.sessionId===__sessions.vvv&&__lastRender.can.voice===true&&__lastRender.can.attachments===true"),spec.name+': reselected Operations opens exact full VVV conversation');
    await evaluate("onDracoTelegramAction({action:'back'});document.querySelector('.world-menu-button').click();document.querySelector('.world-agent[data-agent=forge]').click();document.getElementById('world-operations-open').click();document.querySelector('.world-operation-agent[data-agent=forge]').click()");await sleep(80);
    await evaluate("document.querySelector('.world-operation-actions button:last-child').click()");await wait("__lastRender.view==='activity'&&__lastRender.activityFilter==='forge'");
    check(await evaluate("__lastRender.agent==='forge'&&__lastRender.sessionId===__sessions.forge"),spec.name+': rebound Operations Work timeline keeps exact FORGE owner');
    await evaluate("DracoWatch.back();document.querySelector('.world-menu-button').click();document.querySelector('.world-agent[data-agent=atlas]').click();document.getElementById('world-operations-open').click()");await sleep(80);
    check(await evaluate("document.querySelector('.world-operation-report').textContent.includes('HANDSET FIXTURE')&&document.querySelector('.world-operation-actions').getBoundingClientRect().bottom<=innerHeight&&document.querySelectorAll('.world-operation-agent').length===6"),spec.name+': public report, six-agent selection and full conversation action visible');
    await screenshot(spec.name+'-operations');
    check(await evaluate("document.querySelector('.world-operation-summary').textContent.includes('Return observed')&&document.querySelector('.world-operation-summary').textContent.includes('present execution unknown')&&!document.querySelector('.world-operation-state').textContent.includes('Working')"),spec.name+': exact-run returned event remains distinct from current execution');
    check(await evaluate("document.querySelector('.world-operation-progress').textContent.includes('1/3 reported complete')&&document.querySelector('.world-operation-progress').textContent.includes('Exercise movement and reading')"),spec.name+': authored public progress card displays real reported step');
    check(await evaluate("document.querySelector('.world-operation-pin').textContent.includes('Retained local pin fixture')&&document.querySelector('.world-operation-pin').textContent.includes('Device-local snapshot')&&document.querySelectorAll('.world-operation-event').length===2"),spec.name+': owner-bound local pin and two observed events displayed');
    check(await evaluate("document.querySelectorAll('.world-operation-muted')[0].textContent.includes('source excerpt')"),spec.name+': report excerpt is not labelled complete');

    await evaluate("document.querySelector('.world-report-expand').click()");
    check(await evaluate("document.querySelector('.world-operation-report').textContent.length>420&&document.querySelector('.world-operation-body').scrollHeight>document.querySelector('.world-operation-body').clientHeight"),spec.name+': long report expands in scrollable stable body');
    await evaluate("window.__reportSection=document.querySelector('.world-operation-report').closest('section');window.__operationBody=document.querySelector('.world-operation-body');__operationBody.scrollTop+=__reportSection.getBoundingClientRect().top-__operationBody.getBoundingClientRect().top+30;window.__readingTop=__reportSection.getBoundingClientRect().top-__operationBody.getBoundingClientRect().top;window.__extraTool=true;onDracoSnapshot(__snapshot())");
    check(await evaluate("Math.abs(document.querySelector('.world-operation-report').closest('section').getBoundingClientRect().top-document.querySelector('.world-operation-body').getBoundingClientRect().top-__readingTop)<2&&document.querySelectorAll('.world-operation-event').length===3"),spec.name+': new observed work above report preserves its reading anchor');
    await evaluate("window.__retainedReport=document.querySelector('.world-operation-report');for(let i=0;i<5;i++)onDracoSnapshot(__snapshot())");
    check(await evaluate("window.__retainedReport===document.querySelector('.world-operation-report')"),spec.name+': unchanged poll keeps report DOM and reading position intact');
    await evaluate("window.__scrollBeforePin=document.querySelector('.world-operation-body').scrollTop;document.querySelector('.world-operation-body').scrollTop=document.querySelector('.world-operation-body').scrollHeight");
    check(await evaluate("(()=>{const p=document.querySelector('.world-operation-pin').getBoundingClientRect(),b=document.querySelector('.world-operation-body').getBoundingClientRect(),a=document.querySelector('.world-operation-actions').getBoundingClientRect();return p.top>=b.top-1&&p.bottom<=b.bottom+1&&p.bottom<=a.top+1;})()"),spec.name+': local pin is reachable inside scroller above fixed actions');
    await screenshot(spec.name+'-operations-pins');await evaluate("document.querySelector('.world-operation-body').scrollTop=window.__scrollBeforePin");


    await evaluate("__connected=false;onDracoSnapshot(__snapshot())");
    check(await evaluate("document.querySelector('.world-operation-state').textContent.includes('Offline')&&document.querySelector('.world-operation-muted').textContent.includes('No live tool')&&document.querySelector('.world-operation-report').textContent.includes('HANDSET FIXTURE')"),spec.name+': offline drawer distinguishes saved report from current activity');
    await screenshot(spec.name+'-operations-offline');
    await evaluate("__connected=true;__sessions.atlas='replacement:atlas';onDracoSnapshot(__snapshot())");
    check(await evaluate("document.querySelector('.world-operation-state').textContent.includes('Session changed')&&document.querySelector('.world-operation-talk').disabled&&!document.querySelector('.world-operation-report')"),spec.name+': physical session replacement removes old content and disables old action');
    await evaluate("DracoWatch.back();document.querySelector('.world-menu-button').click();const c=document.getElementById('world-look-sensitivity');c.value=150;c.dispatchEvent(new Event('input'));const h=document.getElementById('world-handedness');h.value='left';h.dispatchEvent(new Event('change'));DracoWatch.back()");
    check(await evaluate("document.body.dataset.worldHandedness==='left'&&document.getElementById('world-walk').getBoundingClientRect().x>innerWidth/2"),spec.name+': handedness swaps movement and interaction sides');
    await screenshot(spec.name+'-left-handed');
    await evaluate("document.querySelector('.world-menu-button').click();document.getElementById('world-handedness').value='right';document.getElementById('world-handedness').dispatchEvent(new Event('change'));DracoWatch.back()");

    const before=await pose(),pad=geometry.controls[0],x=pad.x+pad.width/2,y=pad.y+pad.height/2;
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-pad.height*.28,id:1}]});await sleep(450);
    await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(100);
    const moved=await pose();check(Math.hypot(moved.x-before.x,moved.z-before.z)>.3,spec.name+': actual touch pad walks local avatar',{before,moved});
    const yaw=moved.yaw;await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:spec.width*.7,y:spec.height*.38,id:2}]});await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:spec.width*.5,y:spec.height*.4,id:2}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(100);
    check(Math.abs((await pose()).yaw-yaw)>.1,spec.name+': touch drag looks without orbiting player');
    const stable=await pose();await evaluate('for(let i=0;i<20;i++)onDracoSnapshot(__snapshot());');await sleep(150);
    const refreshed=await pose();check(Math.hypot(refreshed.x-stable.x,refreshed.z-stable.z)<.001&&Math.abs(refreshed.yaw-stable.yaw)<.001,spec.name+': feed updates retain player and look direction');
    const explicit=await evaluate("__environment.player.x=-6.58;__environment.player.z=9.59;document.querySelector('.world-menu-button').click();document.querySelector('.world-agent[data-agent=\"main\"]').click();({target:__environment.interactionTarget(),label:document.getElementById('world-talk').textContent})");
    check(explicit.target?.agent==='main'&&explicit.target.explicit&&explicit.label==='Talk to Commander',spec.name+': explicit menu selection owns Talk immediately, before a replacement scene frame');
    await sleep(200);
    check(await evaluate("__environment.interactionTarget()?.agent==='main'&&__environment.interactionTarget().explicit&&document.getElementById('world-target').textContent.startsWith('Selected: Commander')"),spec.name+': nearer creature cannot steal an explicitly selected conversation after walking behind the room');
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:spec.width*.7,y:spec.height*.38,id:3}]});await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:spec.width*.65,y:spec.height*.38,id:3}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(100);
    check(await evaluate('!__environment.interactionTarget()?.explicit'),spec.name+': deliberate look gesture returns communication targeting to gaze');
    for(const id of ['main','forge','atlas','aera-new','vvv','daedalus']){
      await evaluate(`document.querySelector('.world-menu-button').click();document.querySelector('.world-agent[data-agent="${id}"]').click()`);await sleep(120);
      if(spec.name==='portrait')await screenshot('agent-'+id);
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
    check(await evaluate("__lastRender.visible===false&&document.getElementById('world-menu').open&&__environment.active===false"),spec.name+': menu leaves immersive world and stops movement');
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
  if(fs.existsSync(path.join(output,'failure.json')))fs.renameSync(path.join(output,'failure.json'),path.join(output,'prior-failure-'+Date.now()+'.json'));
  fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({checks,observations,errors,sourceHashes,endedHashes:hashes()},null,2));
  console.log(JSON.stringify({checks,errors,output}));
}catch(error){
  try{await capture?.('failure');}catch{}
  fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(error),checks,observations,errors,sourceHashes},null,2));throw error;
}finally{ws?.close();chromium.kill();await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
