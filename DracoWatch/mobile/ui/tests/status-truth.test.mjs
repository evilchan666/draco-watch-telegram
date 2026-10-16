import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const scope={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../client-state.js',import.meta.url),'utf8'),scope);
const {occupancyLabel,conversationTarget,runObservation}=scope.window.DracoState;
const now=1791900000000;
const agent=()=>({id:'atlas',status:'active',conversationStatus:'active',sessionKey:'agent:atlas:telegram:direct:8745908879',sessionId:'physical-atlas',
  controlTargets:[{agent:'atlas',scope:'conversation',sessionKey:'agent:atlas:telegram:direct:8745908879',sessionId:'physical-atlas',runId:'current-run'}]});
const coverage=()=>({available:true,freshUntil:now+10000});
function event(phase='start',overrides={}) {
  const a=agent();return {id:'event-'+phase,agent:a.id,sessionKey:a.sessionKey,sessionId:a.sessionId,runId:'current-run',callId:'call-1',
    source:'authenticated-tool-status',publicAttested:true,kind:({start:'Tool started',result:'Tool finished',error:'Tool failed'})[phase],timestamp:now-4000,
    observation:{version:1,agent:a.id,sessionKey:a.sessionKey,sessionId:a.sessionId,runId:'current-run',callId:'call-1',phase,tool:'exec_command'},
    evidenceSource:{observedAt:now-1000,freshUntil:now+10000},...overrides};
}
const observe=(a=agent(),events=[],extra={})=>runObservation(a,{live:true,now,coverage:coverage(),events,...extra});

test('agent occupancy is not useful work; background run does not borrow an operation into idle chat',()=>{
  assert.equal(occupancyLabel('active'),'Run open');const a=agent();a.conversationStatus='idle';
  const s=observe(a,[event()]);assert.equal(s.occupancy,'Run open');assert.equal(s.conversation,'No conversation run');assert.equal(s.event,null);
});
test('subagent-only occupancy with no exact conversation target is unknown execution',()=>{
  const a=agent();a.controlTargets=[];const s=observe(a,[event()]);assert.equal(s.execution,'Execution unknown');assert.match(s.summary,/Exact conversation run unavailable/);
});
test('an unmatched start in a partial bounded window is an observation, not a running or waiting job',()=>{
  const s=observe(agent(),[event()],{coverage:{...coverage(),partial:true,upstreamDropped:3}});
  assert.match(s.summary,/Start observed · outcome not observed/);assert.match(s.summary,/partial\/gapped/);assert.equal(s.execution,'Execution unknown');
});
test('newer old-run evidence and unbound public reports cannot displace current-run terminal evidence',()=>{
  const old=event('start',{id:'old',runId:'old-run',timestamp:now-1});old.observation={...old.observation,runId:'old-run'};
  const report={...event('result'),id:'report',source:'authenticated-native-history',timestamp:now};
  const s=observe(agent(),[event('result'),old,report]);assert.equal(s.event.id,'event-result');assert.match(s.summary,/Return observed/);
});
for(const key of ['agent','sessionKey','sessionId','runId','callId'])test('wrong '+key+' cannot inform current-run summary',()=>{
  const e=event();e[key]='other';assert.equal(observe(agent(),[e]).event,null);
  const nested=event();nested.observation={...nested.observation,[key]:'other'};assert.equal(observe(agent(),[nested]).event,null);
});
test('physical-session replacement invalidates prior current-operation proof',()=>{
  const a=agent();a.sessionId='replacement';a.controlTargets[0].sessionId='replacement';assert.equal(observe(a,[event()]).event,null);
});
test('missing or expired event freshness leaves observations historical, not current-run evidence',()=>{
  for(const source of [undefined,{}, {observedAt:now,freshUntil:now}, {observedAt:now+1,freshUntil:now+1000}])
    assert.equal(observe(agent(),[event('result',{evidenceSource:source})]).event,null);
});
test('unavailable/expired coverage stays separate from fresh runtime occupancy',()=>{
  for(const c of [undefined,{available:false,freshUntil:now+1000},{available:true}, {available:true,freshUntil:now}]){
    const s=observe(agent(),[event()],{coverage:c});assert.equal(s.occupancy,'Run open');assert.equal(s.event,null);assert.match(s.summary,/unavailable or stale/);
  }
});
test('disconnect remains unknown; reconnect needs new exact session and event proof',()=>{
  const e=event('result');assert.equal(observe(agent(),[e],{live:false}).event,null);
  assert.match(observe(agent(),[e],{live:false}).occupancy,/stale\/disconnected/);
  const a=agent();a.sessionId='replacement';assert.equal(observe(a,[e]).event,null);
});
test('silent active and queued admission do not imply approval or input waiting',()=>{
  assert.match(observe().summary,/No exact-run tool event observed/);const a=agent();a.conversationStatus='queued';
  assert.match(observe(a).summary,/Admission is not execution/);assert.equal(observe(a).execution,'Execution unknown');
});
test('reported processRunning and authored current step do not prove current liveness',()=>{
  const e=event('result');e.observation.result={processRunning:true};e.observation.taskProgress={current:'Working'};
  const s=observe(agent(),[e]);assert.match(s.summary,/Return observed/);assert.match(s.summary,/present execution unknown/);
});
test('terminal supersedes same-call start and contradictory call facts are withheld',()=>{
  const terminal=event('result',{timestamp:now-5000});assert.equal(observe(agent(),[event(),terminal]).event.id,terminal.id);
  const s=observe(agent(),[event('result'),event('error')]);assert.equal(s.event,null);assert.match(s.summary,/conflicting call facts/);
});
test('exact logical key and unique target are required for control binding',()=>{
  const a=agent();assert.equal(conversationTarget(a).runId,'current-run');a.controlTargets[0].sessionKey='other';assert.equal(conversationTarget(a),null);
  const b=agent();b.controlTargets.push({...b.controlTargets[0],runId:'second'});assert.equal(conversationTarget(b),null);
});
test('conflicting namespaced tools sharing a normalized alias cannot be reported as one call',()=>{
  const start=event(),end=event('result');start.observation.toolName='gateway.exec_command';end.observation.toolName='other.exec_command';
  const s=observe(agent(),[start,end]);assert.equal(s.event,null);assert.match(s.summary,/conflicting call facts withheld/);
});

test('fresh native phase is separate from tool history and stale phase becomes unknown',()=>{
  const a=agent();a.runPhase={phase:'working',runId:'current-run',observedAt:now-1000,expiresAt:now+1000};
  assert.equal(observe(a,[],{coverage:undefined}).execution,'Working');
  for(const patch of [{runId:'old-run'},{observedAt:now+1},{expiresAt:now},{phase:'invented'}])
    assert.equal(observe({...a,runPhase:{...a.runPhase,...patch}}).execution,'Execution unknown');
  assert.equal(observe(a,[],{live:false}).execution,'Execution unknown');
});
test('wait phases require the exact current owner; no borrowed background or ambiguous run',()=>{
  const a=agent();a.runPhase={phase:'input-wait',runId:'current-run',observedAt:now,expiresAt:now+1000};
  assert.equal(observe(a).execution,'Waiting for input');
  a.controlTargets.push({...a.controlTargets[0],runId:'second'});
  assert.equal(observe(a).execution,'Execution unknown');
});
test('durable continuation hold remains visible when idle but never crosses a session or disconnect',()=>{
  const a=agent();a.conversationStatus='idle';a.controlTargets=[];
  a.continuationHold={id:'hold-1',sessionId:a.sessionId,heldAt:now-10000};
  assert.equal(observe(a).continuation,'Automatic continuation held');
  assert.equal(observe(a,[],{live:false}).execution,'Execution unknown');
  assert.equal(observe({...a,sessionId:'replacement'}).execution,'Execution unknown');
});

test('native phase without complete control inventory is observable but never creates a control target',()=>{
  const a=agent();a.controlTargets=[];a.runPhase={phase:'working',runId:'native-owner-run',observedAt:now-100,expiresAt:now+1000};
  const result=observe(a);assert.equal(result.execution,'Working');assert.equal(result.target,null);assert.equal(conversationTarget(a),null);
});

test('canonical current-session attestation preserves an inherited hold without borrowing another incarnation',()=>{
  const a=agent();a.continuationHold={id:'retained-hold',heldAt:now-1000,sessionId:'original',currentSessionId:a.sessionId};
  assert.equal(observe(a).continuation,'Automatic continuation held');
  a.continuationHold.currentSessionId='wrong';assert.equal(observe(a).execution,'Execution unknown');
});


test('a durable hold never masks fresh still-running execution or claims cessation',()=>{
  const a=agent();a.continuationHold={id:'hold-while-working',sessionId:a.sessionId,heldAt:now-50};
  a.runPhase={phase:'tool-wait',runId:'current-run',observedAt:now-100,expiresAt:now+1000};
  const observed=observe(a);assert.equal(observed.execution,'Waiting for tool');assert.equal(observed.continuation,'Automatic continuation held');
  a.runPhase.expiresAt=now;assert.equal(observe(a).execution,'Execution unknown');assert.equal(observe(a).continuation,'Automatic continuation held');
});
