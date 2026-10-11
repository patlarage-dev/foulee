const CalendarModule = (() => {
  const months=new Map();
  function dateKey(value) {
    const date=value instanceof Date?value:new Date(value);
    if(!Number.isFinite(date.getTime()))return '';
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function monthDays(year,month) {
    const first=new Date(year,month,1,12),offset=(first.getDay()+6)%7;
    return Array.from({length:42},(_,i)=>new Date(year,month,1-offset+i,12));
  }
  function groupExercises(items,now=new Date()) {
    const groups=new Map();
    items.filter(item=>Number.isFinite(new Date(item.date).getTime())&&new Date(item.date)<=now).sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(item=>{
      const key=dateKey(item.date);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);
    });
    return groups;
  }
  function upcomingSessions(plan,now=new Date(),exercises=[]) {
    const groups=new Map(),today=dateKey(now);
    for(const session of plan?.weeks?.flatMap(week=>week.sessions) || []){
      const key=session.scheduledDate;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(key||'') || key<today )continue;
      if(exercises.some(item=>item.planLink?.planId===plan.id&&item.planLink?.sessionId===session.id))continue;
      const exerciseType=session.exerciseType || (/longue/i.test(session.name)?'long':/tempo|seuil|allure semi|allure marathon/i.test(session.name)?'tempo':/vma|intervall|fractionn|côte/i.test(session.name)?'vma':'footing');
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push({...session,exerciseType,planned:true});
    }
    return groups;
  }
  function render(context) {
    const root=document.querySelector('#calendar-content'),today=new Date();
    let items=[];try{items=JSON.parse(context.read(ExerciseModule.storageKey)) || [];}catch{}
    if(!Array.isArray(items))items=[];
    const groups=groupExercises(items,today),upcoming=upcomingSessions(context.plan,today,items);
    const viewed=months.get(context.athleteId) || [today.getFullYear(),today.getMonth()];
    const [year,month]=viewed;months.set(context.athleteId,viewed);
    root.replaceChildren();
    const header=document.createElement('div');header.className='calendar-month-toolbar';
    const previous=document.createElement('button');previous.type='button';previous.textContent='‹';previous.setAttribute('aria-label','Mois précédent');
    const heading=document.createElement('h2');heading.id='calendar-month-title';heading.setAttribute('aria-live','polite');heading.textContent=new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(new Date(year,month,1));
    const next=document.createElement('button');next.type='button';next.textContent='›';next.setAttribute('aria-label','Mois suivant');
    const current=document.createElement('button');current.type='button';current.textContent="Aujourd’hui";current.className='calendar-today';
    const change=offset=>{const date=new Date(year,month+offset,1);months.set(context.athleteId,[date.getFullYear(),date.getMonth()]);render(context);};
    previous.onclick=()=>change(-1);next.onclick=()=>change(1);current.onclick=()=>{months.delete(context.athleteId);render(context);};
    header.append(previous,heading,next,current);root.append(header);
    const weekdays=document.createElement('div');weekdays.className='calendar-weekdays';weekdays.setAttribute('aria-hidden','true');
    ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].forEach(day=>{const span=document.createElement('span');span.textContent=day;weekdays.append(span);});root.append(weekdays);
    const grid=document.createElement('div');grid.className='calendar-grid';grid.setAttribute('role','group');grid.setAttribute('aria-labelledby',heading.id);
    monthDays(year,month).forEach(date=>{
      const key=dateKey(date),cell=document.createElement('div');cell.className='calendar-day';
      cell.classList.toggle('outside-month',date.getMonth()!==month);cell.classList.toggle('is-today',key===dateKey(today));
      const number=document.createElement('span');number.className='calendar-day-number';number.textContent=date.getDate();if(key===dateKey(today))number.setAttribute('aria-label',"Aujourd’hui, "+date.toLocaleDateString('fr-FR'));cell.append(number);
      const recorded=groups.get(key)||[],exercises=[...recorded,...(upcoming.get(key)||[])];
      if(exercises.length){
        const colors=exercises.map(item=>ExerciseModule.exerciseTypes.find(type=>type.id===item.exerciseType)?.color || '#77817a');
        const button=document.createElement('button');button.type='button';button.className='calendar-colored-day';
        button.style.background=colors.length===1?colors[0]:`linear-gradient(135deg,${colors.map((color,i)=>color+' '+i/colors.length*100+'%, '+color+' '+(i+1)/colors.length*100+'%').join(',')})`;
        button.setAttribute('aria-label',date.toLocaleDateString('fr-FR')+' · '+exercises.length+' séance'+(exercises.length>1?'s':''));
        number.remove();button.append(number);
        const dots=document.createElement('span');dots.className='calendar-activity-dots';dots.setAttribute('aria-hidden','true');recorded.forEach(()=>{const dot=document.createElement('i');dots.append(dot);});button.append(dots);
        button.onclick=()=>{
          if(exercises.length===1){if(exercises[0].planned)context.openSession(exercises[0].id);else context.open(exercises[0].id);return;}
          const dialog=document.createElement('dialog');dialog.className='calendar-day-dialog';dialog.setAttribute('aria-label','Exercices du '+date.toLocaleDateString('fr-FR'));
          const title=document.createElement('h2');title.textContent=date.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});dialog.append(title);
          exercises.forEach(item=>{const option=document.createElement('button');option.type='button';option.className='calendar-day-choice';option.textContent=item.planned?'À venir · '+item.name:item.title;option.style.setProperty('--exercise-color',ExerciseModule.exerciseTypes.find(type=>type.id===item.exerciseType)?.color || '#77817a');option.onclick=()=>{dialog.close();if(item.planned)context.openSession(item.id);else context.open(item.id);};dialog.append(option);});
          const close=document.createElement('button');close.type='button';close.className='secondary-button';close.textContent='Fermer';close.onclick=()=>dialog.close();dialog.append(close);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
        };cell.append(button);cell.classList.add('has-exercise');
      }
      grid.append(cell);
    });root.append(grid);
    const footer=document.createElement('div');footer.className='calendar-footer';
    const legend=document.createElement('div');legend.className='calendar-type-legend';
    ExerciseModule.exerciseTypes.forEach(type=>{const entry=document.createElement('span');const dot=document.createElement('i');dot.style.background=type.color;entry.append(dot,type.label);legend.append(entry);});footer.append(legend);
    const info=document.createElement('details');info.className='calendar-information';info.innerHTML='<summary aria-label="Information sur le calendrier">i</summary><p>Touche un jour coloré du calendrier pour consulter la séance prévue ou l’exercice réalisé. Un point indique un exercice fait.</p>';footer.append(info);root.append(footer);

  }
  return {dateKey,monthDays,groupExercises,upcomingSessions,render};
})();

const PROFILE_KEY = 'foulee.profile.v1';
const SESSION_KEY = 'foulee.session.v1';
const PLAN_KEY = 'foulee.plan.v1';
const PLANS_KEY = 'foulee.plans.v1';
const ACTIVE_PLAN_KEY = 'foulee.active-plan.v1';
const $ = (selector) => document.querySelector(selector);
const profileForm = $('#profile-form');
const raceForm = $('#race-form');
const planForm = $('#plan-form');
let session = null;
let toastTimer;
const ATHLETES_KEY = 'foulee.athletes.v1';
const ACTIVE_ATHLETE_KEY = 'foulee.active-athlete.v1';
const WORKSPACE_SESSION_KEY = 'foulee.workspace-session.v1';
const RACES_KEY = 'foulee.races.v1';
let activeAthleteId = '';
let workspaceUnlocked = false;
let calendarExerciseToOpen = null;
let calendarExerciseOrigin = false;
let sessionEditorState = null;
let importedSourceCache=null,importedCache=[],associationCache=new Map();
let pendingRoute = ['#plan','#profil','#modifier-profil','#modifier-course','#exercices','#calendrier','#libre','#parametres','#plans-enregistres','#editer-plan','#seance'].includes(location.hash) ? location.hash : '#calendrier';
const TOKEN_KEY = 'foulee.server-token';
let syncQueue = Promise.resolve();
let serverItems = {};
const uncachedExerciseItems = new Map();
let serverPolling = false;
let planEditingId = '';
let pendingResultImport = null;

async function requestLocalLLM(path, payload) {
  const token=sessionStorage.getItem(TOKEN_KEY);
  if(!token)throw new Error('Connecte-toi au Mac pour utiliser le LLM local.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),135000);
  try {
    const response=await fetch(path,{method:payload?'POST':'GET',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:payload?JSON.stringify(payload):undefined,cache:'no-store',signal:controller.signal});
    const result=await response.json();
    if(!response.ok)throw new Error(response.status===401?'Session expirée : reconnecte-toi au Mac.':result.error || 'Lecture LLM indisponible.');
    return result;
  } catch(error) {
    if(error.name==='AbortError')throw new Error('Délai de lecture dépassé. Réessaie avec un modèle plus rapide.');
    if(error instanceof TypeError)throw new Error('Mac inaccessible. Vérifie la connexion avant de relancer la lecture.');
    throw error;
  } finally {clearTimeout(timer);}
}

// Bound LAN requests so an unreachable Mac cannot freeze the sync queue.
async function serverFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = options.method === 'PUT' || options.method === 'POST' && url === '/api/state' ? 60000 : 12000;
  const timer = setTimeout(() => controller.abort(), timeout);
  try { return await fetch(url, {...options, signal:controller.signal}); }
  catch(error) {
    if(error.name === 'AbortError' || error instanceof TypeError) throw new Error('Mac inaccessible. Vérifie le Wi-Fi et que Foulée est lancé sur le Mac, puis réessaie.');
    throw error;
  } finally {clearTimeout(timer);}
}
let refreshInFlight = false;

function updateSyncConnect() {
  const button = $('#sync-connect');
  if (!button) return;
  const state = $('.local-badge')?.dataset.sync;
  button.hidden = !$('#access-page').hidden;
  button.textContent=sessionStorage.getItem(TOKEN_KEY)?'Reconnecter au Mac':'Connecter au Mac';
  const target = $('#active-user-toolbar').hidden ? $('#chooser-sync-actions') : $('.toolbar-tools-list');
  if (target && button.parentElement !== target) target.prepend(button);
}
function syncStatus(message, state='') {
  const badge = $('.local-badge');
  if (badge) { badge.title = message; badge.dataset.sync = state; badge.innerHTML = `<span></span> ${message}`; }
  updateSyncConnect();
}
// IndexedDB keeps large exercise imports and pending writes across restarts.
let offlineDB;
let appInitialized = false;
let flushing = false;
const pendingWrites = new Map();
function offlineTransaction(stores, action) {
  return new Promise((resolve,reject) => {
    const tx=offlineDB.transaction(stores,'readwrite');
    action(tx);
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
  });
}
async function prepareOfflineStorage() {
  offlineDB=await new Promise((resolve,reject)=>{
    const request=indexedDB.open('foulee-offline',1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('items');request.result.createObjectStore('pending');};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
  for(const store of ['items','pending']) {
    await new Promise((resolve,reject)=>{
      const tx=offlineDB.transaction(store);const request=tx.objectStore(store).openCursor();
      request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;
        if(store==='pending')pendingWrites.set(cursor.key,cursor.value);
        else cacheSharedValue(cursor.key,cursor.value,false);
        cursor.continue();};
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
  }
}
function persistRemote(key,value) {
  pendingWrites.set(key,value);
  syncStatus('Enregistrement sur cet appareil…','saving');
  syncQueue=syncQueue.then(()=>offlineTransaction(['items','pending'],tx=>{
    tx.objectStore('items').put(value,key);tx.objectStore('pending').put(value,key);
  })).then(()=>flushPendingWrites()).catch(error=>{
    console.warn('Sauvegarde Foulée :',error.message);
    syncStatus('Sauvegarde locale impossible · exporte tes données','error');
  });
}
async function flushPendingWrites() {
  if(flushing)return;
  if(!sessionStorage.getItem(TOKEN_KEY)) {
    if(pendingWrites.size)syncStatus('Modifications locales · reconnecte-toi pour synchroniser','offline');
    return;
  }
  flushing=true;
  try {
    for(const [key,value] of pendingWrites) {
      const response=await serverFetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json','Authorization':`Bearer ${sessionStorage.getItem(TOKEN_KEY)}`},body:JSON.stringify({key,value})});
      if(response.status===401){sessionStorage.removeItem(TOKEN_KEY);syncStatus('Modifications conservées · code d’accès requis pour synchroniser','offline');return;}
      if(!response.ok)throw Error('Synchronisation impossible');
      serverItems[key]=value;
      if(pendingWrites.get(key)===value){
        // Serialize deletion with writes, so a newer edit cannot be removed.
        await offlineTransaction(['pending'],tx=>{
          if(pendingWrites.get(key)===value){tx.objectStore('pending').delete(key);pendingWrites.delete(key);}
        });
      }
    }
    syncStatus('Données synchronisées avec le Mac','saved');
  } catch(error){syncStatus('Hors connexion · modifications conservées sur cet appareil','offline');}
  finally{flushing=false;}
}
function openLocalApp() {
  $('#access-page').hidden=true;$('.local-badge').hidden=false;
  updateSyncConnect();$('#offline-continue').hidden=false;
  initializeApp();
  syncStatus('Hors connexion · données de cet appareil','offline');
  startServerPolling();
}
function startServerPolling() {
  if(!serverPolling){serverPolling=true;setInterval(refreshSharedState,5000);}
}
window.addEventListener('online',()=>refreshSharedState());

function newId() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function readAthletes() { try { return JSON.parse(localStorage.getItem(ATHLETES_KEY)) || []; } catch { return []; } }
function writeAthletes(items) { const value=JSON.stringify(items); localStorage.setItem(ATHLETES_KEY, value); persistRemote(ATHLETES_KEY,value); }
function storageKey(key) { return `foulee.athlete.${activeAthleteId}.${key}`; }
// Exercise data is durable on the Mac; localStorage is only an optional browser cache.
function cacheSharedValue(key, value, durable=true) {
  if(durable && offlineDB) {
    syncQueue=syncQueue.then(()=>offlineTransaction(['items'],tx=>tx.objectStore('items').put(value,key))).catch(()=>syncStatus('Sauvegarde locale impossible · exporte tes données','error'));
  }
  try {localStorage.setItem(key,value);uncachedExerciseItems.delete(key);}
  catch(error) {
    if(error.name!=='QuotaExceededError' || !key.endsWith('.'+ExerciseModule.storageKey)) throw error;
    uncachedExerciseItems.set(key,value);
    localStorage.removeItem(key); // Free any obsolete copy; reads use the in-memory cache.
  }
}
function getData(key) {
  const fullKey=storageKey(key);
  return uncachedExerciseItems.has(fullKey)?uncachedExerciseItems.get(fullKey):localStorage.getItem(fullKey);
}
function setData(key, value) {
  let storedValue=value;
  if(key===PLAN_KEY){
    let plan; try{plan=JSON.parse(value);}catch{return;}
    if(!plan.id) plan.id=newId();
    storedValue=JSON.stringify(plan);
  }
  const fullKey=storageKey(key); cacheSharedValue(fullKey, storedValue); persistRemote(fullKey,storedValue);
  if(key===PLAN_KEY){
    const plan=JSON.parse(storedValue);
    let plans=[]; try{plans=JSON.parse(getData(PLANS_KEY))||[];}catch{}
    const index=plans.findIndex(item=>item.id===plan.id);
    if(index>=0) plans[index]=plan; else plans.unshift(plan);
    const plansKey=storageKey(PLANS_KEY), plansValue=JSON.stringify(plans);
    localStorage.setItem(plansKey,plansValue); persistRemote(plansKey,plansValue);
    const activeKey=storageKey(ACTIVE_PLAN_KEY); localStorage.setItem(activeKey,plan.id); persistRemote(activeKey,plan.id);
  }
}
function initializeAthletes() {
  let athletes = readAthletes();
  if (!athletes.length) {
    const legacyProfile = (() => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch { return {}; } })();
    const legacyData = Object.fromEntries([PROFILE_KEY,RACES_KEY,PLAN_KEY,SESSION_KEY].map(key=>[key,localStorage.getItem(key)]));
    if (Object.values(legacyData).some(value=>value!==null)) {
      const id = newId();
      athletes = [{id, name: legacyProfile.name || 'Mon profil'}];
      writeAthletes(athletes);
      for (const [key,value] of Object.entries(legacyData)) if(value!==null) setDataFor(id,key,value);
    }
  }
  activeAthleteId = localStorage.getItem(ACTIVE_ATHLETE_KEY) || athletes[0]?.id || '';
  if (!athletes.some(item => item.id === activeAthleteId)) activeAthleteId = athletes[0]?.id || '';
  if(activeAthleteId) localStorage.setItem(ACTIVE_ATHLETE_KEY, activeAthleteId);
  else localStorage.removeItem(ACTIVE_ATHLETE_KEY);
}
function setDataFor(id, key, value) { const fullKey=`foulee.athlete.${id}.${key}`; cacheSharedValue(fullKey, value); persistRemote(fullKey,value); }
function renderAthleteOptions() {
  const athletes=readAthletes();
  const current=athletes.find(item=>item.id===activeAthleteId);
  const label=$('#active-athlete-label'); if(label) label.textContent=current?.name||'';
  const list=$('#athlete-choice-list');
  if(list){
    list.innerHTML=athletes.length?athletes.map(item=>'<button type="button" class="athlete-choice" data-athlete-id="'+escapeHtml(item.id)+'"><span class="athlete-choice-mark">'+escapeHtml((item.name||'?').trim().slice(0,1).toUpperCase())+'</span><span class="athlete-choice-name">'+escapeHtml(item.name)+'</span><span class="athlete-choice-arrow">→</span></button>').join(''):'<p class="no-athletes">Aucun profil pour le moment. Crée le premier espace pour commencer.</p>';
    list.querySelectorAll('[data-athlete-id]').forEach(button=>button.addEventListener('click',()=>enterAthleteWorkspace(button.dataset.athleteId)));
  }
}
function enterAthleteWorkspace(id, route=pendingRoute) {
  if (!readAthletes().some(item => item.id === id)) return;
  activeAthleteId=id; localStorage.setItem(ACTIVE_ATHLETE_KEY,id); workspaceUnlocked=true;
  sessionStorage.setItem(WORKSPACE_SESSION_KEY,id);
  fillProfile(); renderRaces(); loadPlanForm(); loadSession(); renderAthleteOptions();
  const destination=route||'#calendrier';
  navigateToRoute(destination);
}
function createAthlete(event) {
  event.preventDefault();
  const input=$('#new-athlete-name'), name=input.value.trim().slice(0,50);
  if(!name){input.focus();return;}
  const athlete={id:newId(),name}; writeAthletes([...readAthletes(),athlete]);
  setDataFor(athlete.id,PROFILE_KEY,JSON.stringify({name}));
  pendingRoute='#profil'; enterAthleteWorkspace(athlete.id,'#profil');
  showToast('Profil créé : complète tes repères sportifs');
}
function returnToUserChooser() {
  workspaceUnlocked=false; pendingRoute='#calendrier';
  sessionStorage.removeItem(WORKSPACE_SESSION_KEY);
  if(location.hash==='#choisir') renderPage(); else location.hash='#choisir';
}
function switchAthlete(id) {
  if (!readAthletes().some(item => item.id === id)) return;
  activeAthleteId = id; planEditingId='';
  if(workspaceUnlocked)sessionStorage.setItem(WORKSPACE_SESSION_KEY,id);
  localStorage.setItem(ACTIVE_ATHLETE_KEY, id);
  session = null;
  fillProfile(); renderRaces(); loadPlanForm();
  const plan=loadPlan();$('#plan-form-panel').hidden=true;$('#plan-detail-panel').hidden=!plan;
  if(plan)renderPlan(plan);renderPlanLibrary();
  loadSession(); renderAthleteOptions(); renderPage();
}
function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
function exportAthlete() {
  const athlete = readAthletes().find(item => item.id === activeAthleteId);
  const data = Object.fromEntries([PROFILE_KEY,RACES_KEY,PLAN_KEY,SESSION_KEY,ExerciseModule.storageKey].map(key => [key, getData(key) ? JSON.parse(getData(key)) : null]));
  downloadJson({format:'foulee-athlete-v1', athlete:{...athlete}, exportedAt:new Date().toISOString(), data}, `foulee-${athlete.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.json`);
  showToast('Dossier individuel exporté');
}
function importAthleteFile(event) {
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file || !ExerciseModule.confirmImport(file)) return;
  file.text().then(text => {
    const bundle = JSON.parse(text);
    if (bundle.format !== 'foulee-athlete-v1' || !bundle.athlete?.id || !bundle.data) throw new Error('Format de dossier non reconnu.');
    const athletes = readAthletes();
    let imported = bundle.athlete;
    if (athletes.some(item => item.id === imported.id)) {
      imported = {...imported, sourceIds:[...new Set([...(imported.sourceIds || []), imported.id])], id:newId(), name:`${imported.name || 'Profil'} (importé)`};
    }
    writeAthletes([...athletes, imported]);
    for (const key of [PROFILE_KEY,RACES_KEY,PLAN_KEY,SESSION_KEY,ExerciseModule.storageKey]) {
      if (bundle.data[key] != null) setDataFor(imported.id, key, JSON.stringify(bundle.data[key]));
    }
    switchAthlete(imported.id); showToast(`Dossier de ${imported.name} importé`);
  }).catch(error => showToast(error.message || 'Impossible de lire ce fichier'));
}
function stripHealthKitDetails(jsonText) {
  // The companion can include thousands of HealthKit samples and GPS points.
  // Foulée only needs the compact result fields, so remove each healthKit object
  // before JSON.parse to avoid allocating a huge tree on iPhone Safari.
  const pattern=/"healthKit"\s*:\s*\{/g, ranges=[];
  let match;
  while((match=pattern.exec(jsonText))){
    if(match.index>0&&jsonText[match.index-1]==='\\')continue;
    const open=match.index+match[0].lastIndexOf('{');let depth=0,inString=false,escaped=false,end=-1;
    for(let i=open;i<jsonText.length;i++){
      const char=jsonText[i];
      if(inString){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')inString=false;continue;}
      if(char==='"'){inString=true;continue;}
      if(char==='{')depth++;
      else if(char==='}'&&--depth===0){end=i+1;break;}
    }
    if(end>open){ranges.push([open,end]);pattern.lastIndex=end;}
  }
  for(let i=ranges.length-1;i>=0;i--){const [start,end]=ranges[i];jsonText=jsonText.slice(0,start)+'{}'+jsonText.slice(end);}
  return jsonText;
}
function openResultMatchDialog(payload, plan) {
  const sessions=plan.weeks.flatMap((week,weekIndex)=>week.sessions.map((item,sessionIndex)=>({item,weekIndex,sessionIndex})))
    .sort((a,b)=>(a.item.scheduledDate||'').localeCompare(b.item.scheduledDate||''));
  const results=payload.results.filter(result=>result.date&&Number.isFinite(Number(result.durationMin))&&Number(result.durationMin)>0);
  if(!results.length)throw new Error('Le fichier ne contient aucun résultat avec une date et une durée valides.');
  const rows=results.map((result,index)=>{
    const byId=result.workoutId?sessions.filter(entry=>entry.item.id===result.workoutId):[];
    const byDate=sessions.filter(entry=>entry.item.scheduledDate===result.date);
    const matched=byId.length===1?byId[0]:byDate.length===1?byDate[0]:null;
    const metrics=[formatMinutes(result.durationMin),result.distanceKm?Number(result.distanceKm).toFixed(2)+' km':null,result.averagePace?String(result.averagePace)+' min/km':null].filter(Boolean).join(' · ');
    const options=sessions.map(entry=>{
      const item=entry.item, key=entry.weekIndex+':'+entry.sessionIndex;
      return '<option value="'+key+'" '+(matched===entry?'selected':'')+'>'+escapeHtml(formatDateShort(item.scheduledDate||result.date))+' · S'+String(entry.weekIndex+1).padStart(2,'0')+' · '+escapeHtml(item.name||'Séance')+'</option>';
    }).join('');
    return '<article class="result-match-row"><div class="result-match-summary"><b>Résultat '+(index+1)+' · '+escapeHtml(formatDateShort(result.date))+'</b><span>'+escapeHtml(metrics)+'</span></div><label for="result-match-'+index+'">Séance correspondante</label><select class="result-match-select" id="result-match-'+index+'" data-result-index="'+index+'" required><option value="">Choisir une séance…</option>'+options+'<option value="skip">Ignorer ce résultat</option></select></article>';
  });
  pendingResultImport={payload,plan,results,sessions};
  $('#result-match-list').innerHTML=rows.join('');
  const dialog=$('#result-match-dialog');
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
}
function importResultsFile(event) {
  const file=event.target.files?.[0];event.target.value='';if(!file || !ExerciseModule.confirmImport(file))return;
  const byteSize=(file.size/1024/1024).toFixed(1);
  showToast('Lecture du fichier ('+byteSize+' Mo)…');
  file.text().then(text=>{
    const payload=JSON.parse(stripHealthKitDetails(text));
    if(payload.format!=='foulee-results-v1'||!Array.isArray(payload.results))throw new Error('Format de résultats non reconnu.');
    const athlete=readAthletes().find(item=>item.id===activeAthleteId);
    if(!athlete)throw new Error('Sélectionne d’abord un profil sportif.');
    if(payload.athleteId&&payload.athleteId!==activeAthleteId&&!(athlete.sourceIds||[]).includes(payload.athleteId))throw new Error(`Ce fichier concerne ${payload.athleteName||'un autre profil'}. Sélectionne d’abord son espace.`);
    const plan=loadPlan();if(!plan)throw new Error('Aucun plan enregistré dans cet espace. Crée ou sélectionne un plan avant d’importer les résultats.');
    openResultMatchDialog(payload,plan);
  }).catch(error=>showToast(error.message||'Impossible de lire ce fichier'));
}
function saveImportedResults(event) {
  event.preventDefault();if(!pendingResultImport)return;
  const {plan,results,sessions}=pendingResultImport;
  const selections=[...document.querySelectorAll('.result-match-select')].map(select=>({index:Number(select.dataset.resultIndex),value:select.value}));
  if(selections.some(selection=>!selection.value)){showToast('Associe chaque résultat à une séance ou choisis « Ignorer ».');return;}
  const chosen=selections.filter(selection=>selection.value!=='skip');
  if(!chosen.length){$('#result-match-dialog').close();pendingResultImport=null;return;}
  if(new Set(chosen.map(item=>item.value)).size!==chosen.length){showToast('Une séance ne peut recevoir qu’un résultat par import.');return;}
  let imported=0;
  for(const selection of chosen){
    const [weekIndex,sessionIndex]=selection.value.split(':').map(Number), result=results[selection.index];
    const candidate=sessions.find(entry=>entry.weekIndex===weekIndex&&entry.sessionIndex===sessionIndex)?.item;
    if(!candidate)continue;
    candidate.status='done';candidate.actualMinutes=String(Math.round(Number(result.durationMin)));
    if(result.distanceKm!=null&&Number.isFinite(Number(result.distanceKm)))candidate.actualDistanceKm=Number(result.distanceKm);
    if(result.averagePace)candidate.actualPace=String(result.averagePace);
    imported++;
  }
  const athlete=readAthletes().find(item=>item.id===activeAthleteId);
  setData(PLAN_KEY,JSON.stringify(plan));renderPlan(plan);
  $('#result-match-dialog').close();pendingResultImport=null;
  showToast(`${imported} résultat${imported>1?'s':''} importé${imported>1?'s':''} pour ${athlete?.name||'ce profil'}`);
}

const goalLabels = {
  endurance: 'Développer mon endurance', '10k': 'Préparer un 10 km', semi: 'Préparer un semi-marathon', marathon: 'Préparer un marathon', reprise: 'Reprendre progressivement'
};
const typeLabels = { easy: 'Footing', tempo: 'Tempo', intervals: 'VMA', long: 'Sortie longue' };
const templates = {
  easy: { title: 'Endurance fondamentale', note: 'Relâche les épaules et garde une respiration confortable.', steps: [
    ['Endurance facile', '50', 'min', 'Conversation aisée']
  ]},
  tempo: { title: 'Tempo progressif', note: 'Reste maîtrisé : termine avec la sensation que tu aurais pu prolonger un peu.', steps: [
    ['Échauffement', '15', 'min', 'Facile'], ['Tempo soutenu', '3 × 6', 'min', 'Soutenu, régulier'], ['Récupération', '2', 'min', 'Trot entre les blocs'], ['Retour au calme', '10', 'min', 'Facile']
  ]},
  intervals: { title: 'Intervalles courts', note: 'Cours vite mais sans sprinter. Privilégie une foulée relâchée et régulière.', steps: [
    ['Échauffement', '15', 'min', 'Facile + mobilité'], ['Fractionné', '8 × 1', 'min', 'Vif, contrôlé'], ['Récupération', '1', 'min', 'Trot lent entre les blocs'], ['Retour au calme', '10', 'min', 'Facile']
  ]},
  long: { title: 'Sortie longue en aisance', note: 'Reste en aisance respiratoire. Raccourcis la séance si la fatigue s’installe.', steps: [
    ['Endurance facile', '65', 'min', 'Conversation aisée']
  ]}
};

function loadProfile() {
  try { return JSON.parse(getData(PROFILE_KEY)) || {}; } catch { return {}; }
}
function saveProfile(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(profileForm).entries());
  setData(PROFILE_KEY, JSON.stringify(data));
  const athletes = readAthletes(), athlete = athletes.find(item => item.id === activeAthleteId);
  if (athlete && data.name?.trim()) { athlete.name = data.name.trim().slice(0,50); writeAthletes(athletes); renderAthleteOptions(); }
  renderProfileSummary();
  navigateToRoute('#profil');
  showToast('Profil enregistré');
}
function fillProfile() {
  const profile = loadProfile();
  for (const [key, value] of Object.entries(profile)) {
    const control = profileForm.elements.namedItem(key);
    if (control) control.value = value;
  }
  renderProfileSummary();
}
function renderProfileSummary() {
  const profile = loadProfile();
  const races = loadRaces();
  const summary = $('#profile-summary');
  if (!profile.name && !profile.goal && !races.length) {
    summary.innerHTML = '<p class="profile-empty">Ajoute tes repères et tes temps de course pour personnaliser ton espace running.</p>';
    return;
  }
  const latest = [...races].sort((a,b) => b.date.localeCompare(a.date))[0];
  const facts = [goalLabels[profile.goal], profile.easyPace ? 'Allure facile : ' + profile.easyPace + '/km' : '', latest ? 'Dernière course : ' + latest.type + ', ' + formatRaceTime(latest) : ''].filter(Boolean);
  summary.innerHTML = '<strong class="profile-greeting">' + escapeHtml(profile.name || 'Profil sportif') + '</strong><ul>' + facts.map(fact => '<li>' + escapeHtml(fact) + '</li>').join('') + '</ul>';
}
function renderProfileRead() {
  const profile=loadProfile(),athlete=readAthletes().find(item=>item.id===activeAthleteId);
  const goals={endurance:'Développer mon endurance','10k':'Préparer un 10 km',semi:'Préparer un semi-marathon',marathon:'Préparer un marathon',reprise:'Reprendre progressivement'};
  const levels={debutant:'Débutant',regulier:'Régulier',confirme:'Confirmé'};
  $('#profile-read-details').innerHTML=[['Nom',profile.name||athlete?.name||'À renseigner'],['Objectif principal',goals[profile.goal]||'À renseigner'],['Expérience',levels[profile.level]||'À renseigner']].map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+escapeHtml(value)+'</dd></div>').join('');
}
function beginNewRace() {
  resetRaceForm();$('#race-editor-title').textContent='Ajouter une course';navigateToRoute('#modifier-course');
}
function loadRaces() {
  try { return JSON.parse(getData(RACES_KEY)) || []; } catch { return []; }
}
function saveRaces(races) {
  setData(RACES_KEY, JSON.stringify(races));
  renderRaces();
  renderProfileSummary();
}
function formatRaceTime(race) {
  const h = Number(race.hours || 0), m = Number(race.minutes || 0), s = Number(race.seconds || 0);
  return (h ? h + ' h ' : '') + String(m).padStart(h ? 2 : 1, '0') + ' min ' + String(s).padStart(2, '0') + ' s';
}
function raceDistanceLabel(race) {
  if (race.type === 'Trail' || race.type === 'Autre') return race.distance ? race.type + ' · ' + race.distance + ' km' : race.type;
  return race.type;
}
function renderRaces() {
  const races = loadRaces().sort((a,b) => b.date.localeCompare(a.date));
  $('#race-count').textContent = races.length + ' ' + (races.length === 1 ? 'course' : 'courses');
  const list = $('#race-list');
  if (!races.length) {
    list.innerHTML = '<p class="race-empty">Tes courses ajoutées apparaîtront ici.</p>';
    return;
  }
  list.innerHTML = races.map(race => '<article class="race-entry trophy-card" data-id="'+escapeHtml(race.id)+'"><div class="trophy-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 14v5m-4 2h8"/></svg></div><div class="race-entry-main"><h3>'+escapeHtml(race.raceName||race.type)+'</h3><span class="race-distance">'+escapeHtml(raceDistanceLabel(race))+'</span><time class="race-date" datetime="'+escapeHtml(race.date)+'">'+escapeHtml(new Date(race.date+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}))+'</time><strong class="race-time">'+escapeHtml(formatRaceTime(race))+'</strong></div><div class="race-entry-actions"><button type="button" data-action="edit">Modifier</button><button type="button" data-action="delete" aria-label="Supprimer '+escapeHtml(race.raceName||race.type)+'">Supprimer</button></div></article>').join('');
  list.querySelectorAll('.race-entry').forEach(entry => {
    entry.querySelector('[data-action="edit"]').addEventListener('click', () => editRace(entry.dataset.id));
    entry.querySelector('[data-action="delete"]').addEventListener('click', () => {
      saveRaces(loadRaces().filter(race => race.id !== entry.dataset.id));
      showToast('Course supprimée');
    });
  });
}
function setRaceTypeFields() {
  $('#custom-distance-row').hidden = !['Trail', 'Autre'].includes($('#race-type').value);
}
function resetRaceForm() {
  raceForm.reset();
  raceForm.elements.namedItem('id').value = '';
  $('#save-race').innerHTML = '<span>Ajouter cette course</span><span>＋</span>';
  $('#cancel-race-edit').hidden = false;
  setRaceTypeFields();
}
function saveRace(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(raceForm).entries());
  if (!data.hours && !data.minutes && !data.seconds) {
    showToast('Renseigne le temps réalisé');
    return;
  }
  const current = loadRaces();
  const raceId = data.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  const race = {...data, id: raceId};
  const existing = current.findIndex(item => item.id === race.id);
  if (existing >= 0) current[existing] = race;
  else current.push(race);
  saveRaces(current);
  resetRaceForm();
  navigateToRoute('#profil');
  showToast(existing >= 0 ? 'Course mise à jour' : 'Course ajoutée à ton historique');
}
function editRace(id) {
  const race = loadRaces().find(item => item.id === id);
  if (!race) return;
  raceForm.reset();
  for (const [key, value] of Object.entries(race)) {
    const field = raceForm.elements.namedItem(key);
    if (field) field.value = value;
  }
  setRaceTypeFields();
  $('#save-race').innerHTML = '<span>Enregistrer les changements</span><span>✓</span>';
  $('#cancel-race-edit').hidden = false;
  $('#race-editor-title').textContent='Modifier cette course';
  navigateToRoute('#modifier-course');
}
const raceDistances = { '5 km': 5, '10 km': 10, 'Semi-marathon': 21.0975, 'Marathon': 42.195 };
const goalDistances = { '5k': 5, '10k': 10, semi: 21.0975, marathon: 42.195 };
const goalNames = { '5k': '5 km', '10k': '10 km', semi: 'Semi-marathon', marathon: 'Marathon' };
const goalPaceAdjustments = { '5k': {threshold: 5, interval: 12, easy: 45}, '10k': {threshold: 8, interval: 20, easy: 70}, semi: {threshold: 10, interval: 27, easy: 85}, marathon: {threshold: 12, interval: 32, easy: 100} };
function dateInputValue(date) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
  return y + '-' + m + '-' + d;
}
function loadPlanForm(saved=loadPlan()) {
  planForm.reset();
  renderPaceSettings(saved);
  if (saved?.settings) {
    for (const [key,value] of Object.entries(saved.settings)) {
      const field = planForm.elements.namedItem(key);
      if (field) field.value = value;
    }
  } else {
    const start = new Date();
    $('#plan-start').value = dateInputValue(start);
  }
  planForm.elements.namedItem('title').value=saved?.settings?.title||goalNames[saved?.settings?.goal]||'';
  if(saved?.targetSeconds){planForm.elements.namedItem('targetHours').value=Math.floor(saved.targetSeconds/3600);planForm.elements.namedItem('targetMinutes').value=Math.floor(saved.targetSeconds%3600/60);}
  const selectedWeekdays = saved?.settings?.trainingWeekdays || defaultWeekdays(Number(planForm.elements.namedItem('days').value));
  document.querySelectorAll('input[name=trainingWeekday]').forEach(box => box.checked = selectedWeekdays.includes(box.value));
  updatePlanDayCount();
  updatePlanKindFields();
  updateTargetPlaceholders();
  populateReferenceRaces(saved?.settings?.referenceRaceId);
}
function defaultWeekdays(count) {
  const presets={2:['2','0'],3:['2','4','0'],4:['1','2','4','0'],5:['1','2','4','6','0']};
  return presets[count] || presets[3];
}
function setDefaultWeekdays() {
  const values=defaultWeekdays(Number($('#plan-days').value));
  document.querySelectorAll('input[name=trainingWeekday]').forEach(box => box.checked=values.includes(box.value));
}
function populateReferenceRaces(selectedId) {
  const select=$('#reference-race');
  if(!select) return;
  const races=loadRaces().filter(race => raceDistances[race.type] || Number(race.distance)>0).sort((a,b)=>b.date.localeCompare(a.date));
  const current=selectedId || (races.length ? 'latest' : 'none');
  const options=['<option value="latest">La plus récente — sélection automatique</option>'];
  if(!races.length) options[0]='<option value="none">Aucune — utiliser le temps visé</option>';
  else races.forEach(race => {
    const distance=raceDistances[race.type] || Number(race.distance);
    const time=String(Number(race.hours||0)*3600+Number(race.minutes||0)*60+Number(race.seconds||0));
    const label=(race.raceName ? race.raceName+' · ' : '')+raceDistanceLabel(race)+' · '+formatRaceTime(race)+' · '+new Date(race.date+'T12:00:00').toLocaleDateString('fr-FR');
    options.push('<option value="'+escapeHtml(race.id)+'">'+escapeHtml(label)+'</option>');
  });
  if(races.length) options.push('<option value="none">Aucune — utiliser le temps visé</option>');
  select.innerHTML=options.join('');
  select.value=[...select.options].some(option=>option.value===current)?current:(races.length?'latest':'none');
}
function loadPlans() {
  try {
    const saved=JSON.parse(getData(PLANS_KEY));
    if(Array.isArray(saved)) return typeof migratePlanSessions==='function'?migratePlanSessions(saved):saved;
  } catch {}
  try {
    const legacy=JSON.parse(getData(PLAN_KEY));
    if(legacy&&Array.isArray(legacy.weeks)){
      legacy.id=legacy.id||newId(); legacy.createdAt=legacy.createdAt||new Date().toISOString();
      const data=JSON.stringify([legacy]), key=storageKey(PLANS_KEY);
      localStorage.setItem(key,data);persistRemote(key,data);
      const active=storageKey(ACTIVE_PLAN_KEY);localStorage.setItem(active,legacy.id);persistRemote(active,legacy.id);
      return typeof migratePlanSessions==='function'?migratePlanSessions([legacy]):[legacy];
    }
  } catch {}
  return [];
}
function loadPlan() {
  const plans=loadPlans();
  if(!plans.length)return null;
  const selected=getData(ACTIVE_PLAN_KEY);
  if(selected==='')return null;
  return plans.find(plan=>plan.id===selected)||plans[0];
}
function selectPlan(id) {
  const plan=loadPlans().find(item=>item.id===id); if(!plan)return;
  if(loadPlan()){showToast('Désactive le plan actif avant d’activer un autre plan');return;}
  setData(ACTIVE_PLAN_KEY,id);planEditingId='';
  $('#plan-form-panel').hidden=true;$('#plan-detail-panel').hidden=false;
  renderPlan(plan);renderPlanLibrary();showToast('Plan actif mis à jour');
}
function deactivatePlan(id) {
  const plan=loadPlan();if(plan?.id!==id)return;
  const title=plan.settings?.title||goalNames[plan.settings?.goal]||'ce plan';
  if(!confirm('Rendre inactif le plan « '+title+' » ?'))return;
  setData(ACTIVE_PLAN_KEY,'');
  const key=storageKey(PLAN_KEY);cacheSharedValue(key,'null');persistRemote(key,'null');
  $('#plan-detail-panel').hidden=true;$('#plan-empty').hidden=false;$('#plan-results').innerHTML='';
  renderPlanLibrary();showToast('Aucun plan actif');
}
function renderPlanLibrary() {
  const list=$('#saved-plans-list');if(!list)return;
  const plans=loadPlans(),selected=loadPlan();
  if(!plans.length){list.innerHTML='<div class="plans-empty"><b>Aucun plan enregistré</b><button type="button" class="secondary-button" data-new-plan>Créer mon premier plan</button></div>';list.querySelector('[data-new-plan]').onclick=beginNewPlan;return;}
  list.innerHTML=plans.map(plan=>{
    const goal=goalNames[plan.settings?.goal]||'Course',progress=planProgress(plan),active=selected?.id===plan.id;
    const title=plan.settings?.title?.trim()||goal;
    const endLabel=plan.settings?.kind==='general'?'Date de fin':'Date de la course';
    const endDate=plan.settings?.raceDate?formatDateShort(plan.settings.raceDate):'À définir';
    return '<article class="saved-plan-card '+(active?'is-selected':'')+'"><div class="saved-plan-info"><h3>'+escapeHtml(title)+'</h3><p>'+escapeHtml(goal)+(plan.targetSeconds?' · '+escapeHtml(timeText(plan.targetSeconds)):'')+'</p><p class="saved-plan-end">'+endLabel+' : '+escapeHtml(endDate)+'</p><small>'+progress.done+' / '+progress.total+' séances réalisées</small></div><div class="saved-plan-actions"><button type="button" class="saved-plan-toggle" data-select-plan="'+escapeHtml(plan.id)+'" data-active="'+active+'" aria-pressed="'+active+'" '+(!active&&selected?'disabled title="Désactive le plan actif pour activer celui-ci" ':'')+'aria-label="'+(active?'Désactiver':'Activer')+' le plan '+escapeHtml(title)+'">'+(active?'Actif':'Inactif')+'</button><button type="button" class="saved-plan-edit" data-edit-plan="'+escapeHtml(plan.id)+'">Modifier</button><button type="button" class="saved-plan-delete" '+(active?'disabled title="Désactive ce plan avant de le supprimer" ':'')+'data-delete-plan="'+escapeHtml(plan.id)+'">Supprimer</button></div></article>';
  }).join('');
  list.querySelectorAll('[data-select-plan]').forEach(button=>button.onclick=()=>button.dataset.active==='true'?deactivatePlan(button.dataset.selectPlan):selectPlan(button.dataset.selectPlan));
  list.querySelectorAll('[data-edit-plan]').forEach(button=>button.onclick=()=>beginPlanEdit(button.dataset.editPlan));
  list.querySelectorAll('[data-delete-plan]').forEach(button=>button.onclick=()=>deletePlan(button.dataset.deletePlan));
}

function deletePlan(id) {
  const plans=loadPlans(), plan=plans.find(item=>item.id===id);
  if(!plan)return;
  if(loadPlan()?.id===id){showToast('Désactive ce plan avant de le supprimer');return;}
  const label=plan.settings?.title?.trim()||(goalNames[plan.settings?.goal]||'Course')+' · '+(plan.settings?.raceDate?formatDateShort(plan.settings.raceDate):'Date à définir');
  if(!confirm('Supprimer le plan « '+label+' » et toutes ses séances ? Cette action est définitive. Les exercices importés sont conservés.'))return;
  const selected=loadPlan(), remaining=plans.filter(item=>item.id!==id);
  const next=selected?(remaining.find(item=>item.id===selected.id)||remaining[0]||null):null;
  setData(PLANS_KEY,JSON.stringify(remaining));
  setData(ACTIVE_PLAN_KEY,next?.id||'');
  // Keep the legacy snapshot consistent for exports and older clients.
  const legacyKey=storageKey(PLAN_KEY), legacyValue=JSON.stringify(next);
  cacheSharedValue(legacyKey,legacyValue);persistRemote(legacyKey,legacyValue);
  if(planEditingId===id||selected?.id===id){
    planEditingId='';$('#plan-form-panel').hidden=true;
    $('#plan-detail-panel').hidden=!next;
    if(next)renderPlan(next);
    else $('#plan-results').innerHTML='';
  }
  renderPlanLibrary();
  const focusTarget=$('#saved-plans-list').querySelector('[data-select-plan], [data-new-plan]');
  if(focusTarget)focusTarget.focus();
  showToast('Plan supprimé');
}
function beginNewPlan() {
  $('#plan-pace-settings').innerHTML='';
  navigateToRoute('#editer-plan');
  planEditingId=''; planForm.reset();$('#plan-reference-settings').hidden=false;
  $('#plan-goal').value='10k';$('#plan-days').value='3';
  const start=new Date();$('#plan-start').value=dateInputValue(start);
  const race=new Date(start);race.setDate(race.getDate()+84);$('#plan-race').value=dateInputValue(race);
  document.querySelectorAll('input[name=trainingWeekday]').forEach(box=>box.checked=false);setDefaultWeekdays();
  planForm.elements.namedItem('targetHours').value='';planForm.elements.namedItem('targetMinutes').value='';
  populateReferenceRaces();updateTargetPlaceholders();updatePlanKindFields();updatePlanDayCount();
  $('#plan-editor-title').textContent='Créer un plan';$('#plan-submit-label').textContent='Créer et enregistrer le plan';
  $('#plan-form-panel').hidden=false;$('#plan-detail-panel').hidden=true;
  $('#plan-form-panel').scrollIntoView({behavior:'smooth',block:'start'});
}
function beginPlanEdit(id) {
  const plan=loadPlans().find(item=>item.id===id);if(!plan)return;
  planEditingId=id;loadPlanForm(plan);$('#plan-reference-settings').hidden=true;navigateToRoute('#editer-plan');
  $('#plan-editor-title').textContent='Modifier ce plan';$('#plan-submit-label').textContent='Enregistrer les modifications';
  $('#plan-form-panel').hidden=false;$('#plan-detail-panel').hidden=true;
  $('#plan-form-panel').scrollIntoView({behavior:'smooth',block:'start'});
}
function cancelPlanEdit() {
  planEditingId='';$('#plan-form-panel').hidden=true;
  const plan=loadPlan();$('#plan-detail-panel').hidden=!plan;
  if(plan)renderPlan(plan);navigateToRoute('#plans-enregistres');
}
function updatePlanDayCount() {
  const count=document.querySelectorAll('input[name=trainingWeekday]:checked').length;
  $('#plan-days').value=String(count);
  $('#plan-days-summary').textContent=count+' séance'+(count>1?'s':'')+' par semaine';
}
function updatePlanKindFields() {
  const general=planForm.elements.namedItem('kind').value==='general';
  $('#plan-end-label').textContent=general?'Date de fin':'Date de la course';
  $('#plan-goal-label').textContent=general?'Distance de référence':'Course préparée';
}
function updateTargetPlaceholders() {
  const examples = {'5k':['0','25'],'10k':['0','55'],semi:['2','00'],marathon:['4','00']};
  const value = examples[$('#plan-goal').value];
  planForm.elements.namedItem('targetHours').placeholder = value[0];
  planForm.elements.namedItem('targetMinutes').placeholder = value[1];
}
function timeText(seconds) {
  const rounded = Math.round(seconds);
  const h = Math.floor(rounded / 3600), m = Math.floor((rounded % 3600) / 60), sec = rounded % 60;
  return (h ? h + ' h ' : '') + (h ? String(m).padStart(2,'0') : String(m)) + ' min' + (sec ? ' ' + String(sec).padStart(2,'0') + ' s' : '');
}
function paceFromSecondsPerKm(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const n = Math.round(seconds), m = Math.floor(n / 60), sec = String(n % 60).padStart(2,'0');
  return m + '′' + sec + '″/km';
}
function latestRaceReference(referenceId='latest') {
  if(referenceId==='none') return null;
  const races = loadRaces().filter(race => race.date && raceDistances[race.type] || (race.date && Number(race.distance) > 0));
  races.sort((a,b) => b.date.localeCompare(a.date));
  const race = referenceId && referenceId!=='latest' ? races.find(item=>item.id===referenceId) : races[0];
  if (!race) return null;
  const distance = raceDistances[race.type] || Number(race.distance);
  const seconds = Number(race.hours || 0)*3600 + Number(race.minutes || 0)*60 + Number(race.seconds || 0);
  if (!seconds || !distance) return null;
  return {race, distance, seconds};
}
function estimatePaces(goal, targetSeconds, reference) {
  const distance = goalDistances[goal];
  const goalPace = targetSeconds / distance;
  const adjust = goalPaceAdjustments[goal];
  let easy, thresholdEstimate, interval, thresholdExplanation;
  if (!reference) {
    const profileEasy = paceToMinutes(loadProfile().easyPace);
    easy = profileEasy ? profileEasy*60 : goalPace + adjust.easy;
    thresholdEstimate = goalPace - adjust.threshold;
    interval = goalPace - adjust.interval;
    thresholdExplanation = 'Origine : allure calculée depuis le temps visé (' + paceFromSecondsPerKm(goalPace) + '). Le seuil automatique est placé ' + adjust.threshold + ' s/km plus rapide que cette allure. Sans course enregistrée, cette estimation est provisoire.';
  } else {
    const equivalentPace = d => reference.seconds * Math.pow(d / reference.distance, 1.06) / d;
    const recent10k = equivalentPace(10);
    const recent5k = equivalentPace(5);
    const profileEasy = paceToMinutes(loadProfile().easyPace);
    easy = profileEasy ? profileEasy*60 : recent10k + 85;
    thresholdEstimate = recent10k + 6;
    interval = recent5k + 8;
    thresholdExplanation = 'Origine : ta dernière course enregistrée (' + reference.race.type + ', ' + timeText(reference.seconds) + ') est extrapolée sur 10 km avec la formule de Riegel, puis 6 s/km sont ajoutées. C’est une estimation, pas une mesure physiologique.';
  }
  const manual = paceToMinutes(loadProfile().thresholdPace);
  return {goalPace, easy, threshold: manual ? manual*60 : thresholdEstimate, thresholdEstimate, thresholdManual: Boolean(manual), interval, source: reference ? 'race' : 'provisional', thresholdExplanation};
}
function paceInputFromSeconds(seconds) {
  const rounded = Math.round(seconds), minutes = Math.floor(rounded/60);
  return minutes + ':' + String(rounded%60).padStart(2,'0');
}
function updateThresholdDelta() {
  const input = $('#threshold-override');
  const message = $('#threshold-delta');
  if (!input || !message) return;
  const value = paceToMinutes(input.value);
  if (!value) { message.className = 'threshold-delta threshold-error'; message.textContent = 'Saisis une allure au format 5:55.'; return; }
  const estimated = (planEditingId?loadPlans().find(plan=>plan.id===planEditingId):loadPlan())?.paces?.thresholdEstimate;
  const delta = Math.round(value*60 - estimated);
  const absolute = Math.abs(delta);
  const direction = delta > 0 ? 'plus lente' : delta < 0 ? 'plus rapide' : 'identique';
  const text = absolute + ' s/km ' + direction + ' que l’estimation automatique.';
  if (absolute <= 15) { message.className = 'threshold-delta threshold-close'; message.textContent = 'Écart faible : ' + text; }
  else if (absolute < 30) { message.className = 'threshold-delta threshold-review'; message.textContent = 'À vérifier : ' + text; }
  else if (absolute < 60) { message.className = 'threshold-delta threshold-alert'; message.textContent = 'Écart important : ' + text + ' Vérifie la course de référence et ton allure saisie.'; }
  else { message.className = 'threshold-delta threshold-alert'; message.textContent = 'Écart très important : ' + text + ' Vérifie les données avant d’utiliser ce plan.'; }
}
function phaseFor(index, count) {
  if (index === count-1) return 'Course';
  if (count >= 4 && index >= count-2) return 'Allègement';
  if (count >= 8 && index >= count-5) return 'Spécifique';
  if (index < Math.ceil(count*.25)) return 'Endurance';
  return 'Développement';
}
function computeWorkoutDuration(structure) {
  const reps=Math.max(1,Number(structure.reps)||1);
  return Math.round((Number(structure.warmupMin||0)+reps*Number(structure.workMin||0)+Math.max(0,reps-1)*Number(structure.recoveryMin||0)+Number(structure.cooldownMin||0))*100)/100;
}
function makeWorkout(name,target,structure,detail='') {
  return {name,target,duration:computeWorkoutDuration(structure),structure,detail};
}
function workoutTemplate(goal, index, phase, paces, easyMinutes, longMinutes, recoveryWeek, trainingDays) {
  const easyPace=paceFromSecondsPerKm(paces.easy)||'Aisance conversationnelle';
  const qualityCycle=index%2===0;
  let quality;
  if(goal==='marathon') quality=phase==='Spécifique'
    ? makeWorkout('Allure marathon',paceFromSecondsPerKm(paces.goalPace),{warmupMin:15,reps:3,workMin:10,recoveryMin:3,cooldownMin:4})
    : makeWorkout('Tempo contrôlé',paceFromSecondsPerKm(paces.threshold),{warmupMin:15,reps:3,workMin:8,recoveryMin:2,cooldownMin:7});
  else if(goal==='semi') quality=qualityCycle
    ? makeWorkout('Tempo / seuil',paceFromSecondsPerKm(paces.threshold),{warmupMin:15,reps:3,workMin:8,recoveryMin:2,cooldownMin:7})
    : makeWorkout('Allure semi',paceFromSecondsPerKm(paces.goalPace),{warmupMin:15,reps:3,workMin:8,recoveryMin:2,cooldownMin:7});
  else if(goal==='10k') quality=qualityCycle
    ? makeWorkout('Intervalles',paceFromSecondsPerKm(paces.interval),{warmupMin:15,reps:6,workMin:3,recoveryMin:2,cooldownMin:5})
    : makeWorkout('Tempo',paceFromSecondsPerKm(paces.threshold),{warmupMin:15,reps:2,workMin:10,recoveryMin:3,cooldownMin:10});
  else quality=qualityCycle
    ? makeWorkout('Intervalles courts',paceFromSecondsPerKm(paces.interval),{warmupMin:15,reps:8,workMin:2,recoveryMin:2,cooldownMin:8})
    : makeWorkout('Côtes courtes','Effort vif et maîtrisé',{warmupMin:15,reps:8,workMin:.75,recoveryMin:1.25,cooldownMin:10});
  let easy=Math.round(easyMinutes),long=Math.round(longMinutes);
  if(recoveryWeek){easy=Math.round(easy*.9);long=Math.round(long*.82);quality={...quality,structure:{...quality.structure,reps:Math.max(2,Math.round(quality.structure.reps*.75))}};quality.duration=computeWorkoutDuration(quality.structure);}
  if(phase==='Allègement'){
    easy=Math.round(easy*.8);long=Math.round(long*.72);
    quality={...quality,structure:{...quality.structure,reps:Math.max(2,Math.round(quality.structure.reps*.7)),workMin:Math.round(quality.structure.workMin*.8*4)/4}};
    quality.duration=computeWorkoutDuration(quality.structure);
  }
  const easyWorkout=(name,duration,target=easyPace)=>makeWorkout(name,target,{warmupMin:0,reps:1,workMin:duration,recoveryMin:0,cooldownMin:0});
  const sessions=[];
  if(trainingDays<=3)sessions.push(easyWorkout('Endurance facile',easy));
  if(trainingDays>=4)sessions.push(easyWorkout(trainingDays===5?'Footing récupération':'Endurance facile',Math.max(25,Math.round(easy*.75)),'Très facile, sans forcer'));
  if(trainingDays>=3)sessions.push(quality);
  if(trainingDays>=4)sessions.push(easyWorkout('Endurance facile',easy));
  if(trainingDays===5)sessions.push(easyWorkout('Endurance facile',Math.max(30,Math.round(easy*.8))));
  sessions.push(easyWorkout('Sortie longue',long, easyPace+' · aisance'));
  return sessions;
}
function normalizeWorkout(item) {
  if(item.planSteps){item.phases=freeWorkoutPhases({id:item.id,steps:item.planSteps});}
  if(Array.isArray(item.phases)&&item.phases.length&&item.phases.every(phase=>Number(phase.seconds)>0)){item.duration=phaseTotals(item.phases).minutes;item.structure={warmupMin:0,reps:1,workMin:item.duration,recoveryMin:0,cooldownMin:0};return item;}
  const duration=Number(item.duration)>0?Number(item.duration):40;
  const existing=item.structure;
  const hasCompleteStructure=existing&&['warmupMin','reps','workMin','recoveryMin','cooldownMin'].every(key=>Number.isFinite(Number(existing[key])))&&Number(existing.reps)>=1&&Number(existing.workMin)>0&&Number(existing.warmupMin)>=0&&Number(existing.recoveryMin)>=0&&Number(existing.cooldownMin)>=0&&Math.abs(computeWorkoutDuration(existing)-duration)<.02;
  const continuous=/footing|endurance|sortie longue/i.test(item.name) && !/tempo|seuil|intervall|fractionn/i.test(item.name);
  // Remove the old generated 5 + main + 5 pattern, keeping deliberately edited blocks.
  if(continuous&&!item.structureEdited&&(!hasCompleteStructure||(Number(existing.reps)===1&&Number(existing.warmupMin)===5&&Number(existing.cooldownMin)===5&&Number(existing.recoveryMin)===0))){item.structure={warmupMin:0,reps:1,workMin:duration,recoveryMin:0,cooldownMin:0};item.duration=duration;return item;}
  if(hasCompleteStructure) return item;
  let structure;
  if(/intervall|fractionn/i.test(item.name))structure={warmupMin:15,reps:6,workMin:3,recoveryMin:2,cooldownMin:0};
  else if(/tempo|seuil|allure marathon|allure semi/i.test(item.name))structure={warmupMin:15,reps:3,workMin:8,recoveryMin:2,cooldownMin:0};
  else if(/côte/i.test(item.name))structure={warmupMin:15,reps:8,workMin:.75,recoveryMin:1.25,cooldownMin:0};
  else structure={warmupMin:0,reps:1,workMin:duration,recoveryMin:0,cooldownMin:0};
  let core=computeWorkoutDuration(structure);
  if(core>duration){
    structure.cooldownMin=0;
    structure.recoveryMin=Math.min(structure.recoveryMin,Math.max(0,(duration-structure.warmupMin)/Math.max(1,structure.reps-1)));
    core=computeWorkoutDuration(structure);
    if(core>duration){
      structure.workMin=Math.max(.25,(duration-structure.warmupMin-Math.max(0,structure.reps-1)*structure.recoveryMin)/structure.reps);
      core=computeWorkoutDuration(structure);
    }
    if(core>duration){structure.reps=1;structure.recoveryMin=0;structure.warmupMin=Math.min(structure.warmupMin,Math.max(0,duration-5));structure.workMin=Math.max(.25,duration-structure.warmupMin-5);core=computeWorkoutDuration(structure);}
  }
  structure.cooldownMin=Math.max(0,Math.round((duration-core)*4)/4);
  item.structure=structure;
  item.duration=computeWorkoutDuration(structure);
  return item;
}
function parsePaceSeconds(value) {
  const match=/(\d{1,2})\s*[:′'’]\s*(\d{2})/.exec(value||'');
  if(!match)return null;
  return Number(match[2])<60?Number(match[1])*60+Number(match[2]):null;
}
function formatMinutes(value) {
  const totalSeconds=Math.round(Number(value||0)*60);
  if(totalSeconds<60)return totalSeconds+' s';
  const minutes=Math.floor(totalSeconds/60),seconds=totalSeconds%60;
  return seconds ? minutes+' min '+String(seconds).padStart(2,'0')+' s' : minutes+' min';
}
function workoutDistance(structure,target) {
  const pace=parsePaceSeconds(target);
  if(!pace)return null;
  return Number((Number(structure.reps)*Number(structure.workMin)*60/pace).toFixed(2));
}
function workoutStructureHtml(item) {
  normalizeWorkout(item);
  let structure=item.structure;
  const total=Number(item.duration)>0?Number(item.duration):40;
  // Final display guard: never render a total from the session alongside empty or
  // mismatched component data. This also repairs legacy plans at the render boundary.
  if(!structure||Number(structure.workMin)<=0||Math.abs(computeWorkoutDuration(structure)-total)>=.02){
    const warmup=Math.min(5,Math.max(0,total*.2));
    const cooldown=Math.min(5,Math.max(0,total*.2));
    structure={warmupMin:warmup,reps:1,workMin:Math.max(.25,total-warmup-cooldown),recoveryMin:0,cooldownMin:0};
    structure.cooldownMin=Math.max(0,total-computeWorkoutDuration(structure));
    item.structure=structure;
    item.duration=computeWorkoutDuration(structure);
  }
  const distance=workoutDistance(structure,item.target);
  const reps=Number(structure.reps)||1;
  const workLabel=reps>1 ? reps+' × '+formatMinutes(structure.workMin)+' de travail' : formatMinutes(structure.workMin)+' de travail';
  const workTarget=item.target||'Effort confortable';
  return '<div class="workout-breakdown"><div class="workout-total"><span>Durée totale</span><b>'+escapeHtml(formatMinutes(item.duration))+'</b></div>'+(structure.warmupMin>0?'<div class="breakdown-row"><span>Échauffement</span><b>'+escapeHtml(formatMinutes(structure.warmupMin))+'</b></div>':'')+'<div class="breakdown-row work-row"><span>Travail</span><div><b>'+escapeHtml(workLabel+' · '+workTarget)+'</b><small>'+(distance?'Distance de travail estimée : ~'+distance+' km':'Distance non estimée pour une consigne à l’effort')+'</small></div></div>'+(reps>1&&structure.recoveryMin>0?'<div class="breakdown-row"><span>Récupérations</span><b>'+escapeHtml(formatMinutes(structure.recoveryMin))+' entre les répétitions</b></div>':'')+(structure.cooldownMin>0?'<div class="breakdown-row"><span>Retour au calme</span><b>'+escapeHtml(formatMinutes(structure.cooldownMin))+'</b></div>':'')+'</div>';
}

function weekRange(startDate, weekIndex, finalDate) {
  const start = new Date(startDate + 'T12:00:00');
  start.setDate(start.getDate() + weekIndex*7);
  const end = new Date(start);
  end.setDate(end.getDate()+6);
  if (end > new Date(finalDate + 'T12:00:00')) end.setTime(new Date(finalDate + 'T12:00:00').getTime());
  const options = {day:'numeric',month:'short'};
  return start.toLocaleDateString('fr-FR',options) + ' – ' + end.toLocaleDateString('fr-FR',options);
}
function assignSessionDates(sessions, weekStartValue, raceDateValue, weekdays, isRaceWeek) {
  const weekStart=new Date(weekStartValue+'T12:00:00');
  const ordered=(weekdays||[]).map(Number).map(day=>({day,offset:(day-weekStart.getDay()+7)%7})).sort((a,b)=>a.offset-b.offset);
  const candidates=ordered.map(item=>{const date=new Date(weekStart);date.setDate(date.getDate()+item.offset);return date;});
  const raceDate=new Date(raceDateValue+'T12:00:00');
  const available=isRaceWeek?candidates.filter(date=>date<raceDate):candidates;
  const names=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  return sessions.map((session,index)=>{
    let date=available[index] || candidates[index] || new Date(weekStart);
    if(isRaceWeek && date>=raceDate){date=new Date(raceDate);date.setDate(date.getDate()-Math.max(1,sessions.length-index));}
    return {...session,status:session.status||'todo',actualMinutes:session.actualMinutes||'',scheduledDate:session.scheduledDate||dateInputValue(date),dayLabel:formatWeekday(session.scheduledDate||dateInputValue(date))};
  });
}
function createTrainingPlan(event, successMessage) {
  event.preventDefault();
  const previous=planEditingId?loadPlans().find(item=>item.id===planEditingId):null;
  const formData=new FormData(planForm);
  const settings = Object.fromEntries(formData.entries());
  if(previous)settings.referenceRaceId=previous.settings.referenceRaceId||'none';
  settings.trainingWeekdays=formData.getAll('trainingWeekday');
  const goal = settings.goal, distance = goalDistances[goal];
  const targetSeconds = Number(settings.targetHours || 0)*3600 + Number(settings.targetMinutes || 0)*60;
  const start = new Date(settings.startDate + 'T12:00:00');
  const race = new Date(settings.raceDate + 'T12:00:00');
  const days = settings.trainingWeekdays.length;settings.days=String(days);
  settings.kind=settings.kind==='general'?'general':'race';
  if(!targetSeconds){showToast('Renseigne le temps visé');return;}
  settings.title=String(settings.title||'').trim();
  if(!settings.title){showToast('Renseigne le titre du plan');return;}
  if (!settings.startDate || !settings.raceDate || race <= start) { showToast(settings.kind==='general'?'La date de fin doit être après le début du plan':'La course doit être après le début du plan'); return; }
  const weeks = Math.ceil((race-start)/(7*24*60*60*1000));
  if (weeks > 40) { showToast('Choisis une date de départ dans les 40 semaines avant la course'); return; }
  if(days<2||days>5) { showToast('Choisis entre 2 et 5 jours habituels de course'); return; }
  const warnings = [];
  const idealLead = goal === 'marathon' ? 12 : goal === 'semi' ? 8 : 6;
  if (weeks < idealLead) warnings.push('Le délai est court pour cet objectif. Le calendrier organise les semaines restantes mais ne remplace pas une préparation déjà commencée.');
  const reference = latestRaceReference(settings.referenceRaceId || 'latest');
  const fallbackPace=Math.max(120,(paceToMinutes(loadProfile().easyPace)||7)*60-goalPaceAdjustments[goal].easy);
  const paceTarget=targetSeconds||(reference?reference.seconds*Math.pow(distance/reference.distance,1.06):fallbackPace*distance);
  const paces = estimatePaces(goal,paceTarget,reference);
  if(previous){for(const input of document.querySelectorAll('[data-plan-pace]')){const pace=parsePaceSeconds(input.value);if(!pace||pace<120||pace>1200){showToast('Renseigne les allures au format min:sec (entre 2:00 et 20:00).');input.closest('.plan-pace-entry').querySelector('input[type=number]').focus();return;}paces[input.dataset.planPace]=pace;}}
  const profile = loadProfile();
  const easyMin = Math.max(25,Math.min(70,Number(profile.longRun || 10)*4));
  let longBase = Number(profile.longRun) > 0 ? Number(profile.longRun)*(paceToMinutes(profile.easyPace) || 7) : (profile.level === 'debutant' ? 60 : profile.level === 'confirme' ? 90 : 75);
  const longCap = { '5k':80, '10k':105, semi:145, marathon:180 }[goal];
  longBase = Math.max(45,Math.min(longBase,longCap*.82));
  const planWeeks=[];
  let progressionIndex=0;
  for(let i=0;i<weeks;i++){
    const phase=phaseFor(i,weeks);
    const isRaceWeek=settings.kind!=='general'&&i===weeks-1;
    const isTaper=phase==='Allègement';
    const recoveryWeek=!isRaceWeek&&!isTaper&&i>0&&(i+1)%4===0;
    if(!isRaceWeek&&!isTaper&&!recoveryWeek) progressionIndex++;
    let longDuration=Math.min(longCap,longBase*(1+Math.min(.38,Math.max(0,progressionIndex-1)*.055)));
    if(recoveryWeek) longDuration*=.82;
    if(phase==='Allègement') longDuration*=.72;
    const easyDuration=Math.min(60,easyMin+Math.floor(i/4)*4 )*(recoveryWeek ? .9 : 1)*(isTaper ? .8 : 1);
    let sessions=workoutTemplate(goal,i,phase,paces,easyDuration,longDuration,recoveryWeek,days);
    if(isRaceWeek){
      sessions=sessions.slice(0,Math.max(1,days-1)).map(item=>({name:'Footing léger',duration:Math.min(30,Math.round(item.duration*.55)),target:'Très facile; garde de la fraîcheur'}));
    }
    const weekStart=new Date(settings.startDate+'T12:00:00');weekStart.setDate(weekStart.getDate()+i*7);
    sessions=assignSessionDates(sessions.map(item=>({...item,id:item.id||newId()})),dateInputValue(weekStart),settings.raceDate,settings.trainingWeekdays,isRaceWeek);
    planWeeks.push({number:i+1,phase,dates:weekRange(settings.startDate,i,settings.raceDate),sessions,recoveryWeek,isRaceWeek});
  }
  if(previous){
    const priorSessions=new Map(previous.weeks.flatMap(week=>week.sessions).map(item=>[(item.scheduledDate||'')+'|'+(item.name||''),item]));
    planWeeks.forEach(week=>week.sessions=week.sessions.map(item=>{
      const old=priorSessions.get((item.scheduledDate||'')+'|'+(item.name||''));
      return old?{...item,id:old.id||item.id,...(old.phases?.length?{phases:old.phases,structureEdited:true,exerciseType:old.exerciseType,target:old.target,duration:old.duration}:{}),status:old.status||'todo',actualMinutes:old.actualMinutes||'',actualDistanceKm:old.actualDistanceKm,actualPace:old.actualPace}:item;
    }));
  }
  const expected=reference ? reference.seconds*Math.pow(distance/reference.distance,1.06) : null;
  if(expected && targetSeconds && targetSeconds < expected*.92) warnings.push('Le temps visé est nettement plus rapide que la projection de ta dernière course ('+timeText(expected)+'). Considère-le comme ambitieux et ajuste-le selon tes sensations.');
  const plan={id:previous?.id||newId(),settings,createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),weeks:planWeeks,targetSeconds,targetPace:paceFromSecondsPerKm(paces.goalPace),paces,reference:reference?{type:reference.race.type,date:reference.race.date,time:timeText(reference.seconds)}:null,warnings};
  const active=loadPlan(),plans=loadPlans(),index=plans.findIndex(item=>item.id===plan.id);if(index>=0)plans[index]=plan;else plans.unshift(plan);setData(PLANS_KEY,JSON.stringify(plans));if(!active&&plans.length===1&&getData(ACTIVE_PLAN_KEY)!==''){setData(ACTIVE_PLAN_KEY,plan.id);setData(PLAN_KEY,JSON.stringify(plan));}else if(active?.id===plan.id)setData(PLAN_KEY,JSON.stringify(plan));
  planEditingId='';$('#plan-form-panel').hidden=true;$('#plan-detail-panel').hidden=false;
  $('#plan-editor-title').textContent='Mon objectif de course';$('#plan-submit-label').textContent='Créer et enregistrer le plan';
  renderPlanLibrary();
  const current=loadPlan();if(current)renderPlan(current);else{$('#plan-detail-panel').hidden=true;$('#plan-results').innerHTML='';$('#plan-empty').hidden=false;}
  navigateToRoute('#plans-enregistres');
  showToast(successMessage || (previous?'Modifications du plan enregistrées':'Plan d’entraînement créé et enregistré'));
}
function formatDateShort(value) {
  return new Date(value+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
}
function formatWeekday(value) {
  return new Date(value+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short'});
}
function planProgress(plan) {
  const sessions=plan.weeks.flatMap(week=>week.sessions);
  const done=sessions.filter(item=>associatedExercise(plan.id,item.id)).length;
  const planned=sessions.reduce((sum,item)=>sum+Number(item.duration||0),0);
  const recorded=sessions.reduce((sum,item)=>sum+Number(associatedExercise(plan.id,item.id)?.seconds||0)/60,0);
  return {done,total:sessions.length,planned,recorded};
}
function importedExercises() {const source=getData(ExerciseModule.storageKey);if(source===importedSourceCache)return importedCache;importedSourceCache=source;try{const items=JSON.parse(source);importedCache=Array.isArray(items)?items:[];}catch{importedCache=[];}associationCache=new Map();importedCache.forEach(item=>{if(item.planLink)associationCache.set(item.planLink.planId+':'+item.planLink.sessionId,item);});return importedCache;}
function associatedExercise(planId,sessionId) {importedExercises();return associationCache.get(planId+':'+sessionId);}
function workoutType(item) {return item.exerciseType || (/longue/i.test(item.name)?'long':/tempo|seuil|allure semi|allure marathon/i.test(item.name)?'tempo':/vma|intervall|fractionn|côte/i.test(item.name)?'vma':'footing');}
function planPhaseName(name) {
  return /^Travail \d+$/i.test(name)?'Travail':/^Récupération \d+$/i.test(name)?'Récupération':name;
}
function cleanPlanStepNames(steps) {
  return steps.map(step=>step.kind==='repeat'?{...step,steps:cleanPlanStepNames(step.steps)}:{...step,name:planPhaseName(step.name)});
}
function workoutPhases(item,plan) {
  if(Array.isArray(item.phases)&&item.phases.length)return item.phases.map(phase=>({...phase,name:planPhaseName(phase.name)}));
  return ExerciseModule.plannedBlocks(item).map(block=>({...block,target:block.work?item.target:(paceFromSecondsPerKm(plan?.paces?.easy)||'')}));
}
function phaseTotals(phases) {
  let seconds=0,km=0,missing=0;
  for(const phase of phases){const duration=Number(phase.seconds);if(Number.isFinite(duration)&&duration>0)seconds+=duration;const pace=parsePaceSeconds(phase.target);if(pace>0&&duration>0)km+=duration/pace;else missing++;}
  return {seconds,minutes:seconds/60,km,missing};
}
function phaseDistanceText(totals) {return totals.missing?(totals.km>0?'~'+totals.km.toFixed(2)+' km · partielle':'Distance à renseigner'):'~'+totals.km.toFixed(2)+' km';}
function plannedSessionSteps(item,plan) {
  if(item.planSteps)return cleanPlanStepNames(JSON.parse(JSON.stringify(item.planSteps)));
  const phases=workoutPhases(item,plan),step=phase=>({name:phase.name,amount:String(phase.seconds/60),unit:'min',target:phase.target||'',work:phase.work,id:phase.id});
  const steps=phases.map(step);
  // Group identical work/recovery pairs while retaining the final work without recovery.
  const result=[];
  for(let i=0;i<steps.length;){
    const first=steps[i],second=steps[i+1];let count=1;
    if(first.work&&second&&!second.work&&/récup|recup/i.test(second.name)){
      while(i+count*2+1<steps.length){const a=steps[i+count*2],b=steps[i+count*2+1];if(!a.work||b.work||a.amount!==first.amount||a.target!==first.target||b.amount!==second.amount||b.target!==second.target)break;count++;}
    }
    const last=steps[i+count*2],hasFinal=first.work&&second&&!second.work&&/récup|recup/i.test(second.name)&&last?.work&&last.amount===first.amount&&last.target===first.target;
    if(count>=2||hasFinal){result.push({kind:'repeat',reps:count+(hasFinal?1:0),skipLastRecovery:hasFinal,steps:[{...first},{...second}]});i+=count*2+(hasFinal?1:0);}else{result.push(first);i++;}
  }
  return result;
}
function migratePlanSessions(plans) {
  let changed=false;
  for(const plan of plans)for(const week of plan.weeks||[])for(const item of week.sessions||[]){
    if(item.planSteps||associatedExercise(plan.id,item.id))continue;
    normalizeWorkout(item);
    const steps=plannedSessionSteps(item,plan);
    const hasQuality=steps.some(step=>step.kind==='repeat'||/échauff|echauff/i.test(step.name));
    if(hasQuality&&!['vma','tempo'].includes(workoutType(item)))item.exerciseType=/intervall|fractionn|côte|vma/i.test(item.name)?'vma':'tempo';
    item.planSteps=steps;changed=true;
  }
  if(changed){setData(PLANS_KEY,JSON.stringify(plans));const selected=getData(ACTIVE_PLAN_KEY),active=plans.find(plan=>plan.id===selected);if(active)setData(PLAN_KEY,JSON.stringify(active));}
  return plans;
}
function plannedStepsView(steps) {
  return '<ol class="planned-block-list">'+steps.map(step=>step.kind==='repeat'?'<li class="planned-repeat-view"><h3>Répétition × '+step.reps+'</h3>'+(step.skipLastRecovery?'<small>Sans récupération après la dernière répétition</small>':'')+plannedStepsView(step.steps)+'</li>':'<li><b>'+escapeHtml(step.name)+'</b><span>'+escapeHtml((step.unit==='m'?step.amount+' m':formatMinutes(Number(step.amount)*(step.unit==='sec'?1/60:1))))+' · '+escapeHtml(step.target||'Allure non renseignée')+'</span></li>').join('')+'</ol>';
}
function phaseMeasureHtml(step) {
  const distance=step.unit==='m',pace=parsePaceSeconds(step.target)||0;
  const seconds=Math.round(distance?Number(step.amount)*pace/1000:Number(step.amount)*(step.unit==='sec'?1:60));
  const icon=path=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>';
  const number=(field,label,value,max)=>'<label class="phase-unit-input"><input type="number" data-measure="'+field+'" aria-label="'+label+'" min="0" '+(max?'max="'+max+'"':'')+' step="'+(field==='meters'?'any':'1')+'" value="'+value+'" required><span aria-hidden="true">'+(field==='meters'?'':field.endsWith('Min')?'min':'s')+'</span></label>';
  return '<div class="phase-measure"><div class="phase-mode" role="group" aria-label="Mesure de la phase"><button type="button" data-measure-mode="time" aria-label="Durée et allure" title="Durée et allure" aria-pressed="'+!distance+'">'+icon('M9 2h6M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16M12 8v5l3 2')+'</button><button type="button" data-measure-mode="distance" aria-label="Mètres et allure" title="Mètres et allure" aria-pressed="'+distance+'">'+icon('M3 7h18v10H3ZM7 7v4M11 7v3M15 7v4M19 7v3')+'</button></div><fieldset><legend>'+(distance?'Distance (m)':'Durée')+'</legend><div class="phase-number-pair">'+(distance?number('meters','Mètres',Number(step.amount)||0):number('durationMin','Minutes',Math.floor(seconds/60))+number('durationSec','Secondes',Math.round(seconds%60),59))+'</div></fieldset><fieldset><legend>Allure</legend><div class="phase-number-pair">'+number('paceMin','Minutes par km',Math.floor(pace/60))+number('paceSec','Secondes par km',pace%60,59)+'<span class="phase-pace-unit">par km</span></div></fieldset></div>';
}
function setPhaseMeasure(step,row) {
  const value=field=>Number(row.querySelector('[data-measure="'+field+'"]').value);
  const pace=value('paceMin')*60+value('paceSec');
  step.target=pace>0?Math.floor(pace/60)+':'+String(pace%60).padStart(2,'0')+' /km':'';
  if(step.unit==='m')step.amount=String(value('meters'));
  else {step.amount=String(value('durationMin')*60+value('durationSec'));step.unit='sec';}
}
function switchPhaseMeasure(step,mode) {
  const pace=parsePaceSeconds(step.target)||0;
  if(mode==='distance'&&step.unit!=='m'){step.amount=String(pace>0?Number((Number(step.amount)*(step.unit==='sec'?1:60)*1000/pace).toFixed(2)):0);step.unit='m';}
  else if(mode==='time'&&step.unit==='m'){step.amount=String(Math.round(Number(step.amount)*pace/1000));step.unit='sec';}
}
function plannedEditorStepsHtml(steps,prefix='') {
  return '<ol class="steps">'+steps.map((step,index)=>{
    const path=prefix+index;
    if(step.kind==='repeat')return '<li class="free-repeat" data-path="'+path+'"><div class="free-repeat-heading"><label>Répétition × <input type="number" min="2" max="100" step="1" data-plan-field="reps" value="'+step.reps+'"></label><button type="button" data-ungroup>Défaire le bloc</button><button type="button" data-move="-1" aria-label="Monter le bloc">↑</button><button type="button" data-move="1" aria-label="Descendre le bloc">↓</button><button type="button" data-remove aria-label="Supprimer le bloc">×</button></div>'+plannedEditorStepsHtml(step.steps,path+'.')+'</li>';
    const pace=parsePaceSeconds(step.target),seconds=Number(step.amount)*(step.unit==='sec'?1:60),km=pace>0?seconds/pace:0;
    return '<li class="session-phase" data-path="'+path+'"><h3>'+escapeHtml(step.name)+'</h3>'+phaseMeasureHtml(step)+'<div class="free-phase-actions"><button type="button" data-move="-1" aria-label="Monter la phase">↑</button><button type="button" data-move="1" aria-label="Descendre la phase">↓</button><button type="button" data-remove aria-label="Supprimer la phase">×</button></div></li>';
  }).join('')+'</ol>';
}
function plannedEditorStepAt(path) {
  const indices=path.split('.').map(Number);let steps=sessionEditorState.steps;
  for(let i=0;i<indices.length-1;i++)steps=steps[indices[i]].steps;
  return {steps,index:indices.at(-1),step:steps[indices.at(-1)]};
}
function refreshPlannedEditor() {
  const form=$('#session-edit-content .workout-editor-form');
  form.querySelector('.session-phases').innerHTML=plannedEditorStepsHtml(sessionEditorState.steps);
  updateEditorPreview();
}
function createPlannedRepeat() {
  const dialog=document.createElement('dialog');dialog.className='free-repeat-dialog';
  dialog.innerHTML='<form><h2>Créer une répétition</h2><p>Choisis des phases consécutives.</p>'+sessionEditorState.steps.map((step,index)=>step.kind==='repeat'?'':'<label><input type="checkbox" name="phase" value="'+index+'">'+escapeHtml(step.name)+'</label>').join('')+'<label>Répétitions<input name="reps" type="number" min="2" max="100" value="4" required></label><p data-error role="alert"></p><div class="editor-actions"><button type="button" data-cancel>Annuler</button><button class="primary-button">Créer le bloc</button></div></form>';
  document.body.append(dialog);dialog.showModal();const close=()=>{dialog.close();dialog.remove();};dialog.querySelector('[data-cancel]').onclick=close;dialog.addEventListener('cancel',close);
  dialog.querySelector('form').onsubmit=event=>{event.preventDefault();try{const data=new FormData(event.target);sessionEditorState.steps=groupFreeSteps(sessionEditorState.steps,data.getAll('phase').map(Number),Number(data.get('reps')));refreshPlannedEditor();close();}catch(error){dialog.querySelector('[data-error]').textContent=error.message;}};
}
function phaseInputHtml(phase) {
  return '<fieldset class="session-phase" data-phase-id="'+escapeHtml(phase.id)+'" data-work="'+Boolean(phase.work)+'"><legend>Phase</legend><label>Nom de la phase<input name="phaseName" value="'+escapeHtml(phase.name)+'" required maxlength="80"></label><label>Durée (min)<input name="phaseMinutes" type="number" min="0.01" max="600" step="any" inputmode="decimal" value="'+Number(phase.seconds/60)+'" required></label><label>Allure ou consigne<input name="phasePace" value="'+escapeHtml(phase.target||'')+'" placeholder="6:00 /km" maxlength="80"></label><output class="phase-estimated-distance"></output><button type="button" class="secondary-button" data-remove-phase>Supprimer cette phase</button></fieldset>';
}
function plannedWorkoutHtml(item,weekIndex,sessionIndex) {
  normalizeWorkout(item);const plan=loadPlan(),type=ExerciseModule.exerciseTypes.find(type=>type.id===workoutType(item)),phases=workoutPhases(item,plan),totals=phaseTotals(phases),actual=associatedExercise(plan.id,item.id);
  const icon=path=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>';
  const averagePace=!totals.missing&&totals.km>0?paceFromSecondsPerKm(totals.seconds/totals.km):'Allure à renseigner';
  const status=actual?'Séance effectuée':'Séance à faire';
  return '<article class="planned-workout plan-consultation-card" data-week-index="'+weekIndex+'" data-session-index="'+sessionIndex+'"><div class="planned-date-block"><time class="planned-date" datetime="'+escapeHtml(item.scheduledDate||'')+'">'+escapeHtml(formatDateShort(item.scheduledDate))+'</time><span class="planned-status '+(actual?'is-done':'is-pending')+'" role="img" aria-label="'+status+'" title="'+status+'">'+icon(actual?'M5 12l4 4L19 6':'M12 8v4l3 2')+'</span></div><div class="planned-main"><div class="workout-name-row"><b>'+escapeHtml(item.name)+'</b></div><div class="planned-overview"><span class="planned-type" style="--exercise-color:'+type.color+'">'+escapeHtml(type.label)+'</span><span title="Durée totale">'+escapeHtml(formatMinutes(totals.minutes))+'</span><span title="Allure moyenne sur toutes les phases">'+escapeHtml(averagePace)+'</span><span title="Kilométrage total estimé">'+escapeHtml(phaseDistanceText(totals))+'</span></div></div><div class="planned-controls"><button type="button" data-action="view" aria-label="Visualiser '+escapeHtml(item.name)+'">'+icon('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0')+'<span>Visualiser</span></button><button type="button" data-action="watch-export" aria-label="Exporter '+escapeHtml(item.name)+'">'+icon('M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5')+'<span>Exporter</span></button>'+(actual?'':'<button type="button" data-action="edit" aria-label="Éditer '+escapeHtml(item.name)+'">'+icon('M4 7h16M4 17h16M8 4v6M16 14v6')+'<span>Éditer</span></button>')+'</div></article>';
}
function exportWatchWorkout(weekIndex,sessionIndex) {
  const plan=loadPlan(),item=normalizeWorkout(plan.weeks[weekIndex].sessions[sessionIndex]);
  const athlete=readAthletes().find(profile=>profile.id===activeAthleteId);
  const payload={format:'foulee-watch-workout-v1',athleteId:activeAthleteId,athleteName:athlete?.name||'',workoutId:item.id||'',name:item.name,target:item.target||'',scheduledDate:item.scheduledDate||dateInputValue(new Date()),durationMin:item.duration,exerciseType:workoutType(item),phases:workoutPhases(item,plan),structure:item.structure};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const link=document.createElement('a');
  const objectURL=URL.createObjectURL(blob);
  link.href=objectURL;
  link.download='foulee-watch-'+(item.scheduledDate||dateInputValue(new Date()))+'.json';
  link.click();
  setTimeout(()=>URL.revokeObjectURL(objectURL),1000);
  showToast('Fichier prêt à importer dans l’app iPhone');
}
function openPlannedSession(sessionId) {
  const plan=loadPlan();
  const weekIndex=plan?.weeks.findIndex(week=>week.sessions.some(item=>item.id===sessionId));
  if(weekIndex==null||weekIndex<0){showToast('Cette séance n’est plus disponible.');return;}
  const sessionIndex=plan.weeks[weekIndex].sessions.findIndex(item=>item.id===sessionId);
  renderSessionViewer(weekIndex,sessionIndex);
}
function renderSessionViewer(weekIndex,sessionIndex) {
  const plan=loadPlan(),item=plan.weeks[weekIndex].sessions[sessionIndex],actual=associatedExercise(plan.id,item.id);
  if(actual){sessionEditorState=null;calendarExerciseOrigin=true;calendarExerciseToOpen=actual.id;navigateToRoute('#exercices');return;}
  const phases=workoutPhases(item,plan),totals=phaseTotals(phases),type=ExerciseModule.exerciseTypes.find(type=>type.id===workoutType(item));
  sessionEditorState=null;
  const averagePace=!totals.missing&&totals.km>0?paceFromSecondsPerKm(totals.seconds/totals.km):'Allure à renseigner';
  $('#session-edit-content').innerHTML='<a href="#plan" class="calendar-back">← Plan actif</a><section class="intro"><h1>Voir la <em>séance.</em></h1></section><section class="workout-editor-form workout-viewer panel" aria-label="Séance en lecture seule"><div class="workout-viewer-heading"><h2>'+escapeHtml(item.name)+'</h2><div class="workout-viewer-actions"><button type="button" class="secondary-button" data-export-session>Exporter</button><button type="button" class="primary-button" data-edit-session>Mettre à jour</button></div></div><dl class="workout-viewer-meta"><div><dt>Type de séance</dt><dd><span class="session-type-badge" style="--exercise-color:'+type.color+'"><i aria-hidden="true"></i>'+escapeHtml(type.label)+'</span></dd></div><div><dt>Date prévue</dt><dd>'+escapeHtml(formatDateShort(item.scheduledDate))+'</dd></div><div><dt>État</dt><dd>'+(associatedExercise(plan.id,item.id)?'Effectuée':'À faire')+'</dd></div></dl><div class="session-phases">'+plannedStepsView(plannedSessionSteps(item,plan))+'</div><dl class="workout-viewer-meta workout-viewer-totals"><div><dt>Durée totale prévue</dt><dd>'+escapeHtml(formatMinutes(totals.minutes))+'</dd></div><div><dt>Allure moyenne</dt><dd>'+escapeHtml(averagePace)+'</dd></div><div><dt>Distance totale estimée</dt><dd>'+escapeHtml(phaseDistanceText(totals))+'</dd></div></dl></section>';
  $('#session-edit-content').querySelector('[data-edit-session]').onclick=()=>renderSessionEditor(weekIndex,sessionIndex);
  $('#session-edit-content').querySelector('[data-export-session]').onclick=()=>exportWatchWorkout(weekIndex,sessionIndex);
  navigateToRoute('#seance');
}
function renderSessionEditor(weekIndex,sessionIndex) {
  const plan=loadPlan(),item=normalizeWorkout(plan.weeks[weekIndex].sessions[sessionIndex]);
  if(associatedExercise(plan.id,item.id)){renderSessionViewer(weekIndex,sessionIndex);showToast('Une séance effectuée est en lecture seule.');return;}
  const quality=['vma','tempo'].includes(workoutType(item)),type=ExerciseModule.exerciseTypes.find(type=>type.id===workoutType(item));
  sessionEditorState={athleteId:activeAthleteId,planId:plan.id,sessionId:item.id,name:item.name,exerciseType:workoutType(item),steps:plannedSessionSteps(item,plan)};
  const root=$('#session-edit-content');
  root.innerHTML='<a href="#plan" class="calendar-back">← Plan actif</a><section class="intro"><h1>Mettre à jour la <em>séance.</em></h1></section><form class="workout-editor-form panel"><h2>'+escapeHtml(item.name)+'</h2><div><span class="session-type-badge" style="--exercise-color:'+type.color+'"><i aria-hidden="true"></i>'+escapeHtml(type.label)+'</span></div><label>Date prévue<input name="scheduledDate" type="date" min="'+escapeHtml(plan.settings.startDate)+'" max="'+escapeHtml(plan.settings.raceDate)+'" value="'+escapeHtml(item.scheduledDate)+'" required></label><div class="session-phases"></div><div class="planned-add-actions"><select aria-label="Phase à ajouter" data-new-phase><option value="Travail">Travail</option>'+(quality?'<option>Échauffement</option><option>Récupération</option><option>Retour au calme</option>':'')+'</select><button type="button" class="secondary-button" data-add-phase>Ajouter une phase</button>'+(quality?'<button type="button" class="secondary-button" data-add-repeat>Répétition</button>':'')+'</div><div class="editor-calculation" aria-live="polite"><div><span>Durée totale prévue</span><b id="editor-total"></b></div><div><span>Distance estimée</span><b id="editor-distance"></b></div></div><div class="editor-actions"><a href="#plan" class="secondary-button">Annuler</a><button type="submit" class="primary-button">Enregistrer la séance</button></div></form>';
  const form=root.querySelector('form');
  form.addEventListener('submit',saveWorkoutEditor);
  form.addEventListener('change',event=>{
    if(event.target.hasAttribute('data-measure')){const row=event.target.closest('[data-path]');if(!event.target.reportValidity())return;setPhaseMeasure(plannedEditorStepAt(row.dataset.path).step,row);updateEditorPreview();return;}
    const field=event.target.dataset.planField;if(!field)return;
    const {step}=plannedEditorStepAt(event.target.closest('[data-path]').dataset.path);
    if(field==='reps'){if(!event.target.reportValidity())return;step.reps=Number(event.target.value);}
    else if(field==='target'){const previous=parsePaceSeconds(step.target),km=previous>0?Number(step.amount)*(step.unit==='sec'?1:60)/previous:0;step.target=event.target.value.trim();const pace=parsePaceSeconds(step.target);if(km>0&&pace>0){step.amount=String(km*pace/60);step.unit='min';}}
    else {const km=Number(event.target.value),pace=parsePaceSeconds(step.target);if(!(km>0&&pace>0)){showToast('Renseigne une distance et une allure positives.');return;}step.amount=String(km*pace/60);step.unit='min';}
    refreshPlannedEditor();
  });
  form.addEventListener('click',event=>{
    const mode=event.target.closest('[data-measure-mode]');if(mode){switchPhaseMeasure(plannedEditorStepAt(mode.closest('[data-path]').dataset.path).step,mode.dataset.measureMode);refreshPlannedEditor();return;}
    const button=event.target.closest('[data-move],[data-remove],[data-ungroup]');if(!button)return;
    const {steps,index,step}=plannedEditorStepAt(button.closest('[data-path]').dataset.path);
    if(button.hasAttribute('data-ungroup'))steps.splice(index,1,...Array.from({length:step.reps},(_,n)=>JSON.parse(JSON.stringify(step.skipLastRecovery&&n===step.reps-1?step.steps.slice(0,-1):step.steps))).flat());
    else if(button.hasAttribute('data-remove')){if(steps.length===1){showToast('Conserve au moins une phase ou défais le bloc.');return;}steps.splice(index,1);}
    else {const next=index+Number(button.dataset.move);if(next<0||next>=steps.length)return;[steps[index],steps[next]]=[steps[next],steps[index]];}
    refreshPlannedEditor();
  });
  form.querySelector('[data-add-phase]').onclick=()=>{const name=form.querySelector('[data-new-phase]').value;sessionEditorState.steps.push({id:newId(),name,amount:'5',unit:'min',target:paceFromSecondsPerKm(plan.paces.easy)||'',work:name==='Travail'});refreshPlannedEditor();};
  if(quality)form.querySelector('[data-add-repeat]').onclick=createPlannedRepeat;
  navigateToRoute('#seance');refreshPlannedEditor();
}
function editorValues(form) {
  const state=sessionEditorState,phases=freeWorkoutPhases({id:state.sessionId,steps:state.steps});
  return {phases,...phaseTotals(phases),name:state.name,exerciseType:state.exerciseType,scheduledDate:form.elements.scheduledDate.value,steps:state.steps};
}
function updateEditorPreview() {
  const form=$('#session-edit-content .workout-editor-form');if(!form)return;
  try{const values=editorValues(form);$('#editor-total').textContent=formatMinutes(values.minutes);$('#editor-distance').textContent=phaseDistanceText(values);}catch(error){$('#editor-total').textContent=error.message;}
}
function closeSessionEditor(slot) {slot.close();slot.remove();document.body.classList.remove('session-editor-open');}
function saveWorkoutEditor(event) {
  event.preventDefault();let values;try{values=editorValues(event.currentTarget);}catch(error){showToast(error.message);return;}const state=sessionEditorState;
  if(!state||state.athleteId!==activeAthleteId)return;
  if(!values.name||values.phases.some(phase=>!phase.name||!Number.isFinite(phase.seconds)||phase.seconds<=0)){showToast('Renseigne le nom et une durée positive pour chaque phase.');return;}
  const plans=loadPlans(),plan=plans.find(plan=>plan.id===state.planId),weekIndex=plan?.weeks.findIndex(week=>week.sessions.some(item=>item.id===state.sessionId));
  if(!plan||weekIndex<0){showToast('Cette séance a été supprimée.');return;}
  if(associatedExercise(plan.id,state.sessionId)){sessionEditorState=null;navigateToRoute('#plan');showToast('Une séance effectuée ne peut plus être modifiée.');return;}
  if(values.scheduledDate<plan.settings.startDate||values.scheduledDate>plan.settings.raceDate){showToast('Choisis une date comprise dans le plan.');return;}
  const sessionIndex=plan.weeks[weekIndex].sessions.findIndex(item=>item.id===state.sessionId),item=plan.weeks[weekIndex].sessions[sessionIndex];
  Object.assign(item,{planSteps:values.steps,phases:values.phases,duration:values.minutes,target:values.phases.find(phase=>phase.work)?.target||values.phases[0].target,structureEdited:true});normalizeWorkout(item);
  relocateSession(plan,weekIndex,sessionIndex,values.scheduledDate);
  if(loadPlan()?.id===plan.id)setData(PLAN_KEY,JSON.stringify(plan));else setData(PLANS_KEY,JSON.stringify(plans));
  sessionEditorState=null;navigateToRoute('#plan');showToast('Séance mise à jour');
}

function planWeekIndexForDate(plan,dateValue) {
  const start=new Date(plan.settings.startDate+'T12:00:00'), date=new Date(dateValue+'T12:00:00');
  return Math.max(0,Math.min(plan.weeks.length-1,Math.floor((date-start)/(7*24*60*60*1000))));
}
function relocateSession(plan,fromWeek,sessionIndex,dateValue) {
  const item=plan.weeks[fromWeek].sessions[sessionIndex];
  const toWeek=planWeekIndexForDate(plan,dateValue);
  item.scheduledDate=dateValue;item.dayLabel=formatWeekday(dateValue);
  if(toWeek!==fromWeek) {
    plan.weeks[fromWeek].sessions.splice(sessionIndex,1);
    plan.weeks[toWeek].sessions.push(item);
    plan.weeks[toWeek].sessions.sort((a,b)=>a.scheduledDate.localeCompare(b.scheduledDate));
  }
  return item;
}
function persistTrackedPlan(openWeeks) {
  const plan=loadPlan();
  setData(PLAN_KEY,JSON.stringify(plan));
  renderPlan(plan);
  document.querySelectorAll('.week-card').forEach(card=>{if(openWeeks.includes(Number(card.dataset.week)))card.open=true;});
}
function attachPlanTracking() {
  document.querySelectorAll('.planned-workout').forEach(row=>{row.querySelector('[data-action="view"]').onclick=()=>renderSessionViewer(Number(row.dataset.weekIndex),Number(row.dataset.sessionIndex));const editButton=row.querySelector('[data-action="edit"]');if(editButton)editButton.onclick=()=>renderSessionEditor(Number(row.dataset.weekIndex),Number(row.dataset.sessionIndex));row.querySelector('[data-action="watch-export"]').onclick=()=>exportWatchWorkout(Number(row.dataset.weekIndex),Number(row.dataset.sessionIndex));});
}
function renderPlan(plan) {
  if(!plan) return;
  $('#plan-detail-panel').hidden=false;
  if(!Number.isFinite(plan.paces?.thresholdEstimate)) {
    const reference=latestRaceReference(plan.settings.referenceRaceId || 'latest');
    const recalculated=estimatePaces(plan.settings.goal,plan.targetSeconds,reference);
    plan.paces={...plan.paces,...recalculated};
  }
  plan.weeks.forEach((week,index)=>{const monday=new Date(plan.settings.startDate+'T12:00:00');monday.setDate(monday.getDate()+index*7);week.sessions=assignSessionDates(week.sessions.map(normalizeWorkout),dateInputValue(monday),plan.settings.raceDate,plan.settings.trainingWeekdays||defaultWeekdays(Number(plan.settings.days)),week.isRaceWeek);});
  setData(PLAN_KEY,JSON.stringify(plan));
  const goal=goalNames[plan.settings.goal];
  const activeAthlete=readAthletes().find(item=>item.id===activeAthleteId);
  const result=$('#plan-results');
  const easy=paceFromSecondsPerKm(plan.paces.easy), threshold=paceFromSecondsPerKm(plan.paces.threshold), interval=paceFromSecondsPerKm(plan.paces.interval);
  const easyLabel=loadProfile().easyPace ? escapeHtml(loadProfile().easyPace+'/km · ton repère') : escapeHtml(easy+' · aisance');
  const progress=planProgress(plan);
  result.innerHTML='<div class="plan-summary"><div><span class="plan-kicker">PLAN DE '+escapeHtml((activeAthlete?.name||'CE PROFIL').toUpperCase())+' · OBJECTIF '+escapeHtml(goal.toUpperCase())+'</span><h3>'+escapeHtml(plan.settings.title||goal)+(plan.targetSeconds?' · '+escapeHtml(timeText(plan.targetSeconds)):'')+'</h3><p>'+escapeHtml(plan.settings.days)+' séances par semaine · '+plan.weeks.length+' semaines · allure objectif '+escapeHtml(plan.targetPace)+'</p><div class="progress-summary"><b>'+progress.done+'/'+progress.total+' séances réalisées</b></div></div></div>'+
    plan.warnings.map(warning=>'<p class="plan-warning">'+escapeHtml(warning)+'</p>').join('')+
    '<div class="week-list">'+plan.weeks.map((week,index)=>'<details class="week-card" data-week="'+week.number+'" '+(index===0?'open':'')+'><summary><span class="week-number">S'+String(week.number).padStart(2,'0')+'</span><span class="week-info"><b>'+escapeHtml(week.phase)+(week.recoveryWeek?' · récupération':'')+'</b><small>'+escapeHtml(week.dates)+'</small></span><span class="week-chevron">⌄</span></summary><div class="week-content-grid"><div class="week-workouts">'+week.sessions.map((item,j)=>plannedWorkoutHtml(item,index,j)).join('')+(week.isRaceWeek?'<article class="race-day"><b>Jour de course</b><span>'+escapeHtml(goal)+(plan.targetSeconds?' · objectif '+escapeHtml(timeText(plan.targetSeconds)):'')+'</span></article>':'')+'<p class="week-rest">Place les sorties avec des jours de récupération entre les séances soutenues.</p></div><aside class="week-editor" hidden></aside></div></details>').join('')+'</div>';
  // Persist repairs made by the final render guard as well as the initial migration.
  setData(PLAN_KEY,JSON.stringify(plan));
  attachPlanTracking();
  renderPlanLibrary();
}
function renderPaceSettings(plan) {
  const root=$('#plan-pace-settings');root.innerHTML='';if(!plan?.paces)return;
  root.innerHTML='<div class="plan-pace-fields">'+[['easy','Allure facile'],['interval','Allure VMA / intervalles'],['goalPace','Allure objectif'],['threshold','Seuil / tempo']].map(([key,label])=>{
    const pace=Math.round(plan.paces[key]);
    return '<fieldset class="plan-pace-entry"><legend>'+label+'</legend><div class="plan-pace-parts"><label>Minutes<input type="number" min="0" max="20" step="1" inputmode="numeric" data-pace-minutes value="'+Math.floor(pace/60)+'" required></label><b aria-hidden="true">:</b><label>Secondes<input type="number" min="0" max="59" step="1" inputmode="numeric" data-pace-seconds value="'+pace%60+'" required></label><span>/ km</span></div><small>minute:seconde au kilomètre</small><output class="plan-pace-speed" aria-live="polite"></output><input type="hidden" data-plan-pace="'+key+'" '+(key==='threshold'?'id="threshold-override"':'')+' value="'+escapeHtml(paceInputFromSeconds(pace))+'"></fieldset>';
  }).join('')+'<p id="threshold-delta" aria-live="polite"></p></div>';
  root.querySelectorAll('.plan-pace-entry').forEach(entry=>{
    const sync=()=>{
      const minutes=entry.querySelector('[data-pace-minutes]'),seconds=entry.querySelector('[data-pace-seconds]'),combined=entry.querySelector('[data-plan-pace]');
      const valid=minutes.value!==''&&seconds.value!==''&&minutes.validity.valid&&seconds.validity.valid;
      const total=Number(minutes.value)*60+Number(seconds.value);
      combined.value=valid?minutes.value+':'+String(seconds.value).padStart(2,'0'):'';
      entry.querySelector('output').textContent=valid&&total>0?(3600/total).toLocaleString('fr-FR',{maximumFractionDigits:2})+' km/h':'— km/h';
      updateThresholdDelta();
    };
    entry.querySelectorAll('input[type=number]').forEach(input=>input.addEventListener('input',sync));sync();
  });
}


function paceToMinutes(value) {
  const match = /^\s*(\d{1,2})\s*[:'’]\s*(\d{1,2})\s*$/.exec(value || '');
  if (!match || Number(match[2]) > 59) return null;
  return Number(match[1]) + Number(match[2]) / 60;
}
function paceText(minutes) {
  if (!Number.isFinite(minutes)) return null;
  const rounded = Math.round(minutes * 60);
  return `${Math.floor(rounded / 60)}’${String(rounded % 60).padStart(2, '0')}”/km`;
}
function generateSession() {
  const profile = loadProfile();
  const type = $('#session-type').value;
  const template = templates[type];
  const easy = paceToMinutes(profile.easyPace);
  let steps = template.steps.map(([name, amount, unit, target]) => ({ name, amount, unit, target }));
  if (type === 'tempo' && easy) steps[1].target = `Environ ${paceText(easy - 0.45)} · régulier`;
  if (type === 'long') {
    const km = Number(profile.longRun);
    if (km >= 5 && km <= 42) {
      const minutes = Math.max(45, Math.round(km * easy || km * 7));
      steps[0].amount = String(minutes);
      steps[0].target = `Environ ${km} km · aisance`;
    }
  }
  if (type === 'intervals' && profile.level === 'debutant') {
    steps[1].amount = '6 × 1';
    steps[2].amount = '90';
    steps[2].unit = 'sec';
  }
  const dayCount = Number(profile.days || 3);
  const frequencyHint = dayCount <= 2 ? 'Garde au moins un jour de repos entre tes sorties.' : 'Laisse idéalement une journée facile ou de repos autour des séances soutenues.';
  session = {
    id: newId(),
    scheduledDate: $('#session-date').value || dateInputValue(new Date()),
    name: template.title,
    type,
    exerciseType:({easy:'footing',long:'long',tempo:'tempo',intervals:'vma'})[type],
    goal: goalLabels[profile.goal] || goalLabels.endurance,
    createdAt: new Date().toISOString(),
    steps: normalizeFreeSteps(steps),
    note: `${template.note} ${frequencyHint}`
  };
  setData(SESSION_KEY, JSON.stringify(session));
  renderSession();
}
function loadSession() {
  try { session = JSON.parse(getData(SESSION_KEY)); } catch { session = null; }
  $('#session-date').value = session?.scheduledDate || dateInputValue(new Date());
  if (session?.steps) {
    session.id ||= newId();
    session.scheduledDate ||= $('#session-date').value;
    session.steps = session.steps.map(step => {
      const legacyRepeat = /^×\s*(\d+)\s*min$/.exec(step.unit || '');
      if (legacyRepeat) return {...step, amount: `${step.amount} × ${legacyRepeat[1]}`, unit: 'min'};
      const legacySeconds = /^(\d+)\s*sec$/.exec(step.amount || '');
      if (legacySeconds) return {...step, amount: legacySeconds[1], unit: 'sec'};
      return step;
    });
    session.steps=normalizeFreeSteps(session.steps);
    setData(SESSION_KEY, JSON.stringify(session));
    renderSession();
  }
}
function normalizeFreeSteps(steps) {
  const result=[];
  for(let index=0;index<steps.length;index++){
    const step={...steps[index]};
    if(step.kind==='repeat'){step.steps=normalizeFreeSteps(step.steps);result.push(step);continue;}
    const match=/^\s*(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*$/i.exec(step.amount);
    if(match){
      step.amount=match[2];
      const children=[step],next=steps[index+1];
      if(next && /récup|recup/i.test(next.name)){children.push({...next});index++;}
      result.push({kind:'repeat',reps:Number(match[1]),steps:children});
    }else result.push(step);
  }
  return result;
}
function groupFreeSteps(steps,indices,reps) {
  if(!Number.isInteger(reps)||reps<2||reps>100)throw new Error('Choisis entre 2 et 100 répétitions.');
  const selected=[...new Set(indices)].sort((a,b)=>a-b);
  if(!selected.length || selected.some((i,n)=>!Number.isInteger(i)||i<0||i>=steps.length||steps[i].kind==='repeat'||(n>0&&i!==selected[n-1]+1)))throw new Error('Choisis des phases consécutives, hors des blocs existants.');
  const start=selected[0],children=steps.slice(start,start+selected.length);
  return [...steps.slice(0,start),{kind:'repeat',reps,steps:children},...steps.slice(start+selected.length)];
}
function freeWorkoutPhases(item) {
  const phases=[];
  const visit=(steps,path)=>steps.forEach((step,index)=>{
    const key=path+'-'+index;
    if(step.kind==='repeat'){
      if(!Number.isInteger(step.reps)||step.reps<2||step.reps>100||!step.steps?.length)throw new Error('Bloc de répétition invalide.');
      for(let repeat=0;repeat<step.reps;repeat++)visit(step.skipLastRecovery&&repeat===step.reps-1?step.steps.slice(0,-1):step.steps,key+'-'+repeat);
      return;
    }
    const match=/^\s*(\d+(?:[.,]\d+)?)\s*$/.exec(step.amount);
    const seconds=match?Number(match[1].replace(',','.'))*(step.unit==='m'?(parsePaceSeconds(step.target)||NaN)/1000:step.unit==='sec'?1:60):NaN;
    if(!['min','sec','m'].includes(step.unit)||!Number.isFinite(seconds)||seconds<1||seconds>36000)throw new Error('Saisis une durée positive ou une distance avec une allure positive pour chaque phase.');
    phases.push({id:key,name:step.name,seconds,target:step.target||'',work:step.work ?? !/récup|recup|échauff|echauff|retour au calme/i.test(step.name)});
    if(phases.length>2000)throw new Error('La séance dépasse 2 000 phases.');
  });
  visit(item.steps,item.id||'free');
  if(!phases.length)throw new Error('Ajoute au moins une phase avant d’exporter.');
  return phases;
}
function freeStepAt(path) {
  const indices=path.split('.').map(Number);let steps=session.steps;
  for(let i=0;i<indices.length-1;i++)steps=steps[indices[i]].steps;
  return {steps,index:indices.at(-1),step:steps[indices.at(-1)]};
}
function freeStepsHtml(steps,prefix='') {
  return '<ol class="steps">'+steps.map((step,index)=>{
    const path=prefix+index;
    if(step.kind==='repeat')return `<li class="free-repeat" data-path="${path}"><div class="free-repeat-heading"><label>Répétition × <input type="number" min="2" max="100" step="1" data-field="reps" aria-label="Nombre de répétitions" value="${step.reps}"></label><button type="button" data-ungroup>Défaire le bloc</button><button type="button" data-move="-1" aria-label="Monter le bloc">↑</button><button type="button" data-move="1" aria-label="Descendre le bloc">↓</button></div>${freeStepsHtml(step.steps,path+'.')}</li>`;
    return `<li class="workout-step" data-path="${path}"><span class="step-index">${index+1}</span><div class="step-fields"><input aria-label="Nom de la phase" data-field="name" value="${escapeHtml(step.name)}">${phaseMeasureHtml(step)}</div><div class="free-phase-actions"><button type="button" data-move="-1" aria-label="Monter la phase">↑</button><button type="button" data-move="1" aria-label="Descendre la phase">↓</button><button type="button" data-remove aria-label="Supprimer la phase">×</button></div></li>`;
  }).join('')+'</ol>';
}
function createFreeRepeat() {
  if(!session)return;
  const dialog=document.createElement('dialog');dialog.className='free-repeat-dialog';
  dialog.innerHTML=`<form><h2>Créer une répétition</h2><p>Choisis les phases consécutives à répéter, dans leur ordre actuel. Chaque répétition exécute toutes les phases choisies, récupération comprise.</p><div class="free-repeat-choices">${session.steps.map((step,index)=>step.kind==='repeat'?`<p>Bloc × ${step.reps} déjà créé</p>`:`<label><input type="checkbox" name="phase" value="${index}"> ${escapeHtml(step.name)}</label>`).join('')}</div><label>Nombre de répétitions <input name="reps" type="number" min="2" max="100" step="1" value="4" required></label><p data-error role="alert"></p><div class="editor-actions"><button type="button" data-cancel>Annuler</button><button type="submit" class="primary-button">Créer le bloc</button></div></form>`;
  document.body.append(dialog);dialog.showModal();
  const close=()=>{dialog.close();dialog.remove();};dialog.querySelector('[data-cancel]').onclick=close;dialog.addEventListener('cancel',close);
  dialog.querySelector('form').onsubmit=event=>{event.preventDefault();try{const data=new FormData(event.target);session.steps=groupFreeSteps(session.steps,data.getAll('phase').map(Number),Number(data.get('reps')));persistAndRender(false);close();}catch(error){dialog.querySelector('[data-error]').textContent=error.message;}};
}
function totalMinutes() {
  if (!session) return 0;
  try {return freeWorkoutPhases(session).reduce((sum,phase)=>sum+phase.seconds,0)/60;} catch {return 0;}
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function renderSession() {
  if (!session) return;
  const card=$('#session-card');$('#session-date').value=session.scheduledDate || dateInputValue(new Date());
  let summary;try{const phases=freeWorkoutPhases(session);summary=formatMinutes(phases.reduce((sum,phase)=>sum+phase.seconds,0)/60)+' · '+phases.length+' phases exécutées';}catch(error){summary=error.message;}
  card.innerHTML=`<div class="session-top"><div><h3 class="session-title">${escapeHtml(session.name)}</h3><div class="session-meta">${escapeHtml(session.goal||'')} · ${escapeHtml(formatDateShort(session.scheduledDate))}</div></div><span class="stat-pill">${escapeHtml(summary)}</span></div>${freeStepsHtml(session.steps)}`;
  card.onchange=event=>{if(!event.target.hasAttribute('data-measure')||!event.target.reportValidity())return;const row=event.target.closest('[data-path]');setPhaseMeasure(freeStepAt(row.dataset.path).step,row);persistAndRender(false);};
  card.onclick=event=>{const mode=event.target.closest('[data-measure-mode]');if(!mode)return;switchPhaseMeasure(freeStepAt(mode.closest('[data-path]').dataset.path).step,mode.dataset.measureMode);persistAndRender(false);};
  card.querySelectorAll('[data-path]').forEach(row=>{
    const resolve=()=>freeStepAt(row.dataset.path);
    row.querySelectorAll('[data-field]').forEach(control=>{if(control.closest('[data-path]')!==row)return;control.onchange=()=>{if(control.type==='number'&&!control.reportValidity())return;resolve().step[control.dataset.field]=control.dataset.field==='reps'?Number(control.value):control.value;persistAndRender(false);};});
    row.querySelectorAll('[data-move],[data-remove],[data-ungroup]').forEach(button=>{if(button.closest('[data-path]')!==row)return;button.onclick=()=>{const {steps,index,step}=resolve();if(button.hasAttribute('data-ungroup'))steps.splice(index,1,...step.steps);else if(button.hasAttribute('data-remove')){if(steps.length===1){showToast('Conserve une phase ou défais le bloc.');return;}steps.splice(index,1);}else{const next=index+Number(button.dataset.move);if(next<0||next>=steps.length)return;[steps[index],steps[next]]=[steps[next],steps[index]];}persistAndRender(false);};});
  });
  $('#session-actions').hidden=false;$('#coach-note').textContent=session.note||'Adapte l’effort à tes sensations.';
}
function persistAndRender(show = true) {
  setData(SESSION_KEY, JSON.stringify(session));
  renderSession();
  if (show) showToast('Séance mise à jour');
}
function addStep() {
  session.steps.push({name:'Nouvelle étape', amount:'5', unit:'min', target:'Facile'});
  persistAndRender();
  const inputs = $('#session-card').querySelectorAll('[data-field="name"]');
  inputs[inputs.length - 1].focus();
}
function exportSession() {
  if (!session) return;
  if (!$('#session-date').reportValidity()) return;
  try {
    session.scheduledDate=$('#session-date').value;
    const phases=freeWorkoutPhases(session),durationMin=phases.reduce((sum,phase)=>sum+phase.seconds,0)/60;
    const athlete=readAthletes().find(item=>item.id===activeAthleteId);
    const payload={...session,format:'foulee-watch-workout-v1',athleteId:activeAthleteId,athleteName:athlete?.name||'',workoutId:session.id,name:session.name,target:'',durationMin,phases,structure:{warmupMin:0,reps:1,workMin:durationMin,recoveryMin:0,cooldownMin:0}};
    setData(SESSION_KEY,JSON.stringify(session));
    downloadJson(payload,`foulee-watch-${session.scheduledDate}.json`);
    showToast('Fichier prêt à importer dans l’app iPhone');
  } catch(error) {showToast(error.message);}
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}
function setToday() {
  $('#today').textContent = new Intl.DateTimeFormat('fr-FR', {weekday:'short', day:'numeric', month:'short'}).format(new Date()).toUpperCase();
}
function showAccessPage(message='') {
  $('#session-edit-page').hidden=true;$('#saved-plans-page').hidden=true;
  $('#calendar-page').hidden=true;$('#settings-page').hidden=true;$('.app-navigation').hidden=true;
  $('#roadmap-page').hidden=true;
  $('#exercise-page').hidden=true;
  $('#access-page').hidden=false;
  $('#user-select-page').hidden=true;
  $('#home-page').hidden=true; $('#profile-page').hidden=true; $('#plan-page').hidden=true;
  $('#active-user-toolbar').hidden=true; $('.local-badge').hidden=true;
  updateSyncConnect();
  $('#access-message').textContent=message || 'Le code se trouve dans le fichier access-code.txt du dossier Application Support/Foulee sur le Mac.';
}
async function pullServerState() {
  const response=await serverFetch('/api/state',{headers:{'Authorization':`Bearer ${sessionStorage.getItem(TOKEN_KEY)}`},cache:'no-store'});
  if(response.status===401) {sessionStorage.removeItem(TOKEN_KEY);throw new Error('La session a expiré. Saisis de nouveau le code d’accès.');}
  if(!response.ok) throw new Error('Le serveur ne répond pas. Vérifie que Foulée est lancé sur le Mac.');
  return (await response.json()).items || {};
}
function applyRemoteItems(items) {
  for(const [key,value] of Object.entries(items)) if(key.startsWith('foulee.') && key!==ACTIVE_ATHLETE_KEY && !['foulee.theme','foulee.basemap',TOKEN_KEY,WORKSPACE_SESSION_KEY].includes(key) && !pendingWrites.has(key)) cacheSharedValue(key,value);
  serverItems=items;
}
async function unlockWithToken() {
  await syncQueue;
  await flushPendingWrites();
  if(pendingWrites.size) {openLocalApp();return;}
  let remote=await pullServerState();
  const local=Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(key=>key?.startsWith('foulee.') && key!==ACTIVE_ATHLETE_KEY && !['foulee.theme','foulee.basemap',TOKEN_KEY,WORKSPACE_SESSION_KEY].includes(key)).map(key=>[key,localStorage.getItem(key)]));
  // One-time migration: insert missing browser values without overwriting the shared database.
  const migration=Object.fromEntries(Object.entries(local).filter(([key])=>!(key in remote)));
  if(Object.keys(migration).length){
    await serverFetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${sessionStorage.getItem(TOKEN_KEY)}`},body:JSON.stringify({items:migration})});
    remote=await pullServerState();
  }
  applyRemoteItems(remote);
  $('#access-page').hidden=true;
  $('.local-badge').hidden=false;
  syncStatus('Données synchronisées avec le Mac','saved');
  initializeApp();
  await syncQueue;
  localStorage.setItem('foulee-offline-ready','yes');
  updateSyncConnect();$('#offline-continue').hidden=false;
  startServerPolling();
}
async function refreshSharedState() {
  if(refreshInFlight || !sessionStorage.getItem(TOKEN_KEY) || document.hidden || !$('#access-page').hidden) return;
  refreshInFlight = true;
  try {
    await syncQueue;
    await flushPendingWrites();
    if(pendingWrites.size || !sessionStorage.getItem(TOKEN_KEY))return;
    const fresh=await pullServerState();
    const changed=Object.entries(fresh).filter(([key,value])=>serverItems[key]!==value && !pendingWrites.has(key));
    if(!changed.length) {syncStatus('Données synchronisées avec le Mac','saved');return;}
    if(document.activeElement?.matches('input,select,textarea')) return;
    for(const [key,value] of changed) cacheSharedValue(key,value);
    serverItems=fresh;
    initializeAthletes(); renderAthleteOptions();
    if(workspaceUnlocked){fillProfile();renderRaces();loadPlanForm();loadSession();renderPage();}
    syncStatus('Données mises à jour depuis un autre appareil','saved');
  } catch(error) {
    if(error.message.includes('session a expiré')) {sessionStorage.removeItem(TOKEN_KEY); showAccessPage(error.message);}
    else syncStatus(error.message,'error');
  } finally {refreshInFlight = false;}
}
function initializeApp() {
  if(appInitialized)return;
  appInitialized=true;
  profileForm.addEventListener('submit', saveProfile);
  raceForm.addEventListener('submit', saveRace);
  planForm.addEventListener('submit', createTrainingPlan);
  $('#new-plan').addEventListener('click',beginNewPlan);
  $('#cancel-plan-edit').addEventListener('click',cancelPlanEdit);
  $('#edit-active-plan').addEventListener('click',()=>{const plan=loadPlan();if(plan)beginPlanEdit(plan.id);});
  $('#plan-goal').addEventListener('change', updateTargetPlaceholders);
  document.querySelectorAll('input[name=kind]').forEach(input=>input.addEventListener('change',updatePlanKindFields));
  document.querySelectorAll('input[name=trainingWeekday]').forEach(input=>input.addEventListener('change',updatePlanDayCount));
  $('#race-type').addEventListener('change', setRaceTypeFields);
  $('#cancel-race-edit').addEventListener('click',()=>{resetRaceForm();navigateToRoute('#profil');});
  $('#add-race').addEventListener('click',beginNewRace);
  document.querySelectorAll('[data-session-type]').forEach(button=>button.addEventListener('click',()=>{$('#session-type').value=button.dataset.sessionType;document.querySelectorAll('[data-session-type]').forEach(choice=>choice.setAttribute('aria-pressed',String(choice===button)));}));
  $('#session-date').addEventListener('change',()=>{if(!$('#session-date').reportValidity())return;if(session){session.scheduledDate=$('#session-date').value;persistAndRender(false);}});
  $('#generate').addEventListener('click',()=>{if($('#session-date').reportValidity())generateSession();});
  $('#add-step').addEventListener('click', addStep);
  $('#add-repeat').addEventListener('click', createFreeRepeat);
  $('#export').addEventListener('click', exportSession);
  initializeAthletes();
  workspaceUnlocked=Boolean(activeAthleteId && sessionStorage.getItem(WORKSPACE_SESSION_KEY)===activeAthleteId);
  renderAthleteOptions();
  $('#create-athlete-form').addEventListener('submit', createAthlete);
  $('#change-athlete').addEventListener('click', returnToUserChooser);
  $('#export-athlete').addEventListener('click', exportAthlete);
  $('#import-athlete').addEventListener('click', () => $('#athlete-file').click());
  $('#athlete-file').addEventListener('change', importAthleteFile);
  $('#import-results').addEventListener('click', () => $('#results-file').click());
  $('#results-file').addEventListener('change', importResultsFile);
  $('#result-match-form').addEventListener('submit',saveImportedResults);
  $('#cancel-result-match').addEventListener('click',()=>{$('#result-match-dialog').close();pendingResultImport=null;});
  $('#skip-result-match').addEventListener('click',()=>{$('#result-match-dialog').close();pendingResultImport=null;});
  document.addEventListener('click',handleInternalNavigation);
  window.addEventListener('hashchange', renderPage);
  window.addEventListener('popstate',renderPage);
  fillProfile(); renderRaces(); renderPage(); loadPlanForm();renderPlanLibrary();
  if(loadPlan()) renderPlan(loadPlan());
  setToday(); loadSession();
}
$('#sync-connect').addEventListener('click',()=>showAccessPage('Saisis le code pour synchroniser les modifications conservées sur cet appareil.'));
$('#offline-continue').addEventListener('click',()=>{$('#access-page').hidden=true;renderPage();});
$('#access-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const button=$('#access-form button'); button.disabled=true;
  $('#access-message').textContent='Connexion et récupération des données…';
  try {
    const response=await serverFetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:$('#access-code').value.trim()})});
    const result=await response.json();
    if(!response.ok) throw new Error(result.error || 'Code incorrect');
    sessionStorage.setItem(TOKEN_KEY,result.token);
    $('#access-code').value='';
    await unlockWithToken();
  } catch(error){ sessionStorage.removeItem(TOKEN_KEY); showAccessPage(error.message); }
  finally{button.disabled=false;}
});
window.addEventListener('DOMContentLoaded',async()=>{
  try {await prepareOfflineStorage();}
  catch(error){return showAccessPage('Le stockage hors ligne est indisponible. Autorise le stockage du navigateur puis recharge Foulée.');}
  const ready=localStorage.getItem('foulee-offline-ready')==='yes';
  if(!sessionStorage.getItem(TOKEN_KEY)) {
    if(ready){openLocalApp();return;}
    return showAccessPage();
  }
  try{await unlockWithToken();}
  catch(error){if(ready)openLocalApp();else showAccessPage(error.message);}
});

function navigateToRoute(route) {
  if(!['#espace','#accueil','#profil','#modifier-profil','#modifier-course','#plan','#exercices','#roadmap','#choisir','#calendrier','#libre','#parametres','#plans-enregistres','#editer-plan','#seance'].includes(route))return;
  if(location.hash!==route)history.pushState(null,'',route);
  renderPage();
  window.scrollTo(0,0);
}
function handleInternalNavigation(event) {
  if(event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
  const link=event.target.closest('a[href^="#"]');
  if(!link || link.hasAttribute('download') || (link.target && link.target!=='_self'))return;
  const route=link.getAttribute('href');
  if(!['#espace','#accueil','#profil','#modifier-profil','#modifier-course','#plan','#exercices','#roadmap','#choisir','#calendrier','#libre','#parametres','#plans-enregistres','#editer-plan','#seance'].includes(route))return;
  event.preventDefault();navigateToRoute(route);
}
function renderPage() {
  const sessionEditor=document.querySelector('.session-editor-dialog');
  if(sessionEditor)closeSessionEditor(sessionEditor);
  if(location.hash==='#choisir'){workspaceUnlocked=false;sessionStorage.removeItem(WORKSPACE_SESSION_KEY);}
  if(!workspaceUnlocked && ['#plan','#profil','#modifier-profil','#modifier-course','#exercices','#calendrier','#libre','#parametres','#plans-enregistres','#editer-plan','#seance'].includes(location.hash))pendingRoute=location.hash;
  const isRoadmap=location.hash === '#roadmap';
  const isChooser=!workspaceUnlocked;
  $('#profile-editor-page').hidden=isChooser||location.hash!=='#modifier-profil';
  $('#race-editor-page').hidden=isChooser||location.hash!=='#modifier-course';
  $('#roadmap-page').hidden=!isRoadmap; 
  $('#user-select-page').hidden=!isChooser || isRoadmap;
  $('#active-user-toolbar').hidden=isChooser;
  updateSyncConnect();
  $('.local-badge').hidden=isChooser;
  document.body.classList.toggle('workspace-active',!isChooser);
  renderAthleteOptions();
  $('#session-edit-page').hidden=isChooser || location.hash!=='#seance';
  const isCalendar=['','#calendrier','#espace','#accueil'].includes(location.hash);
  const isSettings=location.hash==='#parametres';
  const isSavedPlans=location.hash==='#plans-enregistres';
  const isPlanEditor=location.hash==='#editer-plan';
  $('#plan-editor-page').hidden=isChooser||!isPlanEditor;
  $('#plan-form-panel').hidden=isChooser||!isPlanEditor;
  $('#saved-plans-page').hidden=isChooser||!isSavedPlans;
  $('#calendar-page').hidden=isChooser || !isCalendar;
  $('#settings-page').hidden=isChooser || !isSettings;
  $('.app-navigation').hidden=isChooser;
  $('.app-navigation').querySelectorAll('a').forEach(link=>{const active=link.hash===(isCalendar?'#calendrier':location.hash==='#seance'?'#plan':location.hash==='#exercices'?'#calendrier':['#profil','#modifier-profil','#modifier-course'].includes(location.hash)||isSavedPlans||isPlanEditor||isRoadmap?'#parametres':location.hash);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  if(!isChooser&&isCalendar)CalendarModule.render({athleteId:activeAthleteId,read:getData,plan:loadPlan(),openSession:openPlannedSession,open:id=>{calendarExerciseOrigin=true;calendarExerciseToOpen=id;navigateToRoute('#exercices');}});
  $('#exercise-page').hidden=isChooser || location.hash !== '#exercices';
  if(isChooser){$('#home-page').hidden=true;$('#profile-page').hidden=true;$('#plan-page').hidden=true;return;}
  const isProfile = location.hash === '#profil';
  const isProfileEditor=location.hash==='#modifier-profil',isRaceEditor=location.hash==='#modifier-course';
  const isPlan = location.hash === '#plan';
  const isExercise = location.hash === '#exercices';
  $('#home-page').hidden = isProfile || isProfileEditor || isRaceEditor || isPlan || isExercise || isRoadmap || isCalendar || isSettings || isSavedPlans || isPlanEditor || location.hash==='#seance';
  if(isExercise){ExerciseModule.render({athleteId:activeAthleteId, read:getData, write:setData, requestLLM:requestLocalLLM,exerciseId:calendarExerciseToOpen});document.body.classList.toggle('calendar-exercise-open',calendarExerciseOrigin);calendarExerciseToOpen=null;}else {calendarExerciseOrigin=false;document.body.classList.remove('calendar-exercise-open');}
  $('#profile-page').hidden = !isProfile;
  $('#plan-page').hidden = !isPlan;
  if(isSavedPlans)renderPlanLibrary();
  if(isProfile){renderProfileRead();renderRaces();}
  if(isProfileEditor)fillProfile();
  if(isRaceEditor)setRaceTypeFields();
  if (isPlan) { populateReferenceRaces($('#reference-race').value || loadPlan()?.settings?.referenceRaceId); const plan = loadPlan();$('#plan-empty').hidden=Boolean(plan);$('#plan-detail-panel').hidden=!plan;if (plan) renderPlan(plan); }
}
