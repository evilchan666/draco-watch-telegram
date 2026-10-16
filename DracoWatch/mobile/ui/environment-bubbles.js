/* Speech previews consume only the already-public fleet feed. They never synthesize
 * dialogue, expose a different session, or submit input to an agent. */
'use strict';
(() => {
  const MAX_AGE=15*60*1000,STATES=new Set(['active','idle','queued']);
  const IDLE_EXPIRY_MS=60000,EXPIRY_KEY='draco-environment-idle-v1';
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const timestamp=value=>typeof value==='number'&&Number.isFinite(value)?(value<1e11?value*1000:value):typeof value==='string'?Date.parse(value):NaN;
  // Presentation only: bound work on fleet refreshes, retain authored messages
  // untouched for chat, speech identity and reply/submission custody. No HTML.
  function previewText(value){
    return String(value??'').slice(0,4096)
      .replace(/^\s*(`{3,}|~{3,})[^\n]*$/gm,'')
      .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm,'')
      .replace(/!?\[([^\]\n]+)\]\([^\n)]*\)/g,'$1')
      .replace(/(`+)([^`\n]+)\1/g,'$2')
      .replace(/(\*\*|__|~~)(?=\S)([^\n]*?\S)\1/g,'$2')
      .replace(/(^|[\s(])([*_])(?=\S)([^\n]*?\S)\2(?=$|[\s.,!?;:)])/g,'$1$3')
      .replace(/\s+/gu,' ').trim();
  }
  const preview=value=>{const text=previewText(value),characters=Array.from(text);return characters.length>145?characters.slice(0,144).join('')+'…':text;};
  const clock=value=>{const date=new Date(value);return String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0');};
  const stateLabel=status=>({active:'Run open',idle:'No open run',queued:'Queued'})[status]||'Unobserved';
  // Android may already incorporate textZoom in computed font pixels. Compare
  // against the native/app scale contract rather than multiplying it twice.
  const resolveFontScale=(computedFont,nativeFontScale=1,appFontScale=1)=>Math.max(1,(Number(computedFont)||12)/12,(Number(nativeFontScale)||1)*(Number(appFontScale)||1));

  function selectReports(activity,agents,{live=false,now=Date.now(),specs=window.DracoChamber?.SPECS||[]}={}) {
    const latest=new Map(),rows=agents&&typeof agents.get==='function'?agents:new Map();
    if(live===true&&Number.isFinite(now))for(const message of Array.isArray(activity)?activity:[]){
      const agent=rows.get(message?.agent),time=timestamp(message?.timestamp);
      const attachment=message?.kind==='Attachment only'&&!message?.text?.trim()&&Array.isArray(message.media)&&message.media.length>0;
      if(!agent||!STATES.has(agent.status)||typeof agent.sessionId!=='string'||!agent.sessionId||message.sessionId!==agent.sessionId||message.role!=='assistant'||['analysis','thinking','tool'].includes(message.channel)||message.receivedOnly===true||message.source==='authenticated-tool-status'||/^(?:Observed change|Tool started|Tool finished|Tool failed|Status receipt|Delivery receipt)$/i.test(message.kind||'')||typeof message.id!=='string'||!message.id||typeof message.text!=='string'||(!message.text.trim()&&!attachment)||message.private===true||message.audience==='private'||!Number.isFinite(time)||time<=0||time>now+60000)continue;
      const attachmentText=attachment?(message.media.some(item=>item.kind==='audio')?'Audio':'Attachment')+(message.media.some(item=>(!message.media.some(value=>value.kind==='audio')||item.kind==='audio')&&item.downloadAvailable===true)?' available':' unavailable in app')+' · no companion text':null;
      const prior=latest.get(message.agent);if(!prior||time>prior.timestamp)latest.set(message.agent,{sourceId:message.id,text:message.text,attachmentText,timestamp:time,sessionId:agent.sessionId});
    }
    return specs.map(spec=>{
      const agent=rows.get(spec.id),observed=live===true&&STATES.has(agent?.status),status=observed?agent.status:'unknown',report=observed?latest.get(spec.id):null;
      return {id:spec.id,name:spec.name,color:spec.color,status,kind:report?.attachmentText?'attachment':report?'report':'state',historical:!!report&&now-report.timestamp>MAX_AGE,sourceId:report?.sourceId||null,sessionId:observed?agent?.sessionId:null,timestamp:report?.timestamp||null,
        label:report?(report.attachmentText?'Attachment · '+clock(report.timestamp):now-report.timestamp>MAX_AGE?'Last report · '+clock(report.timestamp):'Public report · '+clock(report.timestamp)):stateLabel(status),
        preview:report?preview(report.attachmentText||report.text):observed?'No public update':'Live observation unavailable',fullText:report?.text||null};
    });
  }

  // Presentation custody only: six bounded identity/clock records, never text.
  // Absolute deadlines survive refresh, hidden views and reconnect. No new timer:
  // the existing fleet refresh evaluates expiry even when motion is disabled.
  class IdleExpiry {
    constructor({storage=null}={}) {
      this.storage=storage;this.rows=new Map();this.saved='';
      const validId=value=>typeof value==='string'&&value.length>0&&value.length<=512&&!/[\s\u0000-\u001f\u007f]/u.test(value);
      this.validId=validId;this.agents=new Set(['main','forge','atlas','aera-new','vvv','daedalus']);
      try{const raw=storage?.getItem(EXPIRY_KEY);if(raw?.length<=16384){const saved=JSON.parse(raw);if(saved?.version===1&&Array.isArray(saved.rows))for(const [id,row] of saved.rows.slice(0,6)){
        if(!this.agents.has(id)||!row||!validId(row.sessionId)||!STATES.has(row.status)||![row.messageAt,row.speechAt,row.expiredThrough].every(value=>Number.isSafeInteger(value)&&value>=0)||!(row.idleSince===null||Number.isSafeInteger(row.idleSince)&&row.idleSince>=0)||!(row.messageId===null||validId(row.messageId))||!(row.expiredMessageId===null||validId(row.expiredMessageId)))continue;
        this.rows.set(id,{sessionId:row.sessionId,status:row.status,idleSince:row.idleSince,messageId:row.messageId,messageAt:row.messageAt,speechAt:row.speechAt,expiredThrough:row.expiredThrough,expiredMessageId:row.expiredMessageId});
      }}}catch{/* Unavailable/damaged optional presentation cache never affects chat. */}
    }
    expire(row,now) {
      if(row?.idleSince!==null&&row?.idleSince!==undefined&&now>=Math.max(row.idleSince,row.speechAt)+IDLE_EXPIRY_MS){row.expiredThrough=Math.max(row.expiredThrough,row.messageAt);row.expiredMessageId=row.messageId;}
    }
    apply(reports,{now=Date.now()}={}) {
      if(!Number.isSafeInteger(now)||now<0)return reports;
      const output=reports.map(report=>{
        if(!this.agents.has(report.id))return report;
        let row=this.rows.get(report.id);this.expire(row,now);
        // Unknown is not idle. Keep the last known clock, without claiming an
        // unobserved transition or resetting it when the same session reconnects.
        if(!STATES.has(report.status)||!this.validId(report.sessionId))return {...report,hidden:false};
        if(!row||row.sessionId!==report.sessionId){row={sessionId:report.sessionId,status:report.status,idleSince:report.status==='idle'?now:null,messageId:null,messageAt:0,speechAt:0,expiredThrough:0,expiredMessageId:null};this.rows.set(report.id,row);}
        if(report.status==='idle'&&row.status!=='idle')row.idleSince=now;
        else if(report.status!=='idle')row.idleSince=null;
        row.status=report.status;
        const genuine=report.kind==='report'&&this.validId(report.sourceId)&&typeof report.fullText==='string'&&!!report.fullText.trim()&&Number.isSafeInteger(report.timestamp)&&report.timestamp>0&&report.timestamp<=now+60000;
        if(genuine&&report.sourceId!==row.messageId&&report.timestamp>row.messageAt&&report.timestamp>row.expiredThrough){row.messageId=report.sourceId;row.messageAt=report.timestamp;row.speechAt=Math.min(report.timestamp,now);}
        this.expire(row,now);
        const idleExpired=row.idleSince!==null&&now>=Math.max(row.idleSince,row.speechAt)+IDLE_EXPIRY_MS;
        const oldSpeech=genuine&&(report.timestamp<=row.expiredThrough||report.sourceId===row.expiredMessageId);
        if(idleExpired)return {...report,hidden:true};
        // Returning active alone does not resurrect expired words. Actual active
        // state and creature animation remain available, with no invented speech.
        if(oldSpeech)return {...report,hidden:report.status==='idle',kind:'state',sourceId:null,timestamp:null,historical:false,fullText:null,label:stateLabel(report.status),preview:'No new public update'};
        return {...report,hidden:false};
      });
      const saved=JSON.stringify({version:1,rows:[...this.rows]});
      if(saved!==this.saved){try{this.storage?.setItem(EXPIRY_KEY,saved);}catch{}this.saved=saved;}
      return output;
    }
  }

  const overlaps=(a,b,gap=0)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
  const inside=(box,w,h,pad)=>box.x>=pad-.01&&box.y>=pad-.01&&box.x+box.width<=w-pad+.01&&box.y+box.height<=h-pad+.01;
  function connect(box,point){
    const target=Number.isFinite(point.x)&&Number.isFinite(point.y)?{x:point.x,y:point.y}:null;
    return {...box,connector:target?{start:{x:clamp(target.x,box.x,box.x+box.width),y:clamp(target.y,box.y,box.y+box.height)},end:target}:null};
  }
  // Card placement is retained until a projected body actually collides with it.
  // Most frames do 36 rectangle checks, then move connector endpoints only. A
  // collision triggers a bounded, six-card packing search, never another RAF.
  function layoutBubbles(points,{width,height,padding=6,gap=5,preferredWidth=124,preferredHeight=74,compactHeight=60,previous=[],bodyPoints=points}={}) {
    const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1),pad=Math.min(padding,w/12,h/12);
    const obstacles=bodyPoints.filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.radius>0).map(point=>({x:point.x-point.radius,y:point.y-point.radius,width:point.radius*2,height:point.radius*2})).filter(box=>box.x+box.width>0&&box.y+box.height>0&&box.x<w&&box.y<h);
    const bodyClear=box=>!obstacles.some(body=>overlaps(box,body,3));
    const old=new Map(Array.isArray(previous)?previous.map(box=>[box.id,box]):[]);
    const valid=box=>box&&box.width>=44&&box.height>=44&&inside(box,w,h,box.height<=44?2:pad)&&bodyClear(box);
    function result(boxes,packed,density){const output=points.map(point=>connect(boxes.get(point.id),point));output.packed=packed;output.density=density;output.limit=packed?null:'INSUFFICIENT_CLEAR_CANVAS_FOR_SIX_44PX_BUBBLES';return output;}
    if(points.length&&old.size===points.length&&points.every(point=>valid(old.get(point.id)))&&[...old.values()].every((a,index,array)=>array.slice(index+1).every(b=>!overlaps(a,b,gap))))return result(old,true,previous.density||'regular');

    const regular={width:preferredWidth,height:preferredHeight,density:'regular'},compact={width:Math.min(110,preferredWidth),height:compactHeight,density:'compact'};
    const priorSize=previous.length?{width:previous[0].width,height:previous[0].height,density:previous.density||'compact'}:null;
    const dimensions=[...(priorSize?[priorSize]:[]),...(w<500?[compact,regular]:[regular,compact]),{width:96,height:compactHeight,density:'compact'},{width:88,height:Math.max(44,Math.min(compactHeight,54)),density:'compact'},{width:100,height:44,density:'chip'},{width:88,height:44,density:'chip'},{width:76,height:44,density:'chip'},{width:64,height:44,density:'chip'}].filter((size,index,array)=>array.findIndex(candidate=>candidate.width===size.width&&candidate.height===size.height)===index);
    for(const size of dimensions){
      const inset=size.density==='chip'?Math.min(2,pad):pad,cw=Math.max(44,Math.min(size.width,w-inset*2)),ch=Math.max(44,Math.min(size.height,h-inset*2));
      if(cw>w-inset*2||ch>h-inset*2)continue;
      const xs=new Set([inset,w-inset-cw,(w-cw)/2]),ys=new Set([inset,h-inset-ch,(h-ch)/2]);
      for(let x=inset;x<=w-inset-cw;x+=cw+gap)xs.add(x);for(let y=inset;y<=h-inset-ch;y+=Math.max(12,ch/2))ys.add(y);
      for(const body of obstacles){xs.add(clamp(body.x-cw-gap-3,inset,w-inset-cw));xs.add(clamp(body.x+body.width+gap+3,inset,w-inset-cw));ys.add(clamp(body.y-ch-gap-3,inset,h-inset-ch));ys.add(clamp(body.y+body.height+gap+3,inset,h-inset-ch));}
      const candidates=new Map();
      for(const point of points){
        const target=Number.isFinite(point.x)&&Number.isFinite(point.y)?point:{x:point.id.length%2?w*.75:w*.25,y:h/2},choices=[],seen=new Set();
        const add=(x,y,retain=false)=>{const box={id:point.id,x:clamp(x,inset,w-inset-cw),y:clamp(y,inset,h-inset-ch),width:cw,height:ch},key=box.x.toFixed(1)+':'+box.y.toFixed(1);if(seen.has(key)||!bodyClear(box))return;seen.add(key);box.score=retain?-100000:Math.hypot(box.x+cw/2-target.x,box.y+ch/2-target.y);choices.push(box);};
        const prior=old.get(point.id);if(prior&&prior.width===cw&&prior.height===ch)add(prior.x,prior.y,true);
        const r=Math.max(0,point.radius||0)+8;add(target.x-cw/2,target.y-r-ch);add(target.x-cw/2,target.y+r);add(target.x-r-cw,target.y-ch/2);add(target.x+r,target.y-ch/2);
        for(const x of xs)for(const y of ys)add(x,y);
        choices.sort((a,b)=>a.score-b.score);candidates.set(point.id,choices);
      }
      const placed=new Map();let budget=500;
      function pack(order,index){if(index===order.length)return true;if(--budget<0)return false;const id=order[index].id;for(const box of candidates.get(id)){let blocked=false;for(const prior of placed.values())if(overlaps(box,prior,gap)){blocked=true;break;}if(blocked)continue;placed.set(id,box);if(pack(order,index+1))return true;placed.delete(id);if(budget<0)break;}return false;}
      for(const point of points){const box=old.get(point.id);if(valid(box)&&box.width===cw&&box.height===ch)placed.set(point.id,box);}
      const order=[...points].sort((a,b)=>candidates.get(a.id).length-candidates.get(b.id).length);
      if(pack(order.filter(point=>!placed.has(point.id)),0))return result(placed,true,size.density);
      placed.clear();budget=500;if(pack(order,0))return result(placed,true,size.density);
    }
    // The caller receives an explicit packing failure rather than a silent claim
    // that masking bodies is safe. Real supported viewports are regression-gated.
    const fallback=new Map(),cw=Math.min(88,(w-pad*2-gap)/2),ch=Math.min(44,(h-pad*2-gap*2)/3);
    points.forEach((point,index)=>fallback.set(point.id,{id:point.id,x:index%2?w-pad-cw:pad,y:pad+Math.floor(index/2)*(ch+gap),width:cw,height:ch}));
    return result(fallback,false,'compact');
  }

  function projectActors(renderer,specs=window.DracoChamber?.SPECS||[]) {
    if(!renderer||typeof renderer.scene!=='function')return specs.map(spec=>({id:spec.id,x:NaN,y:NaN}));
    const scene=renderer.scene(),width=renderer.width,height=renderer.height,zoom=renderer.zoom||1,pan=renderer.pan||{x:0,y:0};
    return specs.map((spec,index)=>{
      const actor=renderer.actors?.get(spec.id);if(!actor)return {id:spec.id,x:NaN,y:NaN};
      const position=renderer.actorPosition(scene,index,actor),point=renderer.point(scene,position.x,position.z);
      const x=width/2+(pan.x||0)+(scene.ox+point.x*scene.scale-width/2)*zoom,y=height/2+(pan.y||0)+(scene.oy+point.y*scene.scale-height/2)*zoom;
      // Enclose rotated limbs/feathers and the selected ring, not merely a torso.
      return {id:spec.id,x,y,radius:Math.max(14,(spec.kind==='winged'||spec.kind==='architect'||spec.id==='daedalus'?76:58)*scene.scale*zoom)};
    });
  }

  // A retained inspection dock, never six screen-space cards. Camera and actor
  // movement cannot move/reparent report text or interrupt a reading selection.
  class Bubbles {
    constructor({stage,renderer,specs=window.DracoChamber?.SPECS||[],select,work}={}) {
      Object.assign(this,{stage,renderer,specs,select,work,active:false,selected:'atlas',reports:[],packingChanges:0});
      let storage;try{storage=window.localStorage;}catch{}this.expiry=new IdleExpiry({storage});
      this.layer=document.createElement('section');this.layer.className='spatial-inspector';this.layer.dataset.packing='dock';this.layer.hidden=true;this.layer.setAttribute('aria-label','Selected agent inspection');
      this.heading=document.createElement('h3');this.status=document.createElement('p');this.status.className='spatial-inspector-state';
      this.label=document.createElement('small');this.text=document.createElement('p');this.text.className='spatial-report';
      this.pin=document.createElement('p');this.pin.className='spatial-pin';this.operation=document.createElement('p');this.operation.className='spatial-operation';
      this.details=document.createElement('div');this.details.className='spatial-report-detail';this.details.append(this.label,this.text);
      const actions=document.createElement('div');actions.className='spatial-actions';
      const button=(label,callback,compact)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);if(compact){const full=document.createElement('span'),short=document.createElement('span');full.className='spatial-action-full';full.textContent=label;short.className='spatial-action-short';short.textContent=compact;b.append(full,short);}else b.textContent=label;b.addEventListener('click',callback);actions.append(b);return b;};
      button('Conversation & pins',()=>this.select?.(this.selected),'Chat & pins');button('Work details',()=>this.work?.(this.selected),'Work');
      const head=document.createElement('div');head.className='spatial-inspector-head';head.append(this.heading,this.status);
      this.read=document.createElement('button');this.read.type='button';this.read.className='spatial-read';this.read.textContent='Read';this.read.setAttribute('aria-label','Read full observation');this.read.setAttribute('aria-haspopup','dialog');this.read.setAttribute('aria-controls','spatial-observation-reader');this.read.addEventListener('click',()=>{this.refreshReader?.();this.reader.showModal();});head.append(this.read);
      this.reader=document.createElement('dialog');this.reader.id='spatial-observation-reader';this.reader.className='spatial-observation-reader';this.reader.setAttribute('aria-labelledby','spatial-observation-heading');
      const readerHead=document.createElement('div');readerHead.className='spatial-reader-head';this.readerHeading=document.createElement('h2');this.readerHeading.id='spatial-observation-heading';const close=document.createElement('button');close.type='button';close.textContent='Close';close.addEventListener('click',()=>this.reader.close());readerHead.append(this.readerHeading,close);
      const readerBody=document.createElement('div');readerBody.className='spatial-reader-body';this.readerState=document.createElement('p');this.readerOperation=document.createElement('p');this.readerLabel=document.createElement('small');this.readerText=document.createElement('p');this.readerText.className='spatial-reader-report';this.readerPin=document.createElement('p');readerBody.append(this.readerState,this.readerOperation,this.readerLabel,this.readerText,this.readerPin);this.reader.append(readerHead,readerBody);document.body.append(this.reader);
      const content=document.createElement('div');content.className='spatial-inspector-content';content.append(this.operation,this.details,this.pin);
      this.layer.append(head,content,actions);stage.after(this.layer);
    }
    update(activity,agents,{live=false,selected,now=Date.now(),observation=null,pins=[]}={}) {
      this.selected=selected||this.selected;this.live=live===true;this.agents=agents;
      const owner=this.selected+':'+(agents.get(this.selected)?.sessionId||'unknown');if(owner!==this.readerOwner&&this.reader.open)this.reader.close();this.readerOwner=owner;
      this.reports=this.expiry.apply(selectReports(activity,agents,{live:this.live,now,specs:this.specs}),{now});
      const report=this.reports.find(r=>r.id===this.selected),spec=this.specs.find(s=>s.id===this.selected);if(!spec)return;
      const set=(el,text)=>{if(el.textContent!==text)el.textContent=text;};
      this.layer.style.setProperty('--agent',spec.color);set(this.heading,spec.name);
      set(this.status,observation?.execution||stateLabel(this.live?agents.get(this.selected)?.status:'unknown'));
      const age=observation?.ageMs,summary=observation?.summary||'Recorded operations are available in Work details.';
      // Keep the compact phone surface useful, not a wall of occupancy caveats.
      // Full observation wording remains available to accessibility and Work details.
      set(this.operation,summary.startsWith('No open run in this conversation')?'No open run in this conversation.':summary);
      this.operation.title=summary+(Number.isFinite(age)?' · observed '+Math.floor(age/1000)+'s ago':'');
      // Offline keeps no live speech claim. Idle expiry removes only the preview,
      // never the selected identity, chat, pins, or recorded work access.
      const hidden=!report||report.hidden||!this.live;
      set(this.label,hidden?this.live?'Public preview expired · conversation retained':'Observation unavailable · conversation retained':report.label);
      set(this.text,hidden?'Open the conversation for retained reports.':report.preview);
      this.details.hidden=hidden||report.kind==='state';
      this.layer.dataset.messageId=hidden?'':report.sourceId||'';
      const pin=pins.at(-1);set(this.pin,pin?'Pinned · '+preview(pin.text||pin.title||'Saved item'):'');this.pin.hidden=!pin;
      this.refreshReader=()=>{
        set(this.readerHeading,spec.name+' · observation');set(this.readerState,this.status.textContent);set(this.readerOperation,this.operation.title);
        const previewOff=document.body.classList.contains('spatial-reports-off');set(this.readerLabel,previewOff?'Public preview off · conversation retained':this.label.textContent);
        set(this.readerText,hidden||previewOff?'Open the conversation for retained reports.':report.fullText||report.preview);this.readerText.hidden=!hidden&&!previewOff&&report.kind==='state';
        set(this.readerPin,pin?'Pinned · '+(pin.text||pin.title||'Saved item'):'');this.readerPin.hidden=!pin;
      };this.refreshReader();
    }
    show(active){this.active=active===true;this.layer.hidden=!this.active;if(!this.active&&this.reader.open)this.reader.close();}
    // Kept as a no-op compatibility hook: no RAF layout/packing measurements.
    layout(){}
    destroy(){this.layer.remove();this.reader.remove();}
  }
  window.DracoEnvironmentBubbles={Bubbles,IdleExpiry,IDLE_EXPIRY_MS,selectReports,layoutBubbles,projectActors,resolveFontScale,previewText};
})();
