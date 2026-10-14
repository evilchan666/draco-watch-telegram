// Isolated changed UI path. No production connection, synthesis or replay.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),profile=fs.mkdtempSync(path.join(os.tmpdir(),'watch-execution-ui-'));
const server=http.createServer((req,res)=>{const file=path.join(root,req.url==='/'?'index.html':req.url.split('?')[0]);if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=19354,child=spawn('/usr/bin/chromium',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let ws,checks=0;const check=(value,label)=>{assert.ok(value,label);checks++;};
try{
  let pages;for(let i=0;i<80;i++){try{pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();if(pages.some(page=>page.type==='page'))break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  ws=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let serial=0;const pending=new Map(),errors=[];ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);const task=pending.get(message.id);if(!task)return;pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
  await call('Page.enable');await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:360,height:712,deviceScaleFactor:3,mobile:true});

  await call('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__requests=[];window.__plays=[];
    window.__snapshot=()=>{const now=Date.now(),agent='atlas',sessionId='session:atlas',sessionKey='agent:atlas:telegram:direct:8745908879';
      const event={id:'memory',agent,sessionKey,sessionId,runId:'run:atlas',callId:'call:memory',role:'assistant',text:'Searching retained memory · returned · 3 memory matches',kind:'Tool finished',timestamp:now,source:'authenticated-tool-status',publicAttested:true,evidenceRevision:'a'.repeat(64),evidenceSource:{kind:'recorded-history',sequence:42,projectionRevision:7,observedAt:now,freshUntil:now+15000},
        observation:{version:1,agent,sessionKey,sessionId,runId:'run:atlas',callId:'call:memory',tool:'memory_search',toolName:'mcp__memory__memory_search',phase:'result',redacted:true,operation:{kind:'memory-search',corpora:['wiki']},result:{matchCount:3,sourceCount:2,sourceKinds:['wiki'],disabled:false,stale:true,partial:true,truncated:true,warningCodes:['stale']},gaps:['arguments-withheld']}};
      return {connected:true,lastSuccess:now,selectedAgent:agent,agents:['main','forge','atlas','aera-new','vvv','daedalus'].map(id=>({id,status:'idle',sessionKey:id==='atlas'?sessionKey:'fixture:'+id,sessionId:'session:'+id,historyAvailable:true,capabilities:{}})),conversation:[],historyState:{status:'complete'},fleetActivity:[{id:'public',agent,sessionId,role:'assistant',text:'LATEST READABLE PUBLIC REPORT',timestamp:now-1000}],workActivity:[event],fleetCoverage:[{agent,available:true,status:'recorded-window',work:{available:true,partial:true,windowLimit:30,droppedKnown:2,upstreamDropped:null,sourceConflictCount:1}}]};};
    window.DracoNative={refresh(){},request(id,method,path){__requests.push({method,path});},stopMedia(){},playMedia(){__plays.push('play')}};`});
  await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
  for(let i=0;i<80&&!await evaluate('!!window.DracoWatch');i++)await new Promise(resolve=>setTimeout(resolve,100));
  await evaluate("onDracoSnapshot(__snapshot());DracoWatch.view('activity')");
  check(await evaluate("document.querySelector('#activity-list .timeline-item').textContent.includes('LATEST READABLE') && document.querySelector('.operation-label').textContent.includes('mcp__memory__memory_search')"),'Live feed shows original tool identity without evicting readable report');
  await evaluate("document.querySelector('.tool-status .activity-expand').click()");
  check(await evaluate("(()=>{const t=document.querySelector('.operation-facts').textContent;return t.includes('agent:atlas:telegram:direct:8745908879')&&t.includes('run:atlas')&&t.includes('call:memory')&&t.includes('memory-search · wiki')&&t.includes('Memory matches3')&&t.includes('Memory staleYes')&&t.includes('Memory warningsstale')&&t.includes('Source typeswiki');})()"),'expanded memory effect, supplied counts/corpus/warnings and exact identity are readable');
  check(await evaluate("(()=>{const t=document.querySelector('.operation-facts').textContent;return t.includes('Source sequenc'+'e42')&&t.includes('Projection revision7')&&t.includes('Evidence revision'+('a'.repeat(64)))&&t.includes('No audience-attested evidence link supplied');})()"),'source revision/sequence and precise citation gap are explicit');
  await evaluate("const updated=__snapshot();updated.workActivity[0].evidenceRevision='b'.repeat(64);updated.workActivity[0].observation.result.matchCount=4;onDracoSnapshot(updated)");
  check(await evaluate("!document.querySelector('.operation-facts') && document.querySelector('.activity-expand').getAttribute('aria-expanded')==='false'"),'changed evidence revision closes old expanded detail rather than reusing it');
  await evaluate("const wrong=__snapshot();wrong.workActivity[0].observation.sessionKey='other';onDracoSnapshot(wrong)");
  check(await evaluate("!document.querySelector('.tool-status')"),'mismatched explicit sessionKey cannot authorize tool detail');
  await evaluate("const unknown=__snapshot();unknown.workActivity[0].observation={...unknown.workActivity[0].observation,tool:'mcp__devices__status',toolName:'mcp__devices__status',operation:undefined,result:undefined,gaps:['unsupported-tool-detail']};onDracoSnapshot(unknown);document.querySelector('.tool-status .activity-expand').click()");
  check(await evaluate("document.querySelector('.operation-label').textContent.includes('mcp__devices__status') && document.querySelector('.operation-facts').textContent.includes('safe details are not supported')"),'unknown safe recorded tool stays visible with truthful unsupported detail');
  await evaluate("const process=__snapshot();process.workActivity[0].observation={...process.workActivity[0].observation,tool:'exec_command',toolName:'functions.exec_command',operation:undefined,result:{processId:'987',durationMs:1250,exitCode:0},gaps:['arguments-withheld']};process.workActivity[0].evidenceRevision='c'.repeat(64);onDracoSnapshot(process);document.querySelector('.tool-status .activity-expand').click()");
  check(await evaluate("(()=>{const t=document.querySelector('.operation-facts').textContent;return t.includes('Process / task ID987')&&t.includes('Duration (ms)1250')&&t.includes('Command exit code0');})()"),'explicit native return duration/process/outcome survives client rendering');
  await evaluate("document.getElementById('activity-work').click()");
  check(await evaluate("document.querySelector('.work-card[data-agent=atlas]').textContent.includes('upstream gaps unknown')&&document.querySelector('.work-card[data-agent=atlas]').textContent.includes('conflicting facts withheld')"),'window truncation/unknown upstream gap/source conflict are visible');
  await evaluate("const partial=__snapshot();partial.fleetActivity[0].delivery={state:'delivered',platformMessageId:'123',legs:{text:{state:'accepted'},voice:{state:'unknown'}}};onDracoSnapshot(partial)");
  check(await evaluate("document.querySelector('#activity-list [data-message-id=public]').textContent.includes('readable text accepted · speech unconfirmed')"),'readable and speech delivery legs remain independent');
  await evaluate("const expiring=__snapshot();expiring.workActivity[0].evidenceSource.freshUntil=Date.now()+100;expiring.fleetCoverage[0].work.freshUntil=Date.now()+100;onDracoSnapshot(expiring)");
  await new Promise(resolve=>setTimeout(resolve,1150));
  check(await evaluate("!document.querySelector('.tool-status')&&document.getElementById('connection-label').textContent==='Connected'&&document.getElementById('activity-observation-note').textContent.includes('expired')"),'source-specific15s expiry revokes execution even while global connection remains fresh');
  await evaluate("onDracoConnection({state:'offline',message:'Disconnected'})");
  check(await evaluate("!document.querySelector('.tool-status') && document.getElementById('activity-observation-note').textContent.includes('not live')&&document.querySelector('#activity-list [data-message-id=public]').textContent.includes('Last received')"),'stale observation revokes tool detail but retains labelled public text');
  check(await evaluate("__requests.every(request=>request.method==='GET')&&__plays.length===0"),'read-only expansion never sends input, synthesis or replay');
  check(errors.length===0,'no uncaught UI errors');
  console.log(JSON.stringify({checks,passed:true,productionInput:false,historicalPlayback:false}));
}finally{ws?.close();child.kill();await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});}
