/* Retained, perspective ship interior. Occupancy animates an illustration, never
 * a claim of physical travel or productive execution. No transport or controls. */
'use strict';
(() => {
  const {ellipse}=window.DracoChamber;
  const SPECS=window.DracoChamber.SPECS.map(s=>s.id==='daedalus'?{...s,color:'#d5eeff',kind:'winged'}:s);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
  const gradient=(ctx,x,y,a,b,stops)=>{const g=ctx.createLinearGradient(x,y,a,b);for(const [at,c] of stops)g.addColorStop(at,c);return g;};
  const line=(c,p,color,w=1)=>{c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=w;c.stroke();};
  const polygon=(c,p,fill,stroke,w=1)=>{c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke();}};
  const panel=(c,x,y,w,h,r,fill,stroke,lw=1)=>{c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}};
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
  function multiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];return out;}
  function cameraMatrix(eye,target,aspect){
    const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x),f=1/Math.tan(.42),near=.1,far=180;
    const view=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
    return {matrix:multiply(new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]),view),right:x,up:y};
  }
  const color=(hex,shade=1,alpha=1)=>{const n=parseInt(hex.slice(1,7),16);return [((n>>16)&255)/255*shade,((n>>8)&255)/255*shade,(n&255)/255*shade,alpha];};
  const STATIONS=SPECS.map((spec,i)=>({spec,x:(i%2?1:-1)*2.15,z:-2.85+Math.floor(i/2)*2.85}));
  const ACTOR_HEIGHT=1.82,ACTOR_WIDTH=1.9;
  class Mesh {
    constructor(){this.data=[];this.faces=[];}
    tri(a,b,c,rgba,lit=true){
      const light=lit?.48+.50*Math.abs(dot(norm(cross(sub(b,a),sub(c,a))),[-.462, .770, .346])):1;
      const tint=rgba.map((v,i)=>i<3?v*light:v);for(const p of [a,b,c])this.data.push(...p,...tint,0,0);this.faces.push({p:[a,b,c],c:tint});
    }
    quad(a,b,c,d,rgba,lit=true){this.tri(a,b,c,rgba,lit);this.tri(a,c,d,rgba,lit);}
    box(x,y,z,w,h,d,hex){this.platform(x,y,z,w,h,d,Math.min(.06,w*.2,d*.2),hex);}
    platform(x,y,z,w,h,d,r,hex){
      // Retained beveled geometry, with rounded plan corners and a small shoulder.
      const path=[];for(let corner=0;corner<4;corner++){const a=-Math.PI+corner*Math.PI/2,cx=x+(corner===0||corner===3?-1:1)*(w/2-r),cz=z+(corner<2?-1:1)*(d/2-r);for(let j=0;j<=5;j++){const t=a+j*Math.PI/10;path.push([cx+Math.cos(t)*r,cz+Math.sin(t)*r]);}}
      const bevel=Math.min(.065,h*.32),inset=Math.min(.035,r*.35);for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length],ai=[mix(a[0],x,inset/(w/2)),mix(a[1],z,inset/(d/2))],bi=[mix(b[0],x,inset/(w/2)),mix(b[1],z,inset/(d/2))];
        this.tri([x,y+h,z],[ai[0],y+h,ai[1]],[bi[0],y+h,bi[1]],color(hex));
        this.quad([a[0],y,a[1]],[b[0],y,b[1]],[b[0],y+h-bevel,b[1]],[a[0],y+h-bevel,a[1]],color(hex,.78));
        this.quad([a[0],y+h-bevel,a[1]],[b[0],y+h-bevel,b[1]],[bi[0],y+h,bi[1]],[ai[0],y+h,ai[1]],color(hex,1.25));
      }
    }
    disk(x,y,z,r,hex,alpha=1,segments=48){for(let i=0;i<segments;i++){const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;this.tri([x,y,z],[x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],color(hex,1,alpha),false);}}
    ring(x,y,z,r,hex,width=.025,alpha=1,start=0,end=Math.PI*2){const steps=Math.ceil(64*(end-start)/(Math.PI*2));for(let i=0;i<steps;i++){const a=start+i*(end-start)/steps,b=start+(i+1)*(end-start)/steps;this.quad([x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],[x+Math.cos(b)*(r-width),y,z+Math.sin(b)*(r-width)],[x+Math.cos(a)*(r-width),y,z+Math.sin(a)*(r-width)],color(hex,1,alpha),false);}}
    cylinder(x,y,z,r,h,hex,segments=48){for(let i=0;i<segments;i++){const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments,p=[x+Math.cos(a)*r,z+Math.sin(a)*r],q=[x+Math.cos(b)*r,z+Math.sin(b)*r];this.tri([x,y+h,z],[p[0],y+h,p[1]],[q[0],y+h,q[1]],color(hex));this.quad([p[0],y,p[1]],[q[0],y,q[1]],[q[0],y+h,q[1]],[p[0],y+h,p[1]],color(hex,.85));}}
    shadow(x,y,z,r){for(let i=0;i<5;i++)this.disk(x,y+i*.001,z,r*(1-i*.13),'#01060b',.035+i*.018);}
  }
  function buildShip(){
    const m=new Mesh();
    // One dark architectural deck rather than a collection of bright toy desks.
    m.platform(0,-.36,0,7.9,.36,10.4,1.22,'#17252e');
    m.platform(0,-.02,0,7.62,.055,10.1,1.13,'#111b23');
    m.platform(0,.036,0,7.2,.025,9.68,.92,'#1d2a33');
    // Thin inset metal seams give scale; the central walkway is deliberately calm.
    for(const x of [-3.23,-.66,.66,3.23])m.box(x,.064,0,.012,.008,8.5,'#344550');
    for(const z of [-4.2,-1.43,1.43,4.2]){m.box(-2.12,.065,z,2.15,.006,.012,'#41545d');m.box(2.12,.065,z,2.15,.006,.012,'#41545d');}
    for(const x of [-3.66,3.66]){
      m.box(x,-.12,0,.055,.15,7.9,'#52616a');m.box(x,.073,0,.025,.01,7.8,'#416674');
      for(const z of [-3.7,-.8,.8,3.7])m.box(x,.09,z,.032,.018,.38,'#83b6c5');
    }
    // Low prow and aft ribs. No tall pillars that occlude the creatures.
    for(const z of [-4.71,4.71]){m.platform(0,.07,z,5.2,.15,.31,.14,'#263b47');m.box(0,.225,z,4.65,.012,.028,z<0?'#b94f60':'#4a8b9a');}
    // Panoramic observation glass and fixed distant stars establish room depth.
    // Their content is decorative, not a live telemetry surface.
    m.box(0,.24,-4.69,5.6,.18,.28,'#304752');
    m.quad([-2.65,.42,-4.76],[2.65,.42,-4.76],[2.65,1.93,-4.98],[-2.65,1.93,-4.98],color('#061824'),false);
    m.box(0,1.9,-4.96,5.6,.11,.14,'#385460');
    for(const x of [-2.71,-.93,.93,2.71]){m.box(x,.42,-4.78,.07,1.51,.12,'#466371');m.box(x+.025,.47,-4.7,.011,1.24,.011,'#6d98a9');}
    for(let n=0;n<34;n++){const x=Math.sin(n*23.7)*2.6,y=.56+(Math.sin(n*7.1)+1)*.61,z=-4.755-(y-.42)*.145;m.quad([x-.006,y-.006,z+.012],[x+.006,y-.006,z+.012],[x+.006,y+.006,z+.012],[x-.006,y+.006,z+.012],color(n%5?'#6a929f':'#d2e8ec',1,n%3?.55:1),false);}
    // Recessed central navigation well, dark glass and restrained concentric light.
    m.shadow(0,.066,0,1.06);m.cylinder(0,.07,0,.76,.105,'#101d27');m.cylinder(0,.175,0,.66,.09,'#334650');
    m.disk(0,.267,0,.59,'#06141d');m.ring(0,.269,0,.59,'#688793',.018);m.ring(0,.27,0,.43,'#77c5d2',.012,.75);m.ring(0,.271,0,.26,'#355667',.008);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;m.box(Math.sin(a)*.51,.273,Math.cos(a)*.51,.019,.008,.019,'#9bc6cf');}
    for(const {spec,x,z} of STATIONS){
      m.shadow(x,.066,z,.98);
      // A sculpted low pod with a readable dark inset, not a fluorescent slab.
      m.platform(x,.07,z,2.24,.13,2.24,.46,'#30424d');m.platform(x,.20,z,2.1,.045,2.1,.42,'#4a5d66');
      m.platform(x,.245,z,1.99,.027,1.99,.37,'#15242d');
      m.ring(x,.275,z+.12,.72,spec.color,.018,.68,Math.PI*.08,Math.PI*.92);
      m.ring(x,.276,z+.12,.72,'#44616e',.011,.6,Math.PI*1.08,Math.PI*1.92);
      // A low curved instrument housing sits behind the actor; fine blue-grey UI
      // strokes remain legible as instruments without painting a giant agent logo.
      m.platform(x,.28,z-.77,1.52,.19,.42,.19,'#263e4c');m.platform(x,.47,z-.77,1.42,.035,.36,.15,'#0c1c27');
      m.box(x-.48,.511,z-.77,.28,.01,.015,spec.color);m.box(x+.13,.511,z-.77,.63,.01,.012,'#4c7282');
      for(let n=0;n<5;n++)m.box(x-.46+n*.2,.513,z-.69,.12,.009,.008,'#45616d');
      // A subtle floor-facing status strip and a dock number-sized side marker.
      m.box(x,.278,z+.87,.72,.01,.018,spec.color);m.box(x-.84,.28,z+.66,.02,.015,.11,'#6a8995');
    }
    return m;
  }
  class Environment {
    constructor(canvas,{select,zoomChanged,onFrame}={}){
      Object.assign(this,{canvas,select,zoomChanged,onFrame,width:1,height:1,dpr:1,dprLimit:2,fps:60,zoom:1,pan:{x:0,y:0},yaw:-.18,pitch:.84,rows:new Map(),actors:new Map(),selected:'atlas',active:false,live:false,motion:true,frame:0,dirty:false,clock:0,previous:0,lastDraw:0,pointers:new Map(),hits:[],sprites:new Map(),textures:new Map(),lost:false,destroyed:false});
      this.focused=null;this.fittedDistance=18;this.fitKey='';
      this.performance={draws:0,resizes:0,drawMs:[],frameMs:[],meshBuilds:1};this.mesh=buildShip();
      try{this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:false});if(this.gl)this.initGL();}catch{
        // A failed GPU initialization must not abort the app's communication UI.
        try{this.gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch{}
        const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);this.canvas=canvas=replacement;this.gl=null;
      }
      if(!this.gl){this.ctx=canvas.getContext('2d',{alpha:false});this.dprLimit=1.25;this.fps=15;}
      const stage=canvas.parentElement;
      this.labels=document.createElement('div');this.labels.className='spatial-labels';this.labels.setAttribute('aria-hidden','true');stage.append(this.labels);this.labelNodes=new Map();
      for(const spec of SPECS){const el=document.createElement('span');el.className='spatial-label';el.textContent=spec.name;el.style.setProperty('--agent',spec.color);this.labels.append(el);this.labelNodes.set(spec.id,el);}
      this.notice=document.createElement('p');this.notice.className='spatial-render-note';this.notice.textContent=this.gl?'':'Perspective compatibility renderer';stage.append(this.notice);
      this.bindInput();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);
      this.onVisibility=()=>{this.stopFrame();if(!document.hidden){this.requestDraw();this.schedule();}};document.addEventListener('visibilitychange',this.onVisibility);
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.lost=true;this.stopFrame();this.notice.textContent='Scene paused · graphics unavailable. Conversations remain available.';});
      canvas.addEventListener('webglcontextrestored',()=>{try{this.textures.clear();this.initGL();this.lost=false;this.notice.textContent='';this.requestDraw();this.schedule();}catch{this.lost=true;this.stopFrame();this.notice.textContent='Scene paused · graphics recovery failed. Conversations remain available.';}});
      this.resize();
    }
    initGL(){
      const g=this.gl,shader=(kind,source)=>{const s=g.createShader(kind);g.shaderSource(s,source);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error('Spatial shader compile failed');return s;};
      const v=shader(g.VERTEX_SHADER,'attribute vec3 p;attribute vec4 c;attribute vec2 uv;uniform mat4 vp;varying vec4 col;varying vec2 tex;void main(){gl_Position=vp*vec4(p,1.);col=c;tex=uv;}');
      const f=shader(g.FRAGMENT_SHADER,'precision mediump float;varying vec4 col;varying vec2 tex;uniform sampler2D sprite;uniform bool textured;void main(){vec4 c=col;if(textured)c*=texture2D(sprite,tex);if(c.a<.02)discard;gl_FragColor=c;}');
      this.program=g.createProgram();g.attachShader(this.program,v);g.attachShader(this.program,f);g.linkProgram(this.program);if(!g.getProgramParameter(this.program,g.LINK_STATUS))throw Error('Spatial program link failed');g.deleteShader(v);g.deleteShader(f);g.useProgram(this.program);
      const backgroundVertex=shader(g.VERTEX_SHADER,'attribute vec2 p;varying vec2 pos;void main(){pos=p;gl_Position=vec4(p,0.,1.);}');
      const backgroundFragment=shader(g.FRAGMENT_SHADER,'precision mediump float;varying vec2 pos;void main(){vec2 q=pos*vec2(.8,.65);float glow=exp(-dot(q,q)*2.4);vec3 c=mix(vec3(.005,.012,.020),vec3(.035,.075,.096),glow);c*=1.-.25*max(0.,-pos.y);gl_FragColor=vec4(c,1.);}');
      this.backgroundProgram=g.createProgram();g.attachShader(this.backgroundProgram,backgroundVertex);g.attachShader(this.backgroundProgram,backgroundFragment);g.linkProgram(this.backgroundProgram);if(!g.getProgramParameter(this.backgroundProgram,g.LINK_STATUS))throw Error('Spatial background link failed');g.deleteShader(backgroundVertex);g.deleteShader(backgroundFragment);
      this.backgroundLocation=g.getAttribLocation(this.backgroundProgram,'p');this.backgroundBuffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.backgroundBuffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),g.STATIC_DRAW);
      this.locations={p:g.getAttribLocation(this.program,'p'),c:g.getAttribLocation(this.program,'c'),uv:g.getAttribLocation(this.program,'uv'),vp:g.getUniformLocation(this.program,'vp'),textured:g.getUniformLocation(this.program,'textured')};
      this.staticBuffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.staticBuffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array(this.mesh.data),g.STATIC_DRAW);
      this.dynamicBuffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.dynamicBuffer);g.bufferData(g.ARRAY_BUFFER,9*4*512,g.DYNAMIC_DRAW);
      g.enable(g.DEPTH_TEST);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);g.clearColor(.018,.018,.028,1);
    }
    bindBuffer(buffer){const g=this.gl;g.bindBuffer(g.ARRAY_BUFFER,buffer);for(const [name,size,offset] of [['p',3,0],['c',4,12],['uv',2,28]]){g.enableVertexAttribArray(this.locations[name]);g.vertexAttribPointer(this.locations[name],size,g.FLOAT,false,36,offset);}}
    bindInput(){
      const c=this.canvas;c.style.touchAction='none';
      c.addEventListener('pointerdown',e=>{c.setPointerCapture?.(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,multi:this.pointers.size>0});if(this.pointers.size>1){for(const p of this.pointers.values())p.multi=true;this.pinch=this.pointerDistance();}});
      c.addEventListener('pointermove',e=>{const p=this.pointers.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
        if(this.pointers.size>1){const d=this.pointerDistance();if(this.pinch&&this.pinch>24&&d>24)this.setZoom(this.zoom*clamp(d/this.pinch,.92,1.08));this.pinch=d;this.pan.x=clamp(this.pan.x-dx*.003/this.zoom,-.65,.65);this.pan.y=clamp(this.pan.y+dy*.003/this.zoom,-.8,.8);}
        else{this.yaw-=dx*.005;this.pitch=clamp(this.pitch+dy*.004,.62,1.35);}this.requestDraw();});
      c.addEventListener('pointerup',e=>{const p=this.pointers.get(e.pointerId);this.pointers.delete(e.pointerId);this.pinch=0;if(!p||p.multi||Math.hypot(e.clientX-p.sx,e.clientY-p.sy)>8)return;const r=c.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const hit=this.hits.filter(h=>Math.abs(x-h.x)<h.w/2&&Math.abs(y-h.y)<h.h/2).sort((a,b)=>a.depth-b.depth)[0];if(hit)this.select?.(hit.id);});
      const cancel=e=>{this.pointers.delete(e.pointerId);this.pinch=0;};c.addEventListener('pointercancel',cancel);c.addEventListener('lostpointercapture',cancel);
      c.addEventListener('wheel',e=>{e.preventDefault();this.setZoom(this.zoom*Math.exp(-e.deltaY*.0015));},{passive:false});
      c.addEventListener('keydown',e=>{if(e.key==='0')this.fit();else if(e.key==='+'||e.key==='=')this.setZoom(this.zoom+.2);else if(e.key==='-')this.setZoom(this.zoom-.2);else if(e.key==='ArrowLeft')this.yaw-=.15;else if(e.key==='ArrowRight')this.yaw+=.15;else if(e.key==='ArrowUp')this.pitch=clamp(this.pitch+.1,.62,1.35);else if(e.key==='ArrowDown')this.pitch=clamp(this.pitch-.1,.62,1.35);else return;e.preventDefault();this.requestDraw();});
    }
    pointerDistance(){const [a,b]=this.pointers.values();return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;}
    setZoom(v){if(!Number.isFinite(v))return;this.zoom=clamp(v,.85,1.35);this.zoomChanged?.(Math.round(this.zoom*100));this.requestDraw();}
    fit(){this.focused=null;this.yaw=-.18;this.pitch=.84;this.pan={x:0,y:0};this.setZoom(1);this.fitViewport();}
    focus(id=this.selected){const i=SPECS.findIndex(s=>s.id===id);if(i<0)return;this.focused=id;const p=this.actorPosition(null,i,this.actors.get(id));this.pan={x:p.x,y:p.z};this.zoom=1;this.zoomChanged?.(100);this.requestDraw();}
    framingPoints(){
      // Required station, label, and actual camera-facing creature geometry.
      // Camera-facing artwork does not flatten when the deck is viewed above.
      const points=[],right=[Math.cos(this.yaw),0,-Math.sin(this.yaw)],up=[-Math.sin(this.yaw)*Math.sin(this.pitch),Math.cos(this.pitch),-Math.cos(this.yaw)*Math.sin(this.pitch)];
      for(const {x,z} of STATIONS){for(const dx of [-1.2,1.2])for(const dz of [-1.2,1.2])points.push([x+dx,.1,z+dz]);for(const side of [-1,1])for(const height of [0,ACTOR_HEIGHT])points.push([x+right[0]*ACTOR_WIDTH*.57*side+up[0]*height,.29+up[1]*height,z+.12+right[2]*ACTOR_WIDTH*.57*side+up[2]*height]);points.push([x,.2,z+1.12]);}
      points.push([-2.8,2.05,-4.98],[2.8,2.05,-4.98]);for(const side of [-1,1])for(const end of [-1,1])points.push([side*2.8,-.36,end*5.25],[side*4.0,-.36,end*4.3]);return points;
    }
    frameCamera(aspect){
      const key=[this.width,this.height,this.yaw.toFixed(5),this.pitch.toFixed(5)].join(':');
      if(key!==this.fitKey){const target=[0,.65,.35],points=this.framingPoints(),mx=Math.min(1.8,2-42/this.width),my=Math.min(1.8,2-44/this.height);let low=3,high=70,last;
        for(let pass=0;pass<27;pass++){const distance=(low+high)/2,eye=[Math.sin(this.yaw)*Math.cos(this.pitch)*distance,.65+Math.sin(this.pitch)*distance,.35+Math.cos(this.yaw)*Math.cos(this.pitch)*distance],matrix=cameraMatrix(eye,target,aspect).matrix;
          const projected=points.map(([x,y,z])=>{const w=matrix[3]*x+matrix[7]*y+matrix[11]*z+matrix[15];return [(matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12])/w,(matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13])/w,w];}),left=Math.min(...projected.map(p=>p[0])),right=Math.max(...projected.map(p=>p[0])),bottom=Math.min(...projected.map(p=>p[1])),top=Math.max(...projected.map(p=>p[1]));
          const fits=projected.every(p=>p[2]>.2)&&right-left<=mx&&top-bottom<=my;if(fits){high=distance;last={x:(left+right)/2,y:(bottom+top)/2};}else low=distance;
        }this.fittedDistance=high;this.fitOffset=last||{x:0,y:0};this.fitKey=key;
      }
      const focused=this.focused&&SPECS.some(s=>s.id===this.focused),distance=focused?Math.max(6.3,5.8/aspect)/this.zoom:this.fittedDistance/this.zoom,target=[this.pan.x,.65,this.pan.y+(focused?0:.35)];
      const eye=[target[0]+Math.sin(this.yaw)*Math.cos(this.pitch)*distance,target[1]+Math.sin(this.pitch)*distance,target[2]+Math.cos(this.yaw)*Math.cos(this.pitch)*distance],camera=cameraMatrix(eye,target,aspect);
      // Off-axis optical centering keeps the complete hull centered at Overview.
      // Manual pan and explicit Focus remain genuine camera operations.
      if(!focused)for(let column=0;column<4;column++){camera.matrix[column*4]-=this.fitOffset.x*camera.matrix[column*4+3];camera.matrix[column*4+1]-=this.fitOffset.y*camera.matrix[column*4+3];}
      return camera;
    }
    fitViewport(){
      const stage=this.canvas.parentElement;if(stage.closest('[hidden]'))return;
      // The responsive viewport grid owns scene height. Observe its actual canvas
      // rather than reinstating the old fixed percentage and wasting phone space.
      const nav=document.querySelector('.bottom-nav')?.getBoundingClientRect().height||76;document.documentElement.style.setProperty('--spatial-nav-height',nav+'px');this.resize();
    }
    resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;const dpr=Math.min(this.dprLimit,devicePixelRatio||1),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(w===this.canvas.width&&h===this.canvas.height&&this.width===r.width&&this.height===r.height&&this.dpr===dpr)return;this.width=r.width;this.height=r.height;this.dpr=dpr;this.performance.resizes++;if(this.canvas.width!==w)this.canvas.width=w;if(this.canvas.height!==h)this.canvas.height=h;this.requestDraw();}
    quality(light){const limit=!this.gl||light?1.25:2,rate=!this.gl?15:light?30:60;if(limit===this.dprLimit&&rate===this.fps)return;this.dprLimit=limit;this.fps=rate;this.resize();}
    update(rows,live,selected,motion){this.rows=rows;this.live=live===true;this.selected=selected;this.motion=motion===true;
      for(const [i,s] of SPECS.entries()){const row=rows.get(s.id),status=this.live&&['active','idle','queued'].includes(row?.status)?row.status:'unknown';let a=this.actors.get(s.id);if(!a){a={clock:0,status,observed:status!=='unknown',sessionId:row?.sessionId};this.actors.set(s.id,a);}if(a.sessionId!==row?.sessionId){a.clock=0;a.sessionId=row?.sessionId;}if(status==='unknown'&&a.observed)a.frozen=this.actorPosition(null,i,a);if(status!=='unknown')a.frozen=null;a.status=status;a.observed=status!=='unknown';}
      this.requestDraw();this.schedule();}
    show(active){this.active=active===true;this.labels.hidden=!this.active;if(this.active){this.fitViewport();this.requestDraw();this.schedule();}else{this.stopFrame();this.pointers.clear();}}
    stopFrame(){cancelAnimationFrame(this.frame);this.frame=0;this.previous=0;}
    requestDraw(invalidate=true){if(invalidate)this.dirty=true;if(!this.active||this.destroyed||this.lost||document.hidden||this.frame)return;this.frame=requestAnimationFrame(t=>{this.frame=0;this.tick(t);});}
    schedule(){if(this.live&&this.motion&&[...this.actors.values()].some(a=>a.observed&&a.status==='active'))this.requestDraw(false);}
    tick(t){if(!this.active||this.lost||document.hidden)return;const elapsed=this.previous?t-this.previous:0;if(t-this.lastDraw>=1000/this.fps-1){if(elapsed){this.performance.frameMs.push(elapsed);if(this.performance.frameMs.length>120)this.performance.frameMs.shift();}this.dirty=false;this.advance(Math.min(.08,elapsed/1000));this.previous=t;this.lastDraw=t;this.draw();}
      // A backing-store resize clears WebGL pixels. Retain its invalidation when
      // this RAF is inside the FPS interval, even if motion is reduced or every
      // actor is idle. Animation scheduling alone must never own required paint.
      if(this.dirty)this.requestDraw(false);this.schedule();}
    advance(dt){if(!this.active||!this.live||!this.motion||document.hidden)return;this.clock+=dt;for(const a of this.actors.values())if(a.observed&&a.status==='active')a.clock+=dt;}
    scene(){return {perspective:true,W:7.9,H:10.4,scale:1,ox:0,oy:0};}
    actorPosition(s,i,a=this.actors.get(SPECS[i]?.id)){if(a?.frozen)return a.frozen;const station=STATIONS[i]||{x:0,z:0},phase=(a?.clock||0)*.42;return {x:station.x+(a?.status==='active'?Math.sin(phase)*.08:0),z:station.z+.12+(a?.status==='active'?Math.cos(phase)*.055:0),y:.29};}
    project(p){const m=this.vp,x=p[0],y=p[1],z=p[2],w=m[3]*x+m[7]*y+m[11]*z+m[15];return {x:(m[0]*x+m[4]*y+m[8]*z+m[12])/w*this.width/2+this.width/2,y:-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*this.height/2+this.height/2,depth:w,s:1/w};}
    point(s,x,z){return this.project([x,.2,z]);}
    draw(){if(!this.active||this.destroyed||this.lost||this.width<2)return;const started=performance.now(),camera=this.frameCamera(this.width/this.height);this.vp=camera.matrix;this.right=camera.right;this.up=camera.up;
      if(this.gl)this.drawGL();else this.drawSoftware();this.updateLabels();this.onFrame?.();this.performance.draws++;this.performance.drawMs.push(performance.now()-started);if(this.performance.drawMs.length>120)this.performance.drawMs.shift();}
    texture(spec){const g=this.gl;if(this.textures.has(spec.id))return this.textures.get(spec.id);const t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,this.actorSprite(spec));g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);this.textures.set(spec.id,t);return t;}
    drawGL(){const g=this.gl;g.viewport(0,0,this.canvas.width,this.canvas.height);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.disable(g.DEPTH_TEST);g.disable(g.BLEND);g.useProgram(this.backgroundProgram);g.bindBuffer(g.ARRAY_BUFFER,this.backgroundBuffer);g.enableVertexAttribArray(this.backgroundLocation);g.vertexAttribPointer(this.backgroundLocation,2,g.FLOAT,false,8,0);g.drawArrays(g.TRIANGLES,0,3);g.enable(g.DEPTH_TEST);g.enable(g.BLEND);g.useProgram(this.program);g.uniformMatrix4fv(this.locations.vp,false,this.vp);g.uniform1i(this.locations.textured,0);this.bindBuffer(this.staticBuffer);g.drawArrays(g.TRIANGLES,0,this.mesh.data.length/9);
      const ring=new Mesh(),i=SPECS.findIndex(s=>s.id===this.selected);if(i>=0){const p=this.actorPosition(null,i);ring.ring(p.x,.287,p.z,.75,SPECS[i].color,.035,.95);}
      this.bindBuffer(this.dynamicBuffer);g.bufferSubData(g.ARRAY_BUFFER,0,new Float32Array(ring.data));g.drawArrays(g.TRIANGLES,0,ring.data.length/9);
      // Transparent billboards depth-tested against actual consoles and floor.
      const actors=SPECS.map((s,i)=>({s,i,p:this.actorPosition(null,i)})).sort((a,b)=>this.project([b.p.x,.5,b.p.z]).depth-this.project([a.p.x,.5,a.p.z]).depth);
      g.depthMask(false);g.uniform1i(this.locations.textured,1);
      for(const {s,p} of actors){const a=this.actors.get(s.id),r=this.right.map(v=>v*ACTOR_WIDTH/2),rgba=[1,1,1,a?.observed?1:.48],bottom=[p.x,p.y,p.z],top=[p.x+this.up[0]*ACTOR_HEIGHT,p.y+this.up[1]*ACTOR_HEIGHT,p.z+this.up[2]*ACTOR_HEIGHT],vertices=[];
        const v=(p,sign,u,v)=>vertices.push(p[0]+r[0]*sign,p[1]+r[1]*sign,p[2]+r[2]*sign,...rgba,u,v);
        v(bottom,-1,0,0);v(bottom,1,1,0);v(top,1,1,1);v(bottom,-1,0,0);v(top,1,1,1);v(top,-1,0,1);
        g.bindTexture(g.TEXTURE_2D,this.texture(s));g.bufferSubData(g.ARRAY_BUFFER,0,new Float32Array(vertices));g.drawArrays(g.TRIANGLES,0,6);}
      g.depthMask(true);}
    drawSoftware(){const c=this.ctx;if(!c)return;
      // Software fallback rasterizes static architecture only when its camera or
      // viewport changes. Creature motion never re-sorts twenty thousand faces.
      const key=[this.width,this.height,this.dpr,...this.vp].join(':');
      if(this.softwareKey!==key){this.softwareKey=key;this.softwareCanvas??=document.createElement('canvas');const canvas=this.softwareCanvas;canvas.width=this.canvas.width;canvas.height=this.canvas.height;const out=canvas.getContext('2d',{alpha:false});out.setTransform(this.dpr,0,0,this.dpr,0,0);const sky=out.createLinearGradient(0,0,0,this.height);sky.addColorStop(0,'#0d1b27');sky.addColorStop(.55,'#071018');sky.addColorStop(1,'#020509');out.fillStyle=sky;out.fillRect(0,0,this.width,this.height);
        const faces=this.mesh.faces.map(f=>({points:f.p.map(p=>this.project(p)),c:f.c}));for(const f of faces)f.depth=f.points.reduce((s,p)=>s+p.depth,0)/3;faces.sort((a,b)=>b.depth-a.depth);
        for(const f of faces){if(f.depth<.1||f.points.some(p=>p.depth<.1))continue;polygon(out,f.points.map(p=>[p.x,p.y]),`rgba(${f.c.slice(0,3).map(v=>Math.round(clamp(v,0,1)*255)).join(',')},${f.c[3]})`);}
      }
      c.setTransform(1,0,0,1,0,0);c.drawImage(this.softwareCanvas,0,0);c.setTransform(this.dpr,0,0,this.dpr,0,0);
      const actors=SPECS.map((s,i)=>{const p=this.actorPosition(null,i);return {s,p,base:this.project([p.x,p.y,p.z]),top:this.project([p.x+this.up[0]*ACTOR_HEIGHT,p.y+this.up[1]*ACTOR_HEIGHT,p.z+this.up[2]*ACTOR_HEIGHT])};}).sort((a,b)=>b.base.depth-a.base.depth);
      for(const {s,base,top} of actors){if(base.depth<.1)continue;const h=base.y-top.y;c.globalAlpha=this.actors.get(s.id)?.observed?1:.48;c.drawImage(this.actorSprite(s),top.x-h/2,top.y,h,h);}c.globalAlpha=1;
    }
    updateLabels(){this.hits=[];for(const [i,s] of SPECS.entries()){const p=this.actorPosition(null,i),station=STATIONS[i],a=this.project([p.x+this.up[0]*ACTOR_HEIGHT*.5,p.y+this.up[1]*ACTOR_HEIGHT*.5,p.z+this.up[2]*ACTOR_HEIGHT*.5]),label=this.project([station.x,.28,station.z+1.02]),el=this.labelNodes.get(s.id);const visible=label.depth>0&&label.x>16&&label.x<this.width-16&&label.y>10&&label.y<this.height-12;el.hidden=!visible;el.classList.toggle('selected',s.id===this.selected);el.dataset.status=this.actors.get(s.id)?.status||'unknown';el.style.transform=`translate(${label.x.toFixed(1)}px,${label.y.toFixed(1)}px)`;this.hits.push({id:s.id,x:a.x,y:a.y,w:Math.max(44,ACTOR_WIDTH*1.12*a.s*this.height),h:Math.max(50,ACTOR_HEIGHT*1.12*a.s*this.height),depth:a.depth},{id:s.id,x:label.x,y:label.y,w:78,h:30,depth:label.depth});}}
    projectedBounds(){const points=this.framingPoints().map(p=>this.project(p));return {left:Math.min(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y)),labels:[...this.labelNodes.values()].filter(el=>!el.hidden).length};}
    diagnostics(){const p=(a)=>a.length?Math.round(a.slice().sort((a,b)=>a-b)[Math.floor((a.length-1)*.95)]*100)/100:null;return {renderer:this.gl?'webgl-perspective':'canvas-perspective-fallback',active:this.active,live:this.live,motion:this.motion,contextLost:this.lost,targetFps:this.fps,width:this.width,height:this.height,dpr:this.dpr,zoom:this.zoom,focused:this.focused,projectedBounds:this.vp?this.projectedBounds():null,camera:{yaw:this.yaw,pitch:this.pitch,x:this.pan.x,z:this.pan.y},draws:this.performance.draws,pendingPaint:this.dirty,pendingFrame:!!this.frame,resizes:this.performance.resizes,meshBuilds:this.performance.meshBuilds,triangles:this.mesh.data.length/27,drawSamples:this.performance.drawMs.length,frameSamples:this.performance.frameMs.length,sampleLimit:120,drawCpuP95Ms:p(this.performance.drawMs),rafIntervalP95Ms:p(this.performance.frameMs),scope:'Recent WebView CPU and RAF intervals, not GPU presentation or native-chat frame timing'};}
    destroy(){this.show(false);this.destroyed=true;this.observer.disconnect();document.removeEventListener('visibilitychange',this.onVisibility);this.labels.remove();this.notice.remove();const g=this.gl;if(g){for(const t of this.textures.values())g.deleteTexture(t);g.deleteBuffer(this.staticBuffer);g.deleteBuffer(this.dynamicBuffer);g.deleteBuffer(this.backgroundBuffer);g.deleteProgram(this.program);g.deleteProgram(this.backgroundProgram);}}
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
  }
  window.DracoEnvironment={Environment};
})();
