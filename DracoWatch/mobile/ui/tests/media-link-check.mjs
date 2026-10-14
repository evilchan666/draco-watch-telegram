// Isolated changed UI path. No production connection, synthesis or replay.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),profile=fs.mkdtempSync(path.join(os.tmpdir(),'watch-media-ui-'));
const server=http.createServer((req,res)=>{const file=path.join(root,req.url==='/'?'index.html':req.url.split('?')[0]);if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=19349,child=spawn('/usr/bin/chromium',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port='+port,'--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
let ws,checks=0;const check=(value,label)=>{assert.ok(value,label);checks++;};
try{
  let pages;for(let i=0;i<80;i++){try{pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();if(pages.some(page=>page.type==='page'))break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  ws=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let serial=0;const pending=new Map(),errors=[];ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);const task=pending.get(message.id);if(!task)return;pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
  await call('Page.enable');await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:360,height:712,deviceScaleFactor:3,mobile:true});
  await call('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__requests=[];window.__plays=[];window.__caps={speech:true,reply:true,send:true,queue:true};
    window.__snapshot=()=>{const now=Date.now(),agent='forge',sessionId='session:forge',source='authenticated-native-history';
      const report={id:'readable',agent,sessionId,source,publicAttested:true,role:'assistant',kind:'Confirmed report',text:'VERIFIED READABLE REPORT '+('full report text '.repeat(30)),timestamp:now-1000,delivery:{state:'delivered',platformMessageId:'2463'}};
      const audio={id:'voice-only',agent,sessionId,source,publicAttested:true,role:'assistant',kind:'Attachment only',text:'',timestamp:now,delivery:{state:'delivered',platformMessageId:'2465',replyToPlatformMessageId:'2463'},replyLink:{status:'available',platformMessageId:'2463',messageId:'readable'},media:[{kind:'audio',label:'Voice report',index:0,downloadAvailable:false,unavailableReason:'No public managed media byte reference is available'}]};
      return {connected:true,lastSuccess:now,selectedAgent:agent,agents:['main','forge','atlas','aera-new','vvv','daedalus'].map(id=>({id,status:'idle',sessionId:'session:'+id,historyAvailable:true,capabilities:__caps})),conversation:[{...report,kind:'reply'},{...audio,kind:'media'}],historyState:{status:'complete'},fleetActivity:[report,audio],fleetCoverage:[{agent,available:true,status:'recorded-window'}]};};
    window.DracoNative={refresh(){},stopMedia(){},playMedia(path,id){__plays.push({path,id})},request(id,method,path){__requests.push({method,path});if(path.startsWith('/v1/capabilities'))setTimeout(()=>onDracoResponse({id,ok:true,data:{...__caps,agent:'forge',sessionId:'session:forge'}}),0);}};`});
  await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
  for(let i=0;i<80&&!await evaluate('!!window.DracoWatch');i++)await new Promise(resolve=>setTimeout(resolve,100));
  await evaluate("onDracoSnapshot(__snapshot());DracoWatch.view('activity')");
  check(await evaluate("document.querySelector('#activity-list [data-message-id=voice-only]').textContent.includes('Attachment only') && document.querySelector('#activity-list [data-message-id=voice-only]').textContent.includes('Audio unavailable in app') && !document.querySelector('#activity-list [data-message-id=voice-only]').textContent.includes('Confirmed report')"),'Activity labels the empty receipt as unavailable audio, not a report');
  await evaluate("window.__beforeLinkReads=__requests.length;document.querySelector('#activity-list [data-message-id=voice-only] .linked-text').click()");
  check(await evaluate("document.querySelector('#activity-list [data-message-id=voice-only] details[open]').textContent.includes('VERIFIED READABLE REPORT') && __requests.length===__beforeLinkReads && __plays.length===0"),'linked Activity text expands locally without request/playback');
  await evaluate("DracoWatch.view('chats')");
  check(await evaluate("[...document.querySelectorAll('.agent-card')].find(card=>card.querySelector('.card-name').textContent.startsWith('FORGE')).querySelector('.card-preview').textContent.includes('Audio unavailable in app')"),'roster does not replace missing text with a blank or older report');
  await evaluate("DracoWatch.view('activity');document.getElementById('activity-work').click()");
  check(await evaluate("document.querySelector('.work-card[data-agent=forge]').textContent.includes('Audio unavailable in app')"),'Work details retain the same missing-audio status');
  await evaluate("DracoWatch.select('forge')");await new Promise(resolve=>setTimeout(resolve,80));
  check(await evaluate("document.querySelector('#conversation-list [data-message-id=voice-only]').textContent.includes('No readable reply text accompanied') && document.querySelector('#conversation-list [data-message-id=voice-only] .linked-text') && !document.querySelector('#conversation-list [data-message-id=voice-only] .message-read-aloud') && ![...document.querySelectorAll('#conversation-list [data-message-id=voice-only] button')].some(button=>button.textContent.includes('▶ Voice report'))"),'Chat shows missing text and readable link without a fake playback or speech action');
  await evaluate("document.querySelector('#conversation-list [data-message-id=voice-only] .linked-text').click()");
  check(await evaluate("document.querySelector('#conversation-list [data-message-id=voice-only] details[open]').textContent.includes('VERIFIED READABLE REPORT') && __plays.length===0 && __requests.every(row=>row.method==='GET'&&row.path.startsWith('/v1/capabilities'))"),'Chat text navigation neither plays old audio nor scans history');
  await evaluate("document.querySelector('#conversation-list [data-message-id=voice-only] .message-menu').click()");
  check(await evaluate("!document.getElementById('message-action-list').textContent.includes('Copy message') && !document.getElementById('message-action-list').textContent.includes('Read aloud')"),'media-only action menu cannot copy or speak nonexistent prose');
  await evaluate("document.getElementById('message-actions-close').click();const withdrawn=__snapshot();withdrawn.conversation=withdrawn.conversation.filter(row=>row.id!=='readable');onDracoSnapshot(withdrawn)");
  check(await evaluate("!document.querySelector('#conversation-list .linked-text') && document.getElementById('conversation-list').textContent.includes('outside the available public window')"),'withdrawal removes the cached link even when stale link metadata remains');
  await evaluate("const mismatch=__snapshot();mismatch.conversation[0].sessionId='other-session';onDracoSnapshot(mismatch)");
  check(await evaluate("!document.querySelector('#conversation-list .linked-text')"),'cross-session target cannot be linked in Chat');
  await evaluate("const mixed=__snapshot();mixed.conversation[1].media.push({kind:'image',downloadAvailable:true,url:'/v1/media?synthetic-image',index:1});mixed.fleetActivity[1].media=mixed.conversation[1].media;onDracoSnapshot(mixed);DracoWatch.close();DracoWatch.view('activity')");
  check(await evaluate("document.querySelector('#activity-list [data-message-id=voice-only]').textContent.includes('Audio unavailable in app') && !document.querySelector('#activity-list [data-message-id=voice-only]').textContent.includes('Audio available')"),'a downloadable image cannot relabel unavailable audio as playable');
  await evaluate("const crowded=__snapshot();crowded.fleetActivity[0].timestamp=Date.now()-100000;crowded.fleetActivity.push(...Array.from({length:150},(_,index)=>({...crowded.fleetActivity[0],id:'newer-'+index,text:'Independent newer report',timestamp:Date.now()-index,delivery:undefined})));onDracoSnapshot(crowded);document.querySelector('#activity-list [data-message-id=voice-only] .linked-text').click()");
  check(await evaluate("!document.querySelector('#activity-list [data-message-id=readable]') && document.querySelector('#activity-list [data-message-id=voice-only] details[open]').textContent.includes('VERIFIED READABLE REPORT') && __plays.length===0"),'a target beyond the 120-row display limit opens read-only in its attachment card');
  await evaluate("onDracoSnapshot(__snapshot());DracoWatch.close();DracoWatch.view('activity');onDracoConnection({state:'offline'})");
  check(await evaluate("document.querySelector('#activity-list [data-message-id=voice-only]').textContent.includes('not live') && document.querySelector('#activity-list [data-message-id=voice-only]').textContent.includes('unavailable in app') && __plays.length===0"),'disconnect retains truthful status without starting an audio backlog');
  await evaluate("onDracoSnapshot(__snapshot());DracoWatch.view('settings');document.getElementById('display-scale').value='150';document.getElementById('display-scale').dispatchEvent(new Event('input',{bubbles:true}));DracoWatch.view('activity')");
  check(await evaluate("document.documentElement.scrollWidth<=innerWidth && [...document.querySelectorAll('#activity-list .linked-text')].every(button=>button.getBoundingClientRect().height>=44)"),'enlarged text retains readable status and reachable link without overflow');
  check(errors.length===0,'no uncaught UI errors');
  console.log(JSON.stringify({checks,passed:true,productionInput:false,historicalPlayback:false}));
}finally{ws?.close();child.kill();await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});}
