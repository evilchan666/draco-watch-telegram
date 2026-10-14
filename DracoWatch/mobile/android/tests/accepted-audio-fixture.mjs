// Manual attachment E2E fixture. Fake authenticated history, synthetic signal;
// never connects to an agent, serving gateway, production token or speech engine.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DesktopGateway} from '../../lib/gateway.mjs';
import {SPECS,sessionKey} from '../../lib/bridge_core.mjs';
import {createPhoneServer} from '../../server.mjs';
process.umask(0o077);
const dir=path.resolve('mobile/runtime/forge-media-repair/android-fixture');fs.mkdirSync(dir,{recursive:true,mode:0o700});
const media=path.join(dir,'media');fs.mkdirSync(media,{mode:0o700});
const file=path.join(media,'synthetic.wav'),rate=16000,count=rate*20,buffer=Buffer.alloc(44+count*2);
buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(count*2,40);
for(let i=0;i<count;i++)buffer.writeInt16LE(Math.round(1000*Math.sin(2*Math.PI*440*i/rate)),44+i*2);fs.writeFileSync(file,buffer);
const at=Date.now()+20,key=sessionKey('forge'),physical='fixture-audio-session';
const meta=(id,seq)=>({id,seq,runId:'fixture-run',sessionKey:key,sessionId:physical,recordTimestampMs:at+seq});
const records=[{role:'assistant',__openclaw:meta('fixture-text-call',1),content:[{type:'toolCall',name:'message',id:'fixture-text-tool',arguments:{action:'send',accountId:'forge',channel:'telegram',target:'8745908879',message:'Isolated readable report. Synthetic signal, no agent connection.'}}]},
  {role:'toolResult',toolName:'message',toolCallId:'fixture-text-tool',__openclaw:meta('fixture-text-result',2),content:[{type:'toolResult',content:JSON.stringify({ok:true,messageId:'9001',chatId:'8745908879'})}]},
  {role:'assistant',__openclaw:meta('fixture-audio-call',3),content:[{type:'toolCall',name:'message',id:'fixture-audio-tool',arguments:{action:'send',accountId:'forge',channel:'telegram',target:'8745908879',asVoice:true,media:file,replyTo:'9001'}}]},
  {role:'toolResult',toolName:'message',toolCallId:'fixture-audio-tool',__openclaw:meta('fixture-audio-result',4),content:[{type:'toolResult',content:JSON.stringify({ok:true,messageId:'9002',chatId:'8745908879',receipt:{replyToId:'9001'}})}]}];
const log=value=>fs.appendFileSync(path.join(dir,'events.jsonl'),JSON.stringify({at:Date.now(),...value})+'\n');
const adapter=new DesktopGateway({runtimeDir:path.join(dir,'cache'),sanitize:x=>x,acceptedAudioRoots:{forge:media},rpc:async(method,params)=>{
  if(method==='sessions.list')return {sessions:SPECS.map(spec=>({key:sessionKey(spec.id),agentId:spec.id,sessionId:spec.id==='forge'?physical:'fixture-'+spec.id,hasActiveRun:false,deliveryContext:{channel:'telegram',accountId:spec.id==='main'?'default':spec.id,to:'telegram:8745908879'}}))};
  if(method==='chat.history'){log({state:'history-read',agent:params.sessionKey.split(':')[1],anchor:params.messageId??null});return {sessionKey:params.sessionKey,sessionId:params.sessionKey===key?physical:'fixture-'+params.sessionKey.split(':')[1],messages:params.sessionKey===key?(params.messageId?records.filter(row=>row.__openclaw.id===params.messageId):records):[],hasMore:false};}
  throw Error('Fixture rejects all non-read RPCs');
}});await adapter.start();await adapter.native.replay('forge');
const original=adapter.media.bind(adapter);adapter.media=async request=>{const response=await original(request);log({state:'authorized-manual-download',agent:request.agent,messageId:request.messageId,bytes:response.buffer.length,sha256:response.sha256});return response;};
const cert=path.join(dir,'cert.pem'),privateKey=path.join(dir,'key.pem');
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',privateKey,'-out',cert,'-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore'});
const token='synthetic-watch-manual-audio-token-3197',pin=crypto.createHash('sha256').update(new crypto.X509Certificate(fs.readFileSync(cert)).raw).digest('hex');
fs.writeFileSync(path.join(dir,'profile.json'),JSON.stringify({url:'https://127.0.0.1:19816',token,certificateSha256:pin}));
const server=createPhoneServer({adapter,token,key:fs.readFileSync(privateKey),cert:fs.readFileSync(cert)});
server.listen(19816,'127.0.0.1',()=>console.log(JSON.stringify({ready:true,port:19816,pin,syntheticOnly:true})));
process.on('SIGTERM',()=>{adapter.stop();server.close(()=>process.exit(0));});
