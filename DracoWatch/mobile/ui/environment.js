/* Overhead vessel presentation, from this project's vessel and six avatar identities.
 * Paths visualize observed activity, not literal location or task completion. */
'use strict';
(() => {
  const {ellipse}=window.DracoChamber;
  // The operator's crystalline original supersedes the historical violet placeholder.
  const SPECS=window.DracoChamber.SPECS.map(spec=>spec.id==='daedalus'?{...spec,color:'#d5eeff',kind:'winged'}:spec);
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const mix=(a,b,t)=>a+(b-a)*t;
  const STATES=new Set(['active','idle','queued']);
  const SIDES=[-1,1,-1,1,-1,1];
  const DEPTHS=[210,210,510,510,810,810];
  const RED='#ec455d';

  function polygon(ctx,points,fill,stroke,width=1){
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
  }
  function line(ctx,points,color,width=1){
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  }
  function panel(ctx,x,y,w,h,r,fill,stroke,width=1){
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
  }
  function gradient(ctx,x1,y1,x2,y2,stops){
    const paint=ctx.createLinearGradient(x1,y1,x2,y2);for(const [at,color] of stops)paint.addColorStop(at,color);return paint;
  }

  class Environment {
    constructor(canvas,{select,zoomChanged,onFrame}={}){
      this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.select=select;this.zoomChanged=zoomChanged;this.onFrame=onFrame;
      this.zoom=1;this.pan={x:0,y:0};this.width=1;this.height=1;this.dpr=1;this.dprLimit=2;this.fps=60;
      this.rows=new Map();this.actors=new Map();this.selected='atlas';this.active=false;this.live=false;this.motion=true;
      this.frame=0;this.previous=0;this.lastDraw=0;this.clock=0;this.pointers=new Map();this.hits=[];
      this.backdrop=null;this.backdropKey='';this.sprites=new Map();
      canvas.style.touchAction='pan-y';
      canvas.addEventListener('pointerdown',event=>{
        this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,time:performance.now(),multi:false});
        if(this.zoom>1)canvas.setPointerCapture?.(event.pointerId);
        if(this.pointers.size>1){for(const pointer of this.pointers.values())pointer.multi=true;this.pinch=this.pointerDistance();}
      });
      canvas.addEventListener('pointermove',event=>{
        const p=this.pointers.get(event.pointerId);if(!p)return;
        const dx=event.clientX-p.x,dy=event.clientY-p.y;p.x=event.clientX;p.y=event.clientY;
        if(this.pointers.size===2){const distance=this.pointerDistance();if(this.pinch)this.setZoom(this.zoom*distance/this.pinch);this.pinch=distance;}
        else if(this.zoom>1){this.pan.x+=dx;this.pan.y+=dy;this.boundPan();this.draw();}
      });
      canvas.addEventListener('pointerup',event=>{
        const p=this.pointers.get(event.pointerId);this.pointers.delete(event.pointerId);this.pinch=0;
        if(!p||p.multi||Math.hypot(event.clientX-p.startX,event.clientY-p.startY)>10||performance.now()-p.time>700)return;
        const rect=canvas.getBoundingClientRect();
        const x=(event.clientX-rect.left-this.width/2-this.pan.x)/this.zoom+this.width/2;
        const y=(event.clientY-rect.top-this.height/2-this.pan.y)/this.zoom+this.height/2;
        const hit=[...this.hits].reverse().find(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h);
        if(hit)this.select?.(hit.id);
      });
      canvas.addEventListener('pointercancel',event=>{this.pointers.delete(event.pointerId);this.pinch=0;});
      canvas.addEventListener('lostpointercapture',event=>{this.pointers.delete(event.pointerId);this.pinch=0;});
      canvas.addEventListener('wheel',event=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();this.setZoom(this.zoom+(event.deltaY<0?.15:-.15));},{passive:false});
      canvas.addEventListener('keydown',event=>{
        if(event.key==='0'){this.fit();event.preventDefault();}
        else if(event.key==='+'||event.key==='='){this.setZoom(this.zoom+.25);event.preventDefault();}
        else if(event.key==='-'){this.setZoom(this.zoom-.25);event.preventDefault();}
        else if(this.zoom>1&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
          this.pan.x+=event.key==='ArrowLeft'?32:event.key==='ArrowRight'?-32:0;
          this.pan.y+=event.key==='ArrowUp'?32:event.key==='ArrowDown'?-32:0;this.boundPan();this.draw();event.preventDefault();
        }
      });
      this.onVisibility=()=>{this.stopFrame();if(!document.hidden)this.schedule();};
      document.addEventListener('visibilitychange',this.onVisibility);
      this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
      this.viewportObserver=new ResizeObserver(()=>{if(this.active)this.fitViewport();});
      for(const selector of ['.bottom-nav','.app-header','.connection-bar','#connection-notice','.environment-caption','.environment-toolbar','.environment-stations','.environment-note']){
        const element=document.querySelector(selector);if(element)this.viewportObserver.observe(element);
      }
    }
    pointerDistance(){const [a,b]=this.pointers.values();return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;}
    boundPan(){this.pan.x=clamp(this.pan.x,-(this.zoom-1)*this.width/2,(this.zoom-1)*this.width/2);this.pan.y=clamp(this.pan.y,-(this.zoom-1)*this.height/2,(this.zoom-1)*this.height/2);}
    setZoom(value){if(!Number.isFinite(value))return;this.zoom=clamp(value,1,2.5);this.boundPan();this.canvas.style.touchAction=this.zoom===1?'pan-y':'none';this.zoomChanged?.(Math.round(this.zoom*100));this.draw();}
    fit(){this.fitViewport();this.pan={x:0,y:0};this.setZoom(1);}
    // Android has already removed its system-bar/IME insets from the WebView.
    // Budget the actual remaining CSS viewport, not a nominal phone height or a
    // font-dependent scene minimum. Camera controls and agent selectors must
    // remain above the measured navigation bar even when its labels wrap.
    fitViewport(){
      const stage=this.canvas.closest?.('.environment-stage');if(!stage||stage.closest('[hidden]'))return;
      const view=stage.parentElement,nav=document.querySelector('.bottom-nav');
      const outerHeight=element=>{if(!element||element.hidden)return 0;const style=getComputedStyle(element);if(style.display==='none')return 0;return element.getBoundingClientRect().height+(parseFloat(style.marginTop)||0)+(parseFloat(style.marginBottom)||0);};
      const toolbar=view.querySelector('.environment-toolbar'),stations=view.querySelector('.environment-stations'),note=view.querySelector('.environment-note');
      const viewport=window.visualViewport,visibleHeight=viewport?.height||window.innerHeight;
      const available=()=>Math.min(visibleHeight,nav?.getBoundingClientRect().top??visibleHeight)-(stage.getBoundingClientRect().top+window.scrollY)-(getComputedStyle(view).display==='grid'?0:outerHeight(toolbar)+outerHeight(stations)+outerHeight(note))-8;
      document.body.classList.remove('environment-compact');
      // Keep the actual controls and readable type. When space is constrained,
      // remove duplicated decorative header/help rather than shrinking text.
      document.body.classList.toggle('environment-compact',available()<220);
      const height=Math.max(64,Math.floor(available()));
      stage.style.setProperty('--environment-height',height+'px');this.resize();
    }
    resize(){
      const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
      this.width=rect.width;this.height=rect.height;this.dpr=Math.min(this.dprLimit,window.devicePixelRatio||1);
      this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);
      this.boundPan();this.draw();
    }
    quality(lightweight){const limit=lightweight?1.5:2,rate=lightweight?30:60;if(limit===this.dprLimit&&rate===this.fps)return;this.dprLimit=limit;this.fps=rate;this.lastDraw=0;this.resize();}
    update(rows,live,selected,motion){
      this.rows=rows;this.live=live===true;this.selected=selected;this.motion=motion===true;
      for(const spec of SPECS){
        const supplied=this.live?rows.get(spec.id)?.status:'unknown',status=STATES.has(supplied)?supplied:'unknown';
        let actor=this.actors.get(spec.id);const target=status==='active'?1:status==='queued'?.45:0;
        if(!actor){actor={pose:target,target,status,observed:status!=='unknown',clock:0};this.actors.set(spec.id,actor);}
        const last=this.actorPosition(this.scene(),SPECS.indexOf(spec),actor),changed=actor.status!==status;
        actor.status=status;actor.observed=status!=='unknown';
        // Unknown/stale keeps the last pose frozen; it must not imply an idle transition.
        if(!actor.observed)actor.frozenPosition=last;
        else{
          actor.target=target;
          if(!this.motion){actor.pose=target;actor.transition=null;}
          else if(changed)actor.transition={from:last,fromPose:actor.pose,progress:0};
          actor.frozenPosition=null;
        }
      }
      if(!this.live||!this.motion)this.stopFrame();if(this.active)this.draw();this.schedule();
    }
    show(active){this.active=active===true;if(this.active){this.resize();this.schedule();}else{this.stopFrame();this.pointers.clear();this.pinch=0;}}
    stopFrame(){cancelAnimationFrame(this.frame);this.frame=0;this.previous=0;}
    destroy(){this.show(false);this.observer.disconnect();this.viewportObserver.disconnect();document.removeEventListener('visibilitychange',this.onVisibility);this.destroyed=true;}
    schedule(){
      if(this.destroyed||!this.active||!this.live||!this.motion||document.hidden||this.frame||![...this.actors.values()].some(actor=>actor.observed))return;
      this.frame=requestAnimationFrame(time=>{
        this.frame=0;
        if(this.destroyed||!this.active||!this.live||!this.motion||document.hidden){this.previous=0;return;}
        if(time-this.lastDraw>=1000/this.fps-1){
          const dt=this.previous?Math.min(.08,(time-this.previous)/1000):0;this.previous=time;this.lastDraw=time;this.clock+=dt;
          this.advance(dt);
          this.draw();
        }
        this.schedule();
      });
    }
    advance(dt){
      if(!this.active||!this.live||!this.motion||document.hidden)return;
      for(const actor of this.actors.values())if(actor.observed){
        actor.clock+=dt;
        if(actor.transition){
          actor.transition.progress=Math.min(1,actor.transition.progress+dt/5);actor.pose=mix(actor.transition.fromPose,actor.target,actor.transition.progress);
          if(actor.transition.progress===1){if(actor.target===1)actor.workOffset=-(actor.clock%22);actor.transition=null;}
        }
        else actor.pose+=clamp(actor.target-actor.pose,-dt*.2,dt*.2);
      }
    }
    scene(){
      const wide=this.width/this.height>1.15,W=wide?1100:760,H=wide?760:1100;
      const scale=Math.min((this.width-12)/W,(this.height-12)/H);
      return {wide,W,H,scale,ox:(this.width-W*scale)/2,oy:(this.height-H*scale)/2,stationX:150,podX:305,floorX:350};
    }
    // Orthographic: one world unit has the same screen size everywhere in the room.
    point(s,x,z){return s.wide?{x:50+z,y:s.H/2-x,s:1}:{x:s.W/2+x,y:50+z,s:1};}
    floorPolygon(s){return [[-280,0],[280,0],[350,75],[350,925],[280,1000],[-280,1000],[-350,925],[-350,75]].map(([x,z])=>{const p=this.point(s,x,z);return[p.x,p.y];});}
    local(ctx,s,x,z,draw){const p=this.point(s,x,z);ctx.save();ctx.translate(p.x,p.y);if(s.wide)ctx.rotate(-Math.PI/2);draw();ctx.restore();}
    pathAt(points,fraction){
      const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.z-points[i].z));
      let distance=clamp(fraction,0,1)*lengths.reduce((a,b)=>a+b,0);
      for(let i=0;i<lengths.length;i++){
        if(distance<=lengths[i]||i===lengths.length-1){const a=points[i],b=points[i+1],t=lengths[i]?clamp(distance/lengths[i],0,1):0;return {x:mix(a.x,b.x,t),z:mix(a.z,b.z,t),heading:Math.atan2(b.x-a.x,a.z-b.z)};}
        distance-=lengths[i];
      }
    }
    travelPath(s,i){const side=SIDES[i],z=DEPTHS[i];return [{x:side*s.podX,z:z-18},{x:side*270,z:z+75},{x:side*170,z:z+75},{x:side*s.stationX,z:z-55}];}
    workPath(s,i){const side=SIDES[i],z=DEPTHS[i];return [{x:side*s.stationX,z:z-55},{x:side*160,z:z+120},{x:side*250,z:z+120},{x:side*250,z:z-135},{x:side*s.stationX,z:z-55}];}
    actorPosition(s,i,actor){
      if(!actor.observed&&actor.frozenPosition)return actor.frozenPosition;
      if(actor.transition){const side=SIDES[i],z=DEPTHS[i],end=this.pathAt(this.travelPath(s,i),actor.target);return {...this.pathAt([actor.transition.from,{x:side*270,z:z+75},{x:side*170,z:z+75},end],actor.transition.progress),moving:true};}
      if(actor.pose<.999||actor.status!=='active')return {...this.pathAt(this.travelPath(s,i),actor.pose),moving:actor.observed&&Math.abs(actor.target-actor.pose)>.005};
      // Continuous work-area circuits show activity even when observed state is stable.
      // These are explicitly animated paths, never claims of physical agent travel.
      const phase=(actor.clock+(actor.workOffset??i*2.7))%22,walking=phase>=6;
      return {...this.pathAt(this.workPath(s,i),walking?(phase-6)/16:0),moving:walking};
    }
    draw(){
      const ctx=this.ctx;if(this.destroyed||!this.active||!ctx||this.width<100||this.height<100)return;
      const w=this.width,h=this.height,s=this.scene();ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
      ctx.fillStyle='#05090e';ctx.fillRect(0,0,w,h);
      ctx.save();ctx.translate(w/2+this.pan.x,h/2+this.pan.y);ctx.scale(this.zoom,this.zoom);ctx.translate(-w/2,-h/2);
      this.drawBackdrop(ctx,s);
      ctx.save();ctx.translate(s.ox,s.oy);ctx.scale(s.scale,s.scale);this.drawRift(ctx,s);
      for(let i=0;i<SPECS.length;i++)this.drawStation(ctx,s,SPECS[i],i);
      for(let i=0;i<SPECS.length;i++)this.drawActor(ctx,s,SPECS[i],i);
      ctx.restore();this.drawLabels(ctx,s);ctx.restore();
      this.onFrame?.();
    }
    drawBackdrop(ctx,s){
      const key=[this.width,this.height,this.dpr].join(':');
      if(this.backdropKey!==key){
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(this.width*this.dpr);canvas.height=Math.ceil(this.height*this.dpr);
        const room=canvas.getContext('2d');room.setTransform(this.dpr,0,0,this.dpr,0,0);
        const atmosphere=room.createRadialGradient(this.width*.48,this.height*.42,0,this.width*.48,this.height*.42,Math.max(this.width,this.height)*.72);
        atmosphere.addColorStop(0,'#16212d');atmosphere.addColorStop(1,'#05090e');room.fillStyle=atmosphere;room.fillRect(0,0,this.width,this.height);
        room.save();room.translate(s.ox,s.oy);room.scale(s.scale,s.scale);
        this.drawHull(room,s);this.drawFloor(room,s);this.drawWindow(room,s);this.drawArrival(room,s);room.restore();
        this.backdrop=canvas;this.backdropKey=key;
      }
      ctx.drawImage(this.backdrop,0,0,this.width,this.height);
    }
    drawHull(ctx,s){
      const floor=this.floorPolygon(s),cx=s.W/2,cy=s.H/2;
      polygon(ctx,floor.map(([x,y])=>[mix(cx,x,1.06),mix(cy,y,1.045)]),'#010305',null);
      const shell=gradient(ctx,0,0,s.W,s.H,[[0,'#71808d'],[.11,'#2b3846'],[.5,'#101821'],[.86,'#52616f'],[1,'#1a2530']]);
      polygon(ctx,floor.map(([x,y])=>[mix(cx,x,1.042),mix(cy,y,1.03)]),shell,'#8595a3',1.5);
      polygon(ctx,floor,'#090f16','#17232e',8);
      for(const side of [-1,1])for(const z of [105,355,650,895])this.local(ctx,s,side*345,z,()=>{
        panel(ctx,-10,-34,20,68,8,'#2a3742','#566672',1);
        panel(ctx,-2,-20,4,40,2,z===105?'#f1818d':'#b8d8e7',null);
      });
    }
    drawWindow(ctx,s){
      this.local(ctx,s,0,24,()=>{
        panel(ctx,-194,-17,388,34,15,'#03060c','#607b8e',1.5);
        panel(ctx,-187,-11,374,22,10,gradient(ctx,-180,-11,180,11,[[0,'#101d2d'],[.45,'#30485c'],[1,'#081322']]),null);
        for(let i=0;i<24;i++)ellipse(ctx,-177+(i*61.13)%350,-8+(i*19.37)%16,i%9===0?1.4:.65,i%9===0?1.4:.65,'#e1eef4');
        line(ctx,[[-158,11],[158,11]],'#9eb5c240',1);
      });
    }
    drawFloor(ctx,s){
      const floor=this.floorPolygon(s),grad=gradient(ctx,0,0,s.W,s.H,[[0,'#293745'],[.25,'#1b2732'],[.62,'#111c26'],[1,'#263440']]);polygon(ctx,floor,grad,'#455564',1);
      ctx.save();polygon(ctx,floor,null,null);ctx.clip();
      // Large sculpted panels replace the retro terminal grid and dashed routes.
      for(const side of [-1,1])for(const z of [200,500,800])this.local(ctx,s,side*219,z,()=>{
        panel(ctx,-110,-139,220,280,32,'#0b121a70','#50627335',1.5);
        line(ctx,[[-78,-135],[78,-135]],'#90a6b42a',1.5);
        line(ctx,[[-75,140],[75,140]],'#03070b90',2);
      });
      this.local(ctx,s,0,500,()=>{
        panel(ctx,-88,-462,176,924,46,'#0d161e','#425665',1.5);
        panel(ctx,-79,-455,158,910,40,gradient(ctx,-80,0,80,0,[[0,'#17252f'],[.45,'#1d2e39'],[1,'#101c25']]),null);
        for(const side of [-1,1])line(ctx,[[side*69,-401],[side*69,401]],'#b3d9e240',2);
        for(const z of [-320,-20,280])panel(ctx,-39,z,78,3,1.5,'#a8becd18',null);
      });
      for(let i=0;i<SPECS.length;i++){
        const side=SIDES[i],z=DEPTHS[i],accent=SPECS[i].color;this.local(ctx,s,side*218,z+14,()=>{
          panel(ctx,-98,-124,196,248,28,accent+'05',null);
          panel(ctx,-88,108,176,3,1.5,accent+'40',null);
          for(const x of [-92,92])ellipse(ctx,x,114,2.5,2.5,'#9fb6c540');
        });
      }
      ctx.restore();
    }
    drawRift(ctx,s){
      this.local(ctx,s,0,500,()=>{
        ellipse(ctx,0,5,77,77,'#01040c70');ellipse(ctx,0,0,73,73,'#718491');ellipse(ctx,0,-1,69,69,'#182832','#bdd1dc',1);
        ellipse(ctx,0,0,58,58,'#09111b','#53798f',1.5);ellipse(ctx,0,0,46,46,'#24425770','#bdddea60',1);
        ellipse(ctx,0,0,34,34,'#3f789044');ellipse(ctx,0,0,25,25,'#afdfeb25');
        for(let i=0;i<3;i++){
          const a=this.clock*.16+i*2.1;ctx.save();ctx.rotate(a);ellipse(ctx,0,0,41,13,null,'#b5e3ed66',1.5);ctx.restore();
        }
        polygon(ctx,[[0,-18],[13,0],[0,18],[-13,0]],'#def7ffcc','#edfaff',1);
        line(ctx,[[0,-16],[0,15]],'#6399b4',1);ellipse(ctx,0,0,3.5,3.5,'#fff');
      });
    }
    drawStation(ctx,s,spec,i){
      const actor=this.actors.get(spec.id)||{status:'unknown',observed:false,clock:0},observed=this.live&&actor.observed;
      const accent=observed?spec.color:'#82909b',side=SIDES[i],z=DEPTHS[i],selected=this.selected===spec.id;
      this.local(ctx,s,side*s.podX,z-18,()=>{
        panel(ctx,-32,-56,64,120,28,'#01050a90',null);
        panel(ctx,-31,-60,62,116,27,'#526572','#9aafbf',1.2);
        panel(ctx,-27,-57,54,110,24,'#172632',null);
        panel(ctx,-23,-51,46,98,20,'#2b435350','#7d9bab70',1);
        panel(ctx,-16,-42,32,80,15,accent+'0b',null);
        line(ctx,[[-19,-30],[-19,29]],'#bdcfda60',1.5);
        line(ctx,[[19,-30],[19,29]],accent+'80',2);
        for(const y of [-47,43])line(ctx,[[-9,y],[9,y]],'#b8c6ce',2);
      });
      this.local(ctx,s,side*s.stationX,z-85,()=>{
        panel(ctx,-57,-24,114,61,17,'#01050980',null);
        panel(ctx,-57,-31,114,61,17,'#758793','#a8bac5',1.2);
        panel(ctx,-54,-28,108,55,14,'#263946',null);
        panel(ctx,-48,-24,96,36,11,'#071724','#789cab',1);
        panel(ctx,-43,-20,86,28,8,accent+'09',null);
        // Smooth holo waveform; it describes observed activity, never fabricated task data.
        const phase=observed&&actor.status==='active'?actor.clock*.8:0;
        const trace=Array.from({length:12},(_,n)=>[-35+n*6.4,-7+Math.sin(n*.7+phase)*5]);
        line(ctx,trace,accent+(observed?'a0':'45'),1.7);
        line(ctx,[[-34,5],[6,5]],'#7195ab45',1);
        panel(ctx,27,-15,9,9,2,accent+'55',null);
        for(let row=0;row<2;row++)for(let col=0;col<10;col++)panel(ctx,-30+col*6.4,17+row*4,4.2,2.2,.8,'#8cabb95c',null);
        line(ctx,[[-42,26],[42,26]],selected?accent+'a0':'#b3c7d540',selected?2:1);
        if(observed&&actor.status==='queued')for(let n=0;n<3;n++)ellipse(ctx,28+n*7,-38,2,2,'#e6c98a');
      });
    }
    actorSprite(spec){
      const key=[spec.id,spec.kind,spec.color,this.dprLimit].join(':');if(this.sprites.has(key))return this.sprites.get(key);
      // Code-native vector drawing cached at device quality; no downloaded artwork or
      // costly per-frame shadow blur. Subtle metal highlights stay sharp while moving.
      const canvas=document.createElement('canvas'),resolution=this.dprLimit;canvas.width=canvas.height=120*resolution;
      const ctx=canvas.getContext('2d');ctx.scale(resolution,resolution);ctx.translate(60,60);ctx.lineCap='round';ctx.lineJoin='round';
      const metal=gradient(ctx,-25,-30,28,30,[[0,'#d4e0e8'],[.22,'#708999'],[.44,'#314b5d'],[.59,'#aac1cf'],[.75,'#465e70'],[1,'#142b3b']]);
      const glass=gradient(ctx,-20,-20,20,25,[[0,spec.color+'b0'],[.4,'#274553'],[1,'#07121c']]);
      const winged=spec.kind==='winged'||spec.kind==='architect';
      if(winged){
        // Crystalline wings, fine feather filigree and orbital geometry follow the
        // operator's silver/blue-white emblem, not the withdrawn violet architect.
        const feather=gradient(ctx,-46,-35,46,31,[[0,'#f5fbffb0'],[.35,'#bed7e685'],[.6,'#55718580'],[1,'#e8f6ff50']]);
        for(const side of [-1,1]){
          ctx.save();ctx.scale(side,1);
          for(let j=0;j<4;j++){
            const y=-28+j*12;ctx.beginPath();ctx.moveTo(9,y+11);ctx.bezierCurveTo(21,y-13,43,y-13,53,y-24);ctx.bezierCurveTo(47,y-1,29,y+25,10,y+24);ctx.quadraticCurveTo(18,y+13,9,y+11);
            ctx.fillStyle=feather;ctx.fill();ctx.strokeStyle='#eaf7ffc0';ctx.lineWidth=.9;ctx.stroke();
            for(let n=0;n<3;n++){
              ctx.beginPath();ctx.moveTo(14,y+16);ctx.quadraticCurveTo(30+n*5,y+5,47-n*2,y-14+n*4);ctx.strokeStyle='#e8f6ff60';ctx.lineWidth=.65;ctx.stroke();
            }
          }
          ctx.beginPath();ctx.moveTo(6,31);ctx.bezierCurveTo(31,42,41,16,52,33);ctx.strokeStyle='#cce2edb0';ctx.lineWidth=1.2;ctx.stroke();
          ellipse(ctx,31,24,3.2,5,'#a9d6ee','#edfaff',.8);ctx.restore();
        }
        ellipse(ctx,0,0,27,29,null,'#d7e9f3cc',1.2);ellipse(ctx,0,0,23,25,null,'#87abc0b0',.7);
        ctx.save();ctx.rotate(.45);ellipse(ctx,0,0,31,16,null,'#e3f5ffa0',1);ctx.restore();
        for(const y of [-31,31])ellipse(ctx,0,y,3.5,3.5,'#dbf6ff','#edfaff',.9);
        polygon(ctx,[[0,-23],[16,-7],[12,13],[0,23],[-12,13],[-16,-7]],'#779cb4','#f0faff',1);
        polygon(ctx,[[0,-23],[0,1],[-16,-7]],'#e8f8ff',null);polygon(ctx,[[0,-23],[16,-7],[0,1]],'#739ab5',null);
        polygon(ctx,[[16,-7],[12,13],[0,1]],'#d1efff',null);polygon(ctx,[[-16,-7],[0,1],[-12,13]],'#4b7494',null);
        polygon(ctx,[[-12,13],[0,1],[0,23]],'#b1d7eb',null);polygon(ctx,[[12,13],[0,23],[0,1]],'#365e7d',null);
        line(ctx,[[0,-11],[0,11]],'#fff',1.5);line(ctx,[[-9,0],[9,0]],'#eefaff',1.5);ellipse(ctx,0,0,3,3,'#fff');
      }else{
        for(const side of [-1,1]){
          ellipse(ctx,side*23,-3,8,13,'#142b3b','#93afbf',1.1);ellipse(ctx,side*24,-6,4.8,7,metal,null);
          line(ctx,[[side*25,4],[side*21,12]],spec.color+'90',1.2);
        }
        if(spec.kind==='mantis')for(const side of [-1,1]){
          polygon(ctx,[[side*13,-12],[side*32,-27],[side*37,-42],[side*40,-24],[side*23,2]],metal,'#a6becb',1);
          line(ctx,[[side*28,-27],[side*34,-33]],spec.color+'a0',1.5);
        }
        if(spec.kind==='filament')for(const side of [-1,1])for(let n=0;n<3;n++){
          ctx.beginPath();ctx.moveTo(side*(6+n*4),-17);ctx.quadraticCurveTo(side*(18+n*6),-29,side*(19+n*7),-39+n*3);ctx.strokeStyle='#b4d8c5';ctx.lineWidth=1.2;ctx.stroke();
          ellipse(ctx,side*(19+n*7),-39+n*3,1.7,1.7,spec.color+'b0');
        }
        if(spec.kind==='crystal'){
          polygon(ctx,[[0,-28],[22,-10],[17,17],[0,29],[-17,17],[-22,-10]],metal,'#e0ddba',1.2);
          polygon(ctx,[[0,-24],[0,2],[-19,-10]],'#e1dfae',null);polygon(ctx,[[0,-24],[19,-10],[0,2]],'#7f8354',null);
          polygon(ctx,[[-19,-10],[0,2],[-15,17]],'#494f31',null);polygon(ctx,[[19,-10],[15,17],[0,2]],'#b5bc7c',null);
          polygon(ctx,[[-15,17],[0,2],[0,25]],'#c4cd88',null);polygon(ctx,[[15,17],[0,25],[0,2]],'#555b35',null);
        }else if(spec.kind==='furnace'){
          panel(ctx,-22,-24,44,50,11,metal,'#cabda8',1.3);panel(ctx,-16,-18,32,34,6,'#0b171e',null);
          panel(ctx,-10,-13,20,24,5,glass,null);polygon(ctx,[[0,-13],[8,1],[3,13],[-6,11],[-9,1]],spec.color+'95',null);
          for(const side of [-1,1])for(let n=0;n<3;n++)line(ctx,[[side*17,-9+n*7],[side*21,-9+n*7]],'#d8ba94',1.4);
        }else{
          ellipse(ctx,0,-2,20,26,metal,'#b9d1df',1.2);ellipse(ctx,0,-4,14,19,'#091b27',null);ellipse(ctx,0,-6,11,15,glass,null);
          line(ctx,[[-12,-19],[-5,-23],[4,-23]],'#e5f4f880',1.2);
        }
        if(spec.kind==='orbital'){
          ellipse(ctx,0,0,33,15,null,'#b8e0eaba',1.4);ellipse(ctx,0,-3,12,15,null,spec.color+'b0',1.2);
          for(const side of [-1,1])ellipse(ctx,side*31,0,2,2,'#e7faff');
        }
        panel(ctx,-11,-16,22,4,2,'#e0faff',null);panel(ctx,-8,-15,16,1.2,.5,spec.color+'c0',null);
        ellipse(ctx,0,10,4.5,4.5,'#d0eff0');ellipse(ctx,0,10,2.5,2.5,spec.color+'d0');
      }
      this.sprites.set(key,canvas);return canvas;
    }
    drawActor(ctx,s,spec,i){
      const actor=this.actors.get(spec.id)||{pose:0,target:0,status:'unknown',observed:false,clock:0};
      const pos=this.actorPosition(s,i,actor),p=this.point(s,pos.x,pos.z),observed=this.live&&actor.observed;
      const walking=pos.moving&&observed&&this.motion,stride=walking?Math.sin(actor.clock*13)*7:0;
      ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=observed?1:.45;
      ellipse(ctx,2,6,spec.kind==='winged'?46:32,32,'#01050b60');
      if(this.selected===spec.id){ellipse(ctx,0,0,spec.kind==='winged'?53:38,spec.kind==='winged'?53:38,null,'#e6f3fa70',1.5);ellipse(ctx,0,0,44,44,null,spec.color+'35',1);}
      ctx.rotate(pos.heading+(s.wide?-Math.PI/2:0));ctx.lineJoin='round';ctx.lineCap='round';
      if(spec.kind!=='winged'&&spec.kind!=='architect')for(const side of [-1,1]){
        line(ctx,[[side*13,13],[side*24,20+side*stride],[side*15,29+side*stride]],'#778f9f',6);
        line(ctx,[[side*13,13],[side*24,20+side*stride],[side*15,29+side*stride]],'#c2d6e0',1.2);
        ellipse(ctx,side*24,20+side*stride,3.2,3.2,'#233b4b','#bdd1da',.7);
      }
      ctx.drawImage(this.actorSprite(spec),-60,-60,120,120);
      ctx.restore();
    }
    drawArrival(ctx,s){this.local(ctx,s,0,974,()=>{panel(ctx,-70,-14,140,28,13,'#101b25','#647d8d',1.2);panel(ctx,-59,-2,118,4,2,'#d8e4ea55',null);panel(ctx,-15,-2,30,4,2,RED+'a0',null);});}
    drawLabels(ctx,s){
      this.hits=[];const font=clamp(this.width/33,11,13),actorHits=[];
      const box=(id,p,width,height,kind)=>({id,x:s.ox+p.x*s.scale-width/2,y:s.oy+p.y*s.scale-height/2,w:width,h:height,kind});
      for(let i=0;i<SPECS.length;i++){
        const spec=SPECS[i],actor=this.actors.get(spec.id)||{pose:0,target:0,status:'unknown',observed:false,clock:0},side=SIDES[i],z=DEPTHS[i];
        const desk=this.point(s,side*s.stationX,z-85),pod=this.point(s,side*s.podX,z-18),label=this.point(s,side*204,z+133);
        const x=s.ox+label.x*s.scale,y=s.oy+label.y*s.scale,observed=this.live&&actor.observed;
        ctx.font=`650 ${font}px system-ui`;const width=Math.max(70,ctx.measureText(spec.name).width+20),height=23;
        panel(ctx,x-width/2,y-height/2,width,height,11,'#12212ce8',this.selected===spec.id?'#bed3df':'#728c9f50',1);
        ellipse(ctx,x-width/2+9,y,2,2,observed?spec.color:'#82909b');
        ctx.fillStyle=this.selected===spec.id?'#f3f8fb':'#c4d2dc';ctx.textAlign='center';ctx.fillText(spec.name,x+3,y+4);
        this.hits.push({id:spec.id,x:x-width/2,y:y-height/2,w:width,h:height,kind:'label'},box(spec.id,desk,Math.max(44,(s.wide?58:106)*s.scale),Math.max(44,(s.wide?106:58)*s.scale),'station'),box(spec.id,pod,Math.max(44,(s.wide?116:58)*s.scale),Math.max(44,(s.wide?58:116)*s.scale),'pod'));
        const pos=this.actorPosition(s,i,actor),size=spec.kind==='winged'?116:86;actorHits.push(box(spec.id,this.point(s,pos.x,pos.z),Math.max(44,size*s.scale),Math.max(44,size*s.scale),'actor'));
      }
      this.hits.push(...actorHits);
    }
  }
  window.DracoEnvironment={Environment};
})();
