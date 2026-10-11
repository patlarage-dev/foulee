const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function worker() {
  const events = {}, removed = [], cached = [], reads = [];
  const offline = new Response('reconnexion');
  let claimed = false, skipped = false;
  const context = {
    URL, Response,
    fetch: async () => {throw Error('offline');},
    caches: {
      open: async () => ({addAll: async files => cached.push(...files)}),
      keys: async () => ['foulee-pwa-old', 'another-app', 'foulee-pwa-' + /CACHE_PREFIX \+ '([^']+)'/.exec(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'))[1]],
      delete: async name => removed.push(name),
      match: async url => {reads.push(url);return offline;}
    },
    self: {
      location: {origin:'http://localhost:8765'},
      addEventListener: (name, handler) => events[name] = handler,
      clients: {claim: async () => {claimed = true;}, matchAll: async () => []},
      skipWaiting: () => {skipped = true;}
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), context);
  return {events, context, removed, cached, reads, offline, claimed:()=>claimed, skipped:()=>skipped};
}
test('Manifest and declared icon sizes', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest')));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  for (const icon of manifest.icons) {
    const png = fs.readFileSync(path.join(root, icon.src));
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
  assert.ok(manifest.icons.some(icon=>icon.purpose==='maskable'));
});
test('Offline cache contains the complete application; cleanup stays scoped', async () => {
  const w = worker(); let work;
  w.events.install({waitUntil:p=>work=p}); await work;
  for(const asset of ['/index.html','/styles.css','/app-v2.js','/exercise-module.js','/pwa.js','/manifest.webmanifest']) assert.ok(w.cached.includes(asset));
  for(const asset of w.cached) assert.ok(fs.existsSync(path.join(root,asset)));
  assert.ok(w.cached.every(asset=>!asset.startsWith('/api/')));
  assert.ok(w.skipped(), 'The complete new shell activates without waiting for a hidden update button');
  w.events.activate({waitUntil:p=>work=p}); await work;
  assert.deepEqual(w.removed,['foulee-pwa-old']); assert.ok(w.claimed());
});
test('Private API, writes and external resources bypass the service worker', () => {
  const w = worker();
  for (const [url,method] of [['/api/state','GET'],['/api/login','POST'],['/','PUT'],['https://example.com/','GET']]) {
    w.events.fetch({request:{url:new URL(url,'http://localhost:8765').href,method,mode:'navigate'},respondWith:()=>{throw Error('intercepted');}});
  }
  assert.deepEqual(w.reads,[]);
});
test('Navigation serves the installed application offline', async () => {
  const w = worker(); let result;
  const event = {request:{url:'http://localhost:8765/',method:'GET',mode:'navigate'},respondWith:p=>result=p};
  const online = new Response('online'); w.context.fetch = async()=>online;
  w.events.fetch(event);assert.equal(await result,w.offline);assert.deepEqual(w.reads,['/index.html']);
  w.context.fetch = async()=>{throw Error('offline');};
  w.events.fetch(event);assert.equal(await result,w.offline);
  assert.deepEqual(w.reads,['/index.html','/index.html']);
});
test('An explicit activation message remains supported', () => {
  const w = worker(); assert.equal(w.skipped(),false);
  w.events.message({data:{type:'OTHER'}}); assert.equal(w.skipped(),false);
  w.events.message({data:{type:'ACTIVATE_UPDATE'}}); assert.ok(w.skipped());
});

test('Every cached script and stylesheet in the shell is precached',async()=>{
  const w=worker();let work;w.events.install({waitUntil:p=>work=p});await work;
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const match of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)) assert.ok(w.cached.includes('/'+match[1]));
});
test('Failed sync preserves edits; reconnect sends them and clears acknowledged writes',async()=>{
  const source=fs.readFileSync(path.join(root,'app-v2.js'),'utf8');
  const start=source.indexOf('let offlineDB;'), end=source.indexOf('function openLocalApp()');
  const statuses=[],sent=[],pending=new Map(),items=new Map();let fail=true;
  const context={Map,Promise,console,TOKEN_KEY:'token-key',sessionStorage:{getItem:()=> 'token',removeItem:()=>{}},
    syncQueue:Promise.resolve(),serverItems:{},syncStatus:message=>statuses.push(message),
    fetch:async(url,options)=>{if(fail)throw Error('offline');sent.push(JSON.parse(options.body));return {ok:true,status:200};}};
  context.serverFetch=context.fetch;vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  context.db={transaction:()=>{const tx={objectStore:name=>({put:(value,key)=>(name==='pending'?pending:items).set(key,value),delete:key=>pending.delete(key)})};setImmediate(()=>tx.oncomplete());return tx;}};
  vm.runInContext('offlineDB=db;persistRemote("foulee.profile.v1","local edit");',context);
  await context.syncQueue;assert.equal(pending.size,1);assert.equal(items.get('foulee.profile.v1'),'local edit');
  fail=false;await vm.runInContext('flushPendingWrites()',context);
  assert.equal(pending.size,0);assert.equal(sent[0].value,'local edit');
});

test('Forced release reloads open application windows after claiming the new cache', async () => {
  const w=worker(),navigated=[];let work;
  w.context.self.clients.matchAll=async options=>{assert.equal(options.type,'window');assert.ok(w.claimed());return [{url:'http://localhost:8765/#parametres',navigate:async url=>navigated.push(url)},{url:'http://localhost:8765/#plan',navigate:async()=>{throw Error('closed');}}];};
  w.events.activate({waitUntil:p=>work=p});await work;
  assert.deepEqual(navigated,['http://localhost:8765/#parametres']);
});
