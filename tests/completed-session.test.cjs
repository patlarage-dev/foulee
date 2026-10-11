const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
for(const file of ['app.js','app-v2.js']){
 const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
 function setup(name,context){vm.createContext(context);const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end),context);return context;}
 test(file+': completed session opens the read-only viewer',()=>{
  let viewed=false;const item={id:'session'},context=setup('renderSessionEditor',{loadPlan:()=>({id:'plan',weeks:[{sessions:[item]}]}),normalizeWorkout:v=>v,associatedExercise:()=>({id:'result'}),renderSessionViewer:(week,session)=>{assert.equal(week,0);assert.equal(session,0);viewed=true;},showToast:()=>{}});
  context.renderSessionEditor(0,0);assert.equal(viewed,true);assert.equal(context.sessionEditorState,undefined);
 });
 test(file+': completion during editing prevents saving',()=>{
  const item={id:'session',name:'Original'},plan={id:'plan',weeks:[{sessions:[item]}]};let route;
  const context=setup('saveWorkoutEditor',{editorValues:()=>({name:'Changed',phases:[{name:'Phase',seconds:60}]}),sessionEditorState:{athleteId:'athlete',planId:'plan',sessionId:'session'},activeAthleteId:'athlete',loadPlans:()=>[plan],associatedExercise:()=>({id:'result'}),navigateToRoute:value=>route=value,showToast:()=>{}});
  context.saveWorkoutEditor({preventDefault(){},currentTarget:{}});assert.equal(item.name,'Original');assert.equal(context.sessionEditorState,null);assert.equal(route,'#plan');
 });
}
for(const file of ['app.js','app-v2.js']){
 test(file+': viewing a completed session opens its linked exercise',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');let route;
  const context={loadPlan:()=>({id:'plan',weeks:[{sessions:[{id:'session'}]}]}),associatedExercise:(plan,session)=>{assert.equal(plan,'plan');assert.equal(session,'session');return {id:'recorded-exercise'};},navigateToRoute:value=>route=value,sessionEditorState:{},calendarExerciseOrigin:false,calendarExerciseToOpen:null};
  vm.createContext(context);const start=source.indexOf('function renderSessionViewer('),end=source.indexOf('\nfunction ',start+1);vm.runInContext(source.slice(start,end),context);
  context.renderSessionViewer(0,0);assert.equal(route,'#exercices');assert.equal(context.calendarExerciseToOpen,'recorded-exercise');assert.equal(context.calendarExerciseOrigin,true);assert.equal(context.sessionEditorState,null);
 });
}
