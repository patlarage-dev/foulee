const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app-v2.js'),'utf8');const ctx={paceFromSecondsPerKm:v=>String(v),escapeHtml:String};vm.createContext(ctx);
for(const name of ['normalizeFreeSteps','computeWorkoutDuration','makeWorkout','workoutTemplate','normalizeWorkout','parsePaceSeconds','phaseTotals','formatMinutes','workoutDistance','workoutStructureHtml']){const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end),ctx);}
test('Generated footings and long runs stay continuous while quality sessions retain warmup and cooldown',()=>{
 for(const goal of ['10k','semi','marathon','endurance'])for(const days of [3,4,5]){
 const sessions=ctx.workoutTemplate(goal,0,'Développement',{easy:360,threshold:300,interval:270,goalPace:320},45,75,false,days);
 for(const item of sessions){if(/endurance|footing|longue/i.test(item.name)){assert.equal(item.structure.warmupMin,0);assert.equal(item.structure.cooldownMin,0);assert.equal(item.structure.workMin,item.duration);}else{assert.ok(item.structure.warmupMin>0);assert.ok(item.structure.cooldownMin>0);}}
 }
});
test('Legacy default footing blocks collapse without changing duration or overriding edited structures',()=>{
 const item={name:'Sortie longue',duration:60,structure:{warmupMin:5,reps:1,workMin:50,recoveryMin:0,cooldownMin:5}};
 ctx.normalizeWorkout(item);assert.equal(item.structure.workMin,60);assert.equal(item.duration,60);const html=ctx.workoutStructureHtml(item);assert.ok(!html.includes('Échauffement'));assert.ok(!html.includes('Retour au calme'));
 const custom={name:'Footing',duration:30,structureEdited:true,structure:{warmupMin:5,reps:1,workMin:20,recoveryMin:0,cooldownMin:5}};ctx.normalizeWorkout(custom);assert.equal(custom.structure.warmupMin,5);
});
test('A free long run uses its single continuous step with the profile distance',()=>{
 const local={...ctx,loadProfile:()=>({longRun:12,easyPace:'6:00',days:3}),$:()=>({value:'long'}),paceToMinutes:()=>6,paceText:String,newId:()=> 'free-test',dateInputValue:()=> '2026-10-04',goalLabels:{endurance:'Endurance'},SESSION_KEY:'session',setData:()=>{},renderSession:()=>{}};
 vm.createContext(local);const templateStart=source.indexOf('const templates ='),templateEnd=source.indexOf('\n};',templateStart)+3;vm.runInContext(source.slice(templateStart,templateEnd),local);
 const start=source.indexOf('function generateSession('),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end)+';generateSession();globalThis.result=session;',local);
 assert.equal(local.result.steps.length,1);assert.equal(local.result.steps[0].amount,'72');assert.equal(local.result.exerciseType,'long');
});

test('Custom phases recalculate duration and distance using each phase pace',()=>{
 const phases=[{seconds:600,target:'6:00 /km'},{seconds:900,target:'5:00 /km'}];
 const totals=ctx.phaseTotals(phases);assert.equal(totals.minutes,25);assert.ok(Math.abs(totals.km-14/3)<1e-10);assert.equal(totals.missing,0);
 const item={name:'Tempo',duration:40,phases};ctx.normalizeWorkout(item);assert.equal(item.duration,25);assert.equal(item.structure.workMin,25);
 assert.equal(ctx.phaseTotals([...phases,{seconds:300,target:'Facile'}]).missing,1);assert.equal(ctx.parsePaceSeconds('5:99'),null);
});
