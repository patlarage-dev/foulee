const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../exercise-module.js'),'utf8')+';globalThis.module=ExerciseModule;',ctx);
const planned={duration:25,structure:{warmupMin:5,reps:2,workMin:6,recoveryMin:3,cooldownMin:5}};
test('Comparison assigns recorded phases explicitly and leaves missing or ambiguous steps unavailable',()=>{
 const item={seconds:1530,phases:[{seconds:310,km:.7},{seconds:365,km:1.17}],phaseMapping:{0:'warmup',1:'work-1'}};
 const steps=ctx.module.comparisonSteps(item,planned);assert.equal(steps.length,5);assert.equal(steps[0].actual.seconds,310);assert.equal(steps[1].actual.seconds,365);assert.equal(steps[2].actual,null);
 item.phaseMapping={0:'work-1',1:'work-1'};const ambiguous=ctx.module.comparisonSteps(item,planned)[1];assert.equal(ambiguous.actual,null);assert.equal(ambiguous.ambiguous,true);
});
test('A continuous footing compares the full recording without inventing intermediate phases',()=>{
 const steps=ctx.module.comparisonSteps({seconds:2400,km:7,phases:[{seconds:300,km:1}]},{structure:{warmupMin:0,reps:1,workMin:45,recoveryMin:0,cooldownMin:0}});
 assert.equal(steps.length,1);assert.equal(steps[0].seconds,2700);assert.equal(steps[0].actual.seconds,2400);
});
test('Missing measurements do not render a fake zero completion bar',()=>{
 const html=ctx.module.comparisonGauge(null,300,String,'s','Durée');assert.ok(html.includes('indisponible'));assert.ok(!html.includes('gauge-actual'));assert.ok(!html.includes('NaN'));
});

test('Custom renamed phases retain stable mappings and individual expected paces',()=>{
 const custom={target:'6:00',phases:[{id:'a',name:'Progressif',seconds:600,target:'6:00',work:true},{id:'b',name:'Accélération',seconds:300,target:'4:00',work:true}]};
 const steps=ctx.module.comparisonSteps({phases:[{seconds:290,km:1.2}],phaseMapping:{0:'b'}},custom);
 assert.equal(steps.length,2);assert.equal(steps[0].name,'Progressif');assert.equal(steps[0].targetPace,360);assert.equal(steps[1].targetPace,240);assert.equal(steps[1].actual.seconds,290);assert.equal(steps[0].actual,null);
});
