const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../exercise-module.js'),'utf8');
const start=source.indexOf('  function updateMapAnnotations('),end=source.indexOf('\n  function ',start+1);
function setup(){
 const node=(x,y)=>({dataset:{x,y},style:{},attributes:{},setAttribute(key,value){this.attributes[key]=value;}});
 const labels=Array.from({length:24},(_,i)=>node(30+(i%8)*65,35+Math.floor(i/8)*60));
 const fixed=[node(),node(),node()],endpoints=[node(30,35),node(650,280)];
 let scale=1;
 const svg={getScreenCTM:()=>({a:scale,d:scale,e:0,f:0}),getBoundingClientRect:()=>({left:0,top:0,right:720,bottom:340}),querySelectorAll:selector=>selector==='[data-map-fixed]'?fixed:selector==='.exercise-map-endpoint'?endpoints:labels};
 const context={DOMPoint:class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(m){return {x:this.x*m.a+m.e,y:this.y*m.d+m.f};}}};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 return {labels,fixed,update:()=>context.updateMapAnnotations(svg),setScale:value=>scale=value};
}
test('Map annotations use inverse screen scale for zoom and responsive resize',()=>{
 const state=setup();
 for(const scale of [.5,1,2,16]){state.setScale(scale);state.update();for(const fixed of state.fixed)assert.equal(fixed.attributes.transform,`scale(${1/scale})`);}
});
test('Phase numbers are limited and avoid nearby labels and endpoints',()=>{
 const state=setup();state.update();const visible=state.labels.filter(node=>node.style.display!=='none');
 assert(visible.length>0);assert(visible.length<=8);assert.equal(state.labels[0].style.display,'none');
 for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++)assert(Math.hypot(visible[i].dataset.x-visible[j].dataset.x,visible[i].dataset.y-visible[j].dataset.y)>=36);
 state.setScale(16);state.update();assert(state.labels.filter(node=>node.style.display!=='none').length<=8);
});
