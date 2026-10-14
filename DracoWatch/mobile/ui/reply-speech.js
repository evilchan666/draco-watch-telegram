/* Foreground-only public reply speech. No model input, hydration replay or system voice. */
'use strict';
(() => {
  const publicReply = (m, session) => m?.role==='assistant' && m.publicAttested===true &&
    m.source==='authenticated-native-history' && m.sessionId===session &&
    m.kind!=='media' && typeof m.id==='string' && typeof m.text==='string' && !!m.text.trim();
  const finalReply = (m, session) => publicReply(m,session) &&
    m.kind==='reply' && typeof m.speechFinal?.runId==='string' && !!m.speechFinal.runId;
  class ReplySpeech {
    constructor({prepare,play,stop,status,now=()=>Date.now(),id=()=>crypto.randomUUID()}) {
      Object.assign(this,{prepare,play,stop,status,now,id});
      this.epoch=0;this.scope='';this.ready=false;this.baseline=false;this.queue=[];
      this.seen=new Set();this.current=new Map();this.active=null;this.enabled=true;
    }
    cancel(reason='stopped') {
      const active=this.active;this.epoch++;this.active=null;this.queue=[];
      if(active?.playing)this.stop();
      if(active)this.status({state:reason,agent:active.agent,messageId:active.message.id});
    }
    sync({agent,sessionId,ready,enabled=true,hydrate=false},messages=[]) {
      const scope=agent+':'+sessionId;
      if(scope!==this.scope || ready!==this.ready || enabled!==this.enabled) {
        this.cancel(ready?'stopped':'unavailable');this.scope=scope;this.ready=ready;
        this.agent=agent;this.sessionId=sessionId;this.enabled=enabled;
        this.since=this.now();this.baseline=false;this.seen=new Set();
      }
      this.current=new Map(messages.filter(m=>publicReply(m,sessionId)).map(m=>[m.id,m]));
      if(this.active){const m=this.current.get(this.active.message.id);
        if(!m||m.text!==this.active.message.text)this.cancel('unavailable');}
      if(!ready)return;
      const finals=messages.filter(m=>finalReply(m,sessionId)).sort((a,b)=>a.timestamp-b.timestamp||a.id.localeCompare(b.id));
      if(hydrate)for(const m of finals)this.seen.add(m.speechFinal.runId);
      if(!this.baseline){for(const m of finals)this.seen.add(m.speechFinal.runId);this.baseline=true;return;}
      for(const message of finals) {
        const key=message.speechFinal.runId;if(this.seen.has(key))continue;this.seen.add(key);
        // Old pagination/reconnect records and uncertain clock values are not fresh replies.
        if(!enabled||!Number.isFinite(message.timestamp)||message.timestamp<this.since||message.timestamp>this.now()+1000)continue;
        if(this.queue.length>=5){this.status({state:'error',agent,messageId:message.id,error:'Voice queue is full. Use Read aloud for this reply.'});continue;}
        this.queue.push({agent,sessionId,message:{...message},automatic:true});
      }
      this.pump();
    }
    manual(message) {
      if(!this.ready||!publicReply(message,this.sessionId))return false;
      this.cancel();if(message.speechFinal?.runId)this.seen.add(message.speechFinal.runId);
      this.queue.push({agent:this.agent,sessionId:this.sessionId,message:{...message},automatic:false});this.pump();return true;
    }
    async pump() {
      if(this.active||!this.ready||!this.queue.length)return;
      const job=this.queue.shift(),token=this.epoch;
      if(!this.valid(job)){this.pump();return;}
      job.playbackId='speech_'+this.id();this.active=job;
      this.status({state:'preparing',agent:job.agent,messageId:job.message.id,automatic:job.automatic});
      try {
        const asset=await this.prepare({agent:job.agent,sessionId:job.sessionId,messageId:job.message.id});
        if(token!==this.epoch||this.active!==job||!this.valid(job))return;
        if(asset?.agent!==job.agent||asset.sessionId!==job.sessionId||asset.messageId!==job.message.id||
          !/^\/v1\/speech\/[a-f0-9]{64}$/.test(asset.path??''))throw Error('Voice asset identity did not match this reply.');
        job.playing=true;this.status({state:'loading',agent:job.agent,messageId:job.message.id,playbackId:job.playbackId});
        if(this.play(asset.path,job.playbackId)===false)throw Error('Android playback is unavailable.');
      } catch(error) {
        if(token!==this.epoch||this.active!==job)return;
        this.active=null;this.status({state:'error',agent:job.agent,messageId:job.message.id,error:error.message});this.pump();
      }
    }
    valid(job) {
      const m=this.current.get(job.message.id);
      return this.ready&&job.agent===this.agent&&job.sessionId===this.sessionId&&
        !!m&&m.text===job.message.text&&(!job.automatic||finalReply(m,this.sessionId)&&m.speechFinal.runId===job.message.speechFinal.runId);
    }
    playback(info) {
      const job=this.active;if(!job||info?.id!==job.playbackId)return false;
      this.status({...info,agent:job.agent,messageId:job.message.id});
      if(info.state==='ended'||info.state==='error'){this.active=null;this.pump();}
      else if(info.state==='stopped'){this.cancel();}
      return true;
    }
  }
  window.DracoReplySpeech={ReplySpeech};
})();
