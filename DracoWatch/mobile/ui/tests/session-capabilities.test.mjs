// Real app DOM/native payload with an isolated synthetic Android transport.
// Run: node mobile/ui/tests/session-capabilities.test.mjs
// No gateway, production input, media, speech or package build is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ui=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'watch-session-capabilities-'));
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
  const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(50);}throw Error('Capability fixture condition failed: '+expression+' '+JSON.stringify(errors));};
  const check=async(expression,label)=>results.push({label,passed:await evaluate(expression)===true});
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:412,height:892,deviceScaleFactor:3,mobile:true});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__requests=[];window.__capRequests=[];window.__calls=[];window.__last={};
    window.__session='physical-atlas-a';window.__connected=true;
    window.__ids=['main','forge','atlas','aera-new','vvv','daedalus'];
    window.__caps={send:true,queue:true,steer:false,strictSteer:false,abort:true,attachments:true,voice:true,reply:true,speech:true,commands:true};
    localStorage.setItem('draco-watch-client-v2',JSON.stringify({preferences:{automaticSpeech:false,echoToTelegram:false},drafts:{atlas:'Exact unsent draft survives session replacement'}}));
    window.__message=()=>({id:'report:'+__session,agent:'atlas',sessionId:__session,role:'assistant',kind:'reply',text:'Genuine-looking authenticated public fixture report',timestamp:Date.now()-1000,publicAttested:true,source:'authenticated-native-history'});
    window.__snapshot=()=>({connected:__connected,lastSuccess:Date.now(),selectedAgent:'atlas',agents:__ids.map(id=>({id,status:'idle',conversationStatus:'idle',sessionKey:'agent:'+id+':telegram:direct:8745908879',sessionId:id==='atlas'?__session:'physical-'+id,historyAvailable:true,capabilities:__caps,controlTargets:[],telemetry:{activeSessions:0,queuedSessions:0}})),conversation:[__message()],historyState:{status:'complete'},historyHasMore:false});
    window.__emit=()=>onDracoSnapshot(__snapshot());
    window.__replyCap=(index,sessionId=__capRequests[index].sessionId,extra={})=>onDracoResponse({id:__capRequests[index].id,ok:true,status:200,data:{...__caps,agent:'atlas',sessionId,...extra}});
    window.__advanced=()=>__last.can?.attachments===true&&__last.can.voice===true&&__last.can.speech===true&&__last.messages?.some(m=>m.id==='report:'+__session&&m.canReply&&m.canRead);
    window.__disabled=()=>__last.can?.attachments===false&&__last.can.voice===false&&__last.can.speech===false&&__last.messages?.every(m=>!m.canReply&&!m.canRead);
    window.DracoNative={
      refresh(){setTimeout(__emit,0)},
      request(id,method,route,json){
        __requests.push({id,method,route});
        if(route.startsWith('/v1/capabilities'))__capRequests.push({id,sessionId:__session});
        else if(method==='GET'&&route.startsWith('/v1/history'))setTimeout(()=>onDracoResponse({id,ok:true,status:200,data:{agent:'atlas',sessionId:__session,messages:[__message()],historyState:{status:'complete'},hasMore:false}}),0);
      },
      renderTelegram(json){__last=JSON.parse(json)},stopMedia(){},hideKeyboard(){},
      playMedia(){__calls.push('play')},startRecording(){__calls.push('record')}
    };
  `});
  await call('Page.navigate',{url:origin+'/'});
  await wait('!!window.DracoWatch&&__capRequests.length>=1');
  await evaluate('for(let i=0;i<__capRequests.length;i++)__replyCap(i);DracoWatch.select("atlas")');
  await wait('__last.chat&&__advanced()');
  await check('__last.sessionId==="physical-atlas-a"&&__last.draft==="Exact unsent draft survives session replacement"','initial exact-session capability read enables attachment, recording, reply and manual speech without losing draft');

  await evaluate('__beforeRollover=__capRequests.length;__session="physical-atlas-b";__emit()');
  await wait('__last.sessionId==="physical-atlas-b"&&__capRequests.length>__beforeRollover');
  await check('__disabled()&&__capRequests.at(-1).sessionId==="physical-atlas-b"','physical-session rollover evicts stale cached permissions and requests replacement capabilities instead of remaining permanently disabled');
  await evaluate('__replyCap(__capRequests.length-1)');
  await wait('__advanced()');
  await check('__last.messages.every(m=>m.sessionId==="physical-atlas-b")&&__last.draft==="Exact unsent draft survives session replacement"','fresh replacement capability response restores advanced features only on replacement history and preserves exact unsent draft');

  // Retain one request from B, then replace its physical session before its reply.
  await evaluate('onDracoConnection({state:"offline",message:"Synthetic bounded connection outage"});__beforeOldRead=__capRequests.length;__emit()');
  await wait('__capRequests.length>__beforeOldRead');
  await evaluate('__oldIndex=__capRequests.length-1;__session="physical-atlas-c";__beforeCurrentRead=__capRequests.length;__emit()');
  await wait('__last.sessionId==="physical-atlas-c"&&__capRequests.length>__beforeCurrentRead');
  await evaluate('__currentIndex=__capRequests.length-1;__replyCap(__currentIndex)');
  await wait('__advanced()');
  await evaluate('__replyCap(__oldIndex,"physical-atlas-b",{attachments:false,voice:false,reply:false,speech:false})');
  await pause(100);
  await check('__advanced()&&__last.sessionId==="physical-atlas-c"','late response for prior physical session cannot overwrite newer exact-session capabilities');
  await check('__last.messages.every(m=>m.sessionId==="physical-atlas-c")','late capability response cannot retarget displayed conversation history');

  // An earlier request cannot be relabelled as current by its response body.
  await evaluate('onDracoConnection({state:"offline"});__beforeSpoofRead=__capRequests.length;__emit()');
  await wait('__capRequests.length>__beforeSpoofRead');
  await evaluate('__spoofIndex=__capRequests.length-1;__session="physical-atlas-d";__beforeDRead=__capRequests.length;__emit()');
  await wait('__capRequests.length>__beforeDRead');
  await evaluate('__replyCap(__capRequests.length-1)');
  await wait('__advanced()');
  await evaluate('__replyCap(__spoofIndex,"physical-atlas-d",{attachments:false,voice:false,reply:false,speech:false})');
  await pause(100);
  await check('__advanced()','response claiming current session is still rejected when its request captured the previous physical session');

  await evaluate('onDracoConnection({state:"offline"});__beforeOfflineRead=__capRequests.length;__emit()');
  await wait('__capRequests.length>__beforeOfflineRead');
  await evaluate('__offlineIndex=__capRequests.length-1;__connected=false;onDracoConnection({state:"offline",message:"Synthetic offline during capability read"});__replyCap(__offlineIndex)');
  await pause(100);
  await check('__disabled()&&!__last.live&&!__last.can.send&&!__last.can.queue&&!__last.can.abort','disconnect disables all live actions and late capability success cannot re-enable them');
  await check('__last.draft==="Exact unsent draft survives session replacement"&&__requests.every(r=>r.method==="GET"||r.route==="/v1/diagnostics")&&__calls.length===0','rollover and reconnect never submit input, start speech/media/recording or erase saved draft');
  await evaluate('__beforeRecovery=__capRequests.length;__connected=true;__emit()');
  await wait('__capRequests.length>__beforeRecovery');
  await evaluate('__replyCap(__capRequests.length-1)');
  await wait('__advanced()');
  await check('__last.live&&__last.sessionId==="physical-atlas-d"','fresh authenticated recovery obtains capabilities again without relaunch or message replay');
  results.push({label:'browser traffic stayed on isolated fixture origin',passed:network.every(url=>url.startsWith(origin+'/')||url.startsWith('data:'))});
  results.push({label:'no uncaught application exceptions',passed:errors.length===0});
}catch(error){results.push({label:'focused browser harness completed',passed:false,error:error.stack||String(error)});}
finally{
  ws?.close();browser.kill();await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),pause(1500)]);
  await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
const failed=results.filter(result=>!result.passed);
console.log(JSON.stringify({boundary:'real app DOM/native payload, synthetic isolated transport only',checks:results.length,passed:failed.length===0,results,errors,productionInput:false,realMedia:false,synthesis:false},null,2));
if(failed.length)process.exitCode=1;
