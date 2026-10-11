const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app-v2.js'),'utf8');
function setup(plans,active,accepted=true,legacy=null){
  const data={plans:JSON.stringify(plans),active,legacy:JSON.stringify(legacy)};
  const elements={};let rendered=null;
  const context={PLANS_KEY:'plans',PLAN_KEY:'legacy',ACTIVE_PLAN_KEY:'active',planEditingId:active,
    getData:key=>data[key],setData:(key,value)=>data[key]=value,storageKey:key=>key,
    cacheSharedValue:(key,value)=>data[key]=value,persistRemote:()=>{},newId:()=> 'migrated',
    localStorage:{setItem:(key,value)=>data[key]=value},
    goalNames:{'10k':'10 km'},formatDateShort:value=>value,confirm:()=>accepted,
    $:selector=>elements[selector]??=( {hidden:false,innerHTML:'old',querySelector:()=>({focus(){}})}),
    renderPlan:plan=>rendered=plan,renderPlanLibrary:()=>{},showToast:()=>{}};
  vm.createContext(context);
  for(const name of ['loadPlans','loadPlan','deletePlan']){
    const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);
    vm.runInContext(source.slice(start,end),context);
  }
  return {context,data,elements,rendered:()=>rendered};
}
const first={id:'a',settings:{goal:'10k'}},second={id:'b',settings:{goal:'10k'}};
test('Cancellation preserves all saved data',()=>{
 const state=setup([first,second],'a',false,first),before=JSON.stringify(state.data);
 state.context.deletePlan('a');assert.equal(JSON.stringify(state.data),before);
});
test('An active plan cannot be deleted even when deletion is confirmed',()=>{
 const state=setup([first,second],'a',true,first),before=JSON.stringify(state.data);
 state.context.deletePlan('a');assert.equal(JSON.stringify(state.data),before);
});
test('Deleting the last inactive plan remains empty after reload',()=>{
 const state=setup([first],'',true,first);state.context.deletePlan('a');
 assert.equal(state.context.loadPlans().length,0);assert.equal(state.context.loadPlan(),null);assert.equal(state.data.legacy,'null');
});
test('Explicit empty library never resurrects a legacy plan',()=>{
 const state=setup([],'',true,first);assert.equal(state.context.loadPlans().length,0);
});
test('Deleting another plan preserves current selection and editor',()=>{
 const state=setup([first,second],'a',true,first);state.context.deletePlan('b');
 assert.equal(state.data.active,'a');assert.equal(state.context.planEditingId,'a');
 assert.equal(state.rendered(),null);assert.deepEqual(JSON.parse(state.data.plans),[first]);
});
test('Editing a prepared plan does not activate it',()=>{
 const plan={id:'prepared'},elements={};let loaded=null,route=null;
 const ctx={loadPlans:()=>[plan],loadPlanForm:p=>loaded=p,navigateToRoute:r=>route=r,renderPlanLibrary:()=>{},$:selector=>elements[selector]??={hidden:true,textContent:'',scrollIntoView(){}},setData:()=>{throw Error('Editing must not change the active plan');}};
 vm.createContext(ctx);const start=source.indexOf('function beginPlanEdit('),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end),ctx);ctx.beginPlanEdit('prepared');assert.equal(loaded,plan);assert.equal(route,'#editer-plan');assert.equal(ctx.planEditingId,'prepared');
});

test('An explicitly inactive library stays inactive after loading or deleting a plan',()=>{const state=setup([first,second],'',true,first);assert.equal(state.context.loadPlan(),null);state.context.deletePlan('b');assert.equal(state.data.active,'');assert.equal(state.context.loadPlan(),null);});

test('Cards show escaped titles, optional targets and one active indicator',()=>{
 const list={innerHTML:'',querySelectorAll:()=>[]};
 const plans=[{id:'a',settings:{title:'Paris <2027>',goal:'10k'},targetSeconds:3600},{id:'b',settings:{title:'Remise en forme',goal:'10k'},targetSeconds:0},{id:'c',settings:{goal:'10k'}}];
 const ctx={$:()=>list,loadPlans:()=>plans,loadPlan:()=>plans[0],goalNames:{'10k':'10 km'},planProgress:()=>({done:2,total:12}),escapeHtml:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),formatDateShort:s=>s,timeText:()=> '1 h'};
 vm.createContext(ctx);const start=source.indexOf('function renderPlanLibrary('),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end),ctx);ctx.renderPlanLibrary();
 assert.match(list.innerHTML,/<h3>Paris &lt;2027&gt;<\/h3><p>10 km · 1 h<\/p>/);
 assert.match(list.innerHTML,/<h3>Remise en forme<\/h3><p>10 km<\/p>/);
 assert.match(list.innerHTML,/<h3>10 km<\/h3>/);
 assert.match(list.innerHTML,/2 \/ 12 séances réalisées/);
 assert.equal((list.innerHTML.match(/aria-pressed="true"/g)||[]).length,1);
 assert.doesNotMatch(list.innerHTML,/Plan actif|Plan prêt/);
});

test('A plan saves its title and derives session count from the selected days',()=>{
 const values={title:'  Remise en forme  ',goal:'10k',days:'5',startDate:'2026-10-05',raceDate:'2026-10-19',targetHours:'0',targetMinutes:'55'},stored={},elements={};let paceTarget,route;
 const ctx={planEditingId:'',planForm:{},FormData:class{entries(){return Object.entries(values);}getAll(){return ['2','0'];}},goalDistances:{'10k':10},goalPaceAdjustments:{'10k':{easy:85}},latestRaceReference:()=>null,loadProfile:()=>({easyPace:'7:00',level:'debutant'}),paceToMinutes:()=>7,estimatePaces:(g,t)=>{paceTarget=t;return {goalPace:t/10,easy:420,threshold:330,interval:300};},phaseFor:()=> 'Développement',workoutTemplate:()=>[],assignSessionDates:s=>s,dateInputValue:()=> '2026-10-05',weekRange:()=>'',newId:()=> 'new',paceFromSecondsPerKm:s=>String(s),loadPlan:()=>null,loadPlans:()=>[],setData:(k,v)=>stored[k]=v,getData:()=>'',PLANS_KEY:'plans',ACTIVE_PLAN_KEY:'active',PLAN_KEY:'legacy',$:s=>elements[s]??={hidden:false,textContent:'',innerHTML:''},renderPlanLibrary:()=>{},navigateToRoute:r=>route=r,showToast:()=>{}};
 vm.createContext(ctx);const start=source.indexOf('function createTrainingPlan('),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end),ctx);ctx.createTrainingPlan({preventDefault(){}});
 const plan=JSON.parse(stored.plans)[0];assert.equal(plan.settings.title,'Remise en forme');assert.equal(plan.targetSeconds,3300);assert.equal(plan.settings.days,'2');assert.ok(Number.isFinite(paceTarget)&&paceTarget>0);assert.equal(stored.active,undefined);assert.equal(route,'#plans-enregistres');
 const before=JSON.stringify(stored);values.targetMinutes='';ctx.createTrainingPlan({preventDefault(){}});assert.equal(JSON.stringify(stored),before,'A missing target must not save a plan');
});

test('Activation requires confirmation of deactivation of the current plan first',()=>{
 const state=setup([first,second],'a',true,first);
 for(const name of ['selectPlan','deactivatePlan']){const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end),state.context);}
 state.context.selectPlan('b');assert.equal(state.data.active,'a');
 let prompts=0;state.context.confirm=()=>{prompts++;return false;};state.context.deactivatePlan('a');assert.equal(prompts,1);assert.equal(state.data.active,'a');
 state.context.confirm=()=>{prompts++;return true;};state.context.deactivatePlan('a');assert.equal(state.data.active,'');assert.equal(state.context.loadPlan(),null);
 state.context.selectPlan('b');assert.equal(state.data.active,'b');assert.equal(state.rendered().id,'b');
});

test('Course and other plans display their dates and disable unavailable actions',()=>{
 const list={innerHTML:'',querySelectorAll:()=>[]},plans=[{id:'a',settings:{title:'Course',raceDate:'2027-04-04'}},{id:'b',settings:{title:'Forme',kind:'general',raceDate:'2027-05-01'}}];
 const ctx={$:()=>list,loadPlans:()=>plans,loadPlan:()=>plans[0],goalNames:{},planProgress:()=>({done:0,total:2}),escapeHtml:String,formatDateShort:s=>s};vm.createContext(ctx);
 const start=source.indexOf('function renderPlanLibrary('),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end),ctx);ctx.renderPlanLibrary();
 assert.match(list.innerHTML,/Date de la course : 2027-04-04/);assert.match(list.innerHTML,/Date de fin : 2027-05-01/);
 assert.match(list.innerHTML,/<button[^>]*disabled[^>]*data-delete-plan="a"/);assert.match(list.innerHTML,/<button[^>]*data-select-plan="b"[^>]*disabled/);
 assert.doesNotMatch(list.innerHTML,/<button[^>]*disabled[^>]*data-delete-plan="b"/);
});
