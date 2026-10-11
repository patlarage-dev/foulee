const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app-v2.js'),'utf8');
const ctx={};vm.createContext(ctx);
for(const name of ['normalizeFreeSteps','groupFreeSteps','freeWorkoutPhases','exportSession']){const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end),ctx);}
const step=(name,amount,unit='min')=>({name,amount,unit,target:'6:00 /km'});
test('Intervals alternate work and recovery, including seconds, with every selected recovery',()=>{
 const phases=ctx.freeWorkoutPhases({id:'free',steps:ctx.normalizeFreeSteps([step('Échauffement','15'),step('Fractionné','6 × 1'),step('Récupération','90','sec'),step('Retour au calme','10')])});
 assert.equal(phases.length,14);assert.equal(phases.reduce((s,p)=>s+p.seconds,0),2400);assert.equal(phases[2].seconds,90);assert.equal(phases[2].work,false);assert.equal(phases[11].name,'Fractionné');assert.equal(new Set(phases.map(p=>p.id)).size,14);
});
test('Decimal minutes are preserved and invalid durations block export',()=>{
 assert.equal(ctx.freeWorkoutPhases({steps:[step('Course','1,5') ]})[0].seconds,90);
 for(const amount of ['0','abc','-5','101 × 1'])assert.throws(()=>ctx.freeWorkoutPhases({steps:[step('Course',amount)]}));
 assert.throws(()=>ctx.freeWorkoutPhases({steps:[]}));
});
test('Free export supplies required iPhone decoder fields and selected date',()=>{
 let result;Object.assign(ctx,{session:{id:'free-id',name:'Tempo',steps:ctx.normalizeFreeSteps([step('Tempo','3 × 6'),step('Récupération','2')])},$:()=>({value:'2026-10-12',reportValidity:()=>true}),readAthletes:()=>[{id:'athlete',name:'Patrick'}],activeAthleteId:'athlete',SESSION_KEY:'session',setData:()=>{},downloadJson:p=>result=p,showToast:()=>{}});
 ctx.exportSession();assert.equal(result.format,'foulee-watch-workout-v1');assert.equal(result.scheduledDate,'2026-10-12');assert.equal(result.workoutId,'free-id');assert.equal(result.durationMin,24);assert.equal(result.structure.workMin,24);assert.equal(typeof result.target,'string');assert.equal(result.athleteId,'athlete');
});

test('Two explicit repeat blocks preserve all phases and the standalone recovery',()=>{
 let steps=[step('Échauffement','10'),step('Vite A','1'),step('Repos A','30','sec'),step('Pause','3'),step('Vite B','2'),step('Repos B','1'),step('Retour au calme','5')];
 steps=ctx.groupFreeSteps(steps,[1,2],4);steps=ctx.groupFreeSteps(steps,[3,4],5);
 const phases=ctx.freeWorkoutPhases({id:'session',steps});
 assert.equal(phases.length,21);assert.equal(phases[9].name,'Pause');assert.equal(phases[10].name,'Vite B');assert.equal(phases[19].name,'Repos B');assert.equal(phases[20].name,'Retour au calme');assert.equal(phases.reduce((sum,p)=>sum+p.seconds,0),2340);assert.equal(new Set(phases.map(p=>p.id)).size,21);
});
test('Grouping validates selection and preserves editable child phases',()=>{
 const steps=[step('A','1'),step('B','2'),step('C','3')];
 for(const indices of [[],[0,2],[-1],[3]])assert.throws(()=>ctx.groupFreeSteps(steps,indices,4));
 for(const count of [1,2.5,101])assert.throws(()=>ctx.groupFreeSteps(steps,[0],count));
 const grouped=ctx.groupFreeSteps(steps,[0,1],4);grouped[0].steps[0].amount='3';
 assert.equal(ctx.freeWorkoutPhases({steps:grouped})[0].seconds,180);
 assert.throws(()=>ctx.groupFreeSteps(grouped,[0],4));
});
