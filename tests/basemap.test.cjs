const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../exercise-module.js'),'utf8');
const ctx={};vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('  function basemapCamera('),source.indexOf('  const el =')),ctx);
const lat=48.858,lon=2.294,scale=256*2**15/360;
const svg={dataset:{scale,cx:lon,cy:-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*180/Math.PI}};
test('Vector background matches GPS Mercator center, responsive width and zoom',()=>{
 const first=ctx.basemapCamera(svg,{x:0,y:0,w:720,h:340},720);
 assert(Math.abs(first.center[0]-lon)<1e-10);assert(Math.abs(first.center[1]-lat)<1e-10);assert.equal(first.zoom,14);
 const zoomed=ctx.basemapCamera(svg,{x:180,y:85,w:360,h:170},720);assert.equal(zoomed.zoom,15);assert.deepEqual(zoomed.center,first.center);
 const tall=ctx.basemapCamera(svg,{x:0,y:-330,w:720,h:1000},360);assert.deepEqual(tall.center,first.center);assert.equal(tall.zoom,13);
 const phone=ctx.basemapCamera(svg,{x:0,y:0,w:720,h:340},360);assert.equal(phone.zoom,13);assert.deepEqual(phone.center,first.center);
 const moved=ctx.basemapCamera(svg,{x:200,y:100,w:360,h:170},720);assert(moved.center[0]>lon);assert(moved.center[1]<lat);
});
