const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../exercise-module.js'),'utf8').replace('return {storageKey,','return {mapPopupContent,storageKey,');
const context={};vm.createContext(context);vm.runInContext(source+';globalThis.mod=ExerciseModule;',context);
const item={heart:[{t:0,v:140},{t:60,v:160}],paces:[{t:0,v:360},{t:60,v:300}],elevation:[{t:0,v:30},{t:60,v:40}]};
test('GPS popup summarizes the common instant and labels interpolation',()=>{
 const content=context.mod.mapPopupContent(item,30);
 assert(content.includes('0:30'));assert(content.includes('≈ 150 bpm'));assert(content.includes('≈ 5:30 /km'));assert(content.includes('≈ 35 m'));assert(content.includes('valeur interpolée'));
 const exact=context.mod.mapPopupContent(item,60);assert(exact.includes('160 bpm'));assert(!exact.includes('≈'));
});
test('GPS popup does not extrapolate or invent absent measurements',()=>{
 const content=context.mod.mapPopupContent(item,90);assert.equal((content.match(/<b>—<\/b>/g)||[]).length,4);
 const missing=context.mod.mapPopupContent({heart:[],paces:[],elevation:[]},30);assert.equal((missing.match(/<b>—<\/b>/g)||[]).length,4);
});

test('GPS popup shows signed slope at the shared instant',()=>{
 const uphill=context.mod.mapPopupContent(item,30,[{t:0,v:4},{t:60,v:6}]);
 assert(uphill.includes('<span>Pente</span>'));assert(uphill.includes('≈ +5 %'));
 const downhill=context.mod.mapPopupContent(item,60,[{t:60,v:-3}]);assert(downhill.includes('-3 %'));
 const flat=context.mod.mapPopupContent(item,60,[{t:60,v:0}]);assert(flat.includes('0 %'));
});
