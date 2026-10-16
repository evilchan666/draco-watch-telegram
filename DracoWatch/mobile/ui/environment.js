/* First-person local operating room. Player movement is local navigation only;
 * observed occupancy is never a claim of productive execution. No transport. */
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
  function cameraMatrix(eye,target,aspect,fov=1.22){
    const z=norm(sub(eye,target)),x=norm(cross([0,1,0],z)),y=cross(z,x),f=1/Math.tan(fov/2),near=.06,far=80;
    const view=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
    return {matrix:multiply(new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]),view),right:x,up:y};
  }
  const color=(hex,shade=1,alpha=1)=>{const n=parseInt(hex.slice(1,7),16);return [((n>>16)&255)/255*shade,((n>>8)&255)/255*shade,(n&255)/255*shade,alpha];};
  const ROOM={halfWidth:7,halfDepth:10,height:4.8};
  const STATIONS=SPECS.map((spec,i)=>({spec,x:(i%2?1:-1)*4.4,z:-5+Math.floor(i/2)*5}));
  const ACTOR_HEIGHT=1.82,ACTOR_WIDTH=1.9,PLAYER_RADIUS=.32,EYE_HEIGHT=1.65,WALK_SPEED=2.2;
  const SPAWN={x:0,z:3,yaw:-.9724,pitch:0};
  class Mesh {
    constructor(){this.data=[];this.faces=[];}
    tri(a,b,c,rgba,lit=true){
      const light=lit?.48+.50*Math.abs(dot(norm(cross(sub(b,a),sub(c,a))),[-.462, .770, .346])):1;
      const tint=rgba.map((v,i)=>i<3?v*light:v);for(const p of [a,b,c])this.data.push(...p,...tint,0,0);this.faces.push({p:[a,b,c],c:tint});
    }
    quad(a,b,c,d,rgba,lit=true){this.tri(a,b,c,rgba,lit);this.tri(a,c,d,rgba,lit);}
    box(x,y,z,w,h,d,hex){const a=x-w/2,b=x+w/2,c=z-d/2,e=z+d/2,t=y+h,tint=color(hex);this.quad([a,y,c],[b,y,c],[b,t,c],[a,t,c],tint);this.quad([b,y,e],[a,y,e],[a,t,e],[b,t,e],tint);this.quad([a,y,e],[a,y,c],[a,t,c],[a,t,e],tint);this.quad([b,y,c],[b,y,e],[b,t,e],[b,t,c],tint);this.quad([a,t,c],[b,t,c],[b,t,e],[a,t,e],tint);this.quad([a,y,e],[b,y,e],[b,y,c],[a,y,c],tint);}
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
    // Human-scale architecture surrounds the local player. The floor is not a
    // floating model or overview board; walls, beams and stations share meters.
    m.box(0,-.18,0,14.4,.18,20.4,'#15202a');
    m.box(0,-.01,0,13.92,.025,19.92,'#18252f');
    for(let x=-6;x<=6;x+=2)m.box(x,.018,0,.015,.006,19.7,'#31414c');
    for(let z=-9;z<=9;z+=2)m.box(0,.019,z,13.7,.006,.015,'#31414c');
    // Unobstructed centre aisle, narrow red edge guides and floor lights.
    for(const x of [-1.5,1.5]){m.box(x,.026,0,.026,.008,18.2,'#71323f');for(let z=-8;z<=8;z+=2)m.box(x,.033,z,.04,.009,.35,'#b66b72');}
    for(const x of [-7.1,7.1]){
      m.box(x,0,0,.2,ROOM.height,20.4,'#1a2a36');
      m.box(x-Math.sign(x)*.12,.12,0,.035,.19,20,'#4b6370');
      m.box(x-Math.sign(x)*.12,3.9,0,.04,.12,20,'#506b78');
      for(const z of [-8,-3,2,7]){m.box(x-Math.sign(x)*.18,0,z,.18,ROOM.height,.18,'#354c5a');m.box(x-Math.sign(x)*.29,2.7,z,.035,.62,.035,'#b35c6e');}
    }
    m.box(0,0,10.1,14.4,ROOM.height,.2,'#20313c');
    // A readable aft doorway, without implying an unimplemented destination.
    m.box(0,0,9.95,2.4,2.8,.12,'#0b141d');m.box(-1.25,0,9.82,.14,3,.16,'#627987');m.box(1.25,0,9.82,.14,3,.16,'#627987');m.box(0,2.9,9.82,2.65,.14,.16,'#904354');
    // Forward observation wall: glass covers the whole room end. Fixed stars
    // are decorative architecture, never live telemetry or another world.
    m.box(0,0,-10.1,14.4,.55,.2,'#2a3b48');m.box(0,4.25,-10.1,14.4,.55,.2,'#2a3b48');
    m.quad([-7,.55,-10],[7,.55,-10],[7,4.25,-10],[-7,4.25,-10],color('#071b2a'),false);
    for(const x of [-6.9,-3.5,0,3.5,6.9])m.box(x,.5,-9.91,.09,3.8,.14,'#4b6877');
    for(let n=0;n<86;n++){const x=Math.sin(n*23.7)*6.8,y=.7+(Math.sin(n*7.1)+1)*1.65,r=n%7===0?.014:.006;m.quad([x-r,y-r,-9.98],[x+r,y-r,-9.98],[x+r,y+r,-9.98],[x-r,y+r,-9.98],color(n%5?'#799caa':'#d2e8ec',1,n%3?.6:1),false);}
    // Ceiling frame and recessed light bands maintain scale while looking up.
    m.box(0,4.8,0,14.4,.12,20.4,'#111e28');
    for(const x of [-5.9,-2.2,2.2,5.9])m.box(x,4.65,0,.11,.11,19.8,'#3a5260');
    for(const z of [-7.5,-2.5,2.5,7.5]){m.box(0,4.49,z,14,.18,.15,'#2d4251');m.box(0,4.47,z,5.5,.022,.1,'#9bbac5');}
    for(const {spec,x,z} of STATIONS){
      // Person-height work alcoves with original creature art hovering above a
      // console. These six solid consoles are also the navigation colliders.
      m.shadow(x,.03,z,1.35);m.platform(x,.02,z,2.6,.12,2.6,.32,'#30434f');
      m.platform(x,.14,z,2.35,.64,2.25,.22,'#243744');m.platform(x,.78,z,2.5,.12,2.4,.24,'#465b67');
      m.platform(x,.9,z,2.32,.035,2.18,.21,'#12232e');
      m.ring(x,.94,z+.08,.8,spec.color,.026,.7);
      m.platform(x,.94,z-.82,1.85,.3,.42,.16,'#2b4657');m.box(x,1.24,z-.82,1.68,.025,.32,'#081b27');
      m.box(x-.46,1.27,z-.82,.46,.012,.024,spec.color);m.box(x+.3,1.27,z-.82,.65,.012,.016,'#7598a9');
      m.box(x,.25,z+1.14,.8,.055,.028,spec.color);
      // Colour is a restrained identity locator, not a claim of current work.
      m.box(x-Math.sign(x)*1.19,.25,z,.035,.42,1.1,spec.color);
    }
    return m;
  }
  function buildCompatibilityRoom(){const m=new Mesh();m.box(0,-.12,0,14.4,.12,20.4,'#18252f');m.box(0,4.8,0,14.4,.12,20.4,'#111e28');for(const x of [-7.1,7.1])m.box(x,0,0,.2,4.8,20.4,'#1a2a36');m.box(0,0,10.1,14.4,4.8,.2,'#20313c');m.box(0,0,-10.1,14.4,4.8,.2,'#071b2a');for(const x of [-1.5,1.5])m.box(x,.015,0,.035,.01,18.2,'#71323f');for(const z of [-7.5,-2.5,2.5,7.5])m.box(0,4.49,z,14,.18,.15,'#506b78');for(const {spec,x,z} of STATIONS){m.box(x,.02,z,2.6,.76,2.6,'#243744');m.box(x,.78,z,2.5,.15,2.4,'#465b67');m.box(x,.94,z-.82,1.85,.3,.42,'#2b4657');m.box(x,.25,z+1.31,.8,.05,.025,spec.color);m.box(x-Math.sign(x)*1.31,.25,z,.025,.42,1.1,spec.color);}return m;}
  class Environment {
    constructor(canvas,{select,zoomChanged,onFrame,onTarget}={}){
      Object.assign(this,{canvas,select,zoomChanged,onFrame,onTarget,width:1,height:1,dpr:1,dprLimit:2,fps:60,zoom:1,pan:{x:0,y:0},yaw:SPAWN.yaw,pitch:SPAWN.pitch,rows:new Map(),actors:new Map(),selected:'atlas',active:false,live:false,motion:true,frame:0,dirty:false,clock:0,previous:0,lastDraw:0,pointers:new Map(),hits:[],sprites:new Map(),textures:new Map(),lost:false,destroyed:false});
      this.focused=null;this.player={x:SPAWN.x,z:SPAWN.z,eyeHeight:EYE_HEIGHT,radius:PLAYER_RADIUS};this.movement={x:0,z:0};this.keys=new Set();this.target=null;this.targetSignature='';this.fov=1.22;
      this.performance={draws:0,resizes:0,drawMs:[],frameMs:[],meshBuilds:1};this.mesh=buildShip();
      try{this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:false});if(this.gl)this.initGL();}catch{
        // A failed GPU initialization must not abort the app's communication UI.
        try{this.gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch{}
        const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);this.canvas=canvas=replacement;this.gl=null;
      }
      if(!this.gl){this.ctx=canvas.getContext('2d',{alpha:false});this.dprLimit=1.25;this.fps=15;this.softwareMesh=buildCompatibilityRoom();}
      const stage=canvas.parentElement;
      this.labels=document.createElement('div');this.labels.className='spatial-labels';this.labels.setAttribute('aria-hidden','true');stage.append(this.labels);this.labelNodes=new Map();
      for(const spec of SPECS){const el=document.createElement('span');el.className='spatial-label';el.textContent=spec.name;el.style.setProperty('--agent',spec.color);this.labels.append(el);this.labelNodes.set(spec.id,el);}
      this.notice=document.createElement('p');this.notice.className='spatial-render-note';this.notice.textContent=this.gl?'':'Perspective compatibility renderer';stage.append(this.notice);
      this.bindInput();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);
      this.onVisibility=()=>{this.stopFrame();if(document.hidden){this.keys.clear();this.movement={x:0,z:0};}else{this.requestDraw();this.schedule();}};document.addEventListener('visibilitychange',this.onVisibility);
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
      c.addEventListener('pointerdown',e=>{if(!this.active||e.button>0)return;c.setPointerCapture?.(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,multi:this.pointers.size>0});if(this.pointers.size>1)for(const p of this.pointers.values())p.multi=true;});
      c.addEventListener('pointermove',e=>{const p=this.pointers.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;if(this.pointers.size===1)this.look(dx,dy);});
      c.addEventListener('pointerup',e=>{const p=this.pointers.get(e.pointerId);this.pointers.delete(e.pointerId);if(!p||p.multi||Math.hypot(e.clientX-p.sx,e.clientY-p.sy)>8)return;const r=c.getBoundingClientRect(),hit=this.pick(e.clientX-r.left,e.clientY-r.top);if(hit)this.select?.(hit.id);});
      const cancel=e=>this.pointers.delete(e.pointerId);c.addEventListener('pointercancel',cancel);c.addEventListener('lostpointercapture',cancel);
      // Keyboard navigation belongs only to the visible world, never a draft or
      // dialog. Held keys and touch movement share the same collision path.
      this.onKeyDown=e=>{if(!this.active||e.altKey||e.ctrlKey||e.metaKey||document.querySelector('dialog[open]')||e.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;const key=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){this.keys.add(key);e.preventDefault();this.requestDraw();}else if(key==='home'){e.preventDefault();this.resetPlayer();}};
      this.onKeyUp=e=>{if(this.keys.delete(e.key.toLowerCase())){e.preventDefault();this.requestDraw();}};
      this.onBlur=()=>{this.keys.clear();this.setMovement(0,0);this.pointers.clear();};
      window.addEventListener('keydown',this.onKeyDown);window.addEventListener('keyup',this.onKeyUp);window.addEventListener('blur',this.onBlur);
    }
    pointerDistance(){const [a,b]=this.pointers.values();return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;}
    setMovement(strafe,forward){const x=Number.isFinite(strafe)?clamp(strafe,-1,1):0,z=Number.isFinite(forward)?clamp(forward,-1,1):0,n=Math.max(1,Math.hypot(x,z));this.movement={x:x/n,z:z/n};if(x||z)this.requestDraw();}
    stopMovement(){this.keys.clear();this.movement={x:0,z:0};this.requestDraw();}
    movementVector(){if(document.hidden||document.querySelector?.('dialog[open]'))return {x:0,z:0};const x=this.movement.x+(this.keys.has('d')||this.keys.has('arrowright')?1:0)-(this.keys.has('a')||this.keys.has('arrowleft')?1:0),z=this.movement.z+(this.keys.has('w')||this.keys.has('arrowup')?1:0)-(this.keys.has('s')||this.keys.has('arrowdown')?1:0),n=Math.max(1,Math.hypot(x,z));return {x:x/n,z:z/n};}
    look(dx,dy){if(!Number.isFinite(dx)||!Number.isFinite(dy))return;this.yaw=(this.yaw+dx*.0035+Math.PI*3)%(Math.PI*2)-Math.PI;this.pitch=clamp(this.pitch-dy*.003,-1.15,1.15);this.focused=null;this.requestDraw();}
    canStand(x,z){if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>ROOM.halfWidth-PLAYER_RADIUS-.08||Math.abs(z)>ROOM.halfDepth-PLAYER_RADIUS-.08)return false;for(const station of STATIONS){const nx=clamp(x,station.x-1.3,station.x+1.3),nz=clamp(z,station.z-1.3,station.z+1.3);if(Math.hypot(x-nx,z-nz)<PLAYER_RADIUS)return false;}return true;}
    movePlayer(dt){const move=this.movementVector();if(!move.x&&!move.z)return;const distance=WALK_SPEED*Math.min(.08,Math.max(0,dt)),dx=(Math.cos(this.yaw)*move.x+Math.sin(this.yaw)*move.z)*distance,dz=(Math.sin(this.yaw)*move.x-Math.cos(this.yaw)*move.z)*distance;
      // Small bounded steps and independent axes provide wall sliding, without
      // teleporting through station corners after a long suspended frame.
      const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));for(let i=0;i<steps;i++){if(this.canStand(this.player.x+dx/steps,this.player.z))this.player.x+=dx/steps;if(this.canStand(this.player.x,this.player.z+dz/steps))this.player.z+=dz/steps;}}
    resetPlayer(){this.player.x=SPAWN.x;this.player.z=SPAWN.z;this.yaw=SPAWN.yaw;this.pitch=SPAWN.pitch;this.focused=null;this.zoom=1;this.keys.clear();this.movement={x:0,z:0};this.zoomChanged?.(100);this.requestDraw();}
    setZoom(value){if(!Number.isFinite(value))return;this.zoom=clamp(value,.85,1.35);this.zoomChanged?.(Math.round(this.zoom*100));this.requestDraw();}
    fit(){this.resetPlayer();}
    focus(id=this.selected){this.focusAgent(id);}
    focusAgent(id=this.selected){const index=SPECS.findIndex(s=>s.id===id);if(index<0)return false;const p=this.actorPosition(null,index),dx=p.x-this.player.x,dz=p.z-this.player.z;this.yaw=Math.atan2(dx,-dz);this.pitch=Math.atan2(p.y+ACTOR_HEIGHT*.5-EYE_HEIGHT,Math.hypot(dx,dz));this.focused=id;this.requestDraw();return true;}
    framingPoints(){return [[-ROOM.halfWidth,0,-ROOM.halfDepth],[ROOM.halfWidth,ROOM.height,ROOM.halfDepth],...STATIONS.flatMap(({x,z})=>[[x,.94,z],[x,.94+ACTOR_HEIGHT,z]])];}
    frameCamera(aspect){const eye=[this.player.x,EYE_HEIGHT,this.player.z],cp=Math.cos(this.pitch),forward=[Math.sin(this.yaw)*cp,Math.sin(this.pitch),-Math.cos(this.yaw)*cp],camera=cameraMatrix(eye,eye.map((v,i)=>v+forward[i]),aspect,this.fov/this.zoom);this.eye=eye;this.forward=forward;this.cameraRight=camera.right;this.cameraUp=camera.up;return {...camera,right:[Math.cos(this.yaw),0,Math.sin(this.yaw)],up:[0,1,0]};}
    pick(x=this.width/2,y=this.height/2){if(!this.vp||!this.eye)return null;const t=Math.tan(this.fov/this.zoom/2),nx=(x/this.width*2-1)*this.width/this.height*t,ny=(1-y/this.height*2)*t,ray=norm(this.forward.map((v,i)=>v+this.cameraRight[i]*nx+this.cameraUp[i]*ny)),normal=[Math.sin(this.yaw),0,-Math.cos(this.yaw)],den=dot(ray,normal);if(Math.abs(den)<.0001)return null;let best=null;
      for(const [i,s] of SPECS.entries()){const p=this.actorPosition(null,i),distance=dot(sub([p.x,p.y,p.z],this.eye),normal)/den;if(distance<.1||distance>24)continue;const hit=this.eye.map((v,j)=>v+ray[j]*distance),side=dot(sub(hit,[p.x,p.y,p.z]),this.right);if(Math.abs(side)>ACTOR_WIDTH*.43||hit[1]<p.y+.06||hit[1]>p.y+ACTOR_HEIGHT*.94)continue;if(!best||distance<best.distance)best={id:s.id,agent:s.id,distance,near:Math.hypot(p.x-this.player.x,p.z-this.player.z)<=3.5};}return best;}
    interactionTarget(){return this.target?{...this.target}:null;}
    getDebugState(){return this.diagnostics();}
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
    show(active){this.active=active===true;this.labels.hidden=!this.active;if(this.active){this.fitViewport();this.requestDraw();this.schedule();}else{this.stopFrame();this.pointers.clear();this.keys.clear();this.movement={x:0,z:0};}}
    stopFrame(){cancelAnimationFrame(this.frame);this.frame=0;this.previous=0;}
    requestDraw(invalidate=true){if(invalidate)this.dirty=true;if(!this.active||this.destroyed||this.lost||document.hidden||this.frame)return;this.frame=requestAnimationFrame(t=>{this.frame=0;this.tick(t);});}
    schedule(){const move=this.movementVector();if(move.x||move.z||this.live&&this.motion&&[...this.actors.values()].some(a=>a.observed&&a.status==='active'))this.requestDraw(false);}
    tick(t){if(!this.active||this.lost||document.hidden)return;const elapsed=this.previous?t-this.previous:0;if(t-this.lastDraw>=1000/this.fps-1){if(elapsed){this.performance.frameMs.push(elapsed);if(this.performance.frameMs.length>120)this.performance.frameMs.shift();}this.dirty=false;this.advance(Math.min(.08,elapsed/1000));this.previous=t;this.lastDraw=t;this.draw();}
      // A backing-store resize clears WebGL pixels. Retain its invalidation when
      // this RAF is inside the FPS interval, even if motion is reduced or every
      // actor is idle. Animation scheduling alone must never own required paint.
      if(this.dirty)this.requestDraw(false);this.schedule();}
    advance(dt){if(!this.active||document.hidden)return;this.movePlayer(dt);if(!this.live||!this.motion)return;this.clock+=dt;for(const a of this.actors.values())if(a.observed&&a.status==='active')a.clock+=dt;}
    scene(){return {perspective:true,firstPerson:true,W:ROOM.halfWidth*2,H:ROOM.halfDepth*2,scale:1,ox:0,oy:0};}
    actorPosition(s,i,a=this.actors.get(SPECS[i]?.id)){if(a?.frozen)return a.frozen;const station=STATIONS[i]||{x:0,z:0},phase=(a?.clock||0)*.42;return {x:station.x+(a?.status==='active'?Math.sin(phase)*.08:0),z:station.z+.12+(a?.status==='active'?Math.cos(phase)*.055:0),y:.94};}
    project(p){const m=this.vp,x=p[0],y=p[1],z=p[2],w=m[3]*x+m[7]*y+m[11]*z+m[15];return {x:(m[0]*x+m[4]*y+m[8]*z+m[12])/w*this.width/2+this.width/2,y:-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*this.height/2+this.height/2,depth:w,s:1/w};}
    point(s,x,z){return this.project([x,.2,z]);}
    draw(){if(!this.active||this.destroyed||this.lost||this.width<2)return;const started=performance.now(),camera=this.frameCamera(this.width/this.height);this.vp=camera.matrix;this.right=camera.right;this.up=camera.up;
      if(this.gl)this.drawGL();else this.drawSoftware();this.updateLabels();this.onFrame?.();this.performance.draws++;this.performance.drawMs.push(performance.now()-started);if(this.performance.drawMs.length>120)this.performance.drawMs.shift();}
    texture(spec){const g=this.gl;if(this.textures.has(spec.id))return this.textures.get(spec.id);const t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,this.actorSprite(spec));g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);this.textures.set(spec.id,t);return t;}
    drawGL(){const g=this.gl;g.viewport(0,0,this.canvas.width,this.canvas.height);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.disable(g.DEPTH_TEST);g.disable(g.BLEND);g.useProgram(this.backgroundProgram);g.bindBuffer(g.ARRAY_BUFFER,this.backgroundBuffer);g.enableVertexAttribArray(this.backgroundLocation);g.vertexAttribPointer(this.backgroundLocation,2,g.FLOAT,false,8,0);g.drawArrays(g.TRIANGLES,0,3);g.enable(g.DEPTH_TEST);g.enable(g.BLEND);g.useProgram(this.program);g.uniformMatrix4fv(this.locations.vp,false,this.vp);g.uniform1i(this.locations.textured,0);this.bindBuffer(this.staticBuffer);g.drawArrays(g.TRIANGLES,0,this.mesh.data.length/9);
      const ring=new Mesh(),i=SPECS.findIndex(s=>s.id===this.selected);if(i>=0){const p=this.actorPosition(null,i);ring.ring(p.x,.947,p.z,.8,SPECS[i].color,.035,.95);}
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
      // A small retained depth buffer replaces face-average painter sorting:
      // first-person floors and nearby walls cross the near plane and cannot
      // safely be ordered as whole polygons. Raster work is camera-bound only.
      const key=[this.width,this.height,this.dpr,...this.vp].join(':');
      if(this.softwareKey!==key){this.softwareKey=key;this.softwareCanvas??=document.createElement('canvas');const canvas=this.softwareCanvas,scale=Math.min(1,320/this.width,640/this.height);canvas.width=Math.max(1,Math.round(this.width*scale));canvas.height=Math.max(1,Math.round(this.height*scale));const out=canvas.getContext('2d',{alpha:false}),image=out.createImageData(canvas.width,canvas.height),pixels=image.data,depthBuffer=new Float32Array(canvas.width*canvas.height),sx=canvas.width/this.width,sy=canvas.height/this.height;
        for(let i=0;i<pixels.length;i+=4){pixels[i]=8;pixels[i+1]=17;pixels[i+2]=25;pixels[i+3]=255;}
        const depth=p=>this.vp[3]*p[0]+this.vp[7]*p[1]+this.vp[11]*p[2]+this.vp[15],clip=points=>{const result=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=depth(a),db=depth(b),insideA=da>=.065,insideB=db>=.065;if(insideA)result.push(a);if(insideA!==insideB){const t=(.065-da)/(db-da);result.push(a.map((v,j)=>mix(v,b[j],t)));}}return result;};
        const triangle=(a,b,d,tint)=>{const den=(b.y-d.y)*(a.x-d.x)+(d.x-b.x)*(a.y-d.y);if(Math.abs(den)<.0001)return;const left=Math.max(0,Math.floor(Math.min(a.x,b.x,d.x))),right=Math.min(canvas.width-1,Math.ceil(Math.max(a.x,b.x,d.x))),top=Math.max(0,Math.floor(Math.min(a.y,b.y,d.y))),bottom=Math.min(canvas.height-1,Math.ceil(Math.max(a.y,b.y,d.y))),rgb=tint.slice(0,3).map(v=>Math.round(clamp(v,0,1)*255)),alpha=tint[3];
          for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const px=x+.5,py=y+.5,u=((b.y-d.y)*(px-d.x)+(d.x-b.x)*(py-d.y))/den,v=((d.y-a.y)*(px-d.x)+(a.x-d.x)*(py-d.y))/den,w=1-u-v;if(u<-.0001||v<-.0001||w<-.0001)continue;const z=u/a.depth+v/b.depth+w/d.depth,index=y*canvas.width+x;if(z<depthBuffer[index])continue;depthBuffer[index]=z;const offset=index*4;for(let channel=0;channel<3;channel++)pixels[offset+channel]=rgb[channel]*alpha+pixels[offset+channel]*(1-alpha);}}
        for(const face of this.softwareMesh.faces){const points=clip(face.p).map(p=>{const q=this.project(p);return {...q,x:q.x*sx,y:q.y*sy};});for(let i=1;i+1<points.length;i++)triangle(points[0],points[i],points[i+1],face.c);}out.putImageData(image,0,0);
      }
      c.setTransform(1,0,0,1,0,0);c.imageSmoothingEnabled=true;c.drawImage(this.softwareCanvas,0,0,this.canvas.width,this.canvas.height);c.setTransform(this.dpr,0,0,this.dpr,0,0);
      const actors=SPECS.map((s,i)=>{const p=this.actorPosition(null,i);return {s,p,base:this.project([p.x,p.y,p.z]),top:this.project([p.x,p.y+ACTOR_HEIGHT,p.z])};}).sort((a,b)=>b.base.depth-a.base.depth);
      for(const {s,base,top} of actors){if(base.depth<.1||top.depth<.1)continue;const h=base.y-top.y;if(h<=0)continue;c.globalAlpha=this.actors.get(s.id)?.observed?1:.48;c.drawImage(this.actorSprite(s),top.x-h*ACTOR_WIDTH/ACTOR_HEIGHT/2,top.y,h*ACTOR_WIDTH/ACTOR_HEIGHT,h);}c.globalAlpha=1;
    }
    updateLabels(){this.hits=[];for(const [i,s] of SPECS.entries()){const p=this.actorPosition(null,i),centre=this.project([p.x,p.y+ACTOR_HEIGHT*.5,p.z]),label=this.project([p.x,p.y+ACTOR_HEIGHT+.14,p.z]),el=this.labelNodes.get(s.id),distance=Math.hypot(p.x-this.player.x,p.z-this.player.z);const visible=label.depth>.15&&label.x>20&&label.x<this.width-20&&label.y>12&&label.y<this.height-12&&distance<19;el.hidden=!visible;el.classList.toggle('selected',s.id===this.selected);el.dataset.status=this.actors.get(s.id)?.status||'unknown';const transform=`translate(${label.x.toFixed(1)}px,${label.y.toFixed(1)}px)`;if(el.style.transform!==transform)el.style.transform=transform;if(centre.depth>.15)this.hits.push({id:s.id,x:centre.x,y:centre.y,w:Math.max(30,ACTOR_WIDTH*centre.s*this.height),h:Math.max(35,ACTOR_HEIGHT*centre.s*this.height),depth:centre.depth});}
      this.target=this.pick();const target=this.target?{...this.target,distance:Math.round(this.target.distance*10)/10}:null,signature=JSON.stringify(target);if(signature!==this.targetSignature){this.targetSignature=signature;this.onTarget?.(target||{agent:null,id:null,near:false,distance:null});}}
    projectedBounds(){const points=this.framingPoints().map(p=>this.project(p)).filter(p=>p.depth>.1);if(!points.length)return null;return {left:Math.min(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y)),labels:[...this.labelNodes.values()].filter(el=>!el.hidden).length};}
    diagnostics(){const p=(a)=>a.length?Math.round(a.slice().sort((a,b)=>a-b)[Math.floor((a.length-1)*.95)]*100)/100:null,nearby=STATIONS.map(station=>({agent:station.spec.id,distance:Math.round(Math.hypot(station.x-this.player.x,station.z-this.player.z)*10)/10})).sort((a,b)=>a.distance-b.distance).filter(agent=>agent.distance<=3.5);return {renderer:this.gl?'webgl-first-person':'canvas-first-person-fallback',mode:'first-person',active:this.active,live:this.live,motion:this.motion,contextLost:this.lost,targetFps:this.fps,width:this.width,height:this.height,dpr:this.dpr,zoom:this.zoom,focused:this.focused,projectedBounds:this.vp?this.projectedBounds():null,player:{x:this.player.x,z:this.player.z,eyeHeight:EYE_HEIGHT,radius:PLAYER_RADIUS,yaw:this.yaw,pitch:this.pitch,speed:WALK_SPEED,collision:this.canStand(this.player.x,this.player.z)?'clear':'blocked',movement:this.movementVector()},camera:{yaw:this.yaw,pitch:this.pitch,x:this.player.x,y:EYE_HEIGHT,z:this.player.z},room:{width:ROOM.halfWidth*2,depth:ROOM.halfDepth*2,height:ROOM.height},target:this.interactionTarget(),nearby,draws:this.performance.draws,pendingPaint:this.dirty,pendingFrame:!!this.frame,resizes:this.performance.resizes,meshBuilds:this.performance.meshBuilds,triangles:this.mesh.data.length/27,softwareTriangles:this.softwareMesh?this.softwareMesh.data.length/27:null,drawSamples:this.performance.drawMs.length,frameSamples:this.performance.frameMs.length,sampleLimit:120,drawCpuP95Ms:p(this.performance.drawMs),rafIntervalP95Ms:p(this.performance.frameMs),scope:'Local navigation and recent WebView CPU/RAF intervals; not agent travel, productive work, GPU presentation or native-chat frame timing'};}
    destroy(){this.show(false);this.destroyed=true;this.observer.disconnect();document.removeEventListener('visibilitychange',this.onVisibility);window.removeEventListener('keydown',this.onKeyDown);window.removeEventListener('keyup',this.onKeyUp);window.removeEventListener('blur',this.onBlur);this.labels.remove();this.notice.remove();const g=this.gl;if(g){for(const t of this.textures.values())g.deleteTexture(t);g.deleteBuffer(this.staticBuffer);g.deleteBuffer(this.dynamicBuffer);g.deleteBuffer(this.backgroundBuffer);g.deleteProgram(this.program);g.deleteProgram(this.backgroundProgram);}}
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
