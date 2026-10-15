/* DRACO WATCH phone client. Native-only authenticated transport; no automatic model input. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const {SPECS,Chamber,portrait} = window.DracoChamber;
  const {Environment} = window.DracoEnvironment;
  const byId = new Map(SPECS.map(spec=>[spec.id,spec]));
  const local = new window.DracoState.ClientState(localStorage);
  const demo = new URLSearchParams(location.search).get('demo') === '1';
  const state = {selected:'atlas',view:'chats',chat:false,connected:false,connection:'connecting',observed:0,
    bubbles:local.data.preferences.environmentBubbles!==false,nativeFontScale:1,agents:new Map(),histories:new Map(),capabilities:new Map(),filter:'all',activity:[],workActivity:[],activityMode:'live',activityDetail:'concise',fleetCoverage:[],transitions:[],prior:new Map(),
    refreshing:false,refreshQueued:false,nativeActive:true,attachments:local.data.attachments.slice(),recording:false,reply:null,search:'',playing:null,speechPending:new Set()};
  const cards = new Map(), requests = new Map(), expandedHistory = new Set(), historyReads = new Set(), expandedMessages = new Set(), messageOffsets = new Map();
  const expandedActivity = new Set();let activitySignature='',inputModeScope='',activityFollow=true,activityLatestKey='',activityScope='';
  let ownerRecord=null,debugFlushTimer=0,debugFlushing=false,debugEvents=[],debugDropped=0,debugLastVoice='',debugViewport='';
  try{const detail=localStorage.getItem('draco-watch-activity-detail');if(['concise','detailed'].includes(detail))state.activityDetail=detail;}catch{}
  let poll=0,refreshTimeout=0,toastTimer=0,renderSignature='',renderLatestScope='',renderLatestKey='',forceScroll=false,recordStart=0,recordTimer=0;
  const uid = prefix => prefix+'_'+(crypto.randomUUID?.().replaceAll('-','') || Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
  const create = (tag,className,text) => {const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
  const button = (text,handler,className='secondary-button') => {const el=create('button',className,text);el.type='button';el.addEventListener('click',handler);return el;};
  const date = value => {if(typeof value==='number')return value<1e11?value*1000:value;const n=Date.parse(value);return Number.isFinite(n)?n:0;};
  const time = value => date(value)?new Date(date(value)).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'—';
  const number = value => typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
  const label = window.DracoState.occupancyLabel;
  const visible = () => !document.hidden&&state.nativeActive;
  const live = () => state.connected&&(state.connection==='live'||state.connection==='demo');
  const row = () => state.agents.get(state.selected);
  const caps = () => {const advertised=state.capabilities.get(state.selected),current=row();return advertised&&current?.sessionId&&advertised.sessionId===current.sessionId?
    {...advertised,strictSteer:live()&&current.capabilities?.strictSteer===true,steer:live()&&current.capabilities?.strictSteer===true&&current.capabilities?.steer===true}:{};};
  const attachments = () => state.attachments.filter(item=>item.agent===state.selected&&item.state==='ready');
  const history = () => state.histories.get(state.selected);
  const lightweight = () => local.data.preferences.rendering==='light'||local.data.preferences.rendering==='auto'&&(state.lowMemoryPhone||navigator.hardwareConcurrency>0&&navigator.hardwareConcurrency<=4||navigator.deviceMemory>0&&navigator.deviceMemory<=4);
  const motion = () => !local.data.preferences.motion&&!matchMedia('(prefers-reduced-motion:reduce)').matches;
  const native = (method,...args) => {const bridge=window.DracoNative;if(typeof bridge?.[method]!=='function'){toast('This control is available in the installed Android app.');return false;}try{bridge[method](...args);return true;}catch(error){diagnostic('bridge.failure',{phase:method,errorName:error?.name||'BridgeError'},'error');toast('The Android bridge could not complete this action.');return false;}};
  let voiceStatus={state:'idle'},voiceMessage=null,mediaStatus=null,manualMedia=null,voiceTick=0;
  const voice = new window.DracoReplySpeech.ReplySpeech({
    prepare:body=>new Promise((resolve,reject)=>request('POST','/v1/speech',{...body,idempotencyKey:uid('speech')},response=>response.ok?resolve(response.data):reject(Error(response.error||'Approved voice generation unavailable.')),{timeout:130000})),
    play:(path,id)=>{state.playing=id;return native('playMedia',path,id);},stop:()=>{state.playing=null;native('stopMedia');},
    status:info=>{voiceStatus=info;voiceMessage=history()?.conversation?.find(m=>m.id===info.messageId)||voiceMessage;voiceDiagnostic(info);renderVoice();telegramSchedule();}
  });
  function syncVoice(hydrate=false){voice.sync({hydrate,agent:state.selected,sessionId:row()?.sessionId,
    ready:live()&&visible()&&state.chat&&!state.recording&&(!state.playing||state.playing===voice.active?.playbackId)&&history()?.sessionId===row()?.sessionId&&history()?.historyState?.status!=='unavailable'&&caps().speech===true,
    enabled:!demo&&local.data.preferences.automaticSpeech},history()?.conversation||[]);renderVoice();}
  const audioTime = value => {const seconds=Math.max(0,Math.floor((Number(value)||0)/1000));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
  function audioPayload(){
    const synthesis=voice.active||voiceStatus.source==='synthesis'&&voiceStatus.messageId;
    const base=voice.active?voiceStatus:manualMedia&&mediaStatus?.id===manualMedia.id?{...manualMedia,...mediaStatus}:voiceStatus;
    const id=base.playbackId||base.id||'',messageId=base.messageId||'',sessionId=base.sessionId||'';
    const current=state.chat&&base.agent===state.selected&&sessionId===row()?.sessionId;
    if(!current||!id||!messageId||!['preparing','loading','downloading','downloaded','playing','paused','error'].includes(base.state))return null;
    const source=base.source|| (synthesis?'synthesis':'recording'),progress=base.progress===undefined?null:base.progress;
    return {id,agent:base.agent,sessionId,messageId,state:base.state,source,
      label:source==='synthesis'?'Generate approved speech for this report':'Existing approved recording',
      elapsedMs:Math.max(0,Date.now()-(base.startedAt||Date.now())),progress,
      positionMs:Math.max(0,Number(base.positionMs)||0),durationMs:Math.max(0,Number(base.durationMs)||0),
      canPause:['playing','paused'].includes(base.state)&&typeof window.DracoNative?.pauseMedia==='function',
      canSeek:base.durationMs>0&&typeof window.DracoNative?.seekMedia==='function',error:base.error||'',
      cancelNote:base.state==='preparing'?'Cancel stops waiting locally; server synthesis may finish without playback.':'Stop this recording on this device.'};
  }
  function renderVoice(){
    const audio=audioPayload(),active=!!audio;$('voice-player').hidden=!active;
    clearTimeout(voiceTick);voiceTick=0;
    if(!audio){$('voice-status').textContent='Manual audio · select a report to play';return;}
    const names={preparing:'Preparing',loading:'Downloading',downloading:'Downloading',downloaded:'Ready',playing:'Playing',paused:'Paused',error:'Failed'};
    $('voice-status').textContent=byId.get(audio.agent).name+' · '+audio.label+' · Report '+audio.messageId.slice(-12)+' · '+(names[audio.state]||audio.state)+
      (['preparing','loading','downloading'].includes(audio.state)?' · '+audioTime(audio.elapsedMs)+' elapsed':'')+
      (audio.progress!==null?' · '+(typeof audio.progress==='object'?audio.progress.percent:audio.progress)+'%':'')+(audio.error?' · '+audio.error:'');
    $('voice-player').dataset.state=audio.state;$('voice-stop').hidden=false;$('voice-stop').textContent=audio.state==='preparing'?'Cancel preparation':'Stop audio';$('voice-stop').title=audio.cancelNote;
    $('voice-replay').hidden=true;$('voice-rate').parentElement.hidden=false;
    $('voice-pause').hidden=!audio.canPause;$('voice-pause').textContent=audio.state==='paused'?'Resume':'Pause';
    $('voice-position').textContent=audioTime(audio.positionMs)+' / '+(audio.durationMs?audioTime(audio.durationMs):'duration pending');
    $('voice-seek').hidden=!audio.canSeek;$('voice-seek').max=String(audio.durationMs||1);$('voice-seek').value=String(audio.positionMs);
    $('voice-cancel-note').textContent=audio.cancelNote;
    if(['preparing','loading','downloading'].includes(audio.state)&&visible()){voiceTick=setTimeout(()=>{renderVoice();telegramSchedule();},1000);}
  }
  function audioControl(action,id,positionMs){
    const audio=audioPayload();if(!audio||id!==audio.id||!visible())return false;
    if(action==='seek'&&audio.canSeek&&Number.isFinite(positionMs))return native('seekMedia',id,Math.max(0,Math.min(audio.durationMs,positionMs)));
    if(action==='pause'&&audio.canPause&&audio.state==='playing')return native('pauseMedia',id);
    if(action==='resume'&&audio.canPause&&audio.state==='paused')return native('resumeMedia',id);
    return false;
  }
  function playRecording(message,media,url,id){
    voice.cancel();native('stopMedia');state.playing=id;if(media.kind!=='audio'){manualMedia=null;mediaStatus=null;native('playMedia',url,id);renderVoice();return;}
    manualMedia={id,agent:state.selected,sessionId:message.sessionId,messageId:message.id,source:'recording',startedAt:Date.now(),state:'loading'};
    mediaStatus={...manualMedia};native('playMedia',url,id);renderVoice();syncVoice();
  }
  const diagnosticKeys=['agent','sessionId','runId','callId','messageId','requestId','correlationId','phase','source','reason','errorName','errorCode','file','status','durationMs','elapsedMs','width','height','fontScale','appScale','line','column','bytes','count','queued','connected','native','manual'];
  function diagnostic(event,fields={},level='info'){
    const entry={component:'web',event,level};
    for(const key of diagnosticKeys){const value=fields[key];if(typeof value==='number'&&Number.isFinite(value)||typeof value==='boolean')entry[key]=value;else if(typeof value==='string')entry[key]=value.slice(0,key==='file'?160:200);}
    debugEvents.push(entry);if(debugEvents.length>100){debugEvents.shift();debugDropped++;}
    // Native ring survives WebView UI state and is separately available in export.
    try{window.DracoNative?.recordDiagnostic?.(JSON.stringify(entry));}catch{}
    clearTimeout(debugFlushTimer);debugFlushTimer=setTimeout(flushDiagnostics,750);
  }
  function voiceDiagnostic(info){const key=[info.playbackId||info.id,info.state,info.error?'error':''].join(':');if(key===debugLastVoice)return;debugLastVoice=key;diagnostic('voice.phase',{agent:info.agent||manualMedia?.agent,sessionId:info.sessionId||manualMedia?.sessionId,messageId:info.messageId||manualMedia?.messageId,requestId:info.playbackId||info.id,phase:info.state,source:info.source||manualMedia?.source,elapsedMs:info.elapsedMs,manual:info.automatic!==true,errorCode:info.error?'playback-failed':undefined},info.error?'error':'info');}
  function flushDiagnostics(){
    if(debugFlushing||!debugEvents.length||!live()||!window.DracoNative?.request)return;
    const events=[];while(debugEvents.length&&events.length<20){const next=debugEvents[0];if(events.length&&JSON.stringify({events:[...events,next]}).length>14000)break;events.push(debugEvents.shift());}debugFlushing=true;
    request('POST','/v1/diagnostics',{events},response=>{debugFlushing=false;if(!response.ok){debugDropped+=events.length;return;}if(debugEvents.length)debugFlushTimer=setTimeout(flushDiagnostics,750);},{timeout:5000});
  }
  function diagnosticSnapshot(){let nativeInfo=null;try{nativeInfo=JSON.parse(window.DracoNative?.nativeDiagnostics?.()||'null');}catch{}return {schema:'draco.web-diagnostics.v1',capturedAt:Date.now(),view:state.view,chat:state.chat,agent:state.selected,sessionId:row()?.sessionId||'',connected:live(),appScale:local.data.preferences.scale/100,fontScale:state.nativeFontScale,viewport:{width:innerWidth,height:innerHeight},dropped:debugDropped,pending:debugEvents.slice(),native:nativeInfo};}
  function openDebug(){const dialog=$('debug-dialog');if(!dialog.open)dialog.showModal();refreshDebug();telegramSchedule();}
  function refreshDebug(){
    const local=diagnosticSnapshot();$('debug-state').textContent='Local metadata only · loading server journal…';$('debug-content').textContent=JSON.stringify({local},null,2);
    request('GET','/v1/diagnostics',null,response=>{if(!$('debug-dialog').open)return;$('debug-state').textContent=response.ok?'Metadata-only journal · not a transcript or full tool record':'Server journal unavailable · local metadata retained';$('debug-content').textContent=JSON.stringify({local:diagnosticSnapshot(),server:response.ok?response.data:{available:false,status:response.status||0,reason:'request-failed'}},null,2);},{timeout:5000});
  }
  function exportDebug(){
    const local=diagnosticSnapshot();request('GET','/v1/diagnostics/export',null,response=>{const bundle={schema:'draco.debug-bundle.v1',local,server:response.ok?response.data:{available:false,status:response.status||0}};const text=JSON.stringify(bundle,null,2);if(typeof window.DracoNative?.exportDiagnostics==='function')native('exportDiagnostics',text);else if(text.length<60000)share(text);else toast('Install the updated app to export this full diagnostic bundle as a file.');},{timeout:5000});
  }
  function ownerRef(event){const ref=event?.detailRef;return ref&&ref.agent===event.agent&&ref.sessionId===event.sessionId&&ref.sessionKey===event.sessionKey&&ref.runId===event.runId&&ref.callId===event.callId&&typeof ref.recordId==='string'&&typeof ref.revision==='string'&&typeof ref.url==='string'&&ref.url.startsWith('/v1/work/detail?')?ref:null;}
  function openOwnerRecord(event){
    const ref=ownerRef(event);if(!ref||!workFresh(event))return toast('The exact recorded source is unavailable. Refresh this activity.');
    ownerRecord={ref:{...ref},key:activityKey(event),reveal:false,text:'',offset:0,pending:false,complete:false,loadAll:false};
    $('owner-record-content').textContent='';$('owner-record-export').disabled=true;$('owner-record-load-all').disabled=false;$('owner-record-cancel-load').hidden=true;$('owner-record-reveal').textContent='Reveal credentials…';$('owner-record-dialog').showModal();loadOwnerRecord();telegramSchedule();
  }
  function loadOwnerRecord(){
    const record=ownerRecord;if(!record||record.pending||record.complete||record.failed)return;
    const current=state.workActivity.find(event=>activityKey(event)===record.key),ref=ownerRef(current);
    if(!ref||JSON.stringify(ref)!==JSON.stringify(record.ref)||!workFresh(current)){ownerRecord=null;$('owner-record-content').textContent='';$('owner-record-status').textContent='Source changed or is unavailable. Close and reopen the exact activity record.';$('owner-record-more').disabled=true;return;}
    record.pending=true;$('owner-record-more').disabled=true;$('owner-record-status').textContent='Loading exact recorded source · '+(record.reveal?'credentials revealed by your choice':'credentials masked');
    const url=record.ref.url+'&offset='+record.offset+'&limit=32768&revealCredentials='+String(record.reveal);
    request('GET',url,null,response=>{
      if(ownerRecord!==record||!$('owner-record-dialog').open)return;record.pending=false;
      const data=response.data,identity=data?.identity,match=identity&&['agent','sessionKey','sessionId','runId','callId','recordId'].every(key=>identity[key]===record.ref[key]);
      const current=state.workActivity.find(event=>activityKey(event)===record.key),currentRef=ownerRef(current);
      if(!currentRef||JSON.stringify(currentRef)!==JSON.stringify(record.ref)||!workFresh(current)){record.failed=true;record.loadAll=false;$('owner-record-content').textContent='';$('owner-record-status').textContent='Exact source changed while loading. Close and reopen the current event.';return;}
      if(!response.ok||!match||data.schema!=='draco.owner-work-detail.v1'||data.revision!==record.ref.revision||data.offset!==record.offset||typeof data.text!=='string'||data.sourceTruncated!==false||data.credentialMode!==(record.reveal?'revealed':'masked')||!Number.isSafeInteger(data.totalChars)||data.totalChars<record.text.length+data.text.length||record.totalChars!==undefined&&record.totalChars!==data.totalChars||data.complete!==true&&(!Number.isSafeInteger(data.nextOffset)||data.nextOffset!==record.offset+data.text.length||!data.text.length)){record.failed=true;record.loadAll=false;$('owner-record-status').textContent='Exact recorded source unavailable or changed · '+(response.data?.reason||'identity-validation-failed')+'. No substitute record was opened.';return;}
      record.text+=data.text;record.offset=data.nextOffset;record.complete=data.complete===true;record.totalChars=data.totalChars;
      $('owner-record-content').textContent=record.text;$('owner-record-status').textContent='Recorded tool input/result · '+record.text.length+' / '+data.totalChars+' characters · '+data.credentialMode+' · '+(record.complete?'complete':'more available');$('owner-record-more').disabled=record.complete;$('owner-record-more').hidden=record.complete;$('owner-record-export').disabled=!record.complete;$('owner-record-load-all').disabled=record.complete;
      if(record.complete)record.loadAll=false;$('owner-record-cancel-load').hidden=!record.loadAll;if(record.loadAll)setTimeout(()=>{if(ownerRecord===record)loadOwnerRecord();},0);
    });
  }
  function exportOwnerRecord(){
    const record=ownerRecord;if(!record||record.pending||record.failed||!record.complete)return toast('Load the complete exact record before exporting it.');
    const current=state.workActivity.find(e=>activityKey(e)===record.key),ref=ownerRef(current);
    if(!ref||JSON.stringify(ref)!==JSON.stringify(record.ref)||!workFresh(current))return toast('Source changed. Reopen and reload the current record before exporting.');
    if(record.reveal&&!confirm('This complete owner record contains revealed credentials. Export it deliberately?'))return;
    // Revalidate source binding once more immediately before external sharing.
    request('GET',record.ref.url+'&offset=0&limit=1&revealCredentials='+record.reveal,null,response=>{
      if(ownerRecord!==record||!$('owner-record-dialog').open)return;
      const data=response.data,source=state.workActivity.find(e=>activityKey(e)===record.key),currentRef=ownerRef(source);
      if(!response.ok||!currentRef||JSON.stringify(currentRef)!==JSON.stringify(record.ref)||!workFresh(source)||data?.revision!==record.ref.revision||data?.totalChars!==record.totalChars||data?.credentialMode!==(record.reveal?'revealed':'masked')||data?.offset!==0||typeof data?.text!=='string'||!record.text.startsWith(data.text)||!['agent','sessionKey','sessionId','runId','callId','recordId'].every(key=>data?.identity?.[key]===record.ref[key]))return toast('Export refused: exact record binding changed. Reopen the current record.');
      const {url,...identity}=record.ref;const text=JSON.stringify({schema:'draco.owner-work-export.v1',identity,credentialMode:record.reveal?'revealed':'masked',complete:true,recordedSource:record.text},null,2);
      if(typeof window.DracoNative?.exportOwnerRecord==='function')native('exportOwnerRecord',text);else if(text.length<60000)share(text);else toast('Complete record is loaded. Install the updated app to export it as a file; no truncated share was attempted.');
    });
  }
  function toast(text){if(typeof window.DracoNative?.notifyTelegram==='function')window.DracoNative.notifyTelegram(String(text));clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,5500);}
  function applyPreferences(){const preferences=local.data.preferences;document.documentElement.style.setProperty('--display-scale',String(preferences.scale/100));$('display-scale').value=preferences.scale;$('telegram-copy').checked=preferences.echoToTelegram!==false;$('automatic-speech').checked=preferences.automaticSpeech===true;$('playback-rate').value=String(preferences.playbackRate);$('voice-rate').value=String(preferences.playbackRate);$('scale-value').textContent=preferences.scale+'%';$('reduce-motion').checked=preferences.motion;document.body.classList.toggle('reduced-motion',!motion());$('rendering-mode').value=preferences.rendering;$('rendering-note').textContent=(lightweight()?'Lightweight spatial views: 30 fps, reduced drawing resolution.':'Smooth mode · up to 60 fps.')+' All communication features remain available.';chamber.quality(lightweight());environment.quality(lightweight());viewport();if(cards.size)renderRoster();}
  const chamber = new Chamber($('chamber-canvas'),{select:id=>openChat(id),zoomChanged:value=>$('zoom-level').textContent=value+'%'});
  let environmentBubbles;
  const environment = new Environment($('environment-canvas'),{select:id=>openChat(id),zoomChanged:value=>$('environment-zoom-level').textContent=value+'%',onFrame:()=>environmentBubbles?.layout()});
  environmentBubbles = new window.DracoEnvironmentBubbles.Bubbles({stage:$('environment-stage'),renderer:environment,specs:SPECS,select:id=>openChat(id)});

  function buildRoster(){
    const roster=document.createDocumentFragment(),chips=document.createDocumentFragment(),stations=document.createDocumentFragment(),filters=document.createDocumentFragment();
    for(const spec of SPECS){
      const card=create('button','agent-card');card.type='button';card.style.setProperty('--agent-color',spec.color);
      const image=create('canvas');image.setAttribute('aria-hidden','true');portrait(image,spec);
      const info=create('span','card-info'),name=create('span','card-name',spec.name),draft=create('span','draft-tag','Draft');name.append(draft);
      const status=create('span','card-status'),pip=create('i','status-dot'),statusText=create('span','','Unobserved');status.append(pip,statusText);
      const preview=create('span','card-preview',spec.role),meta=create('span','card-meta',spec.temporary?'Avatar: provisional':'Distinct identity');
      info.append(name,status,preview,meta);card.append(image,info,create('span','card-chevron','›'));card.addEventListener('click',()=>openChat(spec.id));
      cards.set(spec.id,{card,statusText,pip,preview,meta,draft});roster.append(card);
      const chip=button(spec.name,()=>openChat(spec.id),'agent-chip');chip.style.setProperty('--agent-color',spec.color);chips.append(chip);
      const station=button(spec.name,()=>openChat(spec.id),'environment-agent');station.style.setProperty('--agent',spec.color);station.dataset.agent=spec.id;stations.append(station);
    }
    for(const id of ['all',...byId.keys()]){const filter=button(id==='all'?'All':byId.get(id).name,()=>{setActivityFilter(id);},'filter-button');filter.dataset.filter=id;filters.append(filter);}
    $('agent-roster').replaceChildren(roster);$('agent-chips').replaceChildren(chips);$('environment-stations').replaceChildren(stations);$('activity-filters').replaceChildren(filters);renderFilters();
  }
  function renderFilters(){for(const filter of document.querySelectorAll('[data-filter]')){filter.classList.toggle('selected',filter.dataset.filter===state.filter);filter.setAttribute('aria-pressed',String(filter.dataset.filter===state.filter));}}
  function renderConnection(){
    $('connection-bar').dataset.state=state.connection;
    $('connection-label').textContent=({live:'Connected',connecting:'Connecting…',offline:'Offline',stale:'Observation expired',unpaired:'Not paired',demo:'DEMO · not live'})[state.connection]||'Offline';
    $('observed-time').textContent=state.observed?'Observed '+time(state.observed):'—';
    $('connection-notice').hidden=state.connection==='live';
    $('notice-text').textContent=demo?'Preview only. These are labelled fixtures, not real agent activity.':state.connection==='stale'?'The connection has expired. Live state is unknown; no messages will be submitted.':state.connection==='connecting'?'Opening your paired connection…':state.message||'Open connection settings to reconnect.';
    $('connect').hidden=demo;$('refresh').disabled=state.refreshing;$('chamber-state').textContent=live()?demo?'DEMO':'LIVE':'FROZEN';
    $('environment-state').textContent=live()?demo?'DEMO · NOT LIVE':'LIVE STATE':'UNOBSERVED · FROZEN';
    $('settings-connection').textContent=live()?'Paired and connected. Session controls remain capability-bound.':'Connection unavailable. Drafts remain on this device.';
  }
  function renderRoster(){let active=0,waiting=0,known=0,activeKnown=0,queueKnown=0;
    for(const spec of SPECS){const agent=state.agents.get(spec.id),status=live()?agent?.status||'unknown':'unknown',card=cards.get(spec.id);card.statusText.textContent=label(status);card.pip.className='status-dot '+status;
      card.draft.hidden=!local.draft(spec.id)&&!local.unresolved(spec.id);
      const last=state.activity.filter(entry=>entry.agent===spec.id).at(-1)||state.histories.get(spec.id)?.conversation?.at(-1);
      card.preview.textContent=local.unresolved(spec.id)?'A submission is awaiting its exact acknowledgement.':local.draft(spec.id)?'Draft: '+local.draft(spec.id):window.DracoEnvironmentBubbles.previewText(last?attachmentSummary(last)||last.text||spec.role:spec.role);
      card.meta.textContent=live()&&agent?[(agent.telemetry?.model||''),number(agent.telemetry?.activeSessions)!==null?agent.telemetry.activeSessions+' open sessions':'',spec.temporary?'Avatar: provisional':''].filter(Boolean).join(' · ')||'Open conversation':spec.temporary?'Avatar: provisional':'Open conversation';
      card.card.setAttribute('aria-label',`${spec.name}, ${label(status)}. Open conversation.`);
      if(status!=='unknown')known++;if(live()&&number(agent?.telemetry?.activeSessions)!==null){active+=agent.telemetry.activeSessions;activeKnown++;}if(live()&&number(agent?.telemetry?.queuedSessions)!==null){waiting+=agent.telemetry.queuedSessions;queueKnown++;}
    }
    $('active-total').textContent=activeKnown?active+(activeKnown<6?' + ?':''):'—';$('queued-total').textContent=queueKnown?waiting+(queueKnown<6?' + ?':''):'—';$('observed-total').textContent=known+'/6';
    chamber.update(state.agents,live(),state.selected,motion());environment.update(state.agents,live(),state.selected,motion());environmentBubbles.update(state.activity.filter(event=>!event.receivedOnly),state.agents,{live:live(),selected:state.selected,motion:motion(),nativeFontScale:state.nativeFontScale,appFontScale:local.data.preferences.scale/100});
    for(const station of $('environment-stations').children){const status=live()?state.agents.get(station.dataset.agent)?.status||'unknown':'unknown';station.dataset.status=status;station.setAttribute('aria-label',byId.get(station.dataset.agent).name+', '+label(status)+'. Open conversation.');}
  }
  function normalizedAgent(agent){if(!byId.has(agent?.id))return null;const raw=String(agent.status||'unknown');const status=['active','idle','queued'].includes(raw)?raw:'unknown';return {...agent,status,conversationStatus:['active','idle','queued'].includes(agent.conversationStatus)?agent.conversationStatus:'unknown',telemetry:agent.telemetry||{},capabilities:agent.capabilities||{},controlTargets:Array.isArray(agent.controlTargets)?agent.controlTargets.filter(target=>target.agent===agent.id&&typeof target.sessionId==='string'&&typeof target.runId==='string'):[]};}
  function normalizeMessages(rows){return (Array.isArray(rows)?rows:[]).filter(message=>message&&['user','assistant'].includes(message.role)&&typeof message.id==='string'&&typeof message.text==='string').slice(-1000).map(message=>({...message,text:message.text.slice(0,500000),timestamp:date(message.timestamp),media:Array.isArray(message.media)?message.media.filter(media=>typeof media?.kind==='string').slice(0,8):[]}));}
  window.onDracoSnapshot=snapshot=>{
    if(!snapshot||typeof snapshot!=='object')return;state.refreshing=false;clearTimeout(refreshTimeout);
    const observed=date(snapshot.lastSuccess)||date(snapshot.capturedAt);const wasLive=live();state.observed=observed;state.connected=snapshot.connected===true&&observed>0&&Date.now()-observed<=15000;state.connection=demo?'demo':state.connected?'live':snapshot.connected?'stale':'offline';state.message=state.connected?'':'Live connection unavailable. Your drafts stay saved on this phone.';if(wasLive!==live())diagnostic('connection',{connected:live(),phase:state.connection});
    const agents=new Map();for(const source of snapshot.agents||[]){const agent=normalizedAgent(source);if(agent)agents.set(agent.id,agent);}state.agents=agents;
    if(state.connected)for(const receipt of snapshot.steeringReceipts||[]){const agent=agents.get(receipt?.agent);if(agent?.sessionId!==receipt.sessionId)continue;const item=local.steeringResult(receipt);
      if(item?.outcome?.steering?.status==='accepted'){
        for(const id of item.body.attachmentIds||[])if(state.attachments.some(a=>a.id===id))native('releaseAttachment',id);
        state.attachments=state.attachments.filter(a=>!item.body.attachmentIds?.includes(a.id));local.setAttachments(state.attachments);
        if(state.chat&&state.selected===item.agent&&$('draft').value===item.body.text)$('draft').value=local.draft(item.agent);
      }}
    for(const spec of SPECS){const agent=agents.get(spec.id),before=state.prior.get(spec.id);if(wasLive&&live()&&before&&before!=='unknown'&&agent?.status!=='unknown'&&before!==agent?.status)state.transitions.push({id:uid('observed'),agent:spec.id,text:`Observed state: ${label(before)} → ${label(agent.status)}.`,timestamp:observed,kind:'Observed change'});state.prior.set(spec.id,live()?agent?.status||'unknown':'unknown');}
    state.transitions=state.transitions.slice(-80);
    state.fleetCoverage=Array.isArray(snapshot.fleetCoverage)?snapshot.fleetCoverage.filter(source=>byId.has(source?.agent)):[];
    const received=state.activity;
    const current=state.connected&&Array.isArray(snapshot.fleetActivity)?normalizeMessages(snapshot.fleetActivity.filter(event=>byId.has(event?.agent)&&typeof event.sessionId==='string'&&event.sessionId.length>0&&event.sessionId===agents.get(event.agent)?.sessionId&&event.role==='assistant'&&event.source!=='authenticated-tool-status'&&!['Tool started','Tool finished','Tool failed'].includes(event.kind))).map(event=>({...event,receivedOnly:false})):[];
    // A missed refresh is not a source withdrawal. Retain public text only as
    // explicitly last received, never for live summaries, bubbles or speech.
    // A verified empty feed or physical-session rollover removes prior rows.
    const delayed=received.filter(event=>!state.connected||event.sessionId===agents.get(event.agent)?.sessionId&&state.fleetCoverage.some(source=>source.agent===event.agent&&source.available===false)).map(event=>({...event,receivedOnly:true}));
    const merged=new Map(delayed.map(event=>[activityKey(event),event]));for(const event of current)merged.set(activityKey(event),event);
    state.activity=[...merged.values()].sort((a,b)=>Number(a.receivedOnly)-Number(b.receivedOnly)||b.timestamp-a.timestamp).slice(0,180).sort((a,b)=>a.timestamp-b.timestamp||a.id.localeCompare(b.id));
    // Tool status is a distinct, audience-attested stream. Never merge it with
    // conversation or public-report state used by roster, bubbles and speech.
    state.workActivity=state.connected&&Array.isArray(snapshot.workActivity)?normalizeMessages(snapshot.workActivity.filter(event=>byId.has(event?.agent)&&typeof event.sessionId==='string'&&event.sessionId.length>0&&event.sessionId===agents.get(event.agent)?.sessionId&&event.role==='assistant'&&event.publicAttested===true&&event.source==='authenticated-tool-status'&&['Tool started','Tool finished','Tool failed'].includes(event.kind))).filter(event=>!event.observation||event.observation.version===1&&event.observation.agent===event.agent&&event.observation.sessionId===event.sessionId&&event.observation.runId===event.runId&&event.observation.callId===event.callId&&typeof event.observation.tool==='string'&&/^[A-Za-z0-9_.]{1,160}$/.test(event.observation.tool)&&(event.sessionKey===undefined||event.sessionKey===agents.get(event.agent)?.sessionKey)&&(event.observation.sessionKey===undefined||event.observation.sessionKey===event.sessionKey)&&({start:'Tool started',result:'Tool finished',error:'Tool failed'})[event.observation.phase]===event.kind).map(event=>({id:event.id,agent:event.agent,sessionKey:event.sessionKey,sessionId:event.sessionId,runId:event.runId,callId:event.callId,observation:event.observation,evidenceRevision:event.evidenceRevision,evidenceSource:event.evidenceSource,detailRef:event.detailRef,role:'assistant',text:event.text.slice(0,2000),timestamp:event.timestamp,kind:event.kind,source:event.source,publicAttested:true})):[];
    const selected=byId.has(snapshot.selectedAgent)?snapshot.selectedAgent:state.selected;
    if(state.connected){const sessionId=agents.get(selected)?.sessionId,previous=state.histories.get(selected),unavailable=agents.get(selected)?.historyAvailable===false||snapshot.historyState?.status==='unavailable';
      if(previous&&sessionId&&previous.sessionId!==sessionId){state.histories.delete(selected);expandedHistory.delete(selected);}
      if(unavailable){const retained=previous&&previous.sessionId===sessionId?previous:{conversation:[],sessionId,hasMore:false};state.histories.set(selected,{...retained,historyState:{...snapshot.historyState,status:'unavailable'},saved:true});}
      else if(expandedHistory.has(selected)&&previous?.sessionId===sessionId){
        if(state.chat&&selected===state.selected)loadHistory(selected,false);
        else state.histories.set(selected,{...previous,saved:true,historyState:{status:'unavailable'}});
      }
      else{expandedHistory.delete(selected);state.histories.set(selected,{conversation:normalizeMessages(snapshot.conversation),sessionId,historyState:snapshot.historyState||{},hasMore:snapshot.historyHasMore===true,total:snapshot.total});}}
    else {markSavedHistories();state.capabilities.clear();}
    if(ownerRecord){const current=state.workActivity.find(e=>activityKey(e)===ownerRecord.key);if(!current||JSON.stringify(ownerRef(current))!==JSON.stringify(ownerRecord.ref)){$('owner-record-content').textContent='';$('owner-record-status').textContent='Source session or revision changed. Close and reopen the current activity.';ownerRecord=null;$('owner-record-more').disabled=true;}}
    renderAll();syncVoice();if(state.connected&&!demo&&(!state.capabilities.has(selected)||!wasLive))loadCapabilities(selected);
    const queued=state.refreshQueued;state.refreshQueued=false;schedule(queued?60:3000);
  };
  function markSavedHistories(){for(const [agent,previous] of state.histories)state.histories.set(agent,{...previous,saved:true,historyState:{status:'unavailable'}});}
  window.onDracoConnection=info=>{clearTimeout(refreshTimeout);state.refreshing=false;state.connected=false;state.connection=info?.state==='unpaired'?'unpaired':'offline';state.message=info?.message||'Your connection is unavailable.';if(info?.state==='unpaired'){state.histories.clear();state.activity=[];state.workActivity=[];}else markSavedHistories();state.capabilities.clear();renderAll();syncVoice();schedule(3000);};
  window.onDracoLifecycle=info=>{state.nativeActive=info?.active!==false;syncVoice();if(visible()){checkStale();schedule(0);chamber.show(state.view==='chamber'&&!state.chat);environment.show(state.view==='environment'&&!state.chat);environmentBubbles.show(state.bubbles&&state.view==='environment'&&!state.chat);}else{clearTimeout(poll);chamber.show(false);environment.show(false);environmentBubbles.show(false);}};
  function workFresh(event){return live()&&(!Number.isFinite(event.evidenceSource?.freshUntil)||Date.now()<event.evidenceSource.freshUntil);}
  function checkStale(){if(!demo&&state.connected&&Date.now()-state.observed>15000){state.connected=false;state.connection='stale';markSavedHistories();state.capabilities.clear();renderAll();syncVoice();return;}const retained=state.workActivity.filter(workFresh);let expired=false;state.fleetCoverage=state.fleetCoverage.map(source=>{if(source.work?.available===true&&Number.isFinite(source.work.freshUntil)&&Date.now()>=source.work.freshUntil){expired=true;return {...source,work:{...source.work,available:false,partial:true}};}return source;});if(retained.length!==state.workActivity.length||expired){state.workActivity=retained;renderAll();}}
  function schedule(delay){clearTimeout(poll);if(visible())poll=setTimeout(refresh,delay);}
  function refresh(){clearTimeout(poll);if(!visible())return;if(state.refreshing){state.refreshQueued=true;return;}if(demo){fixture();schedule(3000);return;}if(typeof window.DracoNative?.refresh!=='function'){state.connection='unpaired';state.message='Open the installed Android app to use your paired connection.';renderAll();return;}state.refreshing=true;renderConnection();refreshTimeout=setTimeout(()=>window.onDracoConnection({state:'offline',message:'The connection timed out. Drafts and original submission IDs are retained.'}),15000);try{window.DracoNative.refresh(state.selected);}catch{window.onDracoConnection({state:'offline',message:'The phone bridge is unavailable.'});}}
  function receiveResponse(response){if(!response||typeof response.id!=='string')return;const entry=requests.get(response.id);if(!entry)return;clearTimeout(entry.timer);if(!entry.path.startsWith('/v1/diagnostics')&&!response.ok)diagnostic('request.failed',{requestId:response.id,correlationId:response.requestId||response.correlationId,status:response.status||0,reason:response.uncertain===false?'not-dispatched':'unconfirmed'},'error');const unresolved=entry.handler(response);if(!entry.persistent||unresolved!==true)requests.delete(response.id);}
  function request(method,path,body,handler,{id=uid('read'),timeout=25000,persistent=false}={}){
    // Same-ID retries reuse the original listener. A duplicate/pre-transport failure
    // must not swallow an authoritative late acknowledgement from that attempt.
    const previous=requests.get(id),entry=persistent&&previous?.persistent?previous:{handler,path,persistent};clearTimeout(previous?.timer);requests.set(id,entry);
    if(!window.DracoNative?.request){receiveResponse({id,ok:false,status:0,error:'The installed Android connection is unavailable.',uncertain:false});return false;}
    entry.timer=setTimeout(()=>{if(requests.get(id)!==entry)return;entry.timedOut=true;receiveResponse({id,ok:false,status:0,error:body?.mode==='steer'?'Steer acknowledgement timed out. Outcome unconfirmed; do not replay.':'Acknowledgement timed out. Acceptance is unconfirmed; retain and retry only the original ID.'});},timeout);
    try{window.DracoNative.request(id,method,path,body?JSON.stringify(body):'');return true;}catch{receiveResponse({id,ok:false,status:0,error:'Android could not dispatch the request.',uncertain:false});return false;}
  }
  window.onDracoResponse=receiveResponse;
  function loadCapabilities(agent=state.selected){request('GET','/v1/capabilities?agent='+encodeURIComponent(agent),null,response=>{if(response.ok&&response.data&&response.data.agent===agent){state.capabilities.set(agent,response.data);if(agent===state.selected){renderChat();syncVoice();}}});}
  function showView(view,{work=false}={}){if(!['chats','chamber','environment','activity','settings'].includes(view))return;state.view=view;diagnostic('navigation',{phase:view,agent:state.selected,appScale:local.data.preferences.scale/100,fontScale:state.nativeFontScale,width:innerWidth,height:innerHeight});document.body.dataset.view=view;for(const name of ['chats','chamber','environment','activity','settings'])$('view-'+name).hidden=name!==view;for(const item of document.querySelectorAll('[data-view]')){const active=item.dataset.view===view;item.classList.toggle('selected',active);if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');}chamber.show(view==='chamber'&&!state.chat);environment.show(view==='environment'&&!state.chat);environmentBubbles.show(state.bubbles&&view==='environment'&&!state.chat);if(view==='activity'){if(!work){state.activityMode='live';state.filter='all';renderFilters();}activityFollow=true;activitySignature='';renderActivity();}else window.scrollTo({top:0,behavior:'instant'});viewport();}
  function openChat(agent){if(!byId.has(agent))return;if(state.chat&&state.selected!==agent&&state.recording){toast('Finish your voice recording before switching agents.');return;}
    if(state.chat)local.setDraft(state.selected,$('draft').value);const changed=state.selected!==agent;if(changed){voice.cancel();state.playing=null;manualMedia=null;mediaStatus=null;ownerRecord=null;$('owner-record-dialog').close();native('stopMedia');}state.selected=agent;state.chat=true;state.search='';state.reply=null;$('message-search').value='';$('chat-tools').hidden=true;
    $('conversation-screen').hidden=false;document.body.classList.add('chat-open');$('app-shell').inert=true;$('draft').value=local.draft(agent);renderSignature='';forceScroll=true;renderChat();syncVoice();chamber.show(false);environment.show(false);environmentBubbles.show(false);if(changed||!history()||history()?.saved)schedule(0);if(live()&&!state.capabilities.has(agent))loadCapabilities(agent);}
  function closeChat(){local.setDraft(state.selected,$('draft').value);if(state.recording){toast('Finish or remove the voice recording before leaving.');return false;}state.chat=false;syncVoice();state.playing=null;native('stopMedia');$('draft').blur();if(typeof window.DracoNative?.hideKeyboard==='function')native('hideKeyboard');$('conversation-screen').hidden=true;document.body.classList.remove('chat-open');$('app-shell').inert=false;state.reply=null;renderRoster();viewport();chamber.show(state.view==='chamber');environment.show(state.view==='environment');environmentBubbles.show(state.bubbles&&state.view==='environment');return true;}
  function controlTarget(){return window.DracoState.conversationTarget(row());}
  function currentRunObservation(agent=state.selected){return window.DracoState.runObservation(state.agents.get(agent),{live:live(),now:Date.now(),events:state.workActivity,coverage:state.fleetCoverage.find(source=>source.agent===agent)?.work});}
  function conversationRows(){return demo?history()?.conversation||[]:window.DracoState.mergeConversation(history()?.conversation,local.data.outbox,{agent:state.selected,sessionId:row()?.sessionId});}
  function historyCoverage(){
    const current=history(),coverage=current?.historyState||{},count=conversationRows().filter(message=>!message.localSubmission).length;
    if(!current)return 'Loading authenticated conversation · device-saved requests remain separate';
    if(!live())return 'Last received history ('+count+' records) · refresh unavailable. Local requests are device custody, not public replies. Reconnect, then refresh.';
    if(!['unavailable','partial'].includes(coverage.status))return 'Recorded public reports · not full Telegram history. Local requests show admission only.';
    const reasons={'phone-page-budget':'phone page limit','source-limited':'source observation window limited','revalidation-pending':'source revalidation pending','unresolved-owner-proof':'owner delivery proof unresolved','native-history-unavailable':'authenticated history unavailable','history-unavailable':'authenticated history unavailable','upstream-history-unavailable':'source history unavailable','public-output-unresolved':'public delivery evidence unresolved'};
    const reason=reasons[coverage.reason]||'source coverage incomplete; individual missing record identities not supplied';
    return (coverage.status==='partial'?'Partial history':'History unavailable')+' · '+count+' received records retained'+
      (Number.isSafeInteger(coverage.unresolvedCount)&&coverage.unresolvedCount>0?' · '+coverage.unresolvedCount+' unresolved source items':'')+
      ' · '+reason+'. Refresh to retry; Older messages retrieves available earlier pages. No missing reply is invented.';
  }
  function allowed(name){const capability=row()?.capabilities?.[name],advertised=caps();return live()&&!history()?.saved&&!demo&&row()?.sessionId&&(advertised.sessionId===row().sessionId&&advertised[name]===true||capability===true);}
  function renderChat(){if(!state.chat)return;const spec=byId.get(state.selected),agent=row(),current=history();$('conversation-screen').style.setProperty('--selected',spec.color);document.documentElement.style.setProperty('--selected',spec.color);$('conversation-name').textContent=spec.name;$('chat-avatar').textContent=spec.glyph;$('chat-status').textContent=live()?currentRunObservation().conversation+' · '+(agent?.telemetry?.model||'Connected'):'Conversation state unknown · offline · drafts saved';$('draft').placeholder=state.reply?'Reply to selected message…':'Message '+spec.name+'…';
    renderChatWork();
    $('history-note').hidden=false;$('history-note').textContent=historyCoverage();
    renderComposerControls();
    renderOutbox();renderAttachment();renderMessages();positionNewMessages();
  }
  function renderComposerControls(){
    const modeScope=JSON.stringify([state.selected,row()?.sessionKey,row()?.sessionId,controlTarget()?.runId]);
    if(modeScope!==inputModeScope){inputModeScope=modeScope;$('input-mode').value='send';}const agent=row(),current=history();
    const unresolved=local.unresolved(state.selected),hasText=!!$('draft').value.trim(),hasAttachment=attachments().length>0,target=controlTarget();
    $('send').disabled=!allowed('send')||(!hasText&&!hasAttachment)||!!unresolved||state.recording;$('queue').disabled=!allowed('queue')||(!hasText&&!hasAttachment)||!!unresolved||state.recording;
    $('steer').disabled=caps().strictSteer!==true||!allowed('steer')||!target||(!hasText&&!hasAttachment)||!!unresolved||state.recording;$('stop').disabled=!allowed('abort')||!target||!!unresolved;
    const mode=$('input-mode').value;if(mode==='steer')$('send').disabled=$('steer').disabled;else if(mode==='queue')$('send').disabled=$('queue').disabled;
    $('send').setAttribute('aria-label',mode==='steer'?'Steer exact observed run':mode==='queue'?'Queue follow-up (may start now when idle)':'Send / follow-up');
    $('attach').disabled=!live()||current?.saved||demo||caps().attachments!==true||state.recording||!!unresolved;$('record').disabled=!live()||current?.saved||demo||caps().voice!==true||!!unresolved||state.recording;
    $('older-history').disabled=!live()||!current?.hasMore&&conversationRows().length<=50;
    const reason=agent?.capabilities?.reasons||caps().reasons||{};
    const inputNote='Send and Queue submit ordinary input (follow-up while a run is open); neither steers an open run. ';
    $('capability-note').hidden=live();$('capability-note').textContent='Offline · draft saved';$('action-note').textContent=!live()?'Reconnect before sending.':unresolved?'Check the unconfirmed submission before sending more.':inputNote+(caps().strictSteer!==true?'Steer unavailable: no verified exact-run injection.':!allowed('steer')?'Steer unavailable: '+(reason.steer||'no supported exact-run control.'):'Stop targets only the exact displayed conversation run.');$('copy-note').textContent=$('input-mode').value==='steer'?'Steer is submitted only to the exact displayed run; no separate Telegram input copy is sent.':local.data.preferences.echoToTelegram!==false?'Phone submissions also copy to Telegram. Change this in Settings.':'Telegram copies are off. This submission stays phone-only.';
    const draft=$('draft');draft.style.height='auto';draft.style.height=Math.min(132,Math.max(48,draft.scrollHeight))+'px';positionNewMessages();
  }
  function positionNewMessages(){if(state.chat)$('new-messages').style.bottom=($('composer').getBoundingClientRect().height+10)+'px';}
  function renderOutbox(){const container=$('outbox-status'),pending=local.unresolved(state.selected);container.hidden=!pending;if(!pending)return;const prior=pending.body.sessionId!==row()?.sessionId;container.replaceChildren(create('p','',(prior?'Earlier-session request · ':'')+(pending.state==='pending'?'Sending…':pending.body.mode==='steer'?'Steer outcome unconfirmed. Do not replay; awaiting its original receipt.':'Not confirmed. Check this submission before sending another.')));if(pending.state==='uncertain'&&pending.body.mode!=='steer')container.append(button('Retry original ID',()=>retrySubmission(pending.id)));const details=create('details');details.append(create('summary','','Submission details'),create('p','',pending.note),create('p','',`Original ID: ${pending.id}`),button('Copy original ID',()=>copy(pending.id)));container.append(details);}
  function appendText(node,text){const pattern=/https?:\/\/[^\s<>]+/g;let last=0;for(const match of text.matchAll(pattern)){node.append(document.createTextNode(text.slice(last,match.index)));const link=create('a','',match[0]);link.href=match[0];link.rel='noreferrer noopener';link.addEventListener('click',event=>{event.preventDefault();if(!native('openLink',match[0]))copy(match[0]);});node.append(link);last=match.index+match[0].length;}node.append(document.createTextNode(text.slice(last)));}
  function inline(node,text){
    const pattern=/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*(?!\*)[^*]+\*|https?:\/\/[^\s<>]+)/g;let last=0;
    for(const match of text.matchAll(pattern)){node.append(document.createTextNode(text.slice(last,match.index)));const token=match[0];let el;
      if(token.startsWith('**')||token.startsWith('__'))el=create('strong','',token.slice(2,-2));
      else if(token.startsWith('`'))el=create('code','',token.slice(1,-1));
      else if(token.startsWith('*'))el=create('em','',token.slice(1,-1));
      else{const markdown=token.startsWith('[')?token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/):null;const url=markdown?markdown[2]:token;el=create('a','',markdown?markdown[1]:token);el.href=url;el.rel='noreferrer noopener';el.addEventListener('click',event=>{event.preventDefault();if(!native('openLink',url))copy(url);});}
      node.append(el);last=match.index+token.length;
    }node.append(document.createTextNode(text.slice(last)));
  }
  function richText(node,text){
    // Only authored DOM nodes; raw HTML, remote images and script URLs are never parsed.
    const lines=text.split('\n');let i=0;
    while(i<lines.length){const line=lines[i];
      if(/^\s*```/.test(line)){const code=[];i++;while(i<lines.length&&!/^\s*```/.test(lines[i]))code.push(lines[i++]);if(i<lines.length)i++;const block=create('div','code-block'),pre=create('pre'),value=code.join('\n');pre.append(create('code','',value));block.append(pre,button('Copy code',()=>copy(value),'code-copy'));node.append(block);continue;}
      if(!line.trim()){i++;continue;}
      if(/^#{1,6}\s/.test(line)){const heading=create('h3');inline(heading,line.replace(/^#{1,6}\s+/,''));node.append(heading);i++;continue;}
      if(/^\s*[-*+]\s/.test(line)){const list=create('ul');while(i<lines.length&&/^\s*[-*+]\s/.test(lines[i])){const item=create('li');inline(item,lines[i++].replace(/^\s*[-*+]\s+/,''));list.append(item);}node.append(list);continue;}
      if(/^\s*\d+\.\s/.test(line)){const list=create('ol');while(i<lines.length&&/^\s*\d+\.\s/.test(lines[i])){const item=create('li');inline(item,lines[i++].replace(/^\s*\d+\.\s+/,''));list.append(item);}node.append(list);continue;}
      if(/^>\s?/.test(line)){const quote=create('blockquote');inline(quote,line.replace(/^>\s?/,''));node.append(quote);i++;continue;}
      const paragraph=create('p'),content=[];while(i<lines.length&&lines[i].trim()&&!/^\s*```|^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|^>/.test(lines[i]))content.push(lines[i++]);inline(paragraph,content.join('\n'));node.append(paragraph);
    }
  }
  function empty(title,subtitle){const el=create('div','empty-state');el.append(create('strong','',title),create('p','',subtitle));return el;}
  function canReadAloud(message){return live()&&!history()?.saved&&caps().speech===true&&message.role==='assistant'&&message.kind!=='media'&&
    message.publicAttested===true&&message.source==='authenticated-native-history'&&message.sessionId===row()?.sessionId&&!!message.text.trim();}
  function renderMessages(){const current=history(),rows=conversationRows(),needle=state.search.toLowerCase();
    const matches=needle?rows.filter(message=>message.text.toLowerCase().includes(needle)):rows,offset=Math.min(messageOffsets.get(state.selected)||0,Math.max(0,matches.length-1)),end=Math.max(0,matches.length-offset),start=Math.max(0,end-50),windowRows=matches.slice(start,end);
    const signature=JSON.stringify([state.selected,live(),windowRows,rows.length,needle,state.playing,state.reply,caps().reply===true,caps().speech===true,[...expandedMessages],[...state.speechPending],offset,current?.saved===true]);if(signature===renderSignature)return;renderSignature=signature;
    const latestScope=state.selected+':'+(row()?.sessionId||''),latest=rows.at(-1),latestKey=latest?JSON.stringify([latest.id,latest.localSubmission===true]):'';
    const newLatest=renderLatestScope===latestScope&&renderLatestKey!==''&&latestKey!==''&&renderLatestKey!==latestKey;
    renderLatestScope=latestScope;renderLatestKey=latestKey;
    const scroller=$('message-scroll'),bottom=scroller.scrollHeight-scroller.clientHeight-scroller.scrollTop<90,previousTop=scroller.scrollTop,fragment=document.createDocumentFragment();
    if(!rows.length)fragment.append(empty(!live()?'Connection unavailable':!current?'Opening conversation':'No public messages yet','Use the composer below. Your text stays saved until acknowledged.'));
    $('conversation-list').dataset.loadedCount=String(rows.length);
    if(matches.length>50){const controls=create('div','history-window-controls');controls.append(create('p','',`Showing ${start+1}–${end} of ${matches.length} ${needle?'matching':'loaded'} messages`));if(start>0)controls.append(button('Earlier loaded messages',()=>{messageOffsets.set(state.selected,offset+50);renderMessages();}));if(offset>0)controls.append(button('Newer messages',()=>{messageOffsets.set(state.selected,Math.max(0,offset-50));renderMessages();}),button('Latest',()=>{messageOffsets.set(state.selected,0);forceScroll=true;renderMessages();}));fragment.append(controls);}
    let previousDay='';for(const message of windowRows){const day=window.DracoState.conversationDay(message.timestamp);if(day.key!==previousDay){const separator=create('div','conversation-day',day.label);separator.dataset.day=day.key;fragment.append(separator);previousDay=day.key;}const article=create('article','message '+message.role+(message.localSubmission?' local-request '+message.submissionState:''));article.dataset.messageId=message.id;article.dataset.localSubmission=String(message.localSubmission===true);const heading=create('div','message-heading');heading.append(create('strong','',message.role==='user'?'You':byId.get(state.selected).name),create('time','',time(message.timestamp)));const content=create('div','message-text');const full=expandedMessages.has(message.id),shown=full?message.text:message.text.slice(0,12000);if(message.localSubmission)content.textContent=shown;else richText(content,shown);article.append(heading,content);if(message.text.length>12000&&!full)article.append(button('Show full message',()=>{expandedMessages.add(message.id);renderMessages();},'secondary-button'));
      if(message.localSubmission){if(message.attachmentNote)article.append(create('p','delivery-state',message.attachmentNote));article.append(create('p','delivery-state submission-admission',message.submissionNote));const details=create('details','request-custody'),summary=create('summary','','Request details');details.append(summary,create('p','receipt-id','Original ID: '+message.id),button('Copy original ID',()=>copy(message.id),'small-button'));article.append(details);if(message.submissionState==='uncertain'&&!message.noReplay&&local.unresolved(state.selected)?.id===message.id)article.append(button('Retry original ID',()=>retrySubmission(message.id),'secondary-button'));}
      if(message.role==='assistant'&&message.kind==='media')article.append(create('p','delivery-state',deliveryDiagnosis(message)||'No readable reply text accompanied this attachment; source text evidence is unavailable.'));
      renderReplyLink(article,message,false);
      for(const media of message.media||[]){const block=create('div','message-media'),url=media.url||media.path;const available=media.downloadAvailable===true&&typeof url==='string'&&url.startsWith('/v1/media?');
        if(available){const mediaButton=button((state.playing===message.id+':'+media.index?'■ Stop ':'▶ ')+(media.label||({audio:'Voice reply',image:'Open image',video:'Play video',file:'Open file'})[media.kind]||'Media'),()=>{const id=message.id+':'+media.index;if(state.playing===id){native('stopMedia');state.playing=null;}else{playRecording(message,media,url,id);}renderMessages();});mediaButton.disabled=!live()||current?.saved===true;block.append(mediaButton);}
        else{block.append(create('span','media-label',media.label||'Attachment'),create('span','delivery-state',media.unavailableReason||'This attachment has no playable app link.'));}
        article.append(block);}
      const menu=button('•••',()=>messageActions(message),'message-menu');menu.setAttribute('aria-label','Message actions');heading.append(menu);article.addEventListener('contextmenu',event=>{event.preventDefault();messageActions(message);});fragment.append(article);}


    if(needle&&!fragment.childNodes.length)fragment.append(empty('No matching messages','Search covers the loaded public conversation. Use Older messages for more.'));
    $('conversation-list').replaceChildren(fragment);if(forceScroll||bottom){scroller.scrollTop=scroller.scrollHeight;forceScroll=false;$('new-messages').hidden=true;}else{scroller.scrollTop=previousTop;$('new-messages').hidden=$('new-messages').hidden&&!newLatest;}
  }
  function messageActions(message){const fragment=document.createDocumentFragment(),close=()=> $('message-actions-dialog').close();if(message.text.trim())fragment.append(button('Copy message',()=>{close();copy(message.text);},'message-action'),button('Share message',()=>{close();share(message.text);},'message-action'));else fragment.append(create('p','delivery-state','This attachment has no readable text to copy or share.'));if(!message.localSubmission&&message.publicAttested===true&&live()&&!history()?.saved&&caps().reply===true&&message.replyAvailable!==false)fragment.append(button('Reply',()=>{close();state.reply={id:message.id,sessionId:message.sessionId};renderChat();$('draft').focus();},'message-action'));if(canReadAloud(message)){const speech=button(state.speechPending.has(state.selected+':'+message.id)?'Preparing voice…':'Read aloud',()=>{close();readAloud(message);},'message-action');speech.disabled=state.speechPending.has(state.selected+':'+message.id);fragment.append(speech);}$('message-action-list').replaceChildren(fragment);$('message-actions-dialog').showModal();}
  function conversationActions(){$('conversation-actions-dialog').showModal();renderComposerControls();}
  function activityKey(event){return event.agent+':'+event.sessionId+':'+event.id+(event.observation?':'+(event.evidenceRevision||'legacy'):'');}
  function latestWork(agent){return live()?state.activity.filter(event=>!event.receivedOnly&&event.agent===agent&&event.sessionId===state.agents.get(agent)?.sessionId).sort((a,b)=>b.timestamp-a.timestamp||b.id.localeCompare(a.id))[0]:null;}
  function deliveryDiagnosis(message){const evidence=message?.deliveryEvidence;return evidence?.schema==='draco.delivery-source.v1'&&evidence.sourceTextState==='absent'&&evidence.textMissingReason==='source-send-contained-no-readable-text'?'Recorded send contained no readable text; no companion text source was supplied.':'';}
  function attachmentSummary(event){if(!['media','Attachment only'].includes(event?.kind)||event.text.trim())return '';const audio=event.media?.some(item=>item.kind==='audio'),available=event.media?.some(item=>(!audio||item.kind==='audio')&&item.downloadAvailable===true);return (audio?'Audio':'Attachment')+(available?' available':' unavailable in app')+' · no companion text';}
  function linkedText(event,rows){const source=rows.find(row=>row.id===event.id&&row.sessionId===event.sessionId&&row.agent===event.agent),link=source?.replyLink;if(link?.status!=='available')return null;const matches=rows.filter(row=>row.id===link.messageId&&row.id!==source.id&&row.sessionId===source.sessionId&&row.agent===source.agent&&row.role==='assistant'&&row.text.trim()&&row.delivery?.platformMessageId===link.platformMessageId);return matches.length===1?matches[0]:null;}
  function renderReplyLink(item,event,activity){
    if(!event.replyLink)return;
    const rows=()=>activity?state.activity:history()?.conversation||[],target=linkedText(event,rows());
    if(!target){item.append(create('p','delivery-state','Linked report is outside the available public window.'));return;}
    const disclosure=create('details','linked-report'),control=create('summary','linked-text','Show linked text'),content=create('div','message-text');
    disclosure.append(control,content);item.append(create('p','delivery-state','This attachment replies to a separate readable report; audio/text equivalence is unverified.'),disclosure);
    function show(full=false){
      const latest=linkedText(event,rows());
      if(!latest){disclosure.open=false;content.replaceChildren();toast('Linked text is no longer available in this session.');return false;}
      content.replaceChildren();richText(content,full?latest.text:latest.text.slice(0,12000));
      if(!full&&latest.text.length>12000)content.append(button('Show full linked report',()=>show(true),'secondary-button'));
      if(latest.excerpt)content.append(create('p','delivery-state','Source excerpt · full source text unavailable in this window'));
      return true;
    }
    control.addEventListener('click',click=>{click.preventDefault();if(disclosure.open){disclosure.open=false;control.textContent='Show linked text';}else if(show()){disclosure.open=true;control.textContent='Hide linked text';}});
  }
  function observedWorkText(event){
    if(event?.source!=='authenticated-tool-status')return event?.text||'';
    if(event.observation?.result?.processRunning===true)return 'Return observed · reported running then; present liveness unknown';
    const phase=event.observation?.phase||({'Tool started':'start','Tool finished':'result','Tool failed':'error'})[event.kind];
    return ({start:'Start observed',result:'At observed return',error:'Error observed'})[phase]+' · '+event.text;
  }
  function workPreview(event){return window.DracoEnvironmentBubbles.previewText(attachmentSummary(event)||observedWorkText(event)).slice(0,340);}
  function publicKind(event){return event.kind==='Public update'?'Public update':event.kind||'Public update';}
  function taskProgress(observation){
    const value=observation?.taskProgress,steps=value?.steps;
    if(observation?.tool!=='progress_card'||observation.phase!=='start'||value?.version!==1||value.source!=='operator-progress-card'||!Array.isArray(steps)||steps.length>50||!steps.length||steps.some(s=>!['pending','in_progress','completed'].includes(s?.status)||typeof s.step!=='string'||!s.step.trim()||s.step.length>160||/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(s.step))||steps.filter(s=>s.status==='in_progress').length>1)return null;
    return {steps,completed:steps.filter(s=>s.status==='completed').length,total:steps.length,current:steps.find(s=>s.status==='in_progress')?.step||null};
  }
  function openWork(agent){if(state.chat&&!closeChat())return;state.filter=agent;state.activityMode='work';renderFilters();showView('activity',{work:true});$('activity-heading').focus({preventScroll:true});}
  function renderChatWork(){const observation=currentRunObservation(),summary=observation.conversation+' · '+observation.summary;$('chat-work-label').textContent=summary;$('chat-work').setAttribute('aria-label',byId.get(state.selected).name+' observed work. '+summary+'. Open Activity.');$('chat-work').dataset.live=String(live());}
  function renderWorkSummaries(){const fragment=document.createDocumentFragment();for(const spec of SPECS){if(state.filter!=='all'&&state.filter!==spec.id)continue;const agent=state.agents.get(spec.id),event=latestWork(spec.id),card=create('article','work-card');card.style.setProperty('--agent-color',spec.color);card.dataset.agent=spec.id;card.dataset.live=String(live());const heading=create('div','work-heading');heading.append(create('h3','',spec.name),create('span','work-state',live()?label(agent?.status):'Unobserved'));card.append(heading);
      const count=key=>live()&&number(agent?.telemetry?.[key])!==null?String(agent.telemetry[key]):'—';card.append(create('p','work-counts',count('activeSessions')+' open sessions · '+count('queuedSessions')+' queued admissions'));
      const observation=currentRunObservation(spec.id);card.append(create('p','work-preview',observation.conversation+' · '+observation.summary));if(event)card.append(create('p','work-preview','Last public report (not current-run proof): '+workPreview(event)));
      const observed=live()?state.workActivity.filter(value=>workFresh(value)&&value.agent===spec.id&&value.observation):[],calls=new Set(observed.map(value=>value.runId+':'+value.callId)),errors=new Set(observed.filter(value=>value.kind==='Tool failed').map(value=>value.runId+':'+value.callId));if(calls.size){const phases=new Map();for(const value of observed){const key=value.runId+':'+value.callId,set=phases.get(key)||new Set();set.add(value.observation.phase);phases.set(key,set);}const unknown=[...phases.values()].filter(set=>set.has('start')&&!set.has('result')&&!set.has('error')).length,returned=[...phases.values()].filter(set=>set.has('result')||set.has('error')).length;card.append(create('p','work-source','Observed window: '+calls.size+' calls · '+returned+' returned · '+errors.size+' reported errors · '+unknown+' outcomes not observed'));}const scope=state.fleetCoverage.find(source=>source.agent===spec.id)?.work;if(scope){card.append(create('p','work-source','Window: latest '+(scope.windowLimit||30)+' events · '+(scope.droppedKnown??'unknown')+' omitted locally · upstream gaps '+(scope.upstreamDropped??'unknown')+(scope.sourceConflictCount?' · '+scope.sourceConflictCount+' conflicting facts withheld':'')));}
      if(event)card.append(create('p','work-source',publicKind(event)+' · received '+time(event.timestamp)));card.append(button('Open '+spec.name+' chat',()=>openChat(spec.id),'work-open'));fragment.append(card);} $('work-summaries').replaceChildren(fragment);}
  function activityReport(item,event){const key=activityKey(event),detail=state.activityMode==='work'&&state.activityDetail==='detailed',full=expandedActivity.has(key),limit=detail?12000:360;const content=create('div','message-text activity-report');richText(content,full||event.text.length<=limit?event.text:event.text.slice(0,limit));item.append(content);
    if(attachmentSummary(event)){item.append(create('p','delivery-state',attachmentSummary(event)));for(const media of event.media||[])item.append(create('p','delivery-state',media.downloadAvailable===true?'Open the conversation to play this attachment.':media.unavailableReason||'No playable app audio link is available.'));}
    renderReplyLink(item,event,true);
    if(event.text.length>limit||full){const control=button(full?'Collapse report':'Show full report',()=>{full?expandedActivity.delete(key):expandedActivity.add(key);activitySignature='';renderActivity();},'activity-expand');control.setAttribute('aria-expanded',String(full));item.append(control);}if(event.excerpt)item.append(create('p','timeline-kind','Source excerpt · full source text unavailable in this window'));}
  // Basic execution is readable without opening provenance. Only server-projected
  // command/output fields enter this view; never execute or parse their text.
  function executionPreview(observation){
    const parts=[],c=observation?.command,r=observation?.result;
    if(observation?.orchestration?.source==='submitted-wrapper'&&observation.orchestration.innerDispatchAttested===false&&typeof observation.orchestration.preview==='string')parts.push('Submitted orchestration source only · inner execution unconfirmed\n'+observation.orchestration.preview.slice(0,1024));
    if(typeof c?.preview==='string'&&c.preview)parts.push('$ '+c.preview.slice(0,1024));
    else if(c)parts.push('$ '+[c.program,c.operation,...(c.flags||[]),...(c.targets||[])].join(' '));
    if(observation?.operation?.kind==='automation')parts.push('Automation '+(observation.operation.action||'action not supplied')+(observation.operation.jobId?' · job '+observation.operation.jobId:''));
    if(observation?.wrapperReturn?.scope==='outer-wrapper-return-only')parts.push('Outer wrapper return only · '+observation.wrapperReturn.contentBlocks+' content blocks · '+observation.wrapperReturn.textChars+' text characters · inner outcomes are not attested here');
    if(Number.isSafeInteger(r?.exitCode))parts.push('Exit '+r.exitCode);
    if(typeof r?.summary==='string'&&r.summary)parts.push(r.summary.slice(0,1024));
    return parts.join('\n').slice(0,2200);
  }
  function activityOperation(item,event){
    const observation=event.observation;item.append(create('p','tool-status-text',observedWorkText(event)));
    if(ownerRef(event))item.append(button('Open full recorded tool input/result',()=>openOwnerRecord(event),'secondary-button owner-detail-open'));else item.append(create('p','timeline-kind','Full recorded source not available for this event'));
    if(!observation){item.append(create('p','timeline-kind','Historical summary · exact call/freshness not recorded'));return;}
    if(!Number.isFinite(event.evidenceSource?.freshUntil))item.append(create('p','timeline-kind','Freshness not supplied · historical observation only'));
    const preview=executionPreview(observation);if(preview)item.append(create('pre','execution-preview',preview));
    const progress=taskProgress(observation);if(progress){
      item.append(create('p','task-progress-summary',progress.completed+'/'+progress.total+' complete'+(progress.current?' · Reported current step: '+progress.current:' · No current step reported')));
      const steps=create('ol','execution-steps');for(const step of progress.steps){const entry=create('li','',({completed:'☑ ',in_progress:'▶ ',pending:'☐ '})[step.status]+step.step);entry.dataset.status=step.status;steps.append(entry);}item.append(steps);
    }
    item.append(create('p','operation-label',(observation.toolName||observation.tool)+' · '+observation.phase+' · safe evidence'));
    const key=activityKey(event),full=expandedActivity.has(key);
    const toggle=button(full?'Hide execution details':'Show execution details',()=>{full?expandedActivity.delete(key):expandedActivity.add(key);activitySignature='';renderActivity();},'activity-expand');toggle.setAttribute('aria-expanded',String(full));item.append(toggle);
    if(!full)return;
    const facts=create('dl','operation-facts');
    const add=(label,value)=>{if(value===undefined||value===null)return;facts.append(create('dt','',label),create('dd','',String(value)));};
    add('Agent',byId.get(event.agent).name);add('Session key',event.sessionKey||observation.sessionKey||'Not supplied');add('Session',event.sessionId);add('Run',event.runId);add('Tool call',event.callId);add('Lifecycle',observation.phase);add('Tool',observation.toolName||observation.tool);const operation=observation.operation;add('Operation',operation?[operation.kind,operation.action,operation.jobId,...(operation.corpora||[]),...(operation.targets||[])].filter(Boolean).join(' · '):'Safe operation detail not supplied');
    if(progress){add('Task progress',progress.completed+'/'+progress.total+' complete');add('Reported current step',progress.current||'None reported');for(const [index,step] of progress.steps.entries())add('Step '+(index+1),({completed:'☑ ',in_progress:'▶ ',pending:'☐ '})[step.status]+step.step);add('Progress source','Explicit operator-visible progress card; not private planning or proof of completion');}
    const c=observation.command;if(c){add('Command / effect',c.preview||[c.program,c.operation,...(c.flags||[]),...(c.targets||[])].join(' '));}
    const r=observation.result;if(r){for(const [name,label] of [['exitCode','Command exit code'],['outputLines','Output lines'],['outputBytes','Output bytes'],['matchCount','Memory matches'],['sourceCount','Retained sources'],['lineCount','Retained lines'],['durationMs','Duration (ms)'],['returnedCount','Returned entries']])if(Number.isSafeInteger(r[name]))add(label,r[name]);
      if(r.processRunning===true)add('Command state at return','Reported running then; present liveness unknown');if(r.processId!==undefined)add('Process / task ID',r.processId);if(r.truncated!==undefined)add('Returned window truncated',r.truncated?'Yes':'No');for(const flag of ['disabled','stale','partial'])if(r[flag]!==undefined)add('Memory '+flag,r[flag]?'Yes':'No');if(r.warningCode)add('Memory warning',r.warningCode);if(r.warningCodes?.length)add('Memory warnings',r.warningCodes.join(', '));if(r.corpora?.length)add('Memory corpus',r.corpora.join(', '));if(r.corpusKinds?.length)add('Memory corpus',r.corpusKinds.join(', '));if(r.errorCode)add('Error class',r.errorCode);if(Array.isArray(r.sourceKinds))add('Source types',r.sourceKinds.filter(kind=>['workspace-memory','retained-session','unspecified','memory','wiki','sessions','resource','unknown'].includes(kind)).join(', ')||'Not reported');}
    if(r?.summary)add('Output / result',r.summary);if(r?.jobId)add('Automation job',r.jobId);if(r?.state)add('Returned state',r.state);if(typeof r?.enabled==='boolean')add('Automation enabled at return',r.enabled?'Yes':'No');
    if(observation.wrapperReturn?.scope==='outer-wrapper-return-only'){add('Wrapper return','Outer wrapper envelope only; no inner-call outcome is inferred');add('Returned content blocks',observation.wrapperReturn.contentBlocks);add('Returned text characters',observation.wrapperReturn.textChars);}
    if(observation.orchestration)add('Orchestration source','Submitted wrapper only; its source does not establish which inner calls actually ran');
    if(observation.nested){const n=observation.nested;add('Nested execution','Recorded terminal observation; not a reconstructed start');add('Parent relationship',n.parentState);if(n.parentToolCallId)add('Parent call',n.parentToolCallId);}
    const source=event.evidenceSource||{};add('Source',source.kind||'Not supplied');add('Source sequence',source.sequence??'Not supplied');add('Projection revision',source.projectionRevision??'Not supplied');add('Evidence revision',event.evidenceRevision||'Not supplied');add('Observed',source.observedAt?time(source.observedAt):'Not supplied');add('Fresh until',source.freshUntil?time(source.freshUntil):'Not supplied');add('Coverage','Observed owner-run window, not full task history');if(['memory_search','memory_get'].includes(observation.tool))add('Citations','No audience-attested evidence link supplied by this record');
    const notes={ 'arguments-withheld':'Compact preview omits some literals; open Recorded detail for the retained input','result-summary-unavailable':'No compact result summary was supplied; inspect the recorded return when available','nested-events-unavailable':'Inner tool events not exposed by this orchestration record','summary-budget':'Source detail exceeded the summary budget','unsupported-tool-detail':'No compact formatter for this tool; inspect Recorded detail when available'};
    const supplied=new Set();for(const gap of observation.gapReasons||[])if(typeof gap?.code==='string'&&typeof gap.reason==='string'){supplied.add(gap.code);add('Source / summary gap',gap.reason.slice(0,600));}
    for(const gap of observation.gaps||[])if(!supplied.has(gap)&&notes[gap])add('Preview / source gap',notes[gap]+(ownerRef(event)?' in the concise projection; inspect the full recorded source manually':''));
    item.append(facts);
  }
  function renderActivity(){
    const work=state.activityMode==='work',matches=event=>state.filter==='all'||event.agent===state.filter;
    const publicEvents=(live()?state.transitions:[]).concat(state.activity).filter(matches);
    const tools=live()?state.workActivity.filter(event=>workFresh(event)&&matches(event)):[];
    const newest=(a,b)=>Number(Boolean(a.receivedOnly))-Number(Boolean(b.receivedOnly))||b.timestamp-a.timestamp||a.id.localeCompare(b.id);
    // Independent budgets: even a burst of tools cannot evict public reports.
    const reports=publicEvents.sort(newest).slice(0,120),perAgent=new Map();
    const operations=tools.sort(newest).filter(event=>{const count=perAgent.get(event.agent)||0,limit=state.filter==='all'?(work?10:2):(work?60:12);if(count>=limit)return false;perAgent.set(event.agent,count+1);return true;}).slice(0,work?60:12);
    const filtered=reports.concat(operations).sort((a,b)=>a.timestamp-b.timestamp||a.id.localeCompare(b.id));
    const coverage=state.fleetCoverage.filter(source=>state.filter==='all'||source.agent===state.filter),available=live()?coverage.filter(source=>source.available).length:0;
    $('activity-count').textContent=filtered.length+' updates · '+available+'/'+(state.filter==='all'?6:1)+' feeds · '+(live()?'live':'last received');
    $('activity-observation-note').textContent=!live()?'Execution observations unavailable · not live. Last received public reports remain separate.':coverage.some(source=>source.work?.available===false)?'Some execution observations expired or unavailable · refresh pending.':coverage.some(source=>source.work?.partial!==false)?'Partial recorded window · open Recorded detail for original payloads. Missing upstream events remain unavailable; this is not a complete machine log.':'Recorded execution window · concise commands and outcomes below; Recorded detail opens retained originals. Credentials are masked initially and can be revealed there. Unrecorded events cannot be reconstructed.';
    $('activity-freshness').textContent=!live()?'Offline · showing last received public updates, not live activity.':available<coverage.length?'Some feeds are delayed. Last received updates are labelled; live controls require fresh observations.':'Oldest to newest · latest at the bottom · following can be paused by scrolling back.';
    $('activity-live').setAttribute('aria-pressed',String(!work));$('activity-work').setAttribute('aria-pressed',String(work));
    $('work-summaries').hidden=!work;$('activity-toolbar').hidden=!work;$('activity-stream-heading').hidden=!work;$('activity-stream-heading').textContent=work?'Detailed work stream':'Live feed';
    $('activity-detail').value=state.activityDetail;$('view-activity').dataset.detail=state.activityDetail;
    const signature=JSON.stringify([live(),state.filter,state.activityMode,state.activityDetail,filtered,coverage.map(source=>[source.agent,source.available,source.status,source.scope,source.work]),[...state.agents].map(([id,agent])=>[id,agent.status,agent.telemetry?.activeSessions,agent.telemetry?.queuedSessions]),[...expandedActivity]]);
    if(work)renderWorkSummaries();if(signature===activitySignature)return;activitySignature=signature;
    const scope=state.filter+':'+state.activityMode;if(scope!==activityScope){activityScope=scope;activityFollow=true;activityLatestKey='';}
    const latest=filtered.at(-1),nextKey=latest?activityKey(latest):'',changed=activityLatestKey&&nextKey!==activityLatestKey;activityLatestKey=nextKey;
    if(changed&&!activityFollow)$('activity-latest').hidden=false;
    const list=$('activity-list'),anchor=[...list.children].find(item=>item.getBoundingClientRect().bottom>120),anchorId=anchor?.dataset.messageId,anchorTop=anchor?.getBoundingClientRect().top,reading=!activityFollow;
    const fragment=document.createDocumentFragment();if(!filtered.length)fragment.append(empty(live()?'No public updates in this window':'No received updates available','All six public feeds refresh independently of opened chats. Private exchanges and unconfirmed sends are excluded.'));
    for(const event of filtered){const spec=byId.get(event.agent);if(!spec)continue;const tool=event.source==='authenticated-tool-status',item=create('article','timeline-item'+(tool?' tool-status':''));item.style.setProperty('--agent-color',spec.color);item.dataset.agent=event.agent;item.dataset.messageId=event.id;item.dataset.kind=publicKind(event);const heading=create('div','timeline-heading');heading.append(create('span','timeline-symbol',spec.glyph),create('strong','',spec.name),create('time','',time(event.timestamp)));item.append(heading,create('div','timeline-kind',publicKind(event)));
      if(!live()||event.receivedOnly)item.append(create('p','timeline-stale','Last received · not live'));
      if(tool)activityOperation(item,event);else activityReport(item,event);
      if(event.delivery?.state==='delivered'){const legs=event.delivery.legs||{};item.append(create('div','timeline-kind','Telegram receipt · readable text '+(legs.text?.state==='accepted'?'accepted':'unconfirmed')+' · speech '+(legs.voice?.state==='accepted'?'accepted':'unconfirmed')+' · phone reception unverified'));}item.append(button('Open conversation',()=>openChat(event.agent),'activity-chat'));fragment.append(item);}
    list.replaceChildren(fragment);
    if(reading&&anchorId){const retained=[...list.children].find(item=>item.dataset.messageId===anchorId);if(retained)window.scrollBy(0,retained.getBoundingClientRect().top-anchorTop);}else if(activityFollow&&state.view==='activity'&&!state.chat)requestAnimationFrame(followActivity);
    const visibleKeys=new Set(filtered.map(activityKey));for(const key of expandedActivity)if(!visibleKeys.has(key))expandedActivity.delete(key);
  }

  function followActivity(){activityFollow=true;$('activity-latest').hidden=true;window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});telegramSchedule();}
  function setActivityFilter(agent){if(agent!=='all'&&!byId.has(agent))return;state.filter=agent;activityFollow=true;activitySignature='';renderFilters();renderActivity();telegramSchedule();}
  function setActivityMode(mode){if(!['live','work'].includes(mode))return;state.activityMode=mode;activityFollow=true;activitySignature='';renderActivity();telegramSchedule();}
  function renderAll(){renderConnection();renderRoster();renderChat();if(state.view==='activity')renderActivity();}
  function saveDraft(){if(!local.setDraft(state.selected,$('draft').value))toast('Your draft is still here, but local storage is full. Keep the app open until it is sent.');renderComposerControls();}
  function send(mode){const agent=row(),target=controlTarget(),text=$('draft').value,files=attachments();
    if(mode==='steer'&&caps().strictSteer!==true){toast('Steer unavailable: no verified active-run injection. Nothing was sent or queued.');return;}
    if(!allowed(mode==='queue'?'queue':mode==='steer'?'steer':'send')||(!text.trim()&&!files.length)||local.unresolved(state.selected)){toast('This action is unavailable. Your draft has not been sent.');return;}
    const uploadLimit=caps().uploadLimits?.totalBytes||8388608;if(files.reduce((sum,file)=>sum+(file.sizeBytes||0),0)>uploadLimit){toast('These files exceed the '+Math.round(uploadLimit/1048576)+' MB upload limit. Remove a file before sending; your draft stays saved.');return;}
    if(mode==='steer'&&!target){toast('No exact active conversation run is available.');return;}
    if(/^\s*\/(new|reset)(?:\s|$)/i.test(text)&&!confirm('Send this session-changing command? It replaces the selected agent’s current conversation session. Existing exact-run controls will become invalid.'))return;
    if(state.reply&&state.reply.sessionId!==agent.sessionId){state.reply=null;toast('Reply target belonged to the previous session. Review this draft before sending.');renderChat();return;}
    const id=uid('phone'),body={agent:state.selected,sessionId:agent.sessionId,idempotencyKey:id,text,mode,retry:false,echoToTelegram:local.data.preferences.echoToTelegram!==false,...(mode==='steer'?{runId:target.runId}:{}),...(files.length?{attachmentIds:files.map(item=>item.id)}:{}),...(state.reply?{replyToId:state.reply.id}:{})};
    try{local.begin(state.selected,'/v1/message',body);}catch(error){toast(error.message);return;}forceScroll=true;renderChat();dispatchSubmission(id,body,'/v1/message');}
  function dispatchSubmission(id,body,path){request('POST',path,body,response=>{const item=local.result(id,response);if(!item)return;if(item.state==='accepted'){for(const attachmentId of body.attachmentIds||[])native('releaseAttachment',attachmentId);state.attachments=state.attachments.filter(attachment=>!body.attachmentIds?.includes(attachment.id));local.setAttachments(state.attachments);}if(item.agent===state.selected&&item.state==='accepted'){
      if($('draft').value===body.text)$('draft').value=local.draft(state.selected);state.reply=null;}
      toast(body.mode==='steer'?(item.note||'Steer outcome unconfirmed; do not replay.'):item.state==='accepted'?(response.data?.status==='queued'?'Queued. Reading and completion are not yet confirmed.':path==='/v1/abort'?'Stop acknowledgement received; inspect the returned disposition.':'Gateway accepted the submission; completion is not yet confirmed.'):item.state==='uncertain'?'Acceptance is unconfirmed. Retry only the original ID.':response.error||'Request rejected; draft retained.');renderAll();if(item.state==='accepted')schedule(80);return ['pending','uncertain'].includes(item.state);
    },{id,timeout:40000,persistent:true});}
  function retrySubmission(id){let body,item;try{body=local.retry(id);item=local.data.outbox.find(entry=>entry.id===id);}catch(error){toast(error.message);return;}renderChat();dispatchSubmission(id,body,item.path);}
  function stop(){const target=controlTarget();if(!allowed('abort')||!target||local.unresolved(state.selected))return;if(!confirm('Stop only '+byId.get(state.selected).name+'’s exact displayed conversation run? Queued inputs and other sessions are separate.'))return;const id=uid('stop'),body={agent:target.agent,sessionKey:target.sessionKey,sessionId:target.sessionId,runId:target.runId,idempotencyKey:id,retry:false};try{local.begin(state.selected,'/v1/abort',body);}catch(error){toast(error.message);return;}renderChat();dispatchSubmission(id,body,'/v1/abort');}
  function renderAttachment(){
    const files=attachments();$('attachment-preview').hidden=!files.length||state.recording;$('recording-bar').hidden=!state.recording;
    $('reply-preview').hidden=!state.reply;$('reply-label').textContent=state.reply?'Reply to selected message · '+state.reply.id.slice(-12):'';
    const fragment=document.createDocumentFragment();for(const file of files){const item=create('div','staged-attachment'),info=create('span','staged-file-info');info.append(create('strong','',file.name),create('span','',Math.ceil((file.sizeBytes||0)/1024)+' KB'+(file.durationMs?' · '+Math.ceil(file.durationMs/1000)+'s':'')));
      item.append(create('span','attachment-symbol',file.mimeType?.startsWith('audio/')?'♪':file.mimeType?.startsWith('image/')?'▣':'▤'),info);
      if(file.mimeType?.startsWith('audio/'))item.append(button('▶ Review',()=>native('previewAttachment',file.id),'attachment-action'));
      const remove=button('×',()=>{native('cancelAttachment',file.id);state.attachments=state.attachments.filter(entry=>entry.id!==file.id);local.setAttachments(state.attachments);renderChat();},'icon-button');remove.setAttribute('aria-label','Remove '+file.name);remove.disabled=local.unresolved(state.selected)?.body.attachmentIds?.includes(file.id)||false;item.append(remove);fragment.append(item);}
    $('attachment-preview').replaceChildren(fragment);
  }
  window.onDracoAttachment=info=>{if(!info||typeof info!=='object')return;if(info.state==='recording'){if(!byId.has(info.agent)){toast('Recording recipient is unconfirmed. No message will be sent.');return;}state.recording=true;syncVoice();state.recordingAgent=info.agent;recordStart=Date.now();clearInterval(recordTimer);recordTimer=setInterval(()=>$('recording-time').textContent='Recording · '+Math.floor((Date.now()-recordStart)/1000)+'s',500);}
    else{state.recording=false;clearInterval(recordTimer);if(info.state==='ready'&&typeof info.id==='string'){const agent=info.agent;if(!byId.has(agent)){toast('Attachment recipient is unconfirmed. Nothing was added or sent.');return;}if(state.attachments.filter(file=>file.agent===agent).length>=8){native('cancelAttachment',info.id);toast('Up to 8 attachments fit one submission. Earlier files are retained.');}else if(!state.attachments.some(file=>file.id===info.id))state.attachments.push({...info,agent});}else if(info.state==='cancelled')state.attachments=state.attachments.filter(file=>file.id!==info.id);else if(info.state==='error')toast(info.error||'Attachment could not be prepared. No input was sent.');}if(!local.setAttachments(state.attachments))toast('Attachment metadata could not be saved; keep the app open until this draft is sent.');renderChat();};
  window.onDracoShare=info=>{if(typeof info?.text!=='string'||!info.text)return;const agent=state.selected,existing=state.chat?$('draft').value:local.draft(agent),text=(existing?existing+'\n\n':'')+info.text;local.setDraft(agent,text);if(state.chat)$('draft').value=local.draft(agent);renderAll();toast('Shared text added to '+byId.get(agent).name+'’s draft. Review it before tapping Send.');};
  window.onDracoTransfer=info=>{if(info?.state==='uploading')toast('Uploading attachment · '+(info.progress||0)+'%');else if(info?.state==='downloading'&&info.id===state.playing){if(voice.active?.playbackId===info.id)voice.playback({...info,state:'loading'});else if(manualMedia?.id===info.id)mediaStatus={...manualMedia,...mediaStatus,...info,state:'loading'};renderVoice();telegramSchedule();}};
  window.onDracoPlayback=info=>{if(info?.id===state.playing)voiceDiagnostic({...manualMedia,...info});if(info?.state==='rate-error'){toast(info.error||'Playback speed unavailable.');return;}const matched=info?.id===state.playing;if(matched)mediaStatus={...mediaStatus,...info};if(matched&&['ended','stopped','error'].includes(info.state))state.playing=null;const handled=voice.playback(info);if(!matched&&!handled)return;renderVoice();if(['ended','stopped','error'].includes(info?.state)){if(info.id===state.playing)state.playing=null;renderMessages();if(info.state==='error')toast(info.error||'Media playback unavailable.');}};
  function readAloud(message){if(state.playing&&!voice.active){state.playing=null;native('stopMedia');}syncVoice();if(!voice.manual(message))toast('Open a connected public conversation to read this reply aloud.');}

  function copy(text){if(String(text).length>=65536){toast('This full record exceeds Android’s text-copy limit. Use complete file export; no partial copy was made.');return false;}if(typeof window.DracoNative?.copyText==='function'){native('copyText',text);toast('Copied');return;}navigator.clipboard?.writeText(text).then(()=>toast('Copied')).catch(()=>toast('Copy is unavailable in this preview.'));}
  function share(text){if(String(text).length>=65536){toast('This full record exceeds Android’s text-share limit. Use complete file export; no partial share was made.');return false;}if(typeof window.DracoNative?.shareText==='function'){native('shareText',text);return;}if(navigator.share)navigator.share({text}).catch(()=>{});else copy(text);}
  function loadHistory(agent,olderPage){
    if(!live()||historyReads.has(agent))return;const sessionId=state.agents.get(agent)?.sessionId;if(!sessionId)return;historyReads.add(agent);if(agent===state.selected)$('older-history').disabled=true;
    request('GET','/v1/history?agent='+encodeURIComponent(agent)+(olderPage?'&before=older':''),null,response=>{historyReads.delete(agent);const data=response.data;if(response.ok&&data?.agent===agent&&data.sessionId===state.agents.get(agent)?.sessionId&&sessionId===data.sessionId&&live()){
      if(data.historyState?.status==='unavailable'){const previous=state.histories.get(agent),retained=previous?.sessionId===sessionId?previous:{conversation:[],sessionId,hasMore:false};state.histories.set(agent,{...retained,saved:true,historyState:{...data.historyState,status:'unavailable'}});if(agent===state.selected){renderChat();syncVoice();}return;}
      expandedHistory.add(agent);const scroller=$('message-scroll'),height=scroller.scrollHeight,top=scroller.scrollTop;state.histories.set(agent,{conversation:normalizeMessages(data.messages),sessionId:data.sessionId,historyState:data.historyState||{},hasMore:data.hasMore===true,total:data.total});if(agent===state.selected)syncVoice(olderPage);renderChat();if(olderPage&&agent===state.selected)scroller.scrollTop=top+scroller.scrollHeight-height;
    }else if(olderPage)toast(response.error||'Older history is unavailable or the selected session changed.');if(agent===state.selected)renderChat();});
  }
  function older(){if(!live())return;const loaded=conversationRows().length,offset=messageOffsets.get(state.selected)||0;if(loaded>offset+50){messageOffsets.set(state.selected,offset+50);renderMessages();}else if(history()?.hasMore)loadHistory(state.selected,true);}
  const COMMANDS=[['help','Show supported commands'],['status','Session status'],['tasks','Task progress'],['context','Context usage'],['queue','Queue mode'],['model','Model selection'],['models','Available models'],['think','Thinking level'],['new','Start a new session'],['reset','Reset this session'],['compact','Compact conversation context']];
  function commands(){const advertised=caps().commands;const fragment=document.createDocumentFragment();for(const [name,description] of COMMANDS){const matching=Array.isArray(advertised)?advertised.find(command=>(typeof command==='string'?command:command.name)===name):null;const supported=advertised===true||!!matching&&(typeof matching==='string'||matching.enabled!==false);const item=button('',()=>{local.setDraft(state.selected,'/'+name);$('draft').value='/'+name;$('command-dialog').close();renderChat();$('draft').focus();},'command-item');const text=create('span');text.append(create('strong','','/'+name),create('span','',supported?description+' · review in composer before sending':typeof matching==='object'&&matching?.reason?matching.reason:'Telegram-native command route is unavailable in this client.'));item.append(text);item.disabled=!supported;fragment.append(item);} $('command-list').replaceChildren(fragment);$('command-dialog').showModal();}
  function details(){const spec=byId.get(state.selected),agent=row(),telemetry=agent?.telemetry||{};$('details-name').textContent=spec.name;$('details-role').textContent=spec.role+'.';const fragment=document.createDocumentFragment();for(const [key,value] of [['Observed state',live()?label(agent?.status):'Unobserved'],...(spec.temporary?[['Avatar','Provisional; pending Æra’s permanent design']]:[]),['Model',telemetry.model||'Not reported'],['Conversation occupancy',currentRunObservation().conversation],['Execution evidence',currentRunObservation().summary],['Open sessions',live()?telemetry.activeSessions??'Unknown':'Unknown'],['Queued admissions',live()?telemetry.queuedSessions??'Unknown':'Unknown'],['Last reported tokens',live()?telemetry.totalTokens??'Unknown':'Unknown'],['Conversation coverage',history()?.historyState?.status==='partial'?'Some earlier public messages are missing.':history()?.historyState?.status==='unavailable'?'Public history is unavailable.':'Recorded public output and confirmed operator sends; not a full Telegram journal.'],['Telegram copies',local.data.preferences.echoToTelegram!==false?'Outbound copies enabled; not a full mirror.':'Outbound copies disabled.'],['Session',agent?.sessionId||'Unavailable'],['Exact control targets',agent?.controlTargets?.length||0]]){const entry=create('div');entry.append(create('dt','',key),create('dd','',String(value)));fragment.append(entry);}$('details-facts').replaceChildren(fragment);$('details-dialog').showModal();}
  window.onDracoInsets=info=>{document.body.classList.toggle('ime-open',info?.keyboardVisible===true);requestAnimationFrame(()=>{viewport();if(state.chat)window.scrollTo(0,0);});};
  window.onDracoAppInfo=info=>{if(!info)return;if([.5,.75,1,1.25,1.5,2].includes(info.playbackRate))local.preferences({playbackRate:info.playbackRate});state.nativeFontScale=Number.isFinite(info.fontScale)?Math.max(.5,Math.min(3,info.fontScale)):1;document.documentElement.style.setProperty('--native-font-scale',String(state.nativeFontScale));state.lowMemoryPhone=info.lowMemoryDevice===true||info.memoryClass>0&&info.memoryClass<=256;applyPreferences();if(typeof info.notificationsEnabled==='boolean')$('notifications').checked=info.notificationsEnabled;if(info.versionName)$('app-version').textContent='DRACO WATCH '+info.versionName;};
  window.onDracoUpdate=info=>{if(!info)return;const states={checking:'Checking the signed update feed…',current:'You have the latest version.',available:'A new signed version is available.',verified:'The signed update has been verified. Preparing Android installation…','awaiting-consent':'Approve the update in Android’s installation screen.',permission:'Allow this app to install its signed updates in Android settings, then return here.',unavailable:'The update feed is unavailable. Try again when connected.',downloading:'Downloading update…',downloaded:'Update downloaded. Tap Install update to open Android’s confirmation.',ready:'Update downloaded. Tap Install update to open Android’s confirmation.',installing:'Android installation confirmation is open.',error:'Update could not be prepared.'};$('update-status').textContent=(states[info.state]||info.message||'Update status unavailable')+(info.versionName?' Version '+info.versionName:'')+(info.progress!==undefined?' · '+info.progress+'%':'')+(info.detail?' '+info.detail:'')+(info.error?' '+info.error:'');$('update-install').hidden=!['available','downloaded','ready'].includes(info.state);$('update-check').disabled=['checking','downloading'].includes(info.state);if(info.currentVersion)$('app-version').textContent='DRACO WATCH '+info.currentVersion;};
  function fixture(){const now=Date.now();window.onDracoSnapshot({version:2,connected:true,lastSuccess:now,capturedAt:now,selectedAgent:state.selected,agents:SPECS.map((spec,i)=>({id:spec.id,status:['active','active','idle','idle','queued','active'][i],sessionId:'demo-session-'+spec.id,telemetry:{activeSessions:[1,1,0,0,0,1][i],queuedSessions:i===4?1:0,model:'DEMO · illustrative',totalTokens:12000+i*1000},capabilities:{send:false,queue:false,steer:false,abort:false},controlTargets:[]})),conversation:[{id:'demo-user',role:'user',text:'DEMO PREVIEW: Show the federation on my phone.',timestamp:now-120000},{id:'demo-reply',role:'assistant',text:'DEMO PREVIEW: Full-screen conversations, readable controls and saturated identities. This is an illustrative fixture. No real agent was contacted.',timestamp:now-90000,media:[]}],historyState:{status:'complete'},historyHasMore:false});}
  function sizeChamber(){if(state.view!=='chamber'||state.chat)return;const wrap=$('canvas-wrap'),top=wrap.getBoundingClientRect().top+window.scrollY,nav=document.querySelector('.bottom-nav').getBoundingClientRect().height,controls=document.querySelector('.chamber-controls').getBoundingClientRect().height;wrap.style.height=Math.max(240,innerHeight-top-nav-controls-20)+'px';}
  function viewport(){const next=[innerWidth,innerHeight,state.nativeFontScale,local.data.preferences.scale].join(':');if(next!==debugViewport){debugViewport=next;diagnostic('viewport',{width:innerWidth,height:innerHeight,fontScale:state.nativeFontScale,appScale:local.data.preferences.scale/100});}if(window.visualViewport)$('conversation-screen').style.setProperty('--keyboard-height',window.visualViewport.height+'px');sizeChamber();if(state.view==='environment'&&!state.chat)environment.fitViewport();}
  function back(){if(telegramLegacy){telegramLegacy=false;$('native-return')?.remove();telegramSchedule();return true;}for(const id of ['debug-dialog','owner-record-dialog','command-dialog','details-dialog','message-actions-dialog','conversation-actions-dialog'])if($(id).open){$(id).close();return true;}if(state.chat&&!$('chat-tools').hidden){$('chat-tools').hidden=true;return true;}if(state.chat){closeChat();return true;}if(state.view!=='chats'){showView('chats');return true;}return false;}
  // Native Telegram UI consumes admitted public history and explicitly labelled
  // device-local request custody; local rows never confer public capabilities.
  // It never has a transport token, raw tool arguments, or an independent send path.
  let telegramTimer=0,telegramSignature='',telegramLegacy=false,telegramFocus=null,telegramIdentity='';
  const telegramEnabled=()=>typeof window.DracoNative?.renderTelegram==='function';
  function telegramSchedule(){if(!telegramEnabled()||telegramTimer)return;telegramTimer=setTimeout(()=>{telegramTimer=0;telegramPublish();},60);}
  function telegramLocal(id){return conversationRows().find(m=>m.localSubmission===true&&m.id===id);}
  function telegramFind(id){return (history()?.conversation||[]).find(m=>m.id===id&&m.sessionId===row()?.sessionId&&m.publicAttested===true&&m.source==='authenticated-native-history'&&['user','assistant'].includes(m.role))||state.workActivity.find(m=>m.id===id&&m.agent===state.selected&&m.sessionId===row()?.sessionId&&workFresh(m));}
  function telegramDetail(event){
    // Reuse the same allowlisted evidence renderer as Activity, not JSON/raw payloads.
    const node=create('div'),key=activityKey(event),was=expandedActivity.has(key);expandedActivity.add(key);activityOperation(node,event);if(!was)expandedActivity.delete(key);
    const detail=[...node.children].map(child=>child.tagName==='DL'?[...child.children].map((item,index)=>item.tagName==='DT'?item.textContent+': ':item.textContent+'\n').join(''):child.tagName==='BUTTON'?'':child.textContent).filter(Boolean).join('\n');
    return detail.length>4096?detail.slice(0,3980)+'\n[Expanded detail limited to 4,096 characters; remaining fields are not shown.]':detail;
  }
  function telegramPayload(){
    const current=history(),sessionId=row()?.sessionId||'',spec=byId.get(state.selected),needle=state.search.toLowerCase();
    const identity=state.selected+':'+sessionId;if(telegramIdentity!==identity){telegramIdentity=identity;telegramFocus=null;if(state.reply&&state.reply.sessionId!==sessionId)state.reply=null;}
    const all=conversationRows().filter(m=>!needle||m.text.toLowerCase().includes(needle));
    const offset=Math.min(messageOffsets.get(state.selected)||0,Math.max(0,all.length-1)),end=Math.max(0,all.length-offset),rows=all.slice(Math.max(0,end-50),end);
    const operations=state.workActivity.filter(e=>e.agent===state.selected&&e.sessionId===sessionId&&workFresh(e));
    const activity=[],counts=new Map();
    for(const e of state.activity.concat(state.workActivity.filter(workFresh)).filter(e=>state.filter==='all'||e.agent===state.filter).sort((a,b)=>b.timestamp-a.timestamp)){
      const count=counts.get(e.agent)||0;if(count>=12||!byId.has(e.agent))continue;counts.set(e.agent,count+1);
      const tool=e.source==='authenticated-tool-status';activity.push({id:e.id,agent:e.agent,sessionId:e.sessionId,name:byId.get(e.agent).name,text:(attachmentSummary(e)||observedWorkText(e)).slice(0,12000),timestamp:e.timestamp,kind:publicKind(e),preview:tool?executionPreview(e.observation):'',steps:tool?taskProgress(e.observation)?.steps||[]:[],detail:tool?telegramDetail(e):'',revision:e.evidenceRevision||'',ownerDetail:!!ownerRef(e),stale:!live()||e.receivedOnly===true});
    }
    activity.sort((a,b)=>a.timestamp-b.timestamp||a.id.localeCompare(b.id));
    const pending=local.unresolved(state.selected);
    return {activityFilter:state.filter,activityMode:state.activityMode,activityFollowKey:activityLatestKey,visible:!telegramLegacy&&!document.querySelector('dialog[open]')&&(state.chat||['chats','activity'].includes(state.view)),chat:state.chat,view:state.view,agent:state.selected,name:spec.name,color:spec.color,sessionId,sessionKey:row()?.sessionKey||'',status:state.chat?$('chat-status').textContent:$('connection-label').textContent,live:live(),appScale:local.data.preferences.scale/100,
      controlRunId:controlTarget()?.runId||'',draft:$('draft').value,replyLabel:state.reply?$('reply-label').textContent:'',historyNote:state.chat?$('history-note').textContent:$('activity-observation-note').textContent,
      audio:audioPayload(),voiceStatus:$('voice-status').textContent,playbackRate:local.data.preferences.playbackRate,recording:state.recording,actionNote:$('action-note').textContent,copyNote:$('copy-note').textContent,search:state.search,focusMessageId:telegramFocus,
      can:{send:!$('send').disabled,queue:!$('queue').disabled,steer:!$('steer').disabled,abort:!$('stop').disabled,attachments:!$('attach').disabled,voice:!$('record').disabled,speech:caps().speech===true&&live(),older:!$('older-history').disabled},
      messages:rows.map(m=>({id:m.id,agent:m.agent||state.selected,sessionId:m.sessionId,role:m.role,text:m.text.slice(0,24000),fullAvailable:m.text.length>24000,timestamp:m.timestamp,kind:m.kind||'Public report',localSubmission:m.localSubmission===true,submissionState:m.submissionState||'',submissionNote:m.submissionNote||'',attachmentNote:m.attachmentNote||'',deliveryDiagnosis:deliveryDiagnosis(m),canPin:!m.localSubmission&&m.publicAttested===true&&m.source==='authenticated-native-history',canReply:!m.localSubmission&&live()&&!current?.saved&&caps().reply===true&&m.replyAvailable!==false,canRead:canReadAloud(m),replyToId:linkedText(m,current?.conversation||[])?.id||m.replyToId||'',delivery:m.delivery?.state==='delivered'?'Telegram receipt; phone reception unverified':'',media:(m.media||[]).map((a,index)=>({index:a.index??index,label:a.label||a.kind||'Attachment',available:live()&&!current?.saved&&a.downloadAvailable===true&&typeof(a.url||a.path)==='string'&&(a.url||a.path).startsWith('/v1/media?'),unavailableReason:a.unavailableReason||'No playable app link'}))})),
      activity,work:operations.slice(-30).map(e=>({id:e.id,agent:e.agent,sessionId:e.sessionId,name:spec.name,text:observedWorkText(e),timestamp:e.timestamp,kind:e.kind,canPin:true,preview:executionPreview(e.observation),steps:taskProgress(e.observation)?.steps||[],detail:telegramDetail(e),revision:e.evidenceRevision||'',ownerDetail:!!ownerRef(e)})),
      roster:SPECS.map(s=>({id:s.id,name:s.name,color:s.color,status:live()?label(state.agents.get(s.id)?.status):'Unobserved',preview:cards.get(s.id)?.preview.textContent||s.role})),
      pins:sessionId?local.pins(state.selected,sessionId).map(pin=>{const current=telegramFind(pin.messageId);return current?{...pin,text:current.text.slice(0,2000),title:workPreview(current).slice(0,160),sourceAvailable:true}:{...pin,sourceAvailable:false};}):[],pinHistory:sessionId?local.pinHistory(state.selected,sessionId):[],attachments:attachments().map(a=>({id:a.id,name:a.name,state:a.state})),
      outbox:local.data.outbox.filter(o=>o.agent===state.selected&&['pending','uncertain'].includes(o.state)).map(o=>({id:o.id,path:o.path,localSubmission:o.path==='/v1/message',sessionId:o.body.sessionId||'',priorSession:o.body.sessionId!==sessionId,text:'',state:o.state,note:(o.body.sessionId!==sessionId?'Earlier-session request · ':'')+(o.note||'Acceptance does not prove reading or completion'),retry:o.body.mode!=='steer'&&o.id===pending?.id&&o.state==='uncertain'})),
      workSummary:state.chat?$('chat-work').textContent:$('activity-count').textContent,observedAt:state.observed};
  }
  function telegramPublish(){if(!telegramEnabled())return;const json=JSON.stringify(telegramPayload());if(json!==telegramSignature){telegramSignature=json;native('renderTelegram',json);}}
  function telegramComposer(){
    // Keep every existing custody control reachable while the native surfaces
    // mature: staged-file review/removal, original-ID retry, reply clear and
    // Finish recording live in this retained composer, not its action dialog.
    telegramLegacy=true;$('chat-tools').hidden=false;
    let back=$('native-return');if(!back){back=button('Return to native chat',()=>{telegramLegacy=false;back.remove();telegramSchedule();},'secondary-button');back.id='native-return';$('conversation-screen').prepend(back);}
    telegramPublish();requestAnimationFrame(()=>$('draft').scrollIntoView({block:'nearest'}));
  }
  function telegramFull(id,localSubmission=false){const m=localSubmission?telegramLocal(id):telegramFind(id);if(!m)return toast('This record is outside the current session window.');telegramLegacy=true;expandedMessages.add(id);const rows=conversationRows(),i=rows.findIndex(row=>row.id===id&&Boolean(row.localSubmission)===localSubmission);if(i>=0)messageOffsets.set(state.selected,Math.max(0,rows.length-i-25));renderSignature='';renderMessages();let back=$('native-return');if(!back){back=button('Return to native chat',()=>{telegramLegacy=false;back.remove();telegramSchedule();},'secondary-button');back.id='native-return';$('conversation-screen').prepend(back);}telegramPublish();requestAnimationFrame(()=>[...$('conversation-list').children].find(row=>row.dataset.messageId===id&&row.dataset.localSubmission===String(localSubmission))?.scrollIntoView({block:'center'}));}
  window.onDracoTelegramAction=event=>{
    const action=event?.action,d=event?.data||{};
    if(action==='openChat'){if(byId.has(d.agent))openChat(d.agent);telegramSchedule();return;}
    if(action==='view'){if(state.chat&&!closeChat())return;showView(d.view);telegramSchedule();return;}
    if(action==='refresh'){refresh();return;}
    if(action==='diagnostics'){openDebug();return;}if(action==='exportDiagnostics'){exportDebug();return;}
    if(action==='activityFilter'){setActivityFilter(d.agent);return;}if(action==='activityMode'){setActivityMode(d.mode);return;}
    if(action==='ownerDetail'){const found=state.workActivity.find(e=>e.id===d.id&&e.agent===d.agent&&e.sessionId===d.sessionId&&e.evidenceRevision===(d.revision||'')&&workFresh(e));if(found)openOwnerRecord(found);else toast('The exact recorded activity changed. Refresh and reopen it.');return;}
    // Every actionable row/menu captures the exact rendered physical-session scope.
    if(d.agent!==state.selected||d.sessionId!==(row()?.sessionId||'')||d.sessionKey!==undefined&&d.sessionKey!==(row()?.sessionKey||'')){toast('The selected session changed. Reopen this control.');return;}
    if((action==='stop'||action==='send'&&d.mode==='steer')&&(!d.runId||d.runId!==controlTarget()?.runId)){toast('The displayed run changed. No control was dispatched.');return;}
    const message=typeof d.id==='string'?(d.localSubmission===true?telegramLocal(d.id):telegramFind(d.id)):null;
    try{
      if(action==='closeChat')closeChat();
      else if(action==='draft'){if(typeof d.text==='string'&&d.text.length<=16000){$('draft').value=d.text;saveDraft();}else toast('Draft exceeds the 16,000-character saved limit. Nothing was sent.');}
      else if(action==='send'){
        // The body visible in the native composer must be the body admitted by
        // the existing outbox. A rejected paste must never send an older draft.
        if(typeof d.text!=='string'||d.text.length>16000||d.text!==$('draft').value)return toast('The visible draft is not saved exactly. Nothing was sent. Keep it within 16,000 characters and try again.');
        if(['send','queue','steer'].includes(d.mode))send(d.mode);
      }
      else if(action==='stop')stop();
      else if(action==='tools')conversationActions();
      else if(action==='composer')telegramComposer();
      else if(action==='commands')commands();
      else if(action==='details')details();
      else if(action==='attach'){if(!$('attach').disabled)$('attach').click();}
      else if(action==='record'){if(!$('record').disabled)$('record').click();}
      else if(action==='recordStop')native('stopRecording');
      else if(action==='replyClear'){state.reply=null;renderChat();}
      else if(action==='attachmentRemove'){const file=attachments().find(a=>a.id===d.id);if(file&&!local.unresolved(state.selected)?.body.attachmentIds?.includes(file.id)){native('cancelAttachment',file.id);state.attachments=state.attachments.filter(a=>a.id!==file.id);local.setAttachments(state.attachments);renderChat();}}
      else if(action==='attachmentPreview'){if(attachments().some(a=>a.id===d.id))native('previewAttachment',d.id);}
      else if(action==='retry'){if(local.unresolved(state.selected)?.id===d.id)retrySubmission(d.id);}
      else if(action==='pin'&&message&&!message.localSubmission){if(message.source==='authenticated-tool-status'&&(d.revision||'')!==(message.evidenceRevision||''))return toast('This work evidence revision changed. Reopen the activity before pinning.');local.pin(state.selected,row().sessionId,message);toast('Pinned on this device');}
      else if(action==='unpin'){local.unpin(state.selected,row().sessionId,d.id);}
      else if(action==='copy'&&message)copy(message.text);
      else if(action==='share'&&message)share(message.text);
      else if(action==='reply'&&message&&live()&&!history()?.saved&&caps().reply===true&&message.source==='authenticated-native-history'&&message.replyAvailable!==false){state.reply={id:message.id,sessionId:message.sessionId};renderChat();}
      else if(action==='read'&&message&&canReadAloud(message))readAloud(message);
      else if(action==='media'&&message&&!message.localSubmission){const media=message.media?.find((a,index)=>(a.index??index)===d.index),url=media?.url||media?.path;if(live()&&!history()?.saved&&media?.downloadAvailable===true&&typeof url==='string'&&url.startsWith('/v1/media?')){const id=message.id+':'+d.index;if(state.playing===id){native('stopMedia');state.playing=null;}else{playRecording(message,media,url,id);}renderMessages();}}
      else if(action==='speed'&&[.5,.75,1,1.25,1.5,2].includes(d.rate)){local.preferences({playbackRate:d.rate});applyPreferences();native('setPlaybackRate',d.rate);}
      else if(action==='stopAudio')$('voice-stop').click();
      else if(action==='audioPause')audioControl('pause',d.playbackId);
      else if(action==='audioResume')audioControl('resume',d.playbackId);
      else if(action==='audioSeek')audioControl('seek',d.playbackId,d.positionMs);
      else if(action==='older')older();
      else if(action==='latest'){messageOffsets.set(state.selected,0);state.search='';renderSignature='';renderMessages();}
      else if(action==='search'&&typeof d.text==='string'){state.search=d.text.slice(0,500);messageOffsets.set(state.selected,0);renderMessages();}
      else if(action==='full'&&message)telegramFull(message.id,message.localSubmission===true);
      else if(action==='goto'){const work=state.workActivity.find(m=>m.id===d.id&&m.agent===state.selected&&m.sessionId===row()?.sessionId&&workFresh(m));const rows=conversationRows(),i=rows.findIndex(m=>m.id===d.id&&!m.localSubmission);if(work){telegramFocus=d.id;}else if(i>=0){state.search='';messageOffsets.set(state.selected,Math.max(0,rows.length-i-25));telegramFocus=d.id;renderSignature='';renderMessages();}else toast('Pinned snapshot retained; source is outside the loaded window. Use Older messages to retrieve it.');}
      else if(action==='work')openWork(state.selected);
    }catch(error){toast(error.message||'This action could not be completed.');}
    telegramSchedule();
  };
  if(telegramEnabled()){
    new MutationObserver(telegramSchedule).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['open','hidden','disabled','data-state']});
    telegramSchedule();
  }

  $('refresh').addEventListener('click',refresh);$('connect').addEventListener('click',()=>native('openSettings'));$('pairing-settings').addEventListener('click',()=>native('openSettings'));
  document.querySelectorAll('[data-view]').forEach(item=>item.addEventListener('click',()=>showView(item.dataset.view)));
  $('keyboard-back').addEventListener('click',()=>{$('draft').blur();if(typeof window.DracoNative?.hideKeyboard==='function')native('hideKeyboard');});$('chat-back').addEventListener('click',closeChat);$('chat-menu').addEventListener('click',()=>{$('chat-tools').hidden=!$('chat-tools').hidden;});$('draft').addEventListener('input',saveDraft);$('send').addEventListener('click',()=>send($('input-mode').value));$('input-mode').addEventListener('change',()=>{renderComposerControls();if($('input-mode').value==='steer'&&caps().strictSteer!==true)toast('Steer requires exact displayed-run injection from the gateway. Unsupported here; nothing will be sent as a follow-up.');else if($('input-mode').value==='queue')toast('Queue uses the gateway follow-up policy and may start now when idle.');});$('queue').addEventListener('click',()=>{$('conversation-actions-dialog').close();send('queue');});$('steer').addEventListener('click',()=>{$('conversation-actions-dialog').close();send('steer');});$('stop').addEventListener('click',()=>{$('conversation-actions-dialog').close();stop();});
  for(const [id,mode] of [['activity-live','live'],['activity-work','work']])$(id).addEventListener('click',()=>setActivityMode(mode));
  $('activity-latest').addEventListener('click',followActivity);window.addEventListener('scroll',()=>{if(state.view!=='activity'||state.chat)return;const near=document.documentElement.scrollHeight-innerHeight-scrollY<90;activityFollow=near;if(near)$('activity-latest').hidden=true;},{passive:true});
  $('chat-work').addEventListener('click',()=>openWork(state.selected));$('activity-detail').addEventListener('change',()=>{state.activityDetail=$('activity-detail').value==='concise'?'concise':'detailed';try{localStorage.setItem('draco-watch-activity-detail',state.activityDetail);}catch{}renderActivity();});
  $('attach').addEventListener('click',()=>{if(attachments().length>=8){toast('Up to 8 attachments can be sent at once.');return;}$('conversation-actions-dialog').close();native('chooseAttachment',state.selected);});$('record').addEventListener('click',()=>{if(attachments().length>=8){toast('Up to 8 attachments can be sent at once.');return;}native('startRecording',state.selected);});$('record-stop').addEventListener('click',()=>native('stopRecording'));$('reply-clear').addEventListener('click',()=>{state.reply=null;renderChat();});
  $('commands').addEventListener('click',()=>{$('conversation-actions-dialog').close();commands();});$('composer-more').addEventListener('click',conversationActions);$('conversation-actions-close').addEventListener('click',()=>$('conversation-actions-dialog').close());$('message-actions-close').addEventListener('click',()=>$('message-actions-dialog').close());$('commands-close').addEventListener('click',()=>$('command-dialog').close());$('agent-details').addEventListener('click',details);$('details-close').addEventListener('click',()=>$('details-dialog').close());$('older-history').addEventListener('click',older);$('message-search').addEventListener('input',()=>{state.search=$('message-search').value;messageOffsets.set(state.selected,0);renderMessages();});
  $('new-messages').addEventListener('click',()=>{messageOffsets.set(state.selected,0);forceScroll=true;renderMessages();$('message-scroll').scrollTop=$('message-scroll').scrollHeight;$('new-messages').hidden=true;});$('message-scroll').addEventListener('scroll',()=>{if($('message-scroll').scrollHeight-$('message-scroll').clientHeight-$('message-scroll').scrollTop<60)$('new-messages').hidden=true;});
  $('zoom-in').addEventListener('click',()=>chamber.setZoom(chamber.zoom+.25));$('zoom-out').addEventListener('click',()=>chamber.setZoom(chamber.zoom-.25));$('zoom-fit').addEventListener('click',()=>chamber.fit());
  $('environment-speech').setAttribute('aria-pressed',String(state.bubbles));
  $('environment-speech').addEventListener('click',()=>{state.bubbles=!state.bubbles;local.preferences({environmentBubbles:state.bubbles});$('environment-speech').setAttribute('aria-pressed',String(state.bubbles));environmentBubbles.show(state.bubbles&&state.view==='environment'&&!state.chat);viewport();});
  $('environment-zoom-in').addEventListener('click',()=>{environment.setZoom(environment.zoom+.25);environmentBubbles.layout(true);});$('environment-zoom-out').addEventListener('click',()=>{environment.setZoom(environment.zoom-.25);environmentBubbles.layout(true);});$('environment-fit').addEventListener('click',()=>{environment.fit();environmentBubbles.layout(true);});
  $('display-scale').addEventListener('input',()=>{local.preferences({scale:Number($('display-scale').value)});applyPreferences();});$('rendering-mode').addEventListener('change',()=>{local.preferences({rendering:$('rendering-mode').value});applyPreferences();});$('reduce-motion').addEventListener('change',()=>{local.preferences({motion:$('reduce-motion').checked});applyPreferences();renderRoster();});
  for(const id of ['voice-rate','playback-rate'])$(id).addEventListener('change',()=>{local.preferences({playbackRate:Number($(id).value)});applyPreferences();if(typeof window.DracoNative?.setPlaybackRate==='function')native('setPlaybackRate',local.data.preferences.playbackRate);else toast('Install the updated Android app to change playback speed.');});
  $('telegram-copy').addEventListener('change',()=>{local.preferences({echoToTelegram:$('telegram-copy').checked});renderComposerControls();});
  $('automatic-speech').addEventListener('change',()=>{const enabled=$('automatic-speech').checked;if(enabled&&!confirm('Optional automatic speech reads NEW final replies while this chat is open. Opening history and reconnecting remain silent. Enable it?')){$('automatic-speech').checked=false;return;}local.preferences({automaticSpeech:enabled,speechPreferenceVersion:2});syncVoice();});$('voice-stop').addEventListener('click',()=>{if(voice.active)voice.cancel();else{native('stopMedia');state.playing=null;mediaStatus=null;renderVoice();renderMessages();}});$('voice-pause').addEventListener('click',()=>{const audio=audioPayload();if(audio)audioControl(audio.state==='paused'?'resume':'pause',audio.id);});$('voice-seek').addEventListener('change',()=>{const audio=audioPayload();if(audio)audioControl('seek',audio.id,Number($('voice-seek').value));});$('voice-replay').addEventListener('click',()=>{const message=history()?.conversation?.find(m=>m.id===voiceMessage?.id);if(message)readAloud(message);});
  $('history-note').addEventListener('click',()=>toast(historyCoverage()));$('history-note').addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();toast(historyCoverage());}});
  $('debug-open').addEventListener('click',openDebug);$('chat-debug').addEventListener('click',openDebug);$('debug-close').addEventListener('click',()=>$('debug-dialog').close());$('debug-refresh').addEventListener('click',refreshDebug);$('debug-inspect').addEventListener('click',()=>{if(typeof window.DracoNative?.requestLocalWebInspection==='function')native('requestLocalWebInspection');else toast('Local WebView inspection requires the updated Android app.');});$('debug-export').addEventListener('click',exportDebug);
  $('owner-record-close').addEventListener('click',()=>$('owner-record-dialog').close());$('owner-record-dialog').addEventListener('close',()=>{if($('owner-record-dialog').open)return;ownerRecord=null;$('owner-record-content').textContent='';telegramSchedule();});$('owner-record-more').addEventListener('click',loadOwnerRecord);$('owner-record-load-all').addEventListener('click',()=>{if(!ownerRecord||ownerRecord.complete)return;ownerRecord.loadAll=true;$('owner-record-cancel-load').hidden=false;loadOwnerRecord();});$('owner-record-cancel-load').addEventListener('click',()=>{if(ownerRecord)ownerRecord.loadAll=false;$('owner-record-cancel-load').hidden=true;});$('owner-record-export').addEventListener('click',exportOwnerRecord);
  $('owner-record-reveal').addEventListener('click',()=>{if(!ownerRecord||ownerRecord.pending)return;if(!ownerRecord.reveal&&!confirm('Reveal credentials present in this exact tool record on this screen? Do not share screenshots or this record unless you intend to disclose them.'))return;ownerRecord={...ownerRecord,reveal:!ownerRecord.reveal,text:'',offset:0,complete:false,pending:false,totalChars:undefined,loadAll:false,failed:false};$('owner-record-export').disabled=true;$('owner-record-load-all').disabled=false;$('owner-record-content').textContent='';$('owner-record-reveal').textContent=ownerRecord.reveal?'Mask credentials':'Reveal credentials…';loadOwnerRecord();});
  window.addEventListener('error',event=>diagnostic('js.error',{errorName:event.error?.name||'Error',file:String(event.filename||'').split('?')[0].split('/').pop(),line:event.lineno,column:event.colno},'error'));
  window.addEventListener('unhandledrejection',event=>diagnostic('js.rejection',{errorName:event.reason?.name||'UnhandledRejection'},'error'));
  $('notifications').addEventListener('change',()=>{if(!native('setNotifications',$('notifications').checked))$('notifications').checked=false;});
  $('update-check').addEventListener('click',()=>native('checkUpdates'));$('update-install').addEventListener('click',()=>native('installUpdate'));$('uninstall').addEventListener('click',()=>native('uninstall'));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&back())event.preventDefault();});document.addEventListener('visibilitychange',()=>window.onDracoLifecycle({active:!document.hidden}));window.addEventListener('resize',viewport);window.visualViewport?.addEventListener('resize',viewport);
  window.addEventListener('pagehide',()=>{if(state.chat)local.setDraft(state.selected,$('draft').value);voice.cancel();clearTimeout(poll);clearTimeout(refreshTimeout);chamber.show(false);environment.show(false);environmentBubbles.show(false);});
  $('draft').value=local.draft(state.selected);applyPreferences();if(typeof window.DracoNative?.setPlaybackRate==='function')native('setPlaybackRate',local.data.preferences.playbackRate);buildRoster();renderAll();viewport();schedule(0);setInterval(()=>{if(visible())checkStale();},1000);
  // Test/debug hook exposes public UI state only, never credentials or native attachment data.
  window.DracoWatch=Object.freeze({select:openChat,close:closeChat,view:showView,refresh,back});
})();
