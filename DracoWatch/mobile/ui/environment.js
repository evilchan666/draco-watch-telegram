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
    return {matrix:multiply(new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]),view),right:x};
  }
  const color=(hex,shade=1,alpha=1)=>{const n=parseInt(hex.slice(1,7),16);return [((n>>16)&255)/255*shade,((n>>8)&255)/255*shade,(n&255)/255*shade,alpha];};
  class Mesh {
    constructor(){this.data=[];this.faces=[];}
    tri(a,b,c,rgba){for(const p of [a,b,c])this.data.push(...p,...rgba,0,0);this.faces.push({p:[a,b,c],c:rgba});}
    quad(a,b,c,d,rgba){this.tri(a,b,c,rgba);this.tri(a,c,d,rgba);}
    box(x,y,z,w,h,d,hex){const a=x-w/2,b=x+w/2,c=z-d/2,e=z+d/2,t=y+h;
      this.quad([a,t,c],[b,t,c],[b,t,e],[a,t,e],color(hex,1.25));
      this.quad([a,y,e],[b,y,e],[b,t,e],[a,t,e],color(hex,.75));
      this.quad([a,y,c],[a,t,c],[b,t,c],[b,y,c],color(hex,.9));
      this.quad([a,y,c],[a,y,e],[a,t,e],[a,t,c],color(hex,.65));
      this.quad([b,y,c],[b,t,c],[b,t,e],[b,y,e],color(hex,1));}
    ring(x,y,z,r,hex,width=.025){for(let i=0;i<48;i++){const a=i*Math.PI/24,b=(i+1)*Math.PI/24;this.quad([x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],[x+Math.cos(b)*(r-width),y,z+Math.sin(b)*(r-width)],[x+Math.cos(a)*(r-width),y,z+Math.sin(a)*(r-width)],color(hex));}}
  }
  function buildShip(){
    const m=new Mesh(),outline=[[-2.6,-5.8],[2.6,-5.8],[3.8,-4.5],[3.8,4.5],[2.6,5.8],[-2.6,5.8],[-3.8,4.5],[-3.8,-4.5]];
    for(let i=0;i<8;i++){const a=outline[i],b=outline[(i+1)%8];m.tri([0,0,0],[a[0],0,a[1]],[b[0],0,b[1]],color('#20232c'));m.quad([a[0],-.34,a[1]],[b[0],-.34,b[1]],[b[0],0,b[1]],[a[0],0,a[1]],color('#3c424f'));}
    // Recessed walking lanes, six individual raised bays, central navigation well.
    for(let z=-5;z<6;z+=.65)m.box(0,.008,z,6.8,.012,.014,'#343945');
    for(const x of [-1.15,1.15])m.box(x,.016,0,.025,.014,10.2,'#9b243b');
    m.box(0,0,-5.2,5.3,.22,.95,'#343442');
    m.box(0,.24,-5.5,5.3,.24,.14,'#c32748');
    m.box(0,.55,-5.65,4.8,1.0,.12,'#112332');
    // Fixed star/window lights and recessed bay shadows, retained with the hull.
    for(let n=0;n<22;n++){const x=Math.sin(n*23.7)*2.2,y=.66+(Math.sin(n*7.1)+1)*.39;m.box(x,y,-5.574,.012+(n%3)*.009,.018,.008,n%3?'#647c92':'#c8dfeb');}
    for(const x of [-1.6,0,1.6])m.box(x,.55,-5.55,.05,1.0,.06,'#778797');
    for(const x of [-3.68,3.68]){
      m.box(x,0,0,.17,.24,9.3,'#5a505a');m.box(x,.25,0,.03,.04,9.3,'#ec455d');
      for(const z of [-4.5,-1.5,1.5,4.5]){m.box(x,.3,z,.22,1.25,.16,'#414452');m.box(x,.44,z,.24,.75,.025,'#9ba8b7');}
    }
    m.box(0,0,5.4,2.2,.14,.5,'#42404d');m.box(0,.15,5.5,1.7,.02,.05,'#ec455d');
    m.ring(0,.025,0,.82,'#693047',.045);m.box(0,0,0,.66,.55,.66,'#272b39');
    m.box(0,.55,0,.92,.04,.92,'#916c7b');m.ring(0,.61,0,.35,'#ec455d',.035);
    for(const [i,spec] of SPECS.entries()){
      const side=i%2?1:-1,z=-3.3+Math.floor(i/2)*3.25,x=side*2.25;
      m.box(x,.02,z,2.3,.12,2.65,'#2c303c');
      m.box(x,.143,z+.22,1.46,.008,1.42,'#181d28');
      m.box(x,.15,z-1.12,2.22,.025,.03,spec.color);
      // Solid pedestal, horizontal keyboard, raised emissive screen and docking capsule.
      m.box(side*1.85,.14,z-.64,1.1,.56,.53,'#394353');
      m.box(side*1.85,.7,z-.64,1.25,.06,.67,'#68737f');
      m.box(side*1.85,.78,z-.85,1.08,.5,.08,'#152839');
      m.box(side*1.85,.84,z-.796,.91,.34,.012,spec.color);
      for(let n=0;n<3;n++)m.box(side*1.85,.88+n*.08,z-.786,.68-n*.15,.015,.009,'#101c27');
      m.box(side*3.08,.14,z+.22,.54,.24,1.53,'#596478');
      m.box(side*3.08,.39,z+.22,.44,.18,1.32,'#22394d');
      m.box(side*3.08,.58,z+.22,.38,.014,1.15,spec.color);
      m.ring(side*1.95,.15,z+.38,.43,spec.color,.018);
    }
    return m;
  }
  class Environment {
    constructor(canvas,{select,zoomChanged,onFrame}={}){
      Object.assign(this,{canvas,select,zoomChanged,onFrame,width:1,height:1,dpr:1,dprLimit:2,fps:60,zoom:1,pan:{x:0,y:0},yaw:-.38,pitch:.88,rows:new Map(),actors:new Map(),selected:'atlas',active:false,live:false,motion:true,frame:0,clock:0,previous:0,lastDraw:0,pointers:new Map(),hits:[],sprites:new Map(),textures:new Map(),lost:false,destroyed:false});
      this.performance={draws:0,resizes:0,drawMs:[],frameMs:[],meshBuilds:1};this.mesh=buildShip();
      try{this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:false});if(this.gl)this.initGL();}catch{
        // A failed GPU initialization must not abort the app's communication UI.
        try{this.gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch{}
        const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);this.canvas=canvas=replacement;this.gl=null;
      }
      if(!this.gl)this.ctx=canvas.getContext('2d',{alpha:false});
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
        if(this.pointers.size>1){const d=this.pointerDistance();if(this.pinch)this.setZoom(this.zoom*d/this.pinch);this.pinch=d;this.pan.x=clamp(this.pan.x-dx*.012/this.zoom,-4,4);this.pan.y=clamp(this.pan.y+dy*.012/this.zoom,-4,4);}
        else{this.yaw-=dx*.008;this.pitch=clamp(this.pitch+dy*.006,.32,1.4);}this.requestDraw();});
      c.addEventListener('pointerup',e=>{const p=this.pointers.get(e.pointerId);this.pointers.delete(e.pointerId);this.pinch=0;if(!p||p.multi||Math.hypot(e.clientX-p.sx,e.clientY-p.sy)>8)return;const r=c.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const hit=this.hits.filter(h=>Math.abs(x-h.x)<h.w/2&&Math.abs(y-h.y)<h.h/2).sort((a,b)=>a.depth-b.depth)[0];if(hit)this.select?.(hit.id);});
      const cancel=e=>{this.pointers.delete(e.pointerId);this.pinch=0;};c.addEventListener('pointercancel',cancel);c.addEventListener('lostpointercapture',cancel);
      c.addEventListener('wheel',e=>{e.preventDefault();this.setZoom(this.zoom*Math.exp(-e.deltaY*.0015));},{passive:false});
      c.addEventListener('keydown',e=>{if(e.key==='0')this.fit();else if(e.key==='+'||e.key==='=')this.setZoom(this.zoom+.2);else if(e.key==='-')this.setZoom(this.zoom-.2);else if(e.key==='ArrowLeft')this.yaw-=.15;else if(e.key==='ArrowRight')this.yaw+=.15;else if(e.key==='ArrowUp')this.pitch=clamp(this.pitch+.1,.32,1.4);else if(e.key==='ArrowDown')this.pitch=clamp(this.pitch-.1,.32,1.4);else return;e.preventDefault();this.requestDraw();});
    }
    pointerDistance(){const [a,b]=this.pointers.values();return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;}
    setZoom(v){if(!Number.isFinite(v))return;this.zoom=clamp(v,.7,3);this.zoomChanged?.(Math.round(this.zoom*100));this.requestDraw();}
    fit(){this.yaw=-.38;this.pitch=.88;this.pan={x:0,y:0};this.setZoom(1);this.fitViewport();}
    focus(id=this.selected){const i=SPECS.findIndex(s=>s.id===id);if(i<0)return;const p=this.actorPosition(null,i,this.actors.get(id));this.pan={x:p.x,y:p.z};this.setZoom(1.8);}
    fitViewport(){
      const stage=this.canvas.parentElement;if(stage.closest('[hidden]'))return;
      const landscape=innerWidth>innerHeight*1.3,visible=window.visualViewport?.height||innerHeight;
      const nav=document.querySelector('.bottom-nav')?.getBoundingClientRect().height||76;document.documentElement.style.setProperty('--spatial-nav-height',nav+'px');const height=landscape?Math.max(180,visible-nav-65):clamp((visible-nav)*.47,250,440);
      if(stage.style.getPropertyValue('--environment-height')!==height+'px')stage.style.setProperty('--environment-height',height+'px');this.resize();
    }
    resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;const dpr=Math.min(this.dprLimit,devicePixelRatio||1),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(w===this.canvas.width&&h===this.canvas.height&&this.width===r.width&&this.height===r.height&&this.dpr===dpr)return;this.width=r.width;this.height=r.height;this.dpr=dpr;this.performance.resizes++;if(this.canvas.width!==w)this.canvas.width=w;if(this.canvas.height!==h)this.canvas.height=h;this.requestDraw();}
    quality(light){const limit=light?1.25:2,rate=light?30:60;if(limit===this.dprLimit&&rate===this.fps)return;this.dprLimit=limit;this.fps=rate;this.resize();}
    update(rows,live,selected,motion){this.rows=rows;this.live=live===true;this.selected=selected;this.motion=motion===true;
      for(const [i,s] of SPECS.entries()){const row=rows.get(s.id),status=this.live&&['active','idle','queued'].includes(row?.status)?row.status:'unknown';let a=this.actors.get(s.id);if(!a){a={clock:0,status,observed:status!=='unknown',sessionId:row?.sessionId};this.actors.set(s.id,a);}if(a.sessionId!==row?.sessionId){a.clock=0;a.sessionId=row?.sessionId;}if(status==='unknown'&&a.observed)a.frozen=this.actorPosition(null,i,a);if(status!=='unknown')a.frozen=null;a.status=status;a.observed=status!=='unknown';}
      this.requestDraw();this.schedule();}
    show(active){this.active=active===true;this.labels.hidden=!this.active;if(this.active){this.fitViewport();this.requestDraw();this.schedule();}else{this.stopFrame();this.pointers.clear();}}
    stopFrame(){cancelAnimationFrame(this.frame);this.frame=0;this.previous=0;}
    requestDraw(){if(!this.active||this.destroyed||this.lost||document.hidden||this.frame)return;this.frame=requestAnimationFrame(t=>{this.frame=0;this.tick(t);});}
    schedule(){if(this.live&&this.motion&&[...this.actors.values()].some(a=>a.observed&&a.status==='active'))this.requestDraw();}
    tick(t){if(!this.active||this.lost||document.hidden)return;const elapsed=this.previous?t-this.previous:0;if(t-this.lastDraw>=1000/this.fps-1){if(elapsed){this.performance.frameMs.push(elapsed);if(this.performance.frameMs.length>120)this.performance.frameMs.shift();}this.advance(Math.min(.08,elapsed/1000));this.previous=t;this.lastDraw=t;this.draw();}this.schedule();}
    advance(dt){if(!this.active||!this.live||!this.motion||document.hidden)return;this.clock+=dt;for(const a of this.actors.values())if(a.observed&&a.status==='active')a.clock+=dt;}
    scene(){return {perspective:true,W:7.6,H:11.6,scale:1,ox:0,oy:0};}
    actorPosition(s,i,a=this.actors.get(SPECS[i]?.id)){if(a?.frozen)return a.frozen;const x=(i%2?1:-1)*2.25,z=-3.3+Math.floor(i/2)*3.25;const phase=(a?.clock||0)*.25;return {x:x+(a?.status==='active'?Math.sin(phase)*.28:0),z:z+.24+(a?.status==='active'?Math.cos(phase)*.2:0),y:.17};}
    project(p){const m=this.vp,x=p[0],y=p[1],z=p[2],w=m[3]*x+m[7]*y+m[11]*z+m[15];return {x:(m[0]*x+m[4]*y+m[8]*z+m[12])/w*this.width/2+this.width/2,y:-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*this.height/2+this.height/2,depth:w,s:1/w};}
    point(s,x,z){return this.project([x,.2,z]);}
    draw(){if(!this.active||this.destroyed||this.lost||this.width<2)return;const started=performance.now(),aspect=this.width/this.height,distance=Math.max(14,10.9/aspect)/this.zoom,target=[this.pan.x,.2,this.pan.y];
      const eye=[target[0]+Math.sin(this.yaw)*Math.cos(this.pitch)*distance,target[1]+Math.sin(this.pitch)*distance,target[2]+Math.cos(this.yaw)*Math.cos(this.pitch)*distance];
      const camera=cameraMatrix(eye,target,aspect);this.vp=camera.matrix;this.right=camera.right;
      if(this.gl)this.drawGL();else this.drawSoftware();this.updateLabels();this.onFrame?.();this.performance.draws++;this.performance.drawMs.push(performance.now()-started);if(this.performance.drawMs.length>120)this.performance.drawMs.shift();}
    texture(spec){const g=this.gl;if(this.textures.has(spec.id))return this.textures.get(spec.id);const t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,this.actorSprite(spec));g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);this.textures.set(spec.id,t);return t;}
    drawGL(){const g=this.gl;g.viewport(0,0,this.canvas.width,this.canvas.height);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.useProgram(this.program);g.uniformMatrix4fv(this.locations.vp,false,this.vp);g.uniform1i(this.locations.textured,0);this.bindBuffer(this.staticBuffer);g.drawArrays(g.TRIANGLES,0,this.mesh.data.length/9);
      const ring=new Mesh(),i=SPECS.findIndex(s=>s.id===this.selected);if(i>=0){const p=this.actorPosition(null,i);ring.ring(p.x,.175,p.z,.58,SPECS[i].color,.045);}
      this.bindBuffer(this.dynamicBuffer);g.bufferSubData(g.ARRAY_BUFFER,0,new Float32Array(ring.data));g.drawArrays(g.TRIANGLES,0,ring.data.length/9);
      // Transparent billboards depth-tested against actual consoles and floor.
      const actors=SPECS.map((s,i)=>({s,i,p:this.actorPosition(null,i)})).sort((a,b)=>this.project([b.p.x,.5,b.p.z]).depth-this.project([a.p.x,.5,a.p.z]).depth);
      g.depthMask(false);g.uniform1i(this.locations.textured,1);
      for(const {s,p} of actors){const a=this.actors.get(s.id),r=this.right.map(v=>v*.62),rgba=[1,1,1,a?.observed?1:.48],bottom=[p.x,p.y,p.z],top=[p.x,p.y+1.24,p.z],vertices=[];
        const v=(p,sign,u,v)=>vertices.push(p[0]+r[0]*sign,p[1]+r[1]*sign,p[2]+r[2]*sign,...rgba,u,v);
        v(bottom,-1,0,0);v(bottom,1,1,0);v(top,1,1,1);v(bottom,-1,0,0);v(top,1,1,1);v(top,-1,0,1);
        g.bindTexture(g.TEXTURE_2D,this.texture(s));g.bufferSubData(g.ARRAY_BUFFER,0,new Float32Array(vertices));g.drawArrays(g.TRIANGLES,0,6);}
      g.depthMask(true);}
    drawSoftware(){const c=this.ctx;if(!c)return;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#06060a';c.fillRect(0,0,this.width,this.height);
      const commands=this.mesh.faces.map(f=>({points:f.p.map(p=>this.project(p)),c:f.c}));
      for(const [i,s] of SPECS.entries()){const p=this.actorPosition(null,i),base=this.project([p.x,p.y,p.z]),top=this.project([p.x,p.y+1.24,p.z]);commands.push({sprite:this.actorSprite(s),base,top,depth:base.depth,observed:this.actors.get(s.id)?.observed});}
      commands.forEach(o=>o.depth??=o.points.reduce((s,p)=>s+p.depth,0)/3);commands.sort((a,b)=>b.depth-a.depth);
      for(const o of commands){if(o.depth<.1||o.points?.some(p=>p.depth<.1))continue;if(o.sprite){const h=o.base.y-o.top.y;c.globalAlpha=o.observed?1:.48;c.drawImage(o.sprite,o.top.x-h/2,o.top.y,h,h);c.globalAlpha=1;}else polygon(c,o.points.map(p=>[p.x,p.y]),`rgb(${o.c.slice(0,3).map(v=>Math.round(clamp(v,0,1)*255)).join(',')})`);}}
    updateLabels(){this.hits=[];for(const [i,s] of SPECS.entries()){const p=this.actorPosition(null,i),a=this.project([p.x,p.y+.6,p.z]),label=this.project([(i%2?1:-1)*2.25,.18,-3.3+Math.floor(i/2)*3.25+1.02]),el=this.labelNodes.get(s.id);const visible=label.depth>0&&label.x>0&&label.x<this.width&&label.y>0&&label.y<this.height;el.hidden=!visible;el.classList.toggle('selected',s.id===this.selected);el.dataset.status=this.actors.get(s.id)?.status||'unknown';el.style.transform=`translate(${label.x.toFixed(1)}px,${label.y.toFixed(1)}px)`;this.hits.push({id:s.id,x:a.x,y:a.y,w:Math.max(44,90*a.s),h:Math.max(50,130*a.s),depth:a.depth},{id:s.id,x:label.x,y:label.y,w:78,h:30,depth:label.depth});const station=this.project([(i%2?1:-1)*1.85,.75,-3.3+Math.floor(i/2)*3.25-.7]);this.hits.push({id:s.id,x:station.x,y:station.y,w:Math.max(44,650*station.s),h:44,depth:station.depth});}}
    diagnostics(){const p=(a)=>a.length?Math.round(a.slice().sort((a,b)=>a-b)[Math.floor((a.length-1)*.95)]*100)/100:null;return {renderer:this.gl?'webgl-perspective':'canvas-perspective-fallback',active:this.active,live:this.live,motion:this.motion,contextLost:this.lost,targetFps:this.fps,width:this.width,height:this.height,dpr:this.dpr,zoom:this.zoom,camera:{yaw:this.yaw,pitch:this.pitch,x:this.pan.x,z:this.pan.y},draws:this.performance.draws,resizes:this.performance.resizes,meshBuilds:this.performance.meshBuilds,triangles:this.mesh.data.length/27,drawSamples:this.performance.drawMs.length,frameSamples:this.performance.frameMs.length,sampleLimit:120,drawCpuP95Ms:p(this.performance.drawMs),rafIntervalP95Ms:p(this.performance.frameMs),scope:'Recent WebView CPU and RAF intervals, not GPU presentation or native-chat frame timing'};}
    destroy(){this.show(false);this.destroyed=true;this.observer.disconnect();document.removeEventListener('visibilitychange',this.onVisibility);this.labels.remove();this.notice.remove();const g=this.gl;if(g){for(const t of this.textures.values())g.deleteTexture(t);g.deleteBuffer(this.staticBuffer);g.deleteBuffer(this.dynamicBuffer);g.deleteProgram(this.program);}}
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
