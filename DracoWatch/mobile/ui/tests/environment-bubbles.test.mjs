import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../environment-bubbles.js',import.meta.url),'utf8');
const specs=['main','forge','atlas','aera-new','vvv','daedalus'].map(id=>({id,name:id,color:'#00ffff'}));
const now=1791900000000;
const agents=()=>new Map(specs.map(spec=>[spec.id,{sessionId:'session-'+spec.id,status:'active'}]));
const message=(agent,overrides={})=>({id:'report-'+agent,agent,sessionId:'session-'+agent,role:'assistant',text:'Public report '+agent,timestamp:now-10000,...overrides});
function helper(extra={}){const scope={window:{},Date,Map,Set,Number,Array,performance:{now:()=>100},...extra};vm.runInNewContext(source,scope);return scope.window.DracoEnvironmentBubbles;}
const plain=value=>JSON.parse(JSON.stringify(value));

test('each creature gets the latest public assistant report from its exact current session',()=>{
  const {selectReports}=helper(),rows=agents();
  const result=selectReports([...specs.map(spec=>message(spec.id)),message('atlas',{id:'latest',text:'New public result',timestamp:now-1}),message('atlas',{id:'older',text:'Older result',timestamp:now-20000})],rows,{live:true,now,specs});
  assert.equal(result.length,6);assert.equal(result.find(report=>report.id==='atlas').sourceId,'latest');assert.equal(result.find(report=>report.id==='forge').preview,'Public report forge');
  assert.ok(result.every(report=>report.kind==='report'&&report.label.startsWith('Public report')));
});

test('user, private, tool, reasoning, missing and different-session messages cannot become speech',()=>{
  const {selectReports}=helper(),rows=agents();
  const source=[message('atlas',{role:'user',text:'USER SECRET'}),message('atlas',{role:'tool',text:'RAW TOOL'}),message('atlas',{role:'thinking',text:'REASONING'}),message('atlas',{channel:'analysis',text:'ASSISTANT REASONING'}),message('atlas',{private:true,text:'PRIVATE'}),message('atlas',{audience:'private',text:'PRIVATE AUDIENCE'}),message('atlas',{sessionId:'previous-session',text:'OLD SESSION'}),message('atlas',{sessionId:undefined}),message('atlas',{id:undefined}),message('atlas',{text:''}),message('atlas',{timestamp:NaN}),message('atlas',{timestamp:now+61000}),message('unrecognized')];
  const result=selectReports(source,rows,{live:true,now,specs});assert.equal(result.length,6);assert.ok(result.every(report=>report.kind==='state'&&report.fullText===null&&report.preview==='No public update'));
});

test('stale observations and unknown agents remove report text instead of making stale speech look live',()=>{
  const {selectReports}=helper(),rows=agents(),activity=specs.map(spec=>message(spec.id));
  for(const report of selectReports(activity,rows,{live:false,now,specs})){assert.equal(report.label,'Unobserved');assert.equal(report.preview,'Live observation unavailable');assert.equal(report.fullText,null);assert.equal(report.sourceId,null);}
  rows.get('forge').status='unknown';rows.delete('daedalus');
  const result=selectReports(activity,rows,{live:true,now,specs});assert.equal(result.find(report=>report.id==='forge').kind,'state');assert.equal(result.find(report=>report.id==='daedalus').label,'Unobserved');assert.equal(result.find(report=>report.id==='atlas').kind,'report');
});

test('a newer attachment-only event replaces the old report with explicit unavailable status, not invented speech',()=>{
  const {selectReports}=helper(),rows=agents(),events=[message('forge'),message('forge',{id:'audio',text:'',kind:'Attachment only',timestamp:now,
    media:[{kind:'audio',downloadAvailable:false}]})];
  const result=selectReports(events,rows,{live:true,now,specs}).find(row=>row.id==='forge');
  assert.equal(result.kind,'attachment');assert.equal(result.sourceId,'audio');assert.equal(result.fullText,null);
  assert.equal(result.preview,'Audio unavailable in app · no companion text');
  events[1].media.push({kind:'image',downloadAvailable:true});
  assert.equal(selectReports(events,rows,{live:true,now,specs}).find(row=>row.id==='forge').preview,'Audio unavailable in app · no companion text');
  assert.equal(selectReports(events,rows,{live:false,now,specs}).find(row=>row.id==='forge').sourceId,null);
});

test('reports older than 15 minutes are explicitly labelled historical, state fallback is not fabricated speech',()=>{
  const {selectReports}=helper(),rows=agents();rows.get('main').status='idle';rows.get('forge').status='queued';
  const result=selectReports([message('atlas',{timestamp:now-16*60000}),message('vvv',{timestamp:new Date(now-30000).toISOString()})],rows,{live:true,now,specs});
  assert.match(result.find(report=>report.id==='atlas').label,/^Last report · \d{2}:\d{2}$/);assert.equal(result.find(report=>report.id==='main').label,'No open run');assert.equal(result.find(report=>report.id==='main').status,'idle');assert.equal(result.find(report=>report.id==='forge').label,'Queued');assert.equal(result.find(report=>report.id==='vvv').kind,'report');
  const open=result.find(report=>report.id==='daedalus');assert.equal(open.label,'Run open');assert.equal(open.status,'active');
});

test('preview compacts whitespace and safely truncates Unicode without parsing markup',()=>{
  const {selectReports}=helper(),text='<img src=x onerror=alert(1)>\n  '+ '🚀'.repeat(180);
  const report=selectReports([message('atlas',{text})],agents(),{live:true,now,specs}).find(report=>report.id==='atlas');
  assert.equal(Array.from(report.preview).length,145);assert.ok(report.preview.endsWith('…'));assert.ok(report.preview.startsWith('<img src=x onerror=alert(1)> '));assert.equal(report.fullText,text);assert.ok(!report.preview.includes('\n'));
});

test('formatted public previews are readable while exact authored text and code identifiers survive',()=>{
  const {selectReports}=helper(),text='# **Result**\n- [Build](https://example.com) __passed__ with *approved* voice.\n`job_id` at -5 dB; 2 * 3 = 6.\n~~Resolved~~';
  const report=selectReports([message('atlas',{text})],agents(),{live:true,now,specs}).find(report=>report.id==='atlas');
  assert.equal(report.preview,'Result Build passed with approved voice. job_id at -5 dB; 2 * 3 = 6. Resolved');
  assert.equal(report.fullText,text);assert.equal(report.sourceId,'report-atlas');assert.equal(report.sessionId,'session-atlas');
});

test('all six bubble cards have bounded non-overlapping accessible targets across phone and wide layouts',()=>{
  const {layoutBubbles}=helper(),points=specs.map((spec,index)=>({id:spec.id,x:index%2?290:30,y:50+index*30}));
  for(const [width,height] of [[320,260],[360,490],[412,670],[780,280],[1100,600]]){
    const boxes=layoutBubbles(points,{width,height});assert.equal(boxes.length,6);
    for(const box of boxes){assert.ok(box.width>=44&&box.height>=44);assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);}
    for(const [index,a] of boxes.entries())for(const b of boxes.slice(index+1))assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
  }
});

test('card positions remain stable during movement while connector tips follow the exact actor',()=>{
  const {layoutBubbles}=helper(),points=specs.map((spec,index)=>({id:spec.id,x:30+index*35,y:50+index*60})),moved=points.map(point=>({...point,x:point.x+15,y:point.y+20}));
  const before=layoutBubbles(points,{width:360,height:500}),after=layoutBubbles(moved,{width:360,height:500,previous:before});
  const positions=boxes=>plain(boxes.map(({x,y,width,height})=>({x,y,width,height})));
  assert.deepEqual(positions(before),positions(after));
  for(const [index,box] of after.entries())assert.deepEqual(plain(box.connector.end),{x:moved[index].x,y:moved[index].y});
});

test('projection includes scene scale, offsets, pan and camera zoom without bounding actor coordinates',()=>{
  const {projectActors}=helper(),renderer={width:360,height:500,zoom:2,pan:{x:20,y:-10},actors:new Map([['atlas',{}]]),scene:()=>({scale:.5,ox:10,oy:15}),actorPosition:()=>({x:100,z:200}),point:(_scene,x,z)=>({x,y:z})};
  const point=projectActors(renderer,[{id:'atlas'}])[0];assert.equal(point.x,-40);assert.equal(point.y,-30);
  assert.equal(point.radius,58);assert.equal(projectActors({...renderer,actors:new Map([['daedalus',{}]])},[{id:'daedalus'}])[0].radius,76);
  const missing=projectActors(renderer,[{id:'forge'}])[0];assert.ok(Number.isNaN(missing.x));
});

test('helper has no independent motion loop, network work, unsafe HTML or speech synthesis',()=>{
  assert.ok(!/requestAnimationFrame\(|setInterval\(|setTimeout\(|fetch\(|\.innerHTML\s*=|speechSynthesis/.test(source));
});

test('native text zoom is counted once while browser simulation honors the combined app/native scale',()=>{
  const {resolveFontScale}=helper();
  assert.equal(resolveFontScale(18,1.5,1),1.5,'Computed18px already contains native150%');
  assert.equal(resolveFontScale(27,1.5,1.5),2.25,'True combined native/app150% is225%, not337.5%');
  assert.equal(resolveFontScale(18,1.5,1.5),2.25,'Browser CSS may omit native zoom');
  assert.equal(resolveFontScale(12,1,1),1);assert.equal(resolveFontScale(24,1,1),2,'Actual computed font enlargement remains conservative');
});

test('impossible body coverage is reported as a packing limit rather than attested as clear',()=>{
  const {layoutBubbles}=helper(),points=specs.map(spec=>({id:spec.id,x:80,y:80,radius:160})),boxes=layoutBubbles(points,{width:160,height:160});
  assert.equal(boxes.packed,false);assert.equal(boxes.limit,'INSUFFICIENT_CLEAR_CANVAS_FOR_SIX_44PX_BUBBLES');
});

// 0.4.0 retires floating report packing. Legacy pure helper fixtures above stay
// for compatibility; real 3D camera/context/layout is in spatial-experience-check.
test('retained inspector is independent of moving geometry and preserves selected-session public text',()=>{
  class Element {
    constructor(){this.hidden=false;this.dataset={};this.children=[];this.attributes=new Map();this.events=new Map();this.style={setProperty(){}};this.classList={toggle(){}};}
    append(...children){this.children.push(...children);}
    after(node){this.afterNode=node;}
    addEventListener(name,callback){this.events.set(name,callback);}
    setAttribute(key,value){this.attributes.set(key,value);}
    remove(){this.removed=true;}
  }
  const doc={createElement:()=>new Element()};
  const {Bubbles}=helper({document:doc}),selected=[];
  const renderer={get width(){throw Error('Inspector must not sample moving scene geometry');}};
  const stage=new Element(),inspector=new Bubbles({stage,renderer,specs,select:id=>selected.push(id)});
  const rows=agents(),messages=specs.map(spec=>message(spec.id));
  inspector.update(messages,rows,{live:true,now,selected:'atlas'});inspector.show(true);
  const textNode=inspector.text,layer=inspector.layer;
  assert.equal(layer.dataset.packing,'dock');assert.equal(layer.hidden,false);assert.equal(stage.afterNode,layer);
  assert.match(textNode.textContent,/Public report atlas/);
  for(let i=0;i<25;i++){inspector.layout();inspector.update(messages,rows,{live:true,now:now+i,selected:'atlas'});}
  assert.equal(inspector.text,textNode);assert.equal(inspector.layer,layer);assert.match(textNode.textContent,/Public report atlas/);
  inspector.update(messages,rows,{live:true,now,selected:'forge'});assert.equal(inspector.heading.textContent,'forge');assert.match(textNode.textContent,/Public report forge/);
  layer.children.at(-1).children[0].events.get('click')();assert.deepEqual(selected,['forge']);
  rows.set('forge',{status:'active',sessionId:'replacement'});inspector.update(messages,rows,{live:true,now,selected:'forge'});
  assert.ok(!textNode.textContent.includes('Public report forge'),'replacement session cannot reuse old public speech');
  inspector.show(false);assert.equal(layer.hidden,true);inspector.show(true);assert.equal(layer.hidden,false);
  inspector.destroy();assert.equal(layer.removed,true);
});
