const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app-v2.js'),'utf8');
test('A hung Mac request times out and clears its timer',async()=>{
 let aborted=false,cleared=false;
 const ctx={AbortController,setTimeout:f=>{queueMicrotask(f);return 1;},clearTimeout:()=>cleared=true,
 fetch:async(_,options)=>new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>{aborted=true;reject({name:'AbortError'});});})};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function serverFetch('),source.indexOf('let refreshInFlight')),ctx);
 await assert.rejects(ctx.serverFetch('/api/login'),/Mac inaccessible/);assert(aborted);assert(cleared);
});
test('Reconnect stays available after an error even with a stored token',()=>{
 const button={},access={hidden:true},toolbar={hidden:false},badge={dataset:{sync:'error'}},actions={prepend:b=>b.parentElement=actions};
 const elements={'#sync-connect':button,'#access-page':access,'#active-user-toolbar':toolbar,'.local-badge':badge,'.toolbar-tools-list':actions};
 const ctx={$:s=>elements[s],TOKEN_KEY:'token',sessionStorage:{getItem:()=> 'expired-token'}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function updateSyncConnect()'),source.indexOf('function syncStatus(')),ctx);
 ctx.updateSyncConnect();assert.equal(button.hidden,false);badge.dataset.sync='saved';ctx.updateSyncConnect();assert.equal(button.hidden,false);assert.equal(button.textContent,'Reconnecter au Mac');
 access.hidden=false;badge.dataset.sync='error';ctx.updateSyncConnect();assert.equal(button.hidden,true);
});
test('Auto-activated worker offers reload and manual checks recover on failure',async()=>{
 const elements={},events={},windowEvents={},classes=new Set();let reloads=0,fail=false;
 for(const id of ['#pwa-install','#pwa-update','#pwa-status','.pwa-panel'])elements[id]={hidden:true,disabled:false,textContent:'',addEventListener:(name,cb)=>events[id+name]=cb};
 const registration={waiting:null,installing:null,update:async()=>{if(fail)throw Error('offline');},addEventListener:()=>{}};
 const sw={controller:{},register:async()=>registration,addEventListener:(name,cb)=>events[name]=cb};
 const ctx={document:{querySelector:id=>elements[id],body:{classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)}},hidden:false,addEventListener:()=>{}},navigator:{serviceWorker:sw,onLine:true},window:{isSecureContext:true,addEventListener:(n,cb)=>windowEvents[n]=cb},matchMedia:()=>({matches:true,addEventListener:()=>{}}),location:{reload:()=>reloads++},setTimeout:()=>1,clearTimeout:()=>{}};
 vm.createContext(ctx);const start=fs.readFileSync(require('node:path').join(__dirname,'../pwa.js'),'utf8').indexOf("(() => {\n  const install");
 vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../pwa.js'),'utf8').slice(start),ctx);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(elements['#pwa-update'].hidden,false);
 fail=true;events['#pwa-updateclick']();await new Promise(resolve=>setImmediate(resolve));assert.match(elements['#pwa-status'].textContent,/indisponible/);assert.equal(elements['#pwa-update'].disabled,false);
 events.controllerchange();assert.ok(classes.has('pwa-update-available'));assert.equal(elements['#pwa-update'].textContent,'Mettre à jour Foulée');events['#pwa-updateclick']();assert.equal(reloads,1);
});
