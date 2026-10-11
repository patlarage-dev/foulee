const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../exercise-module.js'),'utf8');const ctx={};vm.createContext(ctx);vm.runInContext(source+';globalThis.module=ExerciseModule;',ctx);
test('Reimport preserves a custom exercise name and feedback while updating measurements',()=>{
 const previous={id:'a',title:'Mon footing',customTitle:'Mon footing',exerciseType:'tempo',seconds:1200,feedback:{note:'Bien'},planLink:{planId:'p',sessionId:'s'},phaseMapping:{0:'work'}};
 const incoming={id:'a',title:'Titre Apple Watch',seconds:1300};const merged=ctx.module.mergeImportedExercise(incoming,previous);
 assert.equal(merged.title,'Mon footing');assert.equal(merged.exerciseType,'tempo');assert.equal(merged.customTitle,'Mon footing');assert.equal(merged.seconds,1300);assert.deepEqual(merged.feedback,previous.feedback);assert.deepEqual(merged.planLink,previous.planLink);assert.equal(merged.phaseMapping,undefined);
});
test('Reimport keeps the imported title when there is no custom name',()=>{
 const incoming={id:'a',title:'Nouveau titre'};assert.equal(ctx.module.mergeImportedExercise(incoming,{title:'Ancien titre'}).title,'Nouveau titre');assert.equal(ctx.module.mergeImportedExercise(incoming,null),incoming);
});
