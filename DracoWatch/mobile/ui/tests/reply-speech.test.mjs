import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const scope={window:{},Date,crypto};
vm.runInNewContext(fs.readFileSync(new URL('../reply-speech.js',import.meta.url),'utf8'),scope);
const {ReplySpeech}=scope.window.DracoReplySpeech;
const tick=()=>new Promise(r=>setImmediate(r));
const message=(id,extra={})=>({id,role:'assistant',kind:'reply',text:'Public '+id,sessionId:'session-a',timestamp:1010,
  publicAttested:true,source:'authenticated-native-history',speechFinal:{runId:'run-'+id},...extra});
function fixture(){let now=1000,n=0;const jobs=[],plays=[],statuses=[],stops=[];
  const queue=new ReplySpeech({now:()=>now,id:()=>String(++n),prepare:body=>new Promise((resolve,reject)=>jobs.push({body,resolve,reject})),play:(path,id)=>plays.push({path,id}),stop:()=>stops.push(1),status:value=>statuses.push(value)});
  const context={agent:'aera-new',sessionId:'session-a',ready:true,enabled:true};
  const sync=(rows,patch={})=>queue.sync({...context,...patch},rows);
  const complete=index=>{const job=jobs[index];job.resolve({...job.body,path:'/v1/speech/'+'a'.repeat(64)});};
  sync([message('hydrated',{timestamp:800})]);now=1020;
  return {queue,jobs,plays,statuses,stops,sync,complete,now:value=>now=value};
}
test('hydration and repeated reads stay silent; only a fresh final is voiced once',async()=>{
  const f=fixture();f.sync([message('hydrated',{timestamp:800})]);assert.equal(f.jobs.length,0);
  f.sync([message('one')]);f.sync([message('one')]);assert.equal(f.jobs.length,1);
  assert.equal(f.jobs[0].body.agent,'aera-new');assert.equal(f.jobs[0].body.sessionId,'session-a');assert.equal(f.jobs[0].body.messageId,'one');
  f.complete(0);await tick();assert.equal(f.plays.length,1);f.queue.playback({id:f.plays[0].id,state:'ended'});f.sync([message('one')]);assert.equal(f.jobs.length,1);
});
test('reconnect, pause, session change and selected-agent change discard in-flight speech and establish a new silent baseline',async()=>{
  for(const patch of [{ready:false},{agent:'forge'},{sessionId:'session-b'},{enabled:false}]){
    const f=fixture();f.sync([message('one')]);f.sync([message('one')],patch);f.complete(0);await tick();assert.equal(f.plays.length,0);
    f.sync([message('one')]);assert.equal(f.jobs.length,1);
  }
});
test('older pages, progress, user text, private records, other sessions and nonfinal tool reports cannot auto-speak',()=>{
  const f=fixture();for(const [i,patch] of [{timestamp:500},{kind:'progress'},{role:'user'},{publicAttested:false},{source:'toolResult'},{sessionId:'other'},{speechFinal:null},{timestamp:9000}].entries())f.sync([message('bad-'+i,patch)]);
  assert.equal(f.jobs.length,0);
});
test('a progress-to-final change remains eligible but duplicate logical-run records are not replayed',async()=>{
  const f=fixture();f.sync([message('progress',{kind:'progress',speechFinal:null})]);f.sync([message('final',{speechFinal:{runId:'logical-run'}})]);
  f.complete(0);await tick();f.queue.playback({id:f.plays[0].id,state:'ended'});f.sync([message('another-record',{speechFinal:{runId:'logical-run'}})]);assert.equal(f.jobs.length,1);
});
test('new finals are serialized in public timestamp order, never overlapped',async()=>{
  const f=fixture();const rows=[message('two',{timestamp:1015}),message('one')];f.sync(rows);assert.equal(f.jobs.length,1);assert.equal(f.jobs[0].body.messageId,'one');
  f.complete(0);await tick();f.queue.playback({id:f.plays[0].id,state:'playing'});assert.equal(f.jobs.length,1);
  f.queue.playback({id:f.plays[0].id,state:'ended'});assert.equal(f.jobs[1].body.messageId,'two');f.complete(1);await tick();assert.equal(f.plays.length,2);
});
test('wrong asset agent/session/message identity fails visibly and never reaches native playback',async()=>{
  for(const patch of [{agent:'forge'},{sessionId:'other'},{messageId:'other'},{path:'https://unsafe'}]){
    const f=fixture();f.sync([message('one')]);f.jobs[0].resolve({...f.jobs[0].body,path:'/v1/speech/'+'a'.repeat(64),...patch});await tick();assert.equal(f.plays.length,0);assert.equal(f.statuses.at(-1).state,'error');
  }
});
test('Stop clears pending/active automatic voice without input replay; explicit Read aloud remains available',async()=>{
  const f=fixture(),one=message('one');f.sync([one,message('two')]);f.complete(0);await tick();f.queue.cancel();assert.equal(f.stops.length,1);assert.equal(f.jobs.length,1);
  f.sync([one,message('two')]);assert.equal(f.jobs.length,1);assert.equal(f.queue.manual(one),true);f.complete(1);await tick();assert.equal(f.plays.length,2);
});
test('manual read-aloud works with auto disabled but remains public/current-session bound',async()=>{
  const f=fixture(),one=message('one',{speechFinal:null});f.sync([one],{enabled:false});assert.equal(f.queue.manual(one),true);
  f.complete(0);await tick();assert.equal(f.plays.length,1);assert.equal(f.queue.manual(message('private',{publicAttested:false})),false);
});
test('changed or removed public text cancels generation; a stale native callback cannot stop newer audio',async()=>{
  const f=fixture();f.sync([message('one')]);f.sync([message('one',{text:'changed'})]);f.complete(0);await tick();assert.equal(f.plays.length,0);
  f.sync([message('one',{text:'changed'}),message('two')]);f.complete(1);await tick();assert.equal(f.queue.playback({id:'old-native-id',state:'error'}),false);assert.equal(f.queue.active.message.id,'two');
});
test('synthesis failure is visible and is not automatically retried; deliberate manual retry is allowed',async()=>{
  const f=fixture(),one=message('one');f.sync([one]);f.jobs[0].reject(Error('Voice engine unavailable'));await tick();assert.equal(f.statuses.at(-1).state,'error');f.sync([one]);assert.equal(f.jobs.length,1);f.queue.manual(one);assert.equal(f.jobs.length,2);
});
test('historical page hydration is silent but a subsequent fresh final still speaks',()=>{
  const f=fixture();f.sync([message('page-new-to-view')],{hydrate:true});assert.equal(f.jobs.length,0);
  f.sync([message('page-new-to-view'),message('genuinely-fresh',{timestamp:1015})]);assert.equal(f.jobs.length,1);assert.equal(f.jobs[0].body.messageId,'genuinely-fresh');
});

test('omitted/default preference is manual-first across opening, fresh receive, reconnect and resume',()=>{
  const jobs=[],queue=new ReplySpeech({prepare:body=>jobs.push(body),play:()=>{},stop:()=>{},status:()=>{},now:()=>2000,id:()=> 'one'});
  const context={agent:'aera-new',sessionId:'session-a',ready:true};
  queue.sync(context,[message('first')]);queue.sync(context,[message('fresh',{timestamp:2000})]);
  queue.sync({...context,ready:false},[]);queue.sync(context,[message('fresh',{timestamp:2000})]);queue.sync(context,[message('newer',{timestamp:2000})]);
  assert.equal(jobs.length,0);assert.equal(queue.enabled,false);
});
test('manual phases retain exact report scope/source and cancellation does not play a late asset',async()=>{
  const f=fixture(),m=message('manual');f.sync([m],{enabled:false});f.queue.manual(m);
  const preparing=f.statuses.at(-1);assert.equal(preparing.agent,'aera-new');assert.equal(preparing.sessionId,'session-a');assert.equal(preparing.messageId,'manual');assert.equal(preparing.source,'synthesis');assert.equal(preparing.automatic,false);assert.ok(preparing.playbackId);
  f.queue.cancel();f.complete(0);await tick();assert.equal(f.plays.length,0);assert.equal(f.statuses.at(-1).state,'stopped');
});
