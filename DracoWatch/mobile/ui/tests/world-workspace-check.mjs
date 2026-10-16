// Real application composition with a synthetic native bridge only. The page
// cannot contact a gateway, send agent input, synthesize speech or play media.
// Native assertions cover the JS payload contract; screenshots cover the actual
// browser fallback, never Android's native panel or physical-phone acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ui=path.resolve(process.env.DRACO_WORKSPACE_SOURCE_ROOT||path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const output=path.resolve(process.env.DRACO_WORKSPACE_OUTPUT||path.join(ui,'../runtime/world-workspace-20261016/browser'));
const files=['index.html','styles.css','app.js','environment.js','environment-bubbles.js','chamber.js','client-state.js'];
const hashes=()=>Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(ui,file))).digest('hex')]));
const sourceHashes=hashes(),results=[],errors=[],network=[],blocked=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'draco-retained-workspace-'));
fs.mkdirSync(output,{recursive:true});
// Static source only: even an accidentally unbridged API request is denied.
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://fixture.invalid').pathname;
  const file=path.resolve(ui,'.'+(pathname==='/'?'/index.html':pathname));
  if(req.method!=='GET'||pathname.startsWith('/v1/')||!file.startsWith(ui+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');
  res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=spawn('/usr/bin/chromium',['--headless=new','--no-sandbox','--disable-background-networking','--disable-component-update','--no-first-run','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let ws,capture;

try{
  let port,pages;
  for(let attempt=0;attempt<100;attempt++){
    try{if(!port)port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();if(pages.some(p=>p.type==='page'))break;}catch{}
    await pause(75);
  }
  const page=pages?.find(p=>p.type==='page');assert.ok(page,'Isolated Chromium started');
  ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let serial=0;const pending=new Map();
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},15000);
    pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:error=>{clearTimeout(timer);reject(error)}});
    ws.send(JSON.stringify({id,method,params}));
  });
  ws.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
    if(message.method==='Network.requestWillBeSent')network.push(message.params.request.url);
    if(message.method==='Fetch.requestPaused'){
      const {requestId,request}=message.params,url=request.url;
      if(url.startsWith(origin+'/')&&!new URL(url).pathname.startsWith('/v1/'))void call('Fetch.continueRequest',{requestId}).catch(error=>errors.push(String(error)));
      else{blocked.push(url);void call('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'}).catch(error=>errors.push(String(error)));}
    }
    const task=pending.get(message.id);if(!task)return;pending.delete(message.id);
    message.error?task.reject(Error(message.error.message)):task.resolve(message.result);
  };
  const evaluate=async expression=>{
    const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  };
  const wait=async expression=>{
    for(let attempt=0;attempt<100;attempt++){if(await evaluate(expression))return;await pause(60);}
    throw Error('Workspace condition failed: '+expression+' '+JSON.stringify(errors));
  };
  const check=async(expression,label)=>{
    const actual=await evaluate(expression),passed=actual===true;results.push({label,passed,...(passed?{}:{actual})});assert.equal(actual,true,label);
  };
  capture=async name=>{const image=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(image.data,'base64'));};
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
  await call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`
    Object.defineProperty(window,'DracoEnvironment',{configurable:true,set(api){Object.defineProperty(window,'DracoEnvironment',{value:{...api,Environment:class extends api.Environment{constructor(...args){super(...args);if(args[0]?.id==='environment-canvas')window.__environment=this;}}},writable:true,configurable:true});}});
    window.__ids=['main','forge','atlas','aera-new','vvv','daedalus'];window.__requests=[];window.__calls=[];window.__renders=[];
    window.__sessions=Object.fromEntries(__ids.map(id=>[id,'workspace:'+id]));window.__runs=Object.fromEntries(__ids.map(id=>[id,'run:'+id]));
    window.__caps={send:true,queue:true,strictSteer:false,steer:false,abort:true,attachments:true,voice:true,reply:true,speech:true,commands:true};
    window.__messages=agent=>Array.from({length:9},(_,i)=>({id:'report:'+agent+':'+i,agent,sessionId:__sessions[agent],role:i===1?'user':'assistant',text:'SYNTHETIC '+agent+' report '+i+'. '+('Readable retained workspace detail. '.repeat(7)),kind:'Public report',timestamp:Date.now()-30000+i*1000,publicAttested:true,source:'authenticated-native-history',replyAvailable:true,media:[]}));
    window.__snapshot=(agent='atlas')=>({version:2,connected:true,lastSuccess:Date.now(),selectedAgent:agent,agents:__ids.map(id=>({id,status:'active',conversationStatus:'active',sessionKey:'agent:'+id+':telegram:direct:8745908879',sessionId:__sessions[id],historyAvailable:true,capabilities:__caps,controlTargets:[{agent:id,scope:'conversation',sessionKey:'agent:'+id+':telegram:direct:8745908879',sessionId:__sessions[id],runId:__runs[id]}],telemetry:{activeSessions:1,queuedSessions:0,model:'ISOLATED WORKSPACE FIXTURE'}})),conversation:__messages(agent),fleetActivity:__ids.map(id=>__messages(id).at(-1)),historyState:{status:'complete'},historyHasMore:false,total:9});
    window.__emit=agent=>onDracoSnapshot(__snapshot(agent));
    window.__action=(action,data={})=>onDracoTelegramAction({action,data:{agent:window.__lastRender?.agent||'atlas',sessionId:__sessions[window.__lastRender?.agent||'atlas'],sessionKey:'agent:'+(window.__lastRender?.agent||'atlas')+':telegram:direct:8745908879',...data}});
    window.__scope=agent=>({agent,sessionId:__sessions[agent],sessionKey:'agent:'+agent+':telegram:direct:8745908879'});
    window.__visible=element=>{if(!element||!element.getClientRects().length)return false;for(let node=element;node;node=node.parentElement){const style=getComputedStyle(node);if(node.hidden||style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;}return true;};
    window.__rect=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    window.confirm=()=>true;
    localStorage.setItem('draco-watch-client-v2',JSON.stringify({drafts:{atlas:'Retained ATLAS draft',forge:'Retained FORGE draft'},preferences:{scale:150,motion:true,automaticSpeech:false,speechPreferenceVersion:2,echoToTelegram:false}}));
    const bridge={
      refresh(agent){setTimeout(()=>__emit(agent),1)},
      request(id,method,route,json){const body=json?JSON.parse(json):null;__requests.push({id,method,route,body});const agent=body?.agent||new URL(route,'http://fixture.invalid').searchParams.get('agent')||'atlas';let data;
        if(method==='GET')data=route.startsWith('/v1/capabilities')?{...__caps,agent,sessionId:__sessions[agent]}:{agent,sessionId:__sessions[agent],messages:__messages(agent),hasMore:false,total:9,historyState:{status:'complete'}};
        else data={status:'accepted',dispatched:true};
        setTimeout(()=>onDracoResponse({id,ok:true,status:200,data}),2);
      },
      chooseAttachment(agent){__calls.push({method:'chooseAttachment',agent})},startRecording(agent){__calls.push({method:'startRecording',agent})},stopRecording(){__calls.push({method:'stopRecording'})},
      stopMedia(){},hideKeyboard(){},cancelAttachment(id){__calls.push({method:'cancelAttachment',id})},releaseAttachment(id){__calls.push({method:'releaseAttachment',id})},
      copyText(text){__calls.push({method:'copyText',text})},shareText(text){__calls.push({method:'shareText',text})},recordDiagnostic(){},setPlaybackRate(){},
    };
    if(new URLSearchParams(location.search).get('surface')!=='fallback')bridge.renderTelegram=json=>{__lastRender=JSON.parse(json);__renders.push(__lastRender)};
    window.DracoNative=bridge;
  `});

  const load=async(surface,width=412,height=840)=>{
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});
    await call('Page.navigate',{url:origin+'/?surface='+surface});
    await wait("window.__environment&&document.querySelectorAll('.world-workspace-bar .world-contact').length===6&&document.getElementById('connection-label').textContent==='Connected'");
    await evaluate('onDracoAppInfo({fontScale:1.5})');await wait('__environment.performance.draws>0');
    await evaluate('window.__retainedCanvas=document.getElementById("environment-canvas");window.__initialMeshBuilds=__environment.performance.meshBuilds');
  };
  const nativeReady=agent=>wait(`__lastRender?.chat===true&&__lastRender.agent===${JSON.stringify(agent)}&&__lastRender.sessionId===__sessions[${JSON.stringify(agent)}]&&__lastRender.can.voice&&__lastRender.can.attachments&&__lastRender.messages.some(row=>row.text.startsWith(${JSON.stringify('SYNTHETIC '+agent+' report')}))`);
  const select=async agent=>{
    const point=await evaluate(`(()=>{const node=document.querySelector('.world-contact[data-agent=${JSON.stringify(agent)}]');node.scrollIntoView({block:'nearest',inline:'center',behavior:'instant'});const r=node.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:document.elementFromPoint(x,y)?.closest('.world-contact')===node};})()`);
    assert.ok(point.hit,'Contact is actually reachable by touch: '+agent);
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,id:1}]});
    await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  const pose=()=>evaluate('({...__environment.diagnostics().player})');
  const unchanged=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z)<.001&&Math.abs(a.yaw-b.yaw)<.001;

  await load('native');
  await evaluate("document.getElementById('world-talk').click()");await nativeReady('atlas');
  await check("__lastRender.worldDock===true&&__lastRender.world===true&&__lastRender.chat===true&&__lastRender.visible===true&&__lastRender.view==='environment'",'Talk publishes one retained-world native conversation, not a hidden-world chat route');
  await check("__visible(__retainedCanvas)&&__retainedCanvas===document.getElementById('environment-canvas')&&__environment.reading===true",'Talk retains original drawn canvas and disables exploration');
  const readingPose=await pose();
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});await pause(180);
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
  assert.ok(unchanged(readingPose,await pose()),'Movement key cannot move player while talking');results.push({label:'Movement key cannot move player while talking',passed:true});
  await evaluate('onDracoLifecycle({active:false});onDracoLifecycle({active:true})');await pause(100);
  await check("__environment.reading===true&&__lastRender.worldDock===true&&__environment.diagnostics().player.movement.x===0&&__environment.diagnostics().player.movement.z===0",'Lifecycle resume cannot steal conversation focus or restore held movement');

  for(const agent of ['main','forge','atlas','aera-new','vvv','daedalus']){
    await select(agent);await nativeReady(agent);
    await check(`__lastRender.worldDock&&__lastRender.world&&__lastRender.visible&&__lastRender.view==='environment'&&__lastRender.messages.every(row=>row.agent===${JSON.stringify(agent)}&&row.sessionId===__sessions[${JSON.stringify(agent)}])&&__visible(__retainedCanvas)`,agent+': dock opens exact recipient and physical-session history with world retained');
    await evaluate(`__action('draft',{text:${JSON.stringify('Unsent workspace draft for '+agent)}})`);await wait(`__lastRender.draft===${JSON.stringify('Unsent workspace draft for '+agent)}`);
    await check(`JSON.parse(localStorage.getItem('draco-watch-client-v2')).drafts[${JSON.stringify(agent)}]===${JSON.stringify('Unsent workspace draft for '+agent)}&&__environment.reading===true`,agent+': unsent draft is saved without moving or sending');
  }
  await select('atlas');await nativeReady('atlas');
  await check("__lastRender.draft==='Unsent workspace draft for atlas'&&__requests.every(request=>request.method==='GET'||request.route==='/v1/diagnostics')",'Six-agent switching restores distinct drafts without automatically submitting any');
  await evaluate("__action('reply',{id:'report:atlas:0'});__action('pin',{id:'report:atlas:0'})");await pause(80);
  await check("__lastRender.replyLabel.length>0&&__lastRender.pins.some(pin=>pin.messageId==='report:atlas:0'&&pin.agent==='atlas'&&pin.sessionId===__sessions.atlas)",'Real reply and local-pin routes remain bound to the docked conversation');

  await evaluate("__action('search',{text:'SYNTHETIC'});document.querySelector('.world-contact[data-agent=atlas]').click();document.getElementById('world-workspace-talk').click()");await pause(80);
  await check("__lastRender.replyLabel.length>0&&__lastRender.search==='SYNTHETIC'&&__lastRender.draft==='Unsent workspace draft for atlas'",'Reselecting current contact or Conversation preserves reply, search and draft');
  await evaluate("__action('replyClear',{id:'stale-message'})");await pause(40);
  await check("__lastRender.replyId==='report:atlas:0'",'Stale native clear cannot discard a different exact reply reference');
  await evaluate("__action('replyClear',{id:'report:atlas:0'});__action('reply',{id:'report:atlas:0'});__action('search',{text:''})");

  await evaluate("__action('attach')");
  await check("__calls.at(-1).method==='chooseAttachment'&&__calls.at(-1).agent==='atlas'",'File picker captures ATLAS before switching agents');
  await select('forge');await nativeReady('forge');
  await evaluate("onDracoAttachment({state:'ready',agent:'atlas',id:'isolated-file-atlas',name:'fixture.txt',mimeType:'text/plain',sizeBytes:32})");await pause(60);
  await check("!__lastRender.attachments.some(file=>file.id==='isolated-file-atlas')",'Late file result is not retargeted into FORGE composer');
  await select('atlas');await nativeReady('atlas');
  await check("__lastRender.attachments.some(file=>file.id==='isolated-file-atlas')",'Returning to ATLAS restores its captured file');
  await evaluate("__action('record')");
  await check("__calls.at(-1).method==='startRecording'&&__calls.at(-1).agent==='atlas'",'Voice recording captures the docked recipient through existing bridge');
  await evaluate("onDracoAttachment({state:'recording',agent:'atlas'});document.querySelector('.world-contact[data-agent=vvv]').click()");await pause(80);
  await check("__lastRender.agent==='atlas'&&__lastRender.recording===true",'Agent switch cannot move an active ATLAS recording into VVV');
  await evaluate("__action('recordStop');onDracoAttachment({state:'ready',agent:'atlas',id:'isolated-voice-atlas',name:'fixture.ogg',mimeType:'audio/ogg',sizeBytes:320,durationMs:1000})");await pause(80);
  await check("__calls.some(call=>call.method==='stopRecording')&&__lastRender.attachments.some(file=>file.id==='isolated-voice-atlas')&&!__lastRender.recording",'Recording finish returns to original recipient without submitting it');
  await evaluate("__action('reply',{id:'report:atlas:0'});__action('draft',{text:'Explicit isolated ATLAS submission'});__action('send',{text:'Explicit isolated ATLAS submission',mode:'send'})");
  await wait("__requests.some(request=>request.route==='/v1/message'&&request.body.text==='Explicit isolated ATLAS submission')");
  await check("(()=>{const request=__requests.filter(request=>request.route==='/v1/message').at(-1);return request.body.agent==='atlas'&&request.body.sessionId==='workspace:atlas'&&request.body.mode==='send'&&request.body.replyToId==='report:atlas:0'&&request.body.attachmentIds.includes('isolated-file-atlas')&&request.body.attachmentIds.includes('isolated-voice-atlas')&&request.body.echoToTelegram===false;})()",'Explicit Send preserves exact text, selected session, captured files, voice and reply through original outbox');
  await select('forge');await nativeReady('forge');
  await evaluate("__action('draft',{text:'Explicit isolated FORGE queue'});__action('send',{text:'Explicit isolated FORGE queue',mode:'queue'})");
  await wait("__requests.some(request=>request.route==='/v1/message'&&request.body.mode==='queue')");
  await check("(()=>{const request=__requests.filter(request=>request.route==='/v1/message'&&request.body.mode==='queue').at(-1);return request.body.agent==='forge'&&request.body.sessionId==='workspace:forge'&&request.body.text==='Explicit isolated FORGE queue'&&!request.body.attachmentIds&&!request.body.replyToId;})()",'Queue retains explicit FORGE recipient without importing ATLAS files or reply target');
  await select('atlas');await nativeReady('atlas');

  const beforeControl=await evaluate("__requests.filter(request=>request.route==='/v1/abort').length");
  await evaluate("__action('stop',{runId:'old-run'});__action('send',{text:__lastRender.draft,mode:'steer',runId:'old-run'})");await pause(80);
  await check(`__requests.filter(request=>request.route==='/v1/abort').length===${beforeControl}&&!__lastRender.can.steer`,'Stale exact-run control and unsupported Steer are refused, never demoted to ordinary input');
  await evaluate("window.__oldScope=__scope('atlas');__sessions.atlas='replacement:atlas';__runs.atlas='replacement-run:atlas';__emit('atlas')");await nativeReady('atlas');
  const beforeStale=await evaluate('__requests.length'),beforeStaleNative=await evaluate('__calls.length');
  await evaluate("onDracoTelegramAction({action:'stop',data:{...__oldScope,runId:'run:atlas'}});onDracoTelegramAction({action:'attach',data:__oldScope});onDracoTelegramAction({action:'draft',data:{...__oldScope,text:'WRONG SESSION BODY'}})");await pause(60);
  await check(`__requests.slice(${beforeStale}).every(request=>request.method==='GET'||request.route==='/v1/diagnostics')&&__calls.length===${beforeStaleNative}&&__lastRender.draft!=='WRONG SESSION BODY'`,'Old-session native actions cannot dispatch controls, open picker or replace current draft');
  await evaluate("__action('stop',{runId:__runs.atlas})");await wait("__requests.some(request=>request.route==='/v1/abort'&&request.body.sessionId==='replacement:atlas')");
  await check("__requests.filter(request=>request.route==='/v1/abort').at(-1).body.agent==='atlas'&&__requests.filter(request=>request.route==='/v1/abort').at(-1).body.runId==='replacement-run:atlas'",'Fresh Stop uses exact displayed physical session and run in synthetic transport');

  await evaluate("__action('worldExpand',{expanded:true})");await pause(80);
  await check("__lastRender.worldDock&&__lastRender.world&&__lastRender.chat&&__lastRender.worldExpanded===true&&__lastRender.agent==='atlas'&&__environment.reading===true",'Native expand keeps dock ownership and exploration suspended');
  await evaluate("__action('worldExpand',{expanded:false});__action('worldAgent',{agent:'daedalus'})");await nativeReady('daedalus');
  await check("__lastRender.worldDock&&__lastRender.world&&__lastRender.sessionId===__sessions.daedalus",'Native world-agent action is reduced to exact selected conversation');
  await evaluate("document.getElementById('world-workspace-explore').click()");await wait('__environment.active===true&&!__environment.reading');
  const explorePose=await pose();
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});await pause(180);
  await call('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
  assert.ok(!unchanged(explorePose,await pose()),'Explicit Explore restores local movement');results.push({label:'Explicit Explore restores local movement',passed:true});
  await evaluate("document.getElementById('world-workspace-talk').click()");await nativeReady('daedalus');
  await check("__environment.reading===true&&__lastRender.worldDock&&__lastRender.world",'Explicit Talk returns movement to guarded conversation mode');

  // Browser fallback exercises the real complete composer/list rather than a
  // fixture-painted chat. Both high-text-scale orientations must expose world
  // pixels and readable conversation at the same time.
  for(const spec of [{name:'portrait',width:412,height:840},{name:'landscape',width:840,height:412}]){
    await load('fallback',spec.width,spec.height);
    await evaluate("document.getElementById('world-talk').click()");await wait("document.body.classList.contains('chat-open')&&document.getElementById('conversation-name').textContent==='ATLAS'");
    await check("__visible(__retainedCanvas)&&__visible(document.getElementById('conversation-screen'))&&__visible(document.getElementById('draft'))&&__visible(document.querySelector('.world-workspace-bar'))&&__environment.reading===true",spec.name+': actual fallback conversation, composer, contacts and retained world coexist');
    const geometry=await evaluate(`(()=>{const conversation=__rect(document.getElementById('conversation-screen')),canvas=__rect(__retainedCanvas),draft=__rect(document.getElementById('draft')),explore=__rect(document.getElementById('world-workspace-explore'));const sample={world:0,chat:0};for(let x=12;x<innerWidth;x+=24)for(let y=12;y<innerHeight;y+=24){const node=document.elementFromPoint(x,y);if(node?.closest('#environment-stage'))sample.world++;if(node?.closest('#conversation-screen'))sample.chat++;}return {conversation,canvas,draft,explore,sample,width:innerWidth,height:innerHeight,overflow:document.body.scrollWidth>innerWidth+1};})()`);
    assert.ok(geometry.sample.world>=8&&geometry.sample.chat>=20&&!geometry.overflow,spec.name+': both workspace regions are actually exposed '+JSON.stringify(geometry));results.push({label:spec.name+': world and conversation both exposed without horizontal overflow',passed:true,geometry});
    await check("(()=>{const r=__rect(document.getElementById('draft'));return r.width>=120&&r.height>=40&&r.x>=0&&r.right<=innerWidth+1&&r.y>=0&&r.bottom<=innerHeight+1;})()",spec.name+': enlarged-text full composer is visible within viewport');
    await capture(spec.name+'-text150-retained-conversation');
    for(const agent of ['main','forge','atlas','aera-new','vvv','daedalus']){
      await select(agent);await wait(`document.getElementById('conversation-name').textContent===${JSON.stringify({'main':'Commander','forge':'FORGE','atlas':'ATLAS','aera-new':'Æra','vvv':'VVV','daedalus':'Daedalus'}[agent])}&&document.getElementById('conversation-list').textContent.includes(${JSON.stringify('SYNTHETIC '+agent+' report')})`);
      await check(`document.getElementById('conversation-list').textContent.includes(${JSON.stringify('SYNTHETIC '+agent+' report')})&&__visible(__retainedCanvas)&&__environment.reading===true`,spec.name+': fallback '+agent+' contact switches real history without replacing world');
    }
    await evaluate("document.getElementById('draft').value='Fallback unsent DAEDALUS draft';document.getElementById('draft').dispatchEvent(new Event('input'));document.getElementById('world-workspace-explore').click()");await wait('__environment.active===true&&!__environment.reading');
    await evaluate("document.getElementById('world-workspace-talk').click()");await wait("document.body.classList.contains('chat-open')&&__environment.reading===true");
    await check("document.getElementById('draft').value==='Fallback unsent DAEDALUS draft'&&__retainedCanvas===document.getElementById('environment-canvas')&&__environment.performance.meshBuilds===__initialMeshBuilds",spec.name+': Explore/Talk retains unsent draft, canvas instance and scene geometry');
    await capture(spec.name+'-text150-returned-workspace');
  }
  await check("__requests.every(request=>request.method==='GET'||request.route==='/v1/diagnostics')",'Fallback UI navigation causes no model input or audio requests');
  assert.equal(errors.length,0,'No browser script exceptions: '+errors.join('\n'));results.push({label:'No browser script exceptions',passed:true});
  assert.ok(network.every(url=>url.startsWith(origin+'/')||url.startsWith('data:')||url.startsWith('blob:')),'All page network stays inside isolated static fixture');
  assert.equal(blocked.length,0,'No page attempted external or unbridged API network');results.push({label:'All page network remains isolated; no live API or remote host attempted',passed:true});
  const endedHashes=hashes();assert.deepEqual(endedHashes,sourceHashes,'Source changed during test; rerun against frozen candidate');
  if(fs.existsSync(path.join(output,'failure.json')))fs.renameSync(path.join(output,'failure.json'),path.join(output,'prior-failure-'+Date.now()+'.json'));
  fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({checks:results.length,results,errors,network,blocked,sourceHashes,endedHashes,scope:'Synthetic native bridge payload and real browser fallback composition; no gateway/device/native-panel acceptance'},null,2));
  console.log(JSON.stringify({checks:results.length,output,errors:errors.length,blocked:blocked.length}));
}catch(error){
  try{await capture?.('failure');}catch{}
  fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(error),checks:results.length,results,errors,network,blocked,sourceHashes,endedHashes:hashes()},null,2));throw error;
}finally{
  ws?.close();browser.kill();await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
