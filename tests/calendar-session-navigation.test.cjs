const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
for(const file of ['app.js','app-v2.js']){
 const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 function setup(plan){let viewed=null,toast=null;const context={loadPlan:()=>plan,renderSessionViewer:(week,session)=>viewed=[week,session],showToast:value=>toast=value};vm.createContext(context);const start=source.indexOf('function openPlannedSession('),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end),context);return {context,viewed:()=>viewed,toast:()=>toast};}
 test(file+': calendar opens the selected session in its actual week',()=>{const state=setup({weeks:[{sessions:[{id:'a'}]},{sessions:[{id:'b'},{id:'c'}]}]});state.context.openPlannedSession('c');assert.deepEqual(state.viewed(),[1,1]);});
 test(file+': stale calendar session does not open another session',()=>{for(const plan of [null,{weeks:[{sessions:[]}]}]){const state=setup(plan);state.context.openPlannedSession('missing');assert.equal(state.viewed(),null);assert.ok(state.toast());}});
}
