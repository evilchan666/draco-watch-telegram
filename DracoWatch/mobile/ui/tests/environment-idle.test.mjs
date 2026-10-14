import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../environment-bubbles.js',import.meta.url),'utf8');
const START=1_800_000_000_000;
const plain=value=>JSON.parse(JSON.stringify(value));
function helpers(){
  const scope={window:{},Date,Map,Set,Number,Array,performance:{now:()=>100}};
  vm.runInNewContext(source,scope);
  return scope.window.DracoEnvironmentBubbles;
}
function policy(){
  const {IdleExpiry}=helpers();
  assert.equal(typeof IdleExpiry,'function','IdleExpiry must be exported for the existing refresh path');
  return new IdleExpiry();
}
function report(overrides={}){
  return {id:'atlas',name:'ATLAS',color:'#00ffff',sessionId:'physical-atlas-a',status:'idle',kind:'report',sourceId:'public-a',timestamp:START-10_000,fullText:'Exact public report A',preview:'Exact public report A',label:'Public report',...overrides};
}
const apply=(expiry,row,now)=>expiry.apply([row],{now})[0];
function noOldText(row,text='Exact public report A'){
  assert.notEqual(row.fullText,text,'An expired authored report must not remain in fullText');
  assert.ok(!String(row.preview??'').includes(text),'An expired authored report must not remain in the preview');
}

test('confirmed idle expires at precisely sixty seconds after first observation, not the old report time',()=>{
  const expiry=policy(),row=report(),before=plain(row);
  assert.notEqual(apply(expiry,row,START).hidden,true);
  assert.notEqual(apply(expiry,row,START+59_999).hidden,true);
  assert.equal(apply(expiry,row,START+60_000).hidden,true);
  assert.deepEqual(plain(row),before,'The projection must not alter the loaded public report');
});

test('render and fleet refreshes cannot roll the idle deadline forward',()=>{
  const expiry=policy(),row=report();
  for(const elapsed of [0,1,1000,10_000,30_000,59_999])assert.notEqual(apply(expiry,{...row},START+elapsed).hidden,true);
  assert.equal(apply(expiry,{...row},START+60_000).hidden,true);
  assert.equal(apply(expiry,{...row},START+180_000).hidden,true);
});

test('newer genuine text while idle extends from its authored timestamp and can reappear after expiry',()=>{
  const expiry=policy();apply(expiry,report(),START);
  const fresh=report({sourceId:'public-b',timestamp:START+45_000,fullText:'Fresh public report B',preview:'Fresh public report B'});
  assert.equal(apply(expiry,fresh,START+50_000).fullText,'Fresh public report B');
  assert.notEqual(apply(expiry,fresh,START+104_999).hidden,true);
  assert.equal(apply(expiry,fresh,START+105_000).hidden,true);
  const newer=report({sourceId:'public-c',timestamp:START+120_000,fullText:'Fresh public report C',preview:'Fresh public report C'});
  const renewed=apply(expiry,newer,START+125_000);
  assert.notEqual(renewed.hidden,true);assert.equal(renewed.fullText,'Fresh public report C');
  assert.equal(apply(expiry,newer,START+180_000).hidden,true);
});

test('old text, attachment receipts and state rows do not extend an established idle deadline',()=>{
  for(const replacement of [
    report({sourceId:'older-page',timestamp:START-20_000,fullText:'Older public text',preview:'Older public text'}),
    report({kind:'attachment',sourceId:'voice-receipt',timestamp:START+45_000,fullText:null,preview:'Audio available · no companion text'}),
    report({kind:'state',sourceId:null,timestamp:null,fullText:null,preview:'No public update',label:'Idle'})
  ]){
    const expiry=policy();apply(expiry,report(),START);
    apply(expiry,replacement,START+50_000);
    assert.equal(apply(expiry,replacement,START+60_000).hidden,true,`${replacement.kind} must not renew idle speech`);
  }
});

test('unknown observation and reconnect retain the original idle deadline without retaining speech',()=>{
  const expiry=policy(),row=report();apply(expiry,row,START);
  const unknown=report({status:'unknown',kind:'state',sessionId:null,sourceId:null,timestamp:null,fullText:null,preview:'Live observation unavailable',label:'Unobserved'});
  const disconnected=apply(expiry,unknown,START+30_000);noOldText(disconnected);
  apply(expiry,unknown,START+90_000);
  assert.equal(apply(expiry,row,START+90_001).hidden,true,'Reconnect is not a new idle observation');
});

test('switching active or queued cannot resurrect an expired report; newer active text remains usable',()=>{
  const expiry=policy(),row=report();apply(expiry,row,START);
  assert.equal(apply(expiry,row,START+60_000).hidden,true);
  for(const [index,status] of ['active','queued','active'].entries())noOldText(apply(expiry,{...row,status},START+60_001+index));
  const fresh=report({status:'active',sourceId:'active-fresh',timestamp:START+70_000,fullText:'New active work',preview:'New active work'});
  assert.equal(apply(expiry,fresh,START+70_001).fullText,'New active work');
});

test('a hidden or manually disabled view consumes the same absolute deadline, not visible time',()=>{
  const expiry=policy(),row=report();apply(expiry,row,START);
  // No refresh calls while the view is hidden: resuming cannot restart its clock.
  assert.equal(apply(expiry,row,START+5*60_000).hidden,true);
  noOldText(apply(expiry,{...row,status:'active'},START+5*60_000+1));
});

test('idle expiry is isolated per agent and a replacement physical session cannot reuse old speech',()=>{
  const expiry=policy(),atlas=report(),forge=report({id:'forge',name:'FORGE',sessionId:'physical-forge-a',sourceId:'forge-a',fullText:'FORGE public report',preview:'FORGE public report'});
  expiry.apply([atlas],{now:START});expiry.apply([atlas,forge],{now:START+30_000});
  const atDeadline=expiry.apply([atlas,forge],{now:START+60_000});
  assert.equal(atDeadline.find(row=>row.id==='atlas').hidden,true);
  assert.notEqual(atDeadline.find(row=>row.id==='forge').hidden,true);
  const {selectReports}=helpers(),specs=[{id:'atlas',name:'ATLAS',color:'#00ffff'}],agents=new Map([['atlas',{sessionId:'physical-atlas-b',status:'idle'}]]);
  const original={id:'public-a',agent:'atlas',sessionId:'physical-atlas-a',role:'assistant',text:'Exact public report A',timestamp:START-10_000};
  const selected=selectReports([original],agents,{live:true,now:START+70_000,specs});
  assert.equal(selected[0].kind,'state');assert.equal(selected[0].sessionId,'physical-atlas-b');
  const replaced=expiry.apply(selected,{now:START+70_000})[0];noOldText(replaced);
  assert.equal(replaced.sessionId,'physical-atlas-b');assert.notEqual(replaced.hidden,true,'Replacement session gets its own state deadline, never old speech');
  assert.equal(expiry.apply(selected,{now:START+130_000})[0].hidden,true);
});

test('an idle state without a report expires but active state alone does not invent dialogue',()=>{
  const expiry=policy(),idle=report({kind:'state',sourceId:null,timestamp:null,fullText:null,preview:'No public update',label:'Idle'});
  assert.notEqual(apply(expiry,idle,START).hidden,true);
  assert.equal(apply(expiry,idle,START+60_000).hidden,true);
  const active=apply(expiry,{...idle,status:'active',label:'Active'},START+60_001);noOldText(active);assert.equal(active.fullText,null);
});

test('persisted reconstruction retains the deadline and expired identity without storing authored text',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const {IdleExpiry}=helpers(),row=report();
  apply(new IdleExpiry({storage}),row,START);
  assert.equal(values.size,1);
  const initial=[...values.values()][0];
  assert.ok(!initial.includes(row.fullText));assert.ok(!initial.includes('Public report'));
  const cached=JSON.parse(initial);assert.equal(cached.version,1);assert.equal(cached.rows.length,1);
  const restored=new IdleExpiry({storage});
  assert.notEqual(apply(restored,row,START+59_999).hidden,true);
  assert.equal(apply(restored,row,START+60_000).hidden,true);
  const afterExpiry=new IdleExpiry({storage});
  noOldText(apply(afterExpiry,{...row,status:'active'},START+60_001));
  const fresh=report({sourceId:'after-reload',timestamp:START+65_000,fullText:'New after reload',preview:'New after reload'});
  assert.equal(apply(afterExpiry,fresh,START+65_001).fullText,'New after reload');
});

test('unavailable or damaged optional clock storage cannot prevent correct in-memory expiry',()=>{
  const {IdleExpiry}=helpers();
  for(const storage of [
    {getItem:()=>'{broken',setItem:()=>{throw new Error('full');}},
    {getItem:()=>{throw new Error('unavailable');},setItem:()=>{throw new Error('unavailable');}}
  ]){
    const expiry=new IdleExpiry({storage}),row=report();
    assert.notEqual(apply(expiry,row,START).hidden,true);
    assert.equal(apply(expiry,row,START+60_000).hidden,true);
    noOldText(apply(expiry,{...row,status:'active'},START+60_001));
  }
});
