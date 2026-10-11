const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../exercise-module.js'),'utf8')+';globalThis.module=ExerciseModule;',ctx);
test('Overlay simplification preserves isolated peaks and the beginning of GPS outages',()=>{
 const series=Array.from({length:6000},(_,t)=>({t,v:100}));series[305].v=190;series[307].v=40;series[306].breakBefore=true;
 const drawn=ctx.module.chartSamples(series);
 assert.ok(drawn.includes(series[305]));assert.ok(drawn.includes(series[307]));assert.ok(drawn.includes(series[306]));
 assert.equal(drawn[0],series[0]);assert.equal(drawn.at(-1),series.at(-1));assert.ok(drawn.length<series.length);
 for(let i=1;i<drawn.length;i++)assert.ok(drawn[i].t>=drawn[i-1].t);
});
