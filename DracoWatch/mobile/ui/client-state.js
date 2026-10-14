/* Local drafts, exact submission custody and explicit device-local pin snapshots.
 * No credentials, arbitrary received histories or automatic input replay. */
'use strict';
(() => {
  const KEY = 'draco-watch-client-v2';
  const AGENTS = ['main','forge','atlas','aera-new','vvv','daedalus'];
  const occupancyLabel = status => ({active:'Run open',idle:'No open run',queued:'Queued admission',unknown:'Runtime unknown'})[status] || 'Runtime unknown';
  const conversationKey = agent => `agent:${agent}:telegram:direct:8745908879`;
  const statusId = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,256}$/.test(value);
  function conversationTarget(agent) {
    if (!agent || !AGENTS.includes(agent.id) || agent.sessionKey !== conversationKey(agent.id) || !statusId(agent.sessionId)) return null;
    const targets=(agent.controlTargets || []).filter(target => target?.agent === agent.id && target.scope === 'conversation' &&
      target.sessionKey === agent.sessionKey && target.sessionId === agent.sessionId && statusId(target.runId));
    const runs=new Set(targets.map(target=>target.runId));
    return runs.size === 1 ? targets[0] : null;
  }
  // Occupancy and observed events are independent. No approval/input wait,
  // current process liveness or useful work is inferred from silence/history.
  function runObservation(agent,{live=false,now=Date.now(),events=[],coverage}={}) {
    const bound=live && agent && AGENTS.includes(agent.id) && agent.sessionKey === conversationKey(agent.id) && statusId(agent.sessionId);
    const status=bound ? agent.conversationStatus : 'unknown';
    const conversation=({active:'Conversation run open',idle:'No conversation run',queued:'Conversation queued',unknown:'Conversation state unknown'})[status] || 'Conversation state unknown';
    const base={occupancy:live ? occupancyLabel(agent?.status) : 'Runtime unknown · stale/disconnected',conversation,
      execution:'Execution unknown',summary:'No exact-run execution evidence observed',event:null,target:null};
    if (!live) return {...base,summary:'Observation stale or disconnected; received history is retained'};
    if (status === 'idle') return {...base,summary:'No open run in this conversation; agent-wide occupancy is separate'};
    const target=status === 'active' ? conversationTarget(agent) : null;
    if (!target) return {...base,summary:status === 'queued' ? 'Admission is not execution or waiting evidence' : 'Exact conversation run unavailable; execution unknown'};
    base.target=target;
    if (!coverage || coverage.available !== true || !Number.isFinite(coverage.freshUntil) || coverage.freshUntil <= now)
      return {...base,summary:'Execution evidence unavailable or stale; runtime occupancy remains separate'};
    const matches=events.filter(event => {
      const o=event?.observation,s=event?.evidenceSource;
      return event?.publicAttested === true && event.source === 'authenticated-tool-status' && event.agent === agent.id &&
        event.sessionKey === agent.sessionKey && event.sessionId === agent.sessionId && event.runId === target.runId && statusId(event.callId) &&
        o?.version === 1 && o.agent === event.agent && o.sessionKey === event.sessionKey && o.sessionId === event.sessionId &&
        o.runId === event.runId && o.callId === event.callId && typeof o.tool === 'string' && /^[A-Za-z0-9_.]{1,160}$/.test(o.tool) &&
        ({start:'Tool started',result:'Tool finished',error:'Tool failed'})[o.phase] === event.kind &&
        Number.isFinite(s?.observedAt) && s.observedAt <= now && Number.isFinite(s.freshUntil) && s.freshUntil > now &&
        Number.isFinite(event.timestamp) && event.timestamp > 0 && event.timestamp <= now;
    }).sort((a,b)=>b.timestamp-a.timestamp || a.id.localeCompare(b.id));
    const conflicted=new Set();
    for (const e of matches) {
      const same=matches.filter(other=>other.callId === e.callId);
      if (new Set(same.map(other=>other.observation.toolName ?? other.observation.tool)).size>1 ||
          same.some(other=>other.observation.phase === 'result') && same.some(other=>other.observation.phase === 'error')) conflicted.add(e.callId);
    }
    // A terminal observation supersedes a same-call start, even across pages.
    const event=matches.find(e=>!conflicted.has(e.callId) && (e.observation.phase !== 'start' || !matches.some(other=>other.callId === e.callId && other.observation.phase !== 'start')));
    const gap=coverage.partial === true || Number(coverage.upstreamDropped)>0 || Number(coverage.droppedKnown)>0 || Number(coverage.sourceConflictCount)>0;
    if (!event) return {...base,summary:'No exact-run tool event observed'+(gap?' · partial/gapped window':'')+(conflicted.size?' · conflicting call facts withheld':'')};
    const phase=event.observation.phase,tool=typeof event.observation.toolName === 'string' && /^[A-Za-z0-9_.]{1,160}$/.test(event.observation.toolName) ? event.observation.toolName : event.observation.tool;
    const fact=phase === 'start' ? 'Start observed · outcome not observed' : phase === 'error' ? 'Error observed' : 'Return observed';
    return {...base,event,summary:tool+' · '+fact+' · observed '+Math.floor((now-event.timestamp)/1000)+'s ago'+
      (gap?' · partial/gapped window':'')+' · present execution unknown'};
  }
  const PIN_LIMITS = Object.freeze({perSession:30,total:180,historyPerSession:60,historyTotal:240,text:2000,title:160,id:512,sessionId:256});
  const PIN_SCOPE = 'device-local';
  const pinId = (value,max=PIN_LIMITS.id) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\s\u0000-\u001f\u007f-\u009f]/u.test(value);
  const pinTarget = (agent,sessionId) => AGENTS.includes(agent) && pinId(sessionId,PIN_LIMITS.sessionId);
  const pinText = (value,max) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g,'').slice(0,max) : '';
  const pinTitle = text => text.replace(/\s+/g,' ').trim().slice(0,PIN_LIMITS.title) || 'Attachment';
  const pinTime = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  const toolKinds = {'Tool started':'start','Tool finished':'result','Tool failed':'error'};
  // Local submission custody is not public history. Only an exact authenticated
  // user request key AND unchanged original body can replace its visible row.
  function localRequestRows(outbox,{agent,sessionId}={}) {
    if (!pinTarget(agent,sessionId)) return [];
    return (Array.isArray(outbox)?outbox:[]).filter(row=>row?.agent===agent && row.path==='/v1/message' &&
      row.body?.agent===agent && row.body.sessionId===sessionId && pinId(row.id,160) && row.body.idempotencyKey===row.id &&
      typeof row.body.text==='string' && row.body.text.length<=500000 && ['pending','accepted','uncertain','rejected'].includes(row.state))
      .map(row=>{
        const note=pinText(row.note,800),queued=row.outcome?.status==='queued'||row.outcome?.disposition==='queued';
        const admission=({pending:'Sending · gateway admission not yet confirmed',
          accepted:queued?'Gateway admitted · queued follow-up':'Gateway admission acknowledged',
          uncertain:'Admission unconfirmed · original request saved',rejected:'Request rejected · admission not confirmed'})[row.state];
        return {id:row.id,agent,sessionId,role:'user',kind:'Local request',text:row.body.text,
          timestamp:pinTime(row.at)?row.at:0,localSubmission:true,submissionState:row.state,
          submissionNote:admission+'. Reading, start, reply and completion are not established.'+
            (['uncertain','rejected'].includes(row.state)&&note?' '+note:''),
          attachmentNote:Array.isArray(row.body.attachmentIds)&&row.body.attachmentIds.length?
            'Attachment submission · '+row.body.attachmentIds.length+' saved attachment IDs; delivered contents unconfirmed':'',
          source:'device-local-submission',publicAttested:false,replyAvailable:false,canPin:false,canReply:false,canRead:false,media:[]};
      });
  }
  function mergeConversation(history,outbox,{agent,sessionId}={}) {
    if (!pinTarget(agent,sessionId)) return [];
    const rows=(Array.isArray(history)?history:[]).filter(row=>row?.sessionId===sessionId &&
      (row.agent===undefined||row.agent===agent) && row.publicAttested===true && row.source==='authenticated-native-history' &&
      ['user','assistant'].includes(row.role) && pinId(row.id,1024) && typeof row.text==='string' && row.text.length<=500000)
      .map(row=>({...row,timestamp:pinTime(row.timestamp)?row.timestamp:0}));
    for (const local of localRequestRows(outbox,{agent,sessionId})) {
      const keyed=rows.filter(row=>row.role==='user' && row.requestId===local.id);
      // Excerpts, conflicting bodies or unkeyed legacy rows cannot prove that
      // the complete submitted request has entered authenticated history.
      if (keyed.length && keyed.every(row=>row.text===local.text && row.excerpt!==true)) continue;
      rows.push(local);
    }
    return rows.sort((a,b)=>a.timestamp-b.timestamp || a.id.localeCompare(b.id) || Number(a.localSubmission===true)-Number(b.localSubmission===true));
  }
  function conversationDay(timestamp) {
    if (!pinTime(timestamp)||timestamp===0) return {key:'undated',label:'Date not recorded'};
    const value=new Date(timestamp);
    if (!Number.isFinite(value.getTime())) return {key:'undated',label:'Date not recorded'};
    return {key:value.getFullYear()+'-'+String(value.getMonth()+1).padStart(2,'0')+'-'+String(value.getDate()).padStart(2,'0'),
      label:value.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'})};
  }
  function pinIdentity(row) {
    if (!row || !pinTarget(row.agent,row.sessionId) || !pinId(row.messageId)) return null;
    const source=row.source,kind=pinText(row.kind,80);
    if (!['authenticated-native-history','authenticated-tool-status'].includes(source)) return null;
    if (source === 'authenticated-tool-status' && (!Object.hasOwn(toolKinds,kind) || !pinId(row.runId) || !pinId(row.callId))) return null;
    if (row.runId !== undefined && !pinId(row.runId) || row.callId !== undefined && !pinId(row.callId)) return null;
    return {agent:row.agent,sessionId:row.sessionId,messageId:row.messageId,source,kind,
      ...(row.runId !== undefined ? {runId:row.runId} : {}),...(row.callId !== undefined ? {callId:row.callId} : {})};
  }
  function restorePins(rows,history=false) {
    const output=[],seen=new Set(),counts=new Map(),total=history?PIN_LIMITS.historyTotal:PIN_LIMITS.total,perSession=history?PIN_LIMITS.historyPerSession:PIN_LIMITS.perSession;
    for (const row of (Array.isArray(rows)?rows:[]).slice(-total).reverse()) {
      const identity=pinIdentity(row);
      if (!identity || row.scope !== PIN_SCOPE || !pinTime(history?row.at:row.pinnedAt) ||
          (history ? !['pin','unpin'].includes(row.action) : typeof row.text !== 'string' || !pinTime(row.timestamp))) continue;
      const scope=JSON.stringify([identity.agent,identity.sessionId]),key=JSON.stringify([scope,identity.messageId]);
      if ((!history && seen.has(key)) || (counts.get(scope)||0)>=perSession) continue;
      seen.add(key);counts.set(scope,(counts.get(scope)||0)+1);
      if (history) output.push({...identity,scope:PIN_SCOPE,action:row.action,title:pinText(row.title,PIN_LIMITS.title),at:row.at});
      else {const text=pinText(row.text,PIN_LIMITS.text);output.push({...identity,scope:PIN_SCOPE,text,title:pinTitle(text),timestamp:row.timestamp,pinnedAt:row.pinnedAt});}
    }
    return output.reverse();
  }
  class ClientState {
    constructor(storage) {
      this.storage = storage; this.data = {drafts:{},attachments:[],outbox:[],pins:[],pinHistory:[],preferences:{scale:100,motion:false,rendering:'auto',echoToTelegram:false,automaticSpeech:true,playbackRate:1,environmentBubbles:true}};
      try {
        const saved = JSON.parse(storage.getItem(KEY) || 'null');
        if (saved && typeof saved === 'object') {
          for (const id of AGENTS) if (typeof saved.drafts?.[id] === 'string') this.data.drafts[id] = saved.drafts[id].slice(0,16000);
          this.setAttachments(saved.attachments,false);
          this.data.outbox = (Array.isArray(saved.outbox) ? saved.outbox : []).filter(row => row && AGENTS.includes(row.agent) && typeof row.id === 'string' && typeof row.path === 'string' && row.body && typeof row.body === 'object').slice(-60);
          for (const row of this.data.outbox) { if (row.state === 'pending') { row.state = 'uncertain'; row.note = 'The app closed before an acknowledgement. Retry only this original ID.'; } if (row.state === 'uncertain') row.hasUnconfirmedAttempt = true; }
          this.data.preferences.scale = Math.min(150,Math.max(100,Number(saved.preferences?.scale)||100));
          this.data.preferences.playbackRate = [.5,.75,1,1.25,1.5,2].includes(saved.preferences?.playbackRate) ? saved.preferences.playbackRate : 1;
          this.data.preferences.motion = saved.preferences?.motion === true;
          this.data.preferences.automaticSpeech = saved.preferences?.automaticSpeech !== false;
          this.data.preferences.environmentBubbles = saved.preferences?.environmentBubbles !== false;
          this.data.preferences.echoToTelegram = typeof saved.preferences?.echoToTelegram === 'boolean' ? saved.preferences.echoToTelegram : !!saved.preferences && typeof saved.preferences.scale === 'number';
          this.data.preferences.rendering = ['auto','light','full'].includes(saved.preferences?.rendering)?saved.preferences.rendering:'auto';
          this.data.pins = restorePins(saved.pins);
          this.data.pinHistory = restorePins(saved.pinHistory,true);
        }
      } catch { /* A damaged local cache never submits or invents messages. */ }
      this.prune();this.save();
    }
    prune() {
      const unresolved=this.data.outbox.filter(row=>['pending','uncertain'].includes(row.state)),settled=this.data.outbox.filter(row=>!['pending','uncertain'].includes(row.state)).slice(-50);
      this.data.outbox=[...unresolved,...settled].sort((a,b)=>(a.at||0)-(b.at||0));
    }
    save() { try { this.storage.setItem(KEY,JSON.stringify(this.data)); return true; } catch { return false; } }
    draft(agent) { return this.data.drafts[agent] || ''; }
    setDraft(agent,text) { if (!AGENTS.includes(agent)) return; this.data.drafts[agent] = String(text).slice(0,16000); return this.save(); }
    setAttachments(rows,persist=true) {
      const seen=new Set();this.data.attachments=(Array.isArray(rows)?rows:[]).filter(row=>row&&AGENTS.includes(row.agent)&&typeof row.id==='string'&&row.id.length<=160&&!seen.has(row.id)&&(seen.add(row.id),true)).slice(0,48).map(row=>({id:row.id,agent:row.agent,state:'ready',name:String(row.name||'Attachment').slice(0,240),mimeType:String(row.mimeType||'application/octet-stream').slice(0,120),sizeBytes:Math.max(0,Number(row.sizeBytes)||0),durationMs:Math.max(0,Number(row.durationMs)||0)}));
      return persist?this.save():true;
    }
    unresolved(agent) { return this.data.outbox.find(row => row.agent === agent && ['pending','uncertain'].includes(row.state)); }
    begin(agent,path,body) {
      if (this.unresolved(agent)) throw Error('An earlier submission needs its exact-ID acknowledgement.');
      const row = {id:body.idempotencyKey,agent,path,body:JSON.parse(JSON.stringify(body)),state:'pending',at:Date.now(),note:'Waiting for gateway acknowledgement'};
      this.data.outbox.push(row);this.prune();
      if (!this.save()) { this.data.outbox.pop(); throw Error('Local submission custody could not be saved. Your draft has not been sent.'); }
      return row;
    }
    retry(id) {
      const row = this.data.outbox.find(entry => entry.id === id);
      if (!row || row.state !== 'uncertain') throw Error('Only the original unconfirmed submission can be retried.');
      row.hasUnconfirmedAttempt = true; row.state = 'pending'; row.note = 'Checking the original submission ID'; if (!this.save()) { row.state = 'uncertain'; throw Error('The original submission custody could not be saved. Nothing was retried.'); }
      return {...row.body,retry:true};
    }
    result(id,{ok,data,error,uncertain}={}) {
      const row = this.data.outbox.find(entry => entry.id === id); if (!row) return null;
      // A late retry failure cannot undo an authoritative original-ID acceptance.
      if (row.state === 'accepted') return row;
      const notDispatched = data?.dispatched === false || data?.status === 'not-dispatched';
      if (ok && !notDispatched) {
        row.state = 'accepted'; row.hasUnconfirmedAttempt = false; row.outcome = data || {}; row.note = data?.disposition || data?.status || 'Gateway acknowledged; task completion is not established';
        if (row.path === '/v1/message' && this.draft(row.agent) === row.body.text) this.data.drafts[row.agent] = '';
      } else {
        // A failure of the current retry never disproves admission of an earlier
        // unconfirmed attempt. Even not-dispatched may describe only this retry.
        const rejected = !row.hasUnconfirmedAttempt && (notDispatched || uncertain === false);
        row.state = rejected ? 'rejected' : 'uncertain'; if (!rejected) row.hasUnconfirmedAttempt = true;
        row.note = String(error || data?.error || data?.reason || 'Acceptance is unconfirmed. Keep the original request ID.').slice(0,800);
      }
      this.save(); return row;
    }
    // Pins are user-selected local snapshots, not server pins, fresh history or
    // authorization to act/speak. The caller supplies an already loaded public
    // message/event; replacement sessions never inherit or retarget these IDs.
    pin(agent,sessionId,message) {
      const identity=pinIdentity({...message,agent,sessionId,messageId:message?.id});
      const observation=message?.observation;
      if (!identity || message?.sessionId !== sessionId || message.agent !== undefined && message.agent !== agent ||
          message.publicAttested !== true || !['user','assistant'].includes(message.role) || typeof message.text !== 'string' ||
          identity.source === 'authenticated-tool-status' && (message.role !== 'assistant' || observation &&
            (observation.agent !== agent || observation.sessionId !== sessionId || observation.runId !== identity.runId ||
             observation.callId !== identity.callId || observation.phase !== toolKinds[identity.kind]))) {
        throw Error('Pin only a loaded public message or work event from this exact agent and session.');
      }
      const existing=this.data.pins.find(row=>row.agent===agent&&row.sessionId===sessionId&&row.messageId===identity.messageId);
      if (existing) return {...existing};
      if (this.data.pins.length>=PIN_LIMITS.total || this.pins(agent,sessionId).length>=PIN_LIMITS.perSession) throw Error('The device-local pin limit is reached. Unpin a message first.');
      const text=pinText(message.text,PIN_LIMITS.text),row={...identity,scope:PIN_SCOPE,text,title:pinTitle(text),timestamp:pinTime(message.timestamp)?message.timestamp:0,pinnedAt:Date.now()};
      this.updatePins([...this.data.pins,row],{...identity,scope:PIN_SCOPE,action:'pin',title:row.title,at:row.pinnedAt});
      return {...row};
    }
    unpin(agent,sessionId,messageId) {
      if (!pinTarget(agent,sessionId) || !pinId(messageId)) throw Error('Unpin requires an exact agent, session and message ID.');
      const row=this.data.pins.find(pin=>pin.agent===agent&&pin.sessionId===sessionId&&pin.messageId===messageId);
      if (!row) return false;
      const {text,timestamp,pinnedAt,...identity}=row;
      this.updatePins(this.data.pins.filter(pin=>pin!==row),{...identity,action:'unpin',at:Date.now()});
      return true;
    }
    updatePins(pins,event) {
      const previousPins=this.data.pins,previousHistory=this.data.pinHistory;
      this.data.pins=pins;this.data.pinHistory=restorePins([...previousHistory,event],true);
      if (!this.save()) {this.data.pins=previousPins;this.data.pinHistory=previousHistory;throw Error('Device-local pins could not be saved. No pin was changed.');}
    }
    pins(agent,sessionId) {
      return pinTarget(agent,sessionId)?this.data.pins.filter(row=>row.agent===agent&&row.sessionId===sessionId).slice().reverse().map(row=>({...row})):[];
    }
    pinHistory(agent,sessionId) {
      return pinTarget(agent,sessionId)?this.data.pinHistory.filter(row=>row.agent===agent&&row.sessionId===sessionId).slice().reverse().map(row=>({...row})):[];
    }
    preferences(patch) { Object.assign(this.data.preferences,patch);if (![.5,.75,1,1.25,1.5,2].includes(this.data.preferences.playbackRate)) this.data.preferences.playbackRate=1;this.save();return this.data.preferences; }
  }
  window.DracoState = {ClientState,AGENTS,KEY,PIN_LIMITS,occupancyLabel,conversationTarget,runObservation,localRequestRows,mergeConversation,conversationDay};
})();
