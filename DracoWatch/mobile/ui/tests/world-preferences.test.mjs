import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source=fs.readFileSync(new URL('../client-state.js',import.meta.url),'utf8');
function fixture(saved){const store=new Map(),storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};if(saved)storage.setItem('draco-watch-client-v2',JSON.stringify(saved));const scope={window:{},Date,JSON};vm.runInNewContext(source,scope);return {State:scope.window.DracoState.ClientState,storage};}
test('world controls restore deliberate sensitivity and handedness across app reload',()=>{
  const {State,storage}=fixture(),state=new State(storage);state.preferences({worldLookSensitivity:1.4,worldHandedness:'left'});
  const restored=new State(storage);assert.equal(restored.data.preferences.worldLookSensitivity,1.4);assert.equal(restored.data.preferences.worldHandedness,'left');
});
test('legacy preferences migrate world controls without enabling speech or losing existing audio/layout choices',()=>{
  const {State,storage}=fixture({preferences:{scale:125,motion:true,rendering:'light',playbackRate:1.5,automaticSpeech:false},drafts:{atlas:'kept'}}),state=new State(storage);
  assert.equal(state.data.preferences.worldLookSensitivity,1);assert.equal(state.data.preferences.worldHandedness,'right');assert.equal(state.data.preferences.playbackRate,1.5);assert.equal(state.data.preferences.scale,125);assert.equal(state.data.preferences.automaticSpeech,false);assert.equal(state.draft('atlas'),'kept');
});
test('invalid/nonfinite world control settings cannot corrupt navigation on save or restore',()=>{
  for(const value of [null,'2',{},true,Number.NaN,Number.POSITIVE_INFINITY]){const {State,storage}=fixture(),state=new State(storage);state.preferences({worldLookSensitivity:value,worldHandedness:'unexpected'});assert.equal(state.data.preferences.worldLookSensitivity,1);assert.equal(new State(storage).data.preferences.worldLookSensitivity,1);assert.equal(state.data.preferences.worldHandedness,'right');}
  for(const [value,expected] of [[-2,.4],[.2,.4],[3,2]]){const {State,storage}=fixture({preferences:{worldLookSensitivity:value}});assert.equal(new State(storage).data.preferences.worldLookSensitivity,expected);}
});
test('changing world controls never settles or repeats uncertain communication custody',()=>{
  const {State,storage}=fixture(),state=new State(storage);state.setDraft('atlas','visible unsent draft');const body={agent:'atlas',sessionId:'physical-a',idempotencyKey:'original-request',text:'original body',mode:'queue'};
  state.begin('atlas','/v1/message',body);state.result('original-request',{ok:false,error:'Lost acknowledgement',uncertain:true});state.setDraft('atlas','new unsent draft');
  const before=JSON.stringify(state.data.outbox);state.preferences({worldHandedness:'left',worldLookSensitivity:.8});const restored=new State(storage);
  assert.equal(JSON.stringify(restored.data.outbox),before);assert.equal(restored.unresolved('atlas').id,'original-request');assert.equal(restored.draft('atlas'),'new unsent draft');assert.equal(restored.data.preferences.automaticSpeech,false);
});
