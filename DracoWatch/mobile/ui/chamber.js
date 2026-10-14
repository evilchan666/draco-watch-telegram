/* Bounded adaptation of this project's six phone silhouettes; desktop untouched. */
'use strict';
(() => {
  const SPECS = [
    {id:'main',name:'Commander',color:'#ff00e6',glyph:'✣',kind:'mantis',role:'Coordination & integration'},
    {id:'forge',name:'FORGE',color:'#ff6400',glyph:'♜',kind:'furnace',role:'Spatial systems & world integration'},
    {id:'atlas',name:'ATLAS',color:'#00ffff',glyph:'◎',kind:'orbital',role:'Federation & gateway architecture'},
    {id:'aera-new',name:'Æra',color:'#39ff14',glyph:'✧',kind:'filament',role:'Design direction & avatar identity'},
    {id:'vvv',name:'VVV',color:'#ffff00',glyph:'◇',kind:'crystal',role:'Independent analysis & verification'},
    {id:'daedalus',name:'Daedalus',color:'#b9e4ff',glyph:'✦',kind:'winged',role:'Independent fleet collaborator',temporary:true},
  ];
  const robotShapes = {
    winged: ['M0 -65 L19 -43 L12 -19 L0 -10 L-12 -19 L-19 -43 Z', 'M0 -65 L0 -10 M-18 -43 L0 -31 L18 -43', 'M-12 -8 L0 -17 L12 -8 L20 16 L0 38 L-20 16 Z', 'M0 -11 L10 11 L0 31 L-10 11 Z', 'M-16 -7 C-29 -29 -42 -48 -61 -50 C-58 -18 -43 10 -20 19 M16 -7 C29 -29 42 -48 61 -50 C58 -18 43 10 20 19', 'M-55 -41 L-24 9 M-46 -38 L-21 4 M-37 -28 L-18 -2 M55 -41 L24 9 M46 -38 L21 4 M37 -28 L18 -2'],
    mantis: ['M-20 -53 L-36 -76 L-29 -28 L-16 -14 M20 -53 L36 -76 L29 -28 L16 -14', 'M-22 -54 L22 -54 L14 -26 L0 -16 L-14 -26 Z', 'M-16 -10 L0 -18 L16 -10 L23 19 L0 40 L-23 19 Z', 'M0 -12 L12 14 L0 33 L-12 14 Z', 'M-18 -6 L-47 -26 L-39 -56 M18 -6 L47 -26 L39 -56 M-20 11 L-48 26 L-55 5 M20 11 L48 26 L55 5'],
    furnace: ['M-25 -37 L-40 -61 L-40 -31 L-25 -20 M25 -37 L40 -61 L40 -31 L25 -20', 'M-25 -40 L25 -40 L25 -16 L-25 -16 Z', 'M-23 -10 L0 -18 L23 -10 L28 20 L0 40 L-28 20 Z', 'M0 -6 L14 12 L0 29 L-14 12 Z', 'M-25 0 L-42 14 L-49 37 M25 0 L42 14 L49 37'],
    orbital: ['M-27 -45 L-34 -66 L-45 -20 L-22 -5 M27 -45 L34 -66 L45 -20 L22 -5', 'M-20 -7 L0 -15 L20 -7 L24 15 L0 42 L-24 15 Z', 'M0 -12 L11 15 L0 34 L-11 15 Z'],
    filament: ['M-20 -28 L-15 -50 L0 -62 L15 -50 L20 -28 L0 -18 Z', 'M0 -61 L0 -84 M-8 -59 L-17 -79 M8 -59 L17 -79 M-15 -45 L-31 -63 M15 -45 L31 -63 M-19 -33 L-38 -42 M19 -33 L38 -42', 'M-18 -10 L0 -18 L18 -10 L25 15 L0 38 L-25 15 Z', 'M0 -8 L10 10 L0 28 L-10 10 Z', 'M-20 0 L-36 17 L-45 43 M20 0 L36 17 L45 43'],
    crystal: ['M0 -62 L-22 -43 L-20 -25 L0 -16 L20 -25 L22 -43 Z', 'M0 -62 L0 -18 M-21 -42 L0 -30 L21 -42', 'M-21 -8 L0 -17 L21 -8 L26 20 L0 39 L-26 20 Z', 'M0 -12 L12 12 L0 30 L-12 12 Z', 'M-20 -3 L-36 15 L-37 39 M20 -3 L36 15 L37 39'],
    architect: ['M-18 -42 L0 -65 L18 -42 L18 -22 L0 -13 L-18 -22 Z', 'M-12 -50 L0 -37 L12 -50 M-17 -28 L0 -23 L17 -28', 'M-18 -7 L0 -15 L18 -7 L22 24 L0 39 L-22 24 Z', 'M0 -9 L12 12 L0 28 L-12 12 Z', 'M-19 -3 L-43 -37 L-57 -23 L-38 15 L-23 23 M19 -3 L43 -37 L57 -23 L38 15 L23 23', 'M-39 -28 L-27 -7 M39 -28 L27 -7 M-47 -22 L-32 10 M47 -22 L32 10'],
  };

  const paths = new Map(Object.entries(robotShapes).map(([kind,shapes]) => [kind,shapes.map(shape => new Path2D(shape))]));
  const legs = new Path2D('M-11 35 L-17 62 L-28 69 L-7 69 M11 35 L17 62 L28 69 L7 69');
  // Inventory status measures runtime occupancy, not demonstrated execution.
  const stateLabel=status=>({active:'RUN OPEN',idle:'NO OPEN RUN',queued:'QUEUED'})[status]||'UNOBSERVED';
  const ellipse = (ctx,x,y,rx,ry,fill,stroke,width=1) => {ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}};
  function robot(ctx,spec,x,y,scale,time=0,active=false) {
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineJoin='round';ctx.lineWidth=2.8;ctx.strokeStyle=spec.color;
    for (const [i,path] of paths.get(spec.kind).entries()){ctx.fillStyle=i===3?spec.color+'50':'#151515';ctx.fill(path);ctx.stroke(path);}
    ctx.stroke(legs);
    if(spec.kind==='orbital'){ellipse(ctx,0,-34,23,25,'#031818',spec.color,2.8);ellipse(ctx,0,-34,14,15,null,spec.color,2);ellipse(ctx,0,-34,5,5,'#fff');ellipse(ctx,0,16,40,11,null,spec.color,2);}
    else {ctx.beginPath();ctx.moveTo(-8,-37);ctx.lineTo(8,-37);ctx.strokeStyle='#fff';ctx.stroke();}
    if(active){ctx.strokeStyle=spec.color;const arm=Math.sin(time/350)*5;ctx.beginPath();ctx.moveTo(-24,4);ctx.lineTo(-37,15+arm);ctx.lineTo(-45,25+arm);ctx.moveTo(24,4);ctx.lineTo(37,15-arm);ctx.lineTo(45,25-arm);ctx.stroke();}
    ctx.restore();
  }
  function portrait(canvas,spec){canvas.width=136;canvas.height=216;const ctx=canvas.getContext('2d');ctx.setTransform(2,0,0,2,0,0);ellipse(ctx,34,95,29,8,'#000',spec.color+'88',1.5);robot(ctx,spec,34,60,.61);}
  class Chamber {
    constructor(canvas,{select,zoomChanged}={}){
      this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.select=select;this.zoomChanged=zoomChanged;
      this.zoom=1;canvas.style.touchAction='pan-y';this.pan={x:0,y:0};this.rows=new Map();this.actors=new Map();this.frame=0;this.active=false;this.motion=true;this.live=false;this.pointers=new Map();
      this.selected='atlas';this.dprLimit=2;this.fps=60;this.lastDraw=0;this.width=1;this.height=1;this.dpr=1;this.previous=0;this.hits=[];
      canvas.addEventListener('pointerdown',event=>{canvas.setPointerCapture(event.pointerId);this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,time:performance.now()});if(this.pointers.size===2)this.pinch=this.pointerDistance();});
      canvas.addEventListener('pointermove',event=>{const before=this.pointers.get(event.pointerId);if(!before)return;const dx=event.clientX-before.x,dy=event.clientY-before.y;before.x=event.clientX;before.y=event.clientY;if(this.pointers.size===2){const distance=this.pointerDistance();if(this.pinch)this.setZoom(this.zoom*distance/this.pinch);this.pinch=distance;}else if(this.zoom>1){this.pan.x+=dx;this.pan.y+=dy;this.boundPan();this.draw(performance.now());}});
      canvas.addEventListener('pointerup',event=>{const p=this.pointers.get(event.pointerId);this.pointers.delete(event.pointerId);this.pinch=0;if(!p||Math.hypot(event.clientX-p.startX,event.clientY-p.startY)>10||performance.now()-p.time>700)return;const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left-this.width/2-this.pan.x)/this.zoom+this.width/2,y=(event.clientY-rect.top-this.height/2-this.pan.y)/this.zoom+this.height/2;const hit=this.hits.find(h=>x>h.x&&x<h.x+h.w&&y>h.y&&y<h.y+h.h);if(hit)this.select?.(hit.id);});
      canvas.addEventListener('pointercancel',event=>{this.pointers.delete(event.pointerId);this.pinch=0;});
      new ResizeObserver(()=>this.resize()).observe(canvas);this.resize();
    }
    pointerDistance(){const [a,b]=[...this.pointers.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;}
    boundPan(){const maxX=(this.zoom-1)*this.width/2,maxY=(this.zoom-1)*this.height/2;this.pan.x=Math.max(-maxX,Math.min(maxX,this.pan.x));this.pan.y=Math.max(-maxY,Math.min(maxY,this.pan.y));}
    setZoom(value){this.zoom=Math.max(1,Math.min(2.5,value));this.boundPan();this.canvas.style.touchAction=this.zoom===1?'pan-y':'none';this.zoomChanged?.(Math.round(this.zoom*100));this.draw(performance.now());}
    fit(){this.pan={x:0,y:0};this.setZoom(1);}
    resize(){const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;this.width=rect.width;this.height=rect.height;this.dpr=Math.min(this.dprLimit,window.devicePixelRatio||1);this.canvas.width=Math.round(rect.width*this.dpr);this.canvas.height=Math.round(rect.height*this.dpr);this.boundPan();this.draw(performance.now());}
    quality(lightweight){const limit=lightweight?1.5:2,rate=lightweight?30:60;if(this.dprLimit===limit&&this.fps===rate)return;this.dprLimit=limit;this.fps=rate;this.lastDraw=0;this.resize();}
    update(rows,live,selected,motion){this.rows=rows;this.live=live;this.selected=selected;this.motion=motion;for(const spec of SPECS){const status=live?rows.get(spec.id)?.status||'unknown':'unknown';const target=status==='active'?14:-14;let actor=this.actors.get(spec.id);if(!actor){actor={x:target,status,observed:status!=='unknown'};this.actors.set(spec.id,actor);}actor.target=target;actor.status=status;actor.observed=status!=='unknown';if(!motion)actor.x=target;}this.draw(performance.now());this.schedule();}
    show(active){this.active=active;if(active){this.resize();this.schedule();}else{cancelAnimationFrame(this.frame);this.frame=0;this.previous=0;}}
    schedule(){if(!this.active||!this.live||!this.motion||document.hidden||this.frame)return;this.frame=requestAnimationFrame(time=>{this.frame=0;const dt=this.previous?Math.min(.05,(time-this.previous)/1000):0;this.previous=time;for(const actor of this.actors.values())if(actor.observed)actor.x+=(actor.target-actor.x)*Math.min(1,dt*5);if(time-this.lastDraw>=1000/this.fps-2){this.lastDraw=time;this.draw(time);}this.schedule();});}
    draw(time){const ctx=this.ctx;if(!ctx||this.width<100||this.height<100)return;const w=this.width,h=this.height;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.fillStyle='#050505';ctx.fillRect(0,0,w,h);ctx.save();ctx.translate(w/2+this.pan.x,h/2+this.pan.y);ctx.scale(this.zoom,this.zoom);ctx.translate(-w/2,-h/2);
      const cols=w>600?3:2,rows=6/cols,gap=12,pad=14,cw=(w-pad*2-gap*(cols-1))/cols,ch=(h-pad*2-gap*(rows-1))/rows;this.hits=[];
      for(const [i,spec] of SPECS.entries()){const x=pad+(i%cols)*(cw+gap),y=pad+Math.floor(i/cols)*(ch+gap),actor=this.actors.get(spec.id)||{x:-14,status:'unknown',observed:false};this.hits.push({id:spec.id,x,y,w:cw,h:ch});const selected=this.selected===spec.id;
        ctx.fillStyle=selected?spec.color+'16':'#111';ctx.strokeStyle=selected?spec.color:'#555';ctx.lineWidth=selected?2:1;ctx.beginPath();ctx.roundRect(x,y,cw,ch,12);ctx.fill();ctx.stroke();
        ctx.fillStyle=spec.color;ctx.fillRect(x+12,y+12,4,18);ctx.font='800 16px system-ui';ctx.textAlign='left';ctx.fillText(spec.name,x+24,y+26);ctx.font='12px system-ui';ctx.fillStyle='#ddd';ctx.fillText(stateLabel(actor.status)+(actor.status!=='unknown'&&spec.temporary?' · TEMP':''),x+14,y+44);
        const floorY=y+ch-22,centerX=x+cw/2;ellipse(ctx,centerX,floorY,cw*.32,10,'#030303',actor.observed?spec.color+'aa':'#555',1.5);
        ctx.save();ctx.globalAlpha=actor.observed?1:.5;const bob=this.live&&this.motion&&actor.status==='active'?Math.sin(time/400+i)*1.2:0;const scale=Math.max(.22,Math.min(.69,(ch-62)/152));robot(ctx,spec,centerX+actor.x,floorY-69*scale+bob,scale,time,this.live&&this.motion&&actor.status==='active');ctx.restore();
        if(actor.status==='queued'&&this.live){ctx.font='700 18px system-ui';ctx.fillStyle='#ffae00';ctx.textAlign='right';ctx.fillText('•••',x+cw-12,y+44);}
      }ctx.restore();
    }
  }
  window.DracoChamber={SPECS,Chamber,portrait,robot,ellipse};
})();
