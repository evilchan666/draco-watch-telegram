import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=fs.readFileSync(new URL('../client-state.js',import.meta.url),'utf8');
const scope={window:{},Date,JSON};vm.runInNewContext(source,scope);
const {mergeConversation,localRequestRows,conversationDay,ClientState}=scope.window.DracoState;
const target={agent:'atlas',sessionId:'physical-atlas'};
const plain=value=>JSON.parse(JSON.stringify(value));
const submission=(id='request-01',extra={})=>({id,agent:'atlas',path:'/v1/message',state:'accepted',at:1000,note:'queued',
  body:{agent:'atlas',sessionId:'physical-atlas',idempotencyKey:id,text:'Exact original body\nwith **literal** markup.',mode:'send'},...extra});
const publicRow=(id='native-01',extra={})=>({id,agent:'atlas',sessionId:'physical-atlas',role:'user',text:submission().body.text,
  timestamp:1200,publicAttested:true,source:'authenticated-native-history',...extra});

test('accepted request body remains fully visible, local and admission-only when no native record exists',()=>{
  const row=mergeConversation([], [submission()],target)[0];
  assert.equal(row.id,'request-01');assert.equal(row.text,submission().body.text);assert.equal(row.role,'user');
  assert.equal(row.kind,'Local request');assert.equal(row.localSubmission,true);assert.equal(row.timestamp,1000);
  assert.equal(row.submissionState,'accepted');assert.match(row.submissionNote,/Gateway admission acknowledged/);
  assert.match(row.submissionNote,/Reading, start, reply and completion are not established/);
  assert.equal(row.source,'device-local-submission');assert.equal(row.publicAttested,false);
  assert.equal(row.replyAvailable,false);assert.equal(row.canPin,false);assert.equal(row.canReply,false);assert.equal(row.canRead,false);
  assert.deepEqual(plain(row.media),[]);
});
test('pending, uncertain, rejected and queued admissions have distinct truthful labels without body loss',()=>{
  for(const [state,phrase] of [['pending','admission not yet confirmed'],['uncertain','Admission unconfirmed'],['rejected','Request rejected']]) {
    const row=localRequestRows([submission('request-01',{state,note:'Specific admission error'})],target)[0];
    assert.equal(row.submissionState,state);assert.equal(row.text,submission().body.text);assert.ok(row.submissionNote.includes(phrase));
    if(state!=='pending')assert.ok(row.submissionNote.includes('Specific admission error'));
  }
  assert.match(localRequestRows([submission('request-01',{outcome:{status:'queued'}})],target)[0].submissionNote,/queued follow-up/);
});
test('only exact authenticated user request key plus unchanged complete body deduplicates',()=>{
  const native=publicRow('native-01',{requestId:'request-01',runId:'run-01'});
  const merged=mergeConversation([native],[submission()],target);
  assert.equal(merged.length,1);assert.equal(merged[0].id,'native-01');assert.equal(merged[0].localSubmission,undefined);
  for(const patch of [{requestId:undefined},{requestId:'other-key'},{role:'assistant'},{text:'Changed body'},{excerpt:true}])
    assert.equal(mergeConversation([{...native,...patch}],[submission()],target).length,2);
});
test('legacy equal IDs, timestamps or equal text never reconcile without authenticated requestId',()=>{
  const native=publicRow('request-01',{timestamp:1000,idempotencyKey:'request-01'});
  const merged=mergeConversation([native],[submission()],target);
  assert.equal(merged.length,2);assert.equal(merged.filter(row=>row.localSubmission).length,1);
});
test('same text with distinct request keys remains two requests, and conflicting keyed bodies keep local custody',()=>{
  assert.equal(mergeConversation([],[submission('request-01'),submission('request-02')],target).length,2);
  const rows=[publicRow('matching',{requestId:'request-01'}),publicRow('conflict',{requestId:'request-01',text:'Conflicting body'})];
  assert.equal(mergeConversation(rows,[submission()],target).length,3);
});
test('wrong agents, physical sessions and unauthenticated histories cannot import or deduplicate',()=>{
  const rows=[publicRow('wrong-agent',{agent:'forge'}),publicRow('wrong-session',{sessionId:'physical-forge'}),
    publicRow('raw',{source:'raw-history'}),publicRow('unattested',{publicAttested:false})];
  assert.equal(mergeConversation(rows,[submission()],target).length,1);
  const body=submission().body;
  const locals=[submission('wrong-agent',{agent:'forge'}),submission('wrong-body-agent',{body:{...body,agent:'forge'}}),
    submission('wrong-session',{body:{...body,sessionId:'old-session'}}),submission('missing-session',{body:{...body,sessionId:undefined}})];
  assert.equal(mergeConversation([],locals,target).length,0);
  assert.equal(mergeConversation([publicRow()],[submission()],{agent:'atlas',sessionId:'replacement-session'}).length,0);
  assert.equal(mergeConversation([publicRow()],[submission()],{agent:'unknown',sessionId:'physical-atlas'}).length,0);
});
test('abort controls and unknown or corrupted custody never become fake user messages',()=>{
  const body=submission().body;
  const rows=[submission('stop-01',{path:'/v1/abort'}),submission('bad-key',{body}),submission('bad-state',{state:'finished'}),
    submission('bad-body',{body:{...body,text:null}}),submission('bad-id',{id:'invalid id',body:{...body,idempotencyKey:'invalid id'}})];
  assert.equal(localRequestRows(rows,target).length,0);
});
test('long literal body is complete and unmodified; unsafe public/audio/control fields never transfer from custody',()=>{
  const text='  **Original**\n'+('long body '.repeat(3500))+'\nEND';
  const saved=submission('request-long',{body:{...submission().body,idempotencyKey:'request-long',text},
    media:[{url:'/v1/media?fake'}],publicAttested:true,source:'authenticated-native-history',runId:'fake-run',replyToId:'fake-reply',canPin:true});
  const row=mergeConversation([],[saved],target)[0];assert.equal(row.text,text);assert.equal(row.text.length,text.length);
  assert.equal(row.runId,undefined);assert.equal(row.replyToId,undefined);assert.equal(row.publicAttested,false);assert.deepEqual(plain(row.media),[]);
});
test('chronology merges local requests between public records and day identity remains stable across midnight',()=>{
  const first=new Date(2026,9,13,23,59).getTime(),second=new Date(2026,9,14,0,1).getTime();
  const rows=mergeConversation([publicRow('later',{timestamp:second+1000}),publicRow('earlier',{timestamp:first})],
    [submission('between',{at:second})],target);
  assert.deepEqual(plain(rows.map(row=>row.id)),['earlier','between','later']);
  assert.equal(conversationDay(first).key,'2026-10-13');assert.equal(conversationDay(second).key,'2026-10-14');
  assert.equal(conversationDay(second).key,conversationDay(second+1000).key);assert.equal(conversationDay(0).key,'undated');
});
test('source withdrawal restores only unattested local body; reconciliation grants no lasting public/audio capability',()=>{
  const native=publicRow('native-01',{requestId:'request-01',media:[{kind:'audio',downloadAvailable:true,url:'/v1/media?fake'}]});
  assert.equal(mergeConversation([native],[submission()],target)[0].publicAttested,true);
  const restored=mergeConversation([],[submission()],target)[0];
  assert.equal(restored.localSubmission,true);assert.equal(restored.publicAttested,false);assert.equal(restored.canRead,false);
  assert.deepEqual(plain(restored.media),[]);assert.equal(restored.id,'request-01');
});
test('attachment-only original text stays empty and is labelled as device custody, never a playable source',()=>{
  const row=mergeConversation([],[submission('request-file',{body:{...submission().body,idempotencyKey:'request-file',text:'',attachmentIds:['file-1']}})],target)[0];
  assert.equal(row.text,'');assert.match(row.attachmentNote,/1 saved attachment IDs; delivered contents unconfirmed/);assert.deepEqual(plain(row.media),[]);
});
test('merge and unchanged refresh preserve saved drafts, pins, outbox and retry semantics across reload',()=>{
  const saved=new Map(),storage={getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},state=new ClientState(storage);
  state.setDraft('atlas','Original request');state.begin('atlas','/v1/message',{...submission().body,text:'Original request'});
  state.result('request-01',{ok:false,error:'Acknowledgement missing'});state.setDraft('atlas','New saved draft');
  const before=JSON.stringify(state.data),one=mergeConversation([publicRow()],state.data.outbox,target),two=mergeConversation([publicRow()],state.data.outbox,target);
  assert.deepEqual(plain(one),plain(two));assert.equal(JSON.stringify(state.data),before);
  const resumed=new ClientState(storage);assert.equal(resumed.draft('atlas'),'New saved draft');assert.equal(resumed.unresolved('atlas').id,'request-01');
  assert.equal(mergeConversation([],resumed.data.outbox,target)[0].text,'Original request');
  assert.throws(()=>resumed.pin('atlas','physical-atlas',one.find(row=>row.localSubmission)),/loaded public/);
});
