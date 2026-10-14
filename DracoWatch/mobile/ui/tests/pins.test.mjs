import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=fs.readFileSync(new URL('../client-state.js',import.meta.url),'utf8');
function fixture(saved) {
  const values=new Map();let fail=false,clock=1000;
  const storage={getItem:key=>values.get(key),setItem:(key,value)=>{if(fail)throw Error('Quota');values.set(key,value);}};
  const scope={window:{},JSON,Date:class extends Date {static now(){return clock++;}}};
  vm.runInNewContext(source,scope);
  const {ClientState:State,KEY,PIN_LIMITS:limits}=scope.window.DracoState;
  if(saved!==undefined)values.set(KEY,typeof saved==='string'?saved:JSON.stringify(saved));
  return {State,storage,limits,values,KEY,fail:value=>{fail=value;},stored:()=>JSON.parse(values.get(KEY))};
}
const message=(id='message-1',extra={})=>({id,sessionId:'session-a',role:'assistant',text:'A readable public report.',timestamp:500,
  publicAttested:true,source:'authenticated-native-history',kind:'reply',...extra});
const plain=value=>JSON.parse(JSON.stringify(value));

test('explicit local pins survive reload, navigate newest first and retain only selected readable snapshots',()=>{
  const f=fixture(),state=new f.State(f.storage);
  const first=message('first',{text:'First report\nwith useful detail',media:[{bytes:'PRIVATE AUDIO'}],args:{secret:'PRIVATE ARG'},result:'PRIVATE RESULT'});
  const pin=state.pin('atlas','session-a',first);
  state.pin('atlas','session-a',message('second'));
  first.text='Later history replacement';pin.text='Caller mutation';
  const resumed=new f.State(f.storage),pins=resumed.pins('atlas','session-a');
  assert.deepEqual(plain(pins.map(row=>row.messageId)),['second','first']);
  assert.equal(pins[1].text,'First report\nwith useful detail');
  assert.equal(pins[1].title,'First report with useful detail');
  assert.equal(pins[1].scope,'device-local');
  assert.equal(pins[1].timestamp,500);
  assert.equal(resumed.data.outbox.length,0);
  const json=JSON.stringify(f.stored());
  for(const secret of ['PRIVATE AUDIO','PRIVATE ARG','PRIVATE RESULT','Later history replacement'])assert.equal(json.includes(secret),false);
  pins[1].messageId='mutated';assert.equal(resumed.pins('atlas','session-a')[1].messageId,'first');
});

test('pin identity is isolated by all six agents and physical sessions, never automatically retargeted',()=>{
  const f=fixture(),state=new f.State(f.storage);
  for(const agent of ['main','forge','atlas','aera-new','vvv','daedalus'])state.pin(agent,'session-a',message('shared-id'));
  state.pin('atlas','session-b',message('shared-id',{sessionId:'session-b'}));
  assert.equal(state.pins('forge','session-b').length,0);
  assert.equal(state.pins('atlas','replacement').length,0);
  assert.equal(state.pinHistory('atlas','replacement').length,0);
  assert.equal(state.unpin('atlas','replacement','shared-id'),false);
  assert.equal(state.pins('atlas','session-a').length,1);
  assert.equal(state.pins('atlas','session-b').length,1);
  assert.equal(state.pins('unknown','session-a').length,0);
  assert.throws(()=>state.pin('unknown','session-a',message()));
  assert.throws(()=>state.pin('atlas','session-b',message()),/exact agent and session/);
  assert.throws(()=>state.pin('atlas','session-a',message('wrong-agent',{agent:'forge'})));
});

test('pin/unpin history is durable, idempotent and independent of active pin navigation',()=>{
  const f=fixture(),state=new f.State(f.storage);
  const original=state.pin('atlas','session-a',message());
  assert.deepEqual(plain(state.pin('atlas','session-a',message())),plain(original));
  assert.equal(state.pinHistory('atlas','session-a').length,1);
  assert.equal(state.unpin('atlas','session-a','message-1'),true);
  assert.equal(state.unpin('atlas','session-a','message-1'),false);
  assert.equal(state.pins('atlas','session-a').length,0);
  state.pin('atlas','session-a',message());
  const resumed=new f.State(f.storage),history=resumed.pinHistory('atlas','session-a');
  assert.deepEqual(plain(history.map(row=>row.action)),['pin','unpin','pin']);
  assert.ok(history[0].at>history[1].at&&history[1].at>history[2].at);
  assert.ok(history.every(row=>row.messageId==='message-1'&&row.text===undefined&&row.scope==='device-local'));
  assert.equal(resumed.pins('atlas','session-a').length,1);
  history[0].title='mutated';assert.notEqual(resumed.pinHistory('atlas','session-a')[0].title,'mutated');
});

test('only loaded public conversation or admitted operational events can be selected',()=>{
  const f=fixture(),state=new f.State(f.storage);
  for(const patch of [{publicAttested:false},{publicAttested:undefined},{source:'toolResult'},{role:'tool'},
    {role:'system'},{text:null},{id:''},{id:'bad id'},{id:'x'.repeat(513)},{sessionId:'other'}]){
    assert.throws(()=>state.pin('atlas','session-a',message('invalid',patch)),/loaded public/);
  }
  for(const sessionId of ['', 'bad\nsession','s'.repeat(257)])assert.throws(()=>state.pin('atlas',sessionId,message('bad',{sessionId})));
  const work=message('work-1',{agent:'atlas',source:'authenticated-tool-status',kind:'Tool finished',runId:'run-1',callId:'call-1',
    text:'Searching memory · returned · 3 matches',observation:{agent:'atlas',sessionId:'session-a',runId:'run-1',callId:'call-1',phase:'result',args:{private:'PRIVATE QUERY'},result:{private:'PRIVATE MEMORY'}}});
  const pin=state.pin('atlas','session-a',work);
  assert.equal(pin.runId,'run-1');assert.equal(pin.callId,'call-1');assert.equal(pin.kind,'Tool finished');
  assert.equal(pin.source,'authenticated-tool-status');assert.equal(pin.observation,undefined);
  assert.equal(JSON.stringify(f.stored()).includes('PRIVATE'),false);
  for(const patch of [{runId:undefined},{callId:''},{kind:'Unknown tool'},{role:'user'},
    {observation:{...work.observation,runId:'wrong-run'}},{observation:{...work.observation,phase:'start'}},
    {observation:{...work.observation,agent:'forge'}},{observation:{...work.observation,callId:'other'}}]){
    assert.throws(()=>state.pin('atlas','session-a',{...work,id:'invalid-work',...patch}),/loaded public/);
  }
  assert.equal(new f.State(f.storage).pins('atlas','session-a')[0].runId,'run-1');
});

test('pin text and counts are bounded without silently evicting existing user pins',()=>{
  const f=fixture(),state=new f.State(f.storage),limits=f.limits;
  const text='\u0000Heading\n'+('detail '.repeat(1000));
  const saved=state.pin('atlas','session-a',message('long',{text}));
  assert.equal(saved.text.length,limits.text);assert.ok(saved.title.length<=limits.title);assert.equal(saved.text.includes('\u0000'),false);
  for(let index=1;index<limits.perSession;index++)state.pin('atlas','session-a',message('pin-'+index));
  assert.throws(()=>state.pin('atlas','session-a',message('over-limit')),/pin limit/);
  assert.equal(state.pins('atlas','session-a').at(-1).messageId,'long');
  for(const agent of ['main','forge','aera-new','vvv','daedalus']){
    for(let index=0;index<limits.perSession;index++)state.pin(agent,'session-a',message('pin-'+index));
  }
  assert.equal(state.data.pins.length,limits.total);
  assert.throws(()=>state.pin('atlas','another-session',message('global-over-limit',{sessionId:'another-session'})),/pin limit/);
  state.unpin('atlas','session-a','long');
  state.pin('atlas','another-session',message('allowed-after-unpin',{sessionId:'another-session'}));
  assert.equal(state.data.pins.length,limits.total);
});

test('history is bounded globally and per session across repeated explicit pin changes',()=>{
  const f=fixture(),state=new f.State(f.storage);
  for(const agent of ['main','forge','atlas','aera-new','vvv','daedalus']){
    for(let index=0;index<35;index++){state.pin(agent,'session-a',message());state.unpin(agent,'session-a','message-1');}
    assert.ok(state.pinHistory(agent,'session-a').length<=f.limits.historyPerSession);
  }
  const resumed=new f.State(f.storage);
  assert.ok(resumed.data.pinHistory.length<=f.limits.historyTotal);
  assert.equal(resumed.data.pins.length,0);
  assert.equal(resumed.pinHistory('daedalus','session-a')[0].action,'unpin');
});

test('storage errors roll back only pin changes and leave uncertain outbox custody and drafts intact',()=>{
  const f=fixture(),state=new f.State(f.storage);
  state.setDraft('atlas','unsent draft');state.preferences({playbackRate:.75,echoToTelegram:false});
  state.begin('atlas','/v1/message',{agent:'atlas',sessionId:'session-a',idempotencyKey:'original-id',text:'original input',mode:'queue',echoToTelegram:true});
  state.result('original-id',{ok:false,error:'ACK lost'});
  state.pin('atlas','session-a',message('keep'));
  const before=f.values.get(f.KEY),outbox=JSON.stringify(state.data.outbox),history=JSON.stringify(state.data.pinHistory);
  f.fail(true);
  assert.throws(()=>state.pin('atlas','session-a',message('not-saved')),/could not be saved/);
  assert.throws(()=>state.unpin('atlas','session-a','keep'),/could not be saved/);
  assert.equal(state.pins('atlas','session-a').length,1);
  assert.equal(state.pins('atlas','session-a')[0].messageId,'keep');
  assert.equal(JSON.stringify(state.data.pinHistory),history);assert.equal(JSON.stringify(state.data.outbox),outbox);
  assert.equal(f.values.get(f.KEY),before);
  f.fail(false);const resumed=new f.State(f.storage);
  assert.equal(resumed.unresolved('atlas').id,'original-id');assert.equal(resumed.unresolved('atlas').state,'uncertain');
  assert.equal(resumed.unresolved('atlas').body.echoToTelegram,true);assert.equal(resumed.unresolved('atlas').body.mode,'queue');
  assert.equal(resumed.draft('atlas'),'unsent draft');assert.equal(resumed.data.preferences.playbackRate,.75);
  assert.equal(resumed.data.preferences.echoToTelegram,false);
});

test('damaged or oversized pin storage is reduced to local schema without damaging submission migration',()=>{
  const pin={scope:'device-local',agent:'atlas',sessionId:'session-a',messageId:'valid',source:'authenticated-native-history',kind:'reply',
    text:'Saved text',title:'Not an authoritative title',timestamp:10,pinnedAt:100};
  const f=fixture({drafts:{atlas:'saved draft'},outbox:[{id:'pending-id',agent:'atlas',path:'/v1/message',state:'pending',
    body:{idempotencyKey:'pending-id',sessionId:'session-a',text:'held',mode:'queue'}}],preferences:{scale:125},
    pins:[null,{...pin,agent:'outsider'},{...pin,messageId:'bad\nid'},{...pin,scope:'server-synced'},
      {...pin,messageId:'bad-time',pinnedAt:'yesterday'}, {...pin,source:'raw-tool'},{...pin,extra:{payload:'PRIVATE'}},
      {...pin,text:'Newest selected text',pinnedAt:101}],
    pinHistory:[{...pin,action:'erase',at:1},{...pin,action:'pin',at:2,raw:'PRIVATE'}]});
  const state=new f.State(f.storage);
  assert.equal(state.pins('atlas','session-a').length,1);assert.equal(state.pins('atlas','session-a')[0].text,'Newest selected text');
  assert.equal(state.pins('atlas','session-a')[0].title,'Newest selected text');
  assert.equal(state.pinHistory('atlas','session-a').length,1);assert.equal(JSON.stringify(f.stored()).includes('PRIVATE'),false);
  assert.equal(state.unresolved('atlas').id,'pending-id');assert.equal(state.unresolved('atlas').state,'uncertain');
  assert.equal(state.unresolved('atlas').hasUnconfirmedAttempt,true);assert.equal(state.draft('atlas'),'saved draft');
  assert.equal(state.data.preferences.echoToTelegram,true);assert.equal(state.data.preferences.scale,125);
  const damaged=fixture('{not json'),empty=new damaged.State(damaged.storage);
  assert.equal(empty.data.pins.length,0);assert.equal(empty.data.outbox.length,0);assert.equal(empty.data.preferences.echoToTelegram,false);
});

test('oversized stored collections cannot bypass per-session or total retention bounds',()=>{
  const records=Array.from({length:500},(_,index)=>({scope:'device-local',agent:'atlas',sessionId:'session-a',
    messageId:'stored-'+index,source:'authenticated-native-history',kind:'reply',text:'Selected snapshot',timestamp:index,pinnedAt:index}));
  const history=records.map(row=>({...row,action:'pin',at:row.pinnedAt}));
  const f=fixture({pins:records,pinHistory:history}),state=new f.State(f.storage);
  assert.equal(state.pins('atlas','session-a').length,f.limits.perSession);
  assert.equal(state.pins('atlas','session-a')[0].messageId,'stored-499');
  assert.equal(state.pinHistory('atlas','session-a').length,f.limits.historyPerSession);
  assert.ok(f.stored().pins.length<=f.limits.total);assert.ok(f.stored().pinHistory.length<=f.limits.historyTotal);
});
