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
    tri(a,b,c,rgba,lit=true,normals=null){
      const normal=lit?norm(cross(sub(b,a),sub(c,a))):[0,0,0];for(const [i,p] of [a,b,c].entries())this.data.push(...p,...rgba,0,0,...(normals?.[i]||normal));this.faces.push({p:[a,b,c],c:rgba.map((v,i)=>i<3?v*(lit?.48+.5*Math.abs(dot(normal,[-.462,.770,.346])):1):v)});
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
    // These primitives have real thickness. Agent geometry is retained once per
    // identity; navigation changes only model/view matrices, never a sprite.
    ellipsoid(x,y,z,rx,ry,rz,hex,slices=18,bands=12){
      const at=(u,v)=>[x+Math.sin(v)*Math.cos(u)*rx,y+Math.cos(v)*ry,z+Math.sin(v)*Math.sin(u)*rz],normal=p=>norm([(p[0]-x)/(rx*rx),(p[1]-y)/(ry*ry),(p[2]-z)/(rz*rz)]),rgba=color(hex);
      for(let j=0;j<bands;j++)for(let i=0;i<slices;i++){const u=i*2*Math.PI/slices,v=j*Math.PI/bands,a=at(u,v),b=at(u+2*Math.PI/slices,v),c=at(u+2*Math.PI/slices,v+Math.PI/bands),d=at(u,v+Math.PI/bands);this.tri(a,b,c,rgba,true,[normal(a),normal(b),normal(c)]);this.tri(a,c,d,rgba,true,[normal(a),normal(c),normal(d)]);}
    }
    // Extruded silhouette in the XY plane, front at positive Z.
    extrude(points,z,depth,hex,front=hex){const tint=color(hex),face=color(front),cx=points.reduce((n,p)=>n+p[0],0)/points.length,cy=points.reduce((n,p)=>n+p[1],0)/points.length;
      for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];this.tri([cx,cy,z+depth/2],[a[0],a[1],z+depth/2],[b[0],b[1],z+depth/2],face);this.tri([cx,cy,z-depth/2],[b[0],b[1],z-depth/2],[a[0],a[1],z-depth/2],tint);this.quad([a[0],a[1],z-depth/2],[b[0],b[1],z-depth/2],[b[0],b[1],z+depth/2],[a[0],a[1],z+depth/2],tint);}
    }
    tube(a,b,r,hex,segments=8){const axis=norm(sub(b,a)),u=norm(cross(axis,Math.abs(axis[1])<.9?[0,1,0]:[1,0,0])),v=cross(axis,u),at=(p,t)=>p.map((n,i)=>n+r*(u[i]*Math.cos(t)+v[i]*Math.sin(t)));
      for(let i=0;i<segments;i++){const t=i*2*Math.PI/segments,n=(i+1)*2*Math.PI/segments;this.quad(at(a,t),at(b,t),at(b,n),at(a,n),color(hex));this.tri(a,at(a,n),at(a,t),color(hex));this.tri(b,at(b,t),at(b,n),color(hex));}
    }
    torus(x,y,z,r,tube,hex,tilt=0,segments=36,sides=6){const c=Math.cos(tilt),s=Math.sin(tilt),at=(u,v)=>{const px=(r+Math.cos(v)*tube)*Math.cos(u),py=(r+Math.cos(v)*tube)*Math.sin(u),pz=Math.sin(v)*tube;return [x+px,y+py*c-pz*s,z+py*s+pz*c];},normal=(u,v)=>[Math.cos(v)*Math.cos(u),Math.cos(v)*Math.sin(u)*c-Math.sin(v)*s,Math.cos(v)*Math.sin(u)*s+Math.sin(v)*c],rgba=color(hex);
      for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const u=i*2*Math.PI/segments,v=j*2*Math.PI/sides,du=2*Math.PI/segments,dv=2*Math.PI/sides,a=at(u,v),b=at(u+du,v),c=at(u+du,v+dv),d=at(u,v+dv),na=normal(u,v),nb=normal(u+du,v),nc=normal(u+du,v+dv),nd=normal(u,v+dv);this.tri(a,b,c,rgba,true,[na,nb,nc]);this.tri(a,c,d,rgba,true,[na,nc,nd]);}
    }
    gem(x,y,z,w,h,d,hex){const belt=[[x-w,y,z],[x,y,z+d],[x+w,y,z],[x,y,z-d]];for(let i=0;i<4;i++){const a=belt[i],b=belt[(i+1)%4];this.tri([x,y+h,z],a,b,color(hex,i%2?1:.76));this.tri([x,y-h,z],b,a,color(hex,i%2?.64:.9));}}
    shadow(x,y,z,r){for(let i=0;i<5;i++)this.disk(x,y+i*.001,z,r*(1-i*.13),'#01060b',.035+i*.018);}
  }
  function buildShip(){
    const m=new Mesh();
    // A continuous human-scale interior rather than six objects on a neon tray.
    // The circulation lane, sight lines and original solid console colliders stay
    // unchanged. Fine seams are quiet; daylight and task bays provide depth.
    m.box(0,-.18,0,14.4,.18,20.4,'#121b24');
    m.box(0,-.01,0,13.92,.025,19.92,'#273541');
    for(let z=-8;z<=8;z+=4)m.box(0,.018,z,13.8,.004,.016,'#17252f');
    for(const x of [-1.6,1.6]){m.box(x,.019,0,.024,.005,18.3,'#17252f');for(const z of [-7.5,-2.5,2.5,7.5])m.box(x,.024,z,.035,.006,.42,'#acbac0');}
    // A centre runner establishes forward travel without a glowing floor grid.
    m.box(0,.014,0,2.9,.009,18.4,'#1e2d38');
    for(const x of [-7.1,7.1]){
      m.box(x,0,0,.2,ROOM.height,20.4,'#263845');
      m.box(x-Math.sign(x)*.13,.08,0,.04,.2,20,'#506572');
      m.box(x-Math.sign(x)*.12,3.95,0,.05,.12,20,'#536e7e');
      for(const z of [-8,-3,2,7]){
        m.box(x-Math.sign(x)*.2,0,z,.24,ROOM.height,.22,'#607784');
        m.box(x-Math.sign(x)*.33,2.0,z,.028,.95,.09,'#d3e1df');
      }
      // Recessed upper panels are opaque architectural material, not status.
      for(const z of [-5,0,5]){m.box(x-Math.sign(x)*.14,1.14,z,.055,2.45,4.45,'#1a2d3b');m.box(x-Math.sign(x)*.19,3.50,z,.05,.035,3.9,'#91b4c6');}
    }
    m.box(0,0,10.1,14.4,ROOM.height,.2,'#253946');
    m.box(0,0,9.95,2.4,2.8,.12,'#101c27');m.box(-1.25,0,9.82,.14,3,.16,'#68828e');m.box(1.25,0,9.82,.14,3,.16,'#68828e');m.box(0,2.9,9.82,2.65,.14,.16,'#ad5762');
    m.box(0,0,-10.1,14.4,.55,.2,'#344c5b');m.box(0,4.25,-10.1,14.4,.55,.2,'#344c5b');
    m.quad([-7,.55,-10],[7,.55,-10],[7,4.25,-10],[-7,4.25,-10],color('#122b3d'),false);
    // A restrained horizon makes the observation wall spatially legible. It is
    // decorative, never a simulated live external world or a destination.
    m.quad([-7,.55,-9.995],[7,.55,-9.995],[7,1.15,-9.995],[-7,1.15,-9.995],color('#345365'),false);
    m.quad([-7,1.15,-9.994],[7,1.15,-9.994],[7,1.18,-9.994],[-7,1.18,-9.994],color('#8ba8b5'),false);
    for(const x of [-6.9,-3.5,0,3.5,6.9])m.box(x,.5,-9.91,.09,3.8,.14,'#6c8997');
    for(let n=0;n<56;n++){const x=Math.sin(n*23.7)*6.8,y=1.4+(Math.sin(n*7.1)+1)*1.25,r=n%7===0?.012:.005;m.quad([x-r,y-r,-9.98],[x+r,y-r,-9.98],[x+r,y+r,-9.98],[x-r,y+r,-9.98],color(n%5?'#799caa':'#d2e8ec',1,n%3?.6:1),false);}
    m.box(0,4.8,0,14.4,.12,20.4,'#1b2a35');
    for(const x of [-5.9,5.9])m.box(x,4.65,0,.12,.12,19.8,'#72828b');
    for(const z of [-7.5,-2.5,2.5,7.5]){m.box(0,4.49,z,14,.18,.18,'#455c6b');m.box(0,4.465,z,4.8,.026,.11,'#c5d7db');}
    for(const {spec,x,z} of STATIONS){
      // Sculpted graphite bases and open work surfaces replace thick neon slabs.
      // Footprints deliberately retain the existing collision contract.
      m.shadow(x,.03,z,1.33);m.platform(x,.02,z,2.6,.12,2.6,.32,'#1b2b36');
      m.platform(x,.14,z,2.18,.59,2.1,.22,'#203340');m.platform(x,.73,z,2.5,.10,2.4,.24,'#6a8089');
      m.platform(x,.83,z,2.32,.105,2.18,.21,'#233c49');
      m.disk(x,.942,z+.08,.70,'#101f29',1,40);m.ring(x,.945,z+.08,.72,'#8ba0aa',.018,1);
      m.ring(x,.948,z+.08,.69,spec.color,.018,.68,-.45,1.15);
      m.platform(x,.94,z-.82,1.75,.18,.38,.12,'#314b5b');m.box(x,1.12,z-.82,1.58,.024,.28,'#0b1e2b');
      m.box(x-.46,1.146,z-.82,.38,.008,.018,spec.color);m.box(x+.3,1.146,z-.82,.60,.008,.014,'#7295a5');
      m.box(x,.25,z+1.065,.75,.045,.028,spec.color);
      // Locator accents are identity only, never an animated work assertion.
      m.box(x-Math.sign(x)*1.10,.40,z,.022,.045,.40,spec.color);
    }
    return m;
  }
  function buildActor(spec){
    const m=new Mesh(),silver='#a1b6c2',steel='#526b7b',dark='#162c3c',edge='#cfdee3',accent=spec.color;
    const shell=(x,y,z,rx,ry,rz,hex=steel)=>m.ellipsoid(x,y,z,rx,ry,rz,hex,18,12);
    const visor=(width=.36,y=.94,z=.31)=>{m.box(0,y,z,width,.075,.055,'#081b27');m.box(0,y+.006,z+.031,width*.74,.029,.012,accent);};
    const pods=()=>{for(const side of [-1,1]){shell(side*.35,.88,0,.13,.22,.17,silver);shell(side*.39,.88,.10,.055,.09,.06,dark);}};
    const core=()=>{shell(0,.88,0,.31,.44,.26,silver);shell(0,.9,.19,.245,.33,.13,dark);shell(0,.91,.28,.18,.25,.035,'#466474');visor();m.gem(0,.65,.302,.055,.068,.04,accent);};
    if(spec.kind==='orbital'){
      pods();core();m.torus(0,.91,0,.58,.036,silver,1.16,40,7);m.torus(0,.9,.03,.37,.018,accent,.2,36,6);
      for(const side of [-1,1]){shell(side*.56,.91,0,.06,.07,.07,edge);m.box(side*.56,.91,.062,.045,.024,.012,accent);}
      m.tube([0,1.28,-.01],[0,1.42,-.03],.025,silver);m.gem(0,1.43,-.03,.04,.05,.04,accent);
    }else if(spec.kind==='furnace'){
      const outline=[[-.30,.46],[.30,.46],[.38,.55],[.38,1.25],[.27,1.36],[-.27,1.36],[-.38,1.25],[-.38,.55]];
      m.extrude(outline,0,.48,steel,silver);m.extrude([[-.24,.61],[.24,.61],[.26,1.16],[.18,1.22],[-.18,1.22],[-.26,1.16]],.255,.035,dark,dark);
      m.extrude([[-.13,.70],[.13,.70],[.17,1.13],[-.17,1.13]],.282,.035,'#503b2d','#bc7045');
      m.gem(0,.89,.325,.10,.23,.045,accent);m.gem(.055,.91,.34,.045,.11,.025,'#f6c68a');
      for(const side of [-1,1]){m.box(side*.42,.70,0,.10,.5,.38,steel);for(let j=0;j<4;j++)m.box(side*.335,.72+j*.10,.268,.08,.033,.025,'#0d202c');m.tube([side*.28,.48,0],[side*.38,.39,0],.04,silver);}
      m.box(0,1.35,.02,.37,.055,.32,'#bdc3bd');m.box(0,.49,.26,.24,.035,.02,accent);
    }else if(spec.kind==='crystal'){
      // Six-facet double-ended solid: no rotating camera-facing diamond card.
      const ring=[];for(let i=0;i<6;i++){const t=i*Math.PI/3;ring.push([Math.cos(t)*.39,.91,Math.sin(t)*.30]);}
      for(let i=0;i<6;i++){const a=ring[i],b=ring[(i+1)%6];m.tri([0,1.58,0],a,b,color(i%2?'#c6cd89':'#e0e4b4'));m.tri([0,.27,0],b,a,color(i%2?'#647344':'#a3af6e'));}
      m.torus(0,.91,0,.47,.023,silver,Math.PI/2,36,6);m.torus(0,.91,0,.49,.012,accent,.33,32,5);
      for(const side of [-1,1])m.gem(side*.48,.91,0,.045,.09,.045,silver);
      m.gem(0,.91,.31,.055,.12,.025,'#f7fac8');
    }else if(spec.kind==='winged'||spec.kind==='architect'){
      // Layered extruded feathers curve in depth. Each wing is volumetric from
      // the aisle and side view, keeping the silver/ice identity's outline.
      for(const side of [-1,1])for(let j=0;j<4;j++){
        const x=.15+j*.035,y=.91-j*.105,tip=.72+j*.035,top=1.64-j*.115;
        m.extrude([[side*x,y],[side*(x+.12),y+.32],[side*tip,top],[side*(tip-.04),top-.27],[side*(x+.19),y-.02]],-.075-j*.07,.058,j%2?'#6f91a6':'#91afc0',j%2?'#adc9d7':'#d9e7ed');
        m.tube([side*(x+.07),y+.03,-.02-j*.07],[side*(tip-.06),top-.13,-.02-j*.07],.012,'#e0f1f6',5);
      }
      m.gem(0,.92,.045,.23,.50,.20,'#a9cddd');m.gem(0,.94,.23,.10,.22,.025,'#e2f3f8');
      m.torus(0,.93,0,.37,.017,silver,.03,36,6);m.torus(0,.93,0,.42,.013,'#ccdfeb',.65,32,5);
      m.gem(0,1.51,0,.045,.065,.04,edge);m.gem(0,.36,0,.045,.065,.04,edge);
    }else{
      pods();core();
      if(spec.kind==='mantis')for(const side of [-1,1]){
        m.extrude([[side*.12,1.13],[side*.36,1.36],[side*.55,1.70],[side*.52,1.32],[side*.30,.96]],-.02,.13,silver,steel);
        m.tube([side*.32,1.29,.065],[side*.48,1.52,.065],.018,accent,6);
        m.extrude([[side*.24,.73],[side*.43,.62],[side*.49,.42],[side*.36,.55]],0,.11,steel,silver);
      }
      if(spec.kind==='filament'){
        for(const side of [-1,1])for(let j=0;j<3;j++){
          const a=[side*(.10+j*.055),1.18,-.05],b=[side*(.23+j*.11),1.40-j*.035,-.06-j*.09],c=[side*(.25+j*.13),1.65-j*.10,-.12-j*.11];
          m.tube(a,b,.018,'#7c9e93',6);m.tube(b,c,.012,silver,6);shell(...c,.037,.044,.037,accent);
        }
        m.torus(0,.69,0,.49,.018,silver,1.30,36,6);
      }
    }
    // A lower keel and two locator points establish hovering body scale. Their
    // colour is identity, not fabricated productive activity.
    if(spec.kind!=='crystal'&&spec.kind!=='winged'&&spec.kind!=='architect'){m.gem(0,.40,0,.12,.10,.10,steel);for(const side of [-1,1])m.gem(side*.16,.45,.12,.035,.04,.025,accent);}
    m.faces.length=0;return m;
  }
  function buildLocalHand(side){
    const m=new Mesh(),arm='#263f4d',metal='#879ba5',rubber='#172c38';
    // Authored glove/forearm, not a weapon. The wrist and articulated knuckles
    // have volume under the same lighting as the room. Kept below the reticle.
    m.tube([side*.085,-.61,-.34],[0,-.405,-.60],.071,arm,10);
    m.tube([side*.02,-.432,-.57],[0,-.375,-.635],.077,metal,10);
    m.ellipsoid(0,-.355,-.66,.075,.036,.105,rubber,14,9);
    m.ellipsoid(0,-.325,-.652,.062,.012,.068,metal,12,7);m.ellipsoid(0,-.353,-.552,.058,.047,.012,metal,12,7);for(let j=0;j<3;j++)m.box((j-1)*.026,-.333,-.537,.013,.023,.012,rubber);
    for(let i=0;i<4;i++){
      const x=(i-1.5)*.033,y=-.308-Math.abs(i-1.5)*.009,z=-.74+Math.abs(i-1.5)*.008;
      m.tube([x,y,z+.035],[x,y-.027,z-.018],.017,metal,7);m.ellipsoid(x,y-.035,z-.012,.018,.025,.025,rubber,10,6);
    }
    m.tube([-side*.063,-.36,-.65],[-side*.094,-.39,-.70],.023,metal,8);m.ellipsoid(-side*.09,-.395,-.705,.025,.023,.03,rubber,10,6);
    // A quiet red wrist identifier keeps the local operator separate from the
    // six agents. It does not react to network/work state.
    m.box(0,-.359,-.605,.068,.014,.018,'#9e4f59');for(let i=0;i<m.data.length;i+=12){m.data[i]*=.60;m.data[i+1]=m.data[i+1]*.60-.10;m.data[i+2]=m.data[i+2]*.60-.15;}m.faces.length=0;return m;
  }
  function buildCompatibilityRoom(){const m=new Mesh();m.box(0,-.12,0,14.4,.12,20.4,'#18252f');m.box(0,4.8,0,14.4,.12,20.4,'#111e28');for(const x of [-7.1,7.1])m.box(x,0,0,.2,4.8,20.4,'#1a2a36');m.box(0,0,10.1,14.4,4.8,.2,'#20313c');m.box(0,0,-10.1,14.4,4.8,.2,'#071b2a');for(const x of [-1.5,1.5])m.box(x,.015,0,.035,.01,18.2,'#71323f');for(const z of [-7.5,-2.5,2.5,7.5])m.box(0,4.49,z,14,.18,.15,'#506b78');for(const {spec,x,z} of STATIONS){m.box(x,.02,z,2.6,.76,2.6,'#243744');m.box(x,.78,z,2.5,.15,2.4,'#465b67');m.box(x,.94,z-.82,1.85,.3,.42,'#2b4657');m.box(x,.25,z+1.31,.8,.05,.025,spec.color);m.box(x-Math.sign(x)*1.31,.40,z,.025,.045,.40,spec.color);}return m;}
  class Environment {
    constructor(canvas,{select,zoomChanged,onFrame,onTarget}={}){
      Object.assign(this,{canvas,select,zoomChanged,onFrame,onTarget,width:1,height:1,dpr:1,dprLimit:2,fps:60,zoom:1,pan:{x:0,y:0},yaw:SPAWN.yaw,pitch:SPAWN.pitch,rows:new Map(),actors:new Map(),selected:'atlas',active:false,live:false,motion:true,frame:0,dirty:false,clock:0,previous:0,lastDraw:0,pointers:new Map(),hits:[],sprites:new Map(),textures:new Map(),lost:false,destroyed:false});
      this.lookSensitivity=1;this.actorMeshes=new Map(SPECS.map(spec=>[spec.id,buildActor(spec)]));this.actorBuffers=new Map();this.selectionMeshes=new Map(SPECS.map(spec=>{const mesh=new Mesh();mesh.ring(0,.011,0,.75,spec.color,.022,.85,-.4,1.2);return [spec.id,mesh];}));this.selectionBuffers=new Map();this.handMeshes=[buildLocalHand(-1),buildLocalHand(1)];this.handBuffers=[];this.focused=null;this.player={x:SPAWN.x,z:SPAWN.z,eyeHeight:EYE_HEIGHT,radius:PLAYER_RADIUS};this.movement={x:0,z:0};this.keys=new Set();this.target=null;this.targetSignature='';this.fov=1.22;
      this.performance={draws:0,resizes:0,drawMs:[],frameMs:[],meshBuilds:1};this.mesh=buildShip();
      try{this.gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:false});if(this.gl)this.initGL();}catch{
        // A failed GPU initialization must not abort the app's communication UI.
        try{this.gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch{}
        const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);this.canvas=canvas=replacement;this.gl=null;
      }
      if(!this.gl){this.ctx=canvas.getContext('2d',{alpha:false});this.dprLimit=1.25;this.fps=15;this.softwareMesh=buildCompatibilityRoom();}
      canvas.dataset.localBody=this.gl?'solid-3d-gloves':'css-fallback';
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
      // Retained normals are lit per vertex. Smooth agent meshes interpolate
      // highlights, while the fullscreen fragment path stays inexpensive on a
      // phone: no per-pixel normalisation, powers, distance or material branch.
      const v=shader(g.VERTEX_SHADER,'attribute vec3 p;attribute vec4 c;attribute vec2 uv;attribute vec3 normal;uniform mat4 vp;uniform mat4 model;uniform vec3 eye;uniform bool polished;varying vec4 col;varying vec2 tex;varying float fog;void main(){vec4 world=model*vec4(p,1.);gl_Position=vp*world;col=c;tex=uv;vec3 n=mat3(model)*normal;float len=length(n);if(len>.1){n/=len;vec3 view=normalize(eye-world.xyz);if(dot(n,view)<0.)n=-n;vec3 key=normalize(vec3(-.35,.88,.32));vec3 fill=normalize(vec3(.78,.36,-.55));float diffuse=.40+.50*max(dot(n,key),0.)+.16*max(dot(n,fill),0.);col.rgb*=diffuse;if(polished){float spec=pow(max(dot(n,normalize(key+view)),0.),38.)*.24;float rim=pow(1.-max(dot(n,view),0.),3.)*.12;col.rgb+=vec3(.72,.86,.94)*(spec+rim);}}fog=clamp((distance(eye,world.xyz)-5.)/28.,0.,.42);}');
      const f=shader(g.FRAGMENT_SHADER,'precision mediump float;varying vec4 col;varying vec2 tex;varying float fog;uniform sampler2D sprite;uniform bool textured;uniform float visibility;void main(){vec4 c=col;if(textured)c*=texture2D(sprite,tex);gl_FragColor=vec4(mix(c.rgb*visibility,vec3(.075,.12,.16),fog),c.a);}');
      this.program=g.createProgram();g.attachShader(this.program,v);g.attachShader(this.program,f);g.linkProgram(this.program);if(!g.getProgramParameter(this.program,g.LINK_STATUS))throw Error('Spatial program link failed');g.deleteShader(v);g.deleteShader(f);g.useProgram(this.program);
      const backgroundVertex=shader(g.VERTEX_SHADER,'attribute vec2 p;varying vec2 pos;void main(){pos=p;gl_Position=vec4(p,0.,1.);}');
      const backgroundFragment=shader(g.FRAGMENT_SHADER,'precision mediump float;varying vec2 pos;void main(){vec2 q=pos*vec2(.8,.65);float glow=exp(-dot(q,q)*2.4);vec3 c=mix(vec3(.005,.012,.020),vec3(.035,.075,.096),glow);c*=1.-.25*max(0.,-pos.y);gl_FragColor=vec4(c,1.);}');
      this.backgroundProgram=g.createProgram();g.attachShader(this.backgroundProgram,backgroundVertex);g.attachShader(this.backgroundProgram,backgroundFragment);g.linkProgram(this.backgroundProgram);if(!g.getProgramParameter(this.backgroundProgram,g.LINK_STATUS))throw Error('Spatial background link failed');g.deleteShader(backgroundVertex);g.deleteShader(backgroundFragment);
      this.backgroundLocation=g.getAttribLocation(this.backgroundProgram,'p');this.backgroundBuffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.backgroundBuffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),g.STATIC_DRAW);
      this.locations={p:g.getAttribLocation(this.program,'p'),c:g.getAttribLocation(this.program,'c'),uv:g.getAttribLocation(this.program,'uv'),normal:g.getAttribLocation(this.program,'normal'),vp:g.getUniformLocation(this.program,'vp'),model:g.getUniformLocation(this.program,'model'),eye:g.getUniformLocation(this.program,'eye'),visibility:g.getUniformLocation(this.program,'visibility'),polished:g.getUniformLocation(this.program,'polished'),textured:g.getUniformLocation(this.program,'textured')};
      // Partition only once per GL/context initialization. Transparent floor
      // shadows/identity arcs retain blending; all solid room/body passes do not.
      const opaque=[],alpha=[];for(let offset=0;offset<this.mesh.data.length;offset+=36){const target=this.mesh.data[offset+6]<.999?alpha:opaque;for(let n=0;n<36;n++)target.push(this.mesh.data[offset+n]);}
      this.opaqueVertices=opaque.length/12;this.alphaVertices=alpha.length/12;
      this.staticBuffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.staticBuffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array(opaque),g.STATIC_DRAW);
      this.alphaBuffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.alphaBuffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array(alpha),g.STATIC_DRAW);
      this.actorBuffers.clear();for(const [id,mesh] of this.actorMeshes){const buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array(mesh.data),g.STATIC_DRAW);this.actorBuffers.set(id,buffer);}
      this.handBuffers=this.handMeshes.map(mesh=>{const buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array(mesh.data),g.STATIC_DRAW);return buffer;});
      this.selectionBuffers.clear();for(const [id,mesh] of this.selectionMeshes){const buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array(mesh.data),g.STATIC_DRAW);this.selectionBuffers.set(id,buffer);}
      g.enable(g.DEPTH_TEST);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);g.clearColor(.018,.018,.028,1);
    }
    bindBuffer(buffer){const g=this.gl;g.bindBuffer(g.ARRAY_BUFFER,buffer);for(const [name,size,offset] of [['p',3,0],['c',4,12],['uv',2,28],['normal',3,36]]){g.enableVertexAttribArray(this.locations[name]);g.vertexAttribPointer(this.locations[name],size,g.FLOAT,false,48,offset);}}
    bindInput(){
      const c=this.canvas;c.style.touchAction='none';
      c.addEventListener('pointerdown',e=>{if(!this.active||e.button>0)return;c.setPointerCapture?.(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,multi:this.pointers.size>0});if(this.pointers.size>1)for(const p of this.pointers.values())p.multi=true;});
      c.addEventListener('pointermove',e=>{const p=this.pointers.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;if(this.pointers.size===1)this.look(dx,dy);});
      c.addEventListener('pointerup',e=>{const p=this.pointers.get(e.pointerId);this.pointers.delete(e.pointerId);if(!p||p.multi||Math.hypot(e.clientX-p.sx,e.clientY-p.sy)>8)return;const r=c.getBoundingClientRect(),hit=this.pick(e.clientX-r.left,e.clientY-r.top);if(hit){this.focusAgent(hit.id);this.select?.(hit.id);}});
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
    setLookSensitivity(value){if(Number.isFinite(value))this.lookSensitivity=clamp(value,.4,2);return this.lookSensitivity;}
    look(dx,dy){if(!Number.isFinite(dx)||!Number.isFinite(dy))return;this.yaw=(this.yaw+dx*.0035*this.lookSensitivity+Math.PI*3)%(Math.PI*2)-Math.PI;this.pitch=clamp(this.pitch-dy*.003*this.lookSensitivity,-1.15,1.15);this.focused=null;this.requestDraw();}
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
    interactionTarget(){
      // An explicit menu/body selection is not a gaze hit. A nearer creature
      // must not steal its conversation before the next frame or occlude it
      // from a different walking position. Deliberate look input clears focus.
      const index=SPECS.findIndex(spec=>spec.id===this.focused);
      if(index>=0){const p=this.actorPosition(null,index),distance=Math.hypot(p.x-this.player.x,p.z-this.player.z);return {id:this.focused,agent:this.focused,explicit:true,distance,near:distance<=3.5};}
      return this.target?{...this.target}:null;
    }
    getDebugState(){return this.diagnostics();}
    fitViewport(){
      const stage=this.canvas.parentElement;if(stage.closest('[hidden]'))return;
      // The responsive viewport grid owns scene height. Observe its actual canvas
      // rather than reinstating the old fixed percentage and wasting phone space.
      const nav=document.querySelector('.bottom-nav')?.getBoundingClientRect().height||76;document.documentElement.style.setProperty('--spatial-nav-height',nav+'px');this.resize();
    }
    resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;if(!this.active&&this.performance.draws>0){this.resizePending=true;return;}this.resizePending=false;const dpr=Math.min(this.dprLimit,devicePixelRatio||1),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(w===this.canvas.width&&h===this.canvas.height&&this.width===r.width&&this.height===r.height&&this.dpr===dpr)return;this.width=r.width;this.height=r.height;this.dpr=dpr;this.performance.resizes++;if(this.canvas.width!==w)this.canvas.width=w;if(this.canvas.height!==h)this.canvas.height=h;this.requestDraw();}
    quality(light){const limit=!this.gl||light?1.25:2,rate=!this.gl?15:light?30:60;if(limit===this.dprLimit&&rate===this.fps)return;this.dprLimit=limit;this.fps=rate;this.resize();}
    update(rows,live,selected,motion){
      const connected=live===true,animate=motion===true,statusFor=row=>connected&&['active','idle','queued'].includes(row?.status)?row.status:'unknown';
      // Snapshot cadence is not visual motion. Public text, receipts and fresh
      // polling timestamps do not invalidate a retained room or an idle agent.
      const signature=JSON.stringify([connected,selected,animate,SPECS.map(spec=>{const row=rows.get(spec.id);return [spec.id,row?.sessionId||null,statusFor(row)];})]);
      const changed=signature!==this.visualSignature;this.visualSignature=signature;this.rows=rows;this.live=connected;this.selected=selected;this.motion=animate;
      if(changed){for(const [i,spec] of SPECS.entries()){
        const row=rows.get(spec.id),status=statusFor(row);let actor=this.actors.get(spec.id);
        if(!actor){actor={clock:0,status,observed:status!=='unknown',sessionId:row?.sessionId};this.actors.set(spec.id,actor);}
        if(actor.sessionId!==row?.sessionId){actor.clock=0;actor.frozen=null;actor.observed=false;actor.sessionId=row?.sessionId;}
        if(status==='unknown'&&actor.observed)actor.frozen=this.actorPosition(null,i,actor);
        if(status!=='unknown')actor.frozen=null;actor.status=status;actor.observed=status!=='unknown';
      }this.requestDraw();}
      this.schedule();
    }
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
    drawGL(){const g=this.gl,identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);g.viewport(0,0,this.canvas.width,this.canvas.height);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.disable(g.DEPTH_TEST);g.disable(g.BLEND);g.useProgram(this.backgroundProgram);g.bindBuffer(g.ARRAY_BUFFER,this.backgroundBuffer);g.enableVertexAttribArray(this.backgroundLocation);g.vertexAttribPointer(this.backgroundLocation,2,g.FLOAT,false,8,0);g.drawArrays(g.TRIANGLES,0,3);g.enable(g.DEPTH_TEST);g.disable(g.BLEND);g.depthMask(true);g.useProgram(this.program);g.uniformMatrix4fv(this.locations.vp,false,this.vp);g.uniformMatrix4fv(this.locations.model,false,identity);g.uniform3fv(this.locations.eye,this.eye);g.uniform1f(this.locations.visibility,1);g.uniform1i(this.locations.textured,0);g.uniform1i(this.locations.polished,0);this.bindBuffer(this.staticBuffer);g.drawArrays(g.TRIANGLES,0,this.opaqueVertices);g.enable(g.BLEND);g.depthMask(false);this.bindBuffer(this.alphaBuffer);g.drawArrays(g.TRIANGLES,0,this.alphaVertices);
      const selectedIndex=SPECS.findIndex(s=>s.id===this.selected);if(selectedIndex>=0){const p=this.actorPosition(null,selectedIndex),model=identity.slice();model[12]=p.x;model[13]=.94;model[14]=p.z;g.uniformMatrix4fv(this.locations.model,false,model);this.bindBuffer(this.selectionBuffers.get(this.selected));g.drawArrays(g.TRIANGLES,0,this.selectionMeshes.get(this.selected).data.length/12);}
      g.depthMask(true);g.disable(g.BLEND);g.uniform1i(this.locations.polished,1);
      // Opaque retained 3D bodies write depth normally. A side step changes the
      // silhouette and occlusion; no camera-facing art is used on the GPU path.
      for(const [i,spec] of SPECS.entries()){
        const p=this.actorPosition(null,i),yaw=STATIONS[i].x<0?Math.PI/2:-Math.PI/2,c=Math.cos(yaw),s=Math.sin(yaw),model=new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,p.x,p.y,p.z,1]);
        g.uniformMatrix4fv(this.locations.model,false,model);g.uniform1f(this.locations.visibility,this.actors.get(spec.id)?.observed?1:.72);this.bindBuffer(this.actorBuffers.get(spec.id));g.drawArrays(g.TRIANGLES,0,this.actorMeshes.get(spec.id).data.length/12);
      }
      // Camera-attached local embodiment. Clearing depth here prevents a wall
      // from slicing the near-field glove; no navigation/collision geometry is
      // bypassed because these hands are only a view model.
      g.clear(g.DEPTH_BUFFER_BIT);g.uniform1f(this.locations.visibility,1);
      const spread=clamp(this.width/this.height*.24,.16,.48),right=this.cameraRight,up=this.cameraUp,forward=this.forward;
      for(let i=0;i<2;i++){const side=i?1:-1,position=this.eye.map((v,j)=>v+right[j]*spread*side),model=new Float32Array([right[0],right[1],right[2],0,up[0],up[1],up[2],0,-forward[0],-forward[1],-forward[2],0,...position,1]);g.uniformMatrix4fv(this.locations.model,false,model);this.bindBuffer(this.handBuffers[i]);g.drawArrays(g.TRIANGLES,0,this.handMeshes[i].data.length/12);}
      g.uniformMatrix4fv(this.locations.model,false,identity);g.uniform1f(this.locations.visibility,1);
    }
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
    diagnostics(){const p=(a)=>a.length?Math.round(a.slice().sort((a,b)=>a-b)[Math.floor((a.length-1)*.95)]*100)/100:null,nearby=STATIONS.map(station=>({agent:station.spec.id,distance:Math.round(Math.hypot(station.x-this.player.x,station.z-this.player.z)*10)/10})).sort((a,b)=>a.distance-b.distance).filter(agent=>agent.distance<=3.5);return {renderer:this.gl?'webgl-first-person':'canvas-first-person-fallback',mode:'first-person',active:this.active,live:this.live,motion:this.motion,contextLost:this.lost,targetFps:this.fps,width:this.width,height:this.height,dpr:this.dpr,zoom:this.zoom,lookSensitivity:this.lookSensitivity,focused:this.focused,projectedBounds:this.vp?this.projectedBounds():null,player:{x:this.player.x,z:this.player.z,eyeHeight:EYE_HEIGHT,radius:PLAYER_RADIUS,yaw:this.yaw,pitch:this.pitch,speed:WALK_SPEED,collision:this.canStand(this.player.x,this.player.z)?'clear':'blocked',movement:this.movementVector()},camera:{yaw:this.yaw,pitch:this.pitch,x:this.player.x,y:EYE_HEIGHT,z:this.player.z},room:{width:ROOM.halfWidth*2,depth:ROOM.halfDepth*2,height:ROOM.height},target:this.interactionTarget(),nearby,draws:this.performance.draws,pendingPaint:this.dirty,deferredResize:!!this.resizePending,pendingFrame:!!this.frame,resizes:this.performance.resizes,meshBuilds:this.performance.meshBuilds,triangles:this.mesh.data.length/36,actorGeometry:this.gl?'retained-solid-3d':'compatibility-billboards',localBody:this.gl?'solid-3d-gloves':'css-fallback',actorTriangles:[...this.actorMeshes.values()].reduce((n,m)=>n+m.data.length/36,0),localBodyTriangles:this.handMeshes.reduce((n,m)=>n+m.data.length/36,0),softwareTriangles:this.softwareMesh?this.softwareMesh.data.length/36:null,drawSamples:this.performance.drawMs.length,frameSamples:this.performance.frameMs.length,sampleLimit:120,drawCpuP95Ms:p(this.performance.drawMs),rafIntervalP95Ms:p(this.performance.frameMs),scope:'Local navigation and recent WebView CPU/RAF intervals; not agent travel, productive work, GPU presentation or native-chat frame timing'};}
    destroy(){this.show(false);this.destroyed=true;this.observer.disconnect();document.removeEventListener('visibilitychange',this.onVisibility);window.removeEventListener('keydown',this.onKeyDown);window.removeEventListener('keyup',this.onKeyUp);window.removeEventListener('blur',this.onBlur);this.labels.remove();this.notice.remove();const g=this.gl;if(g){for(const t of this.textures.values())g.deleteTexture(t);for(const b of this.actorBuffers.values())g.deleteBuffer(b);for(const b of this.handBuffers)g.deleteBuffer(b);for(const b of this.selectionBuffers.values())g.deleteBuffer(b);g.deleteBuffer(this.staticBuffer);g.deleteBuffer(this.alphaBuffer);g.deleteBuffer(this.backgroundBuffer);g.deleteProgram(this.program);g.deleteProgram(this.backgroundProgram);}}
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
