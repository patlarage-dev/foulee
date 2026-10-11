const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx={Date};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../app-v2.js'),'utf8').split('const PROFILE_KEY')[0]+';globalThis.calendar=CalendarModule;',ctx);
test('Calendar uses local dates and shows a complete Monday-first month including leap day',()=>{
 const days=ctx.calendar.monthDays(2024,1);assert.equal(days.length,42);assert.equal(days[0].getDay(),1);assert.ok(days.some(d=>ctx.calendar.dateKey(d)==='2024-02-29'));
 const local=new Date(2026,9,4,0,30);assert.equal(ctx.calendar.dateKey(local),'2026-10-04');assert.equal(ctx.calendar.dateKey('invalid'),'');
});
test('Calendar retains multiple exercises on one day and excludes future or invalid dates',()=>{
 const now=new Date(2026,9,4,12),items=[{id:'b',date:new Date(2026,9,3,10)},{id:'a',date:new Date(2026,9,3,8)},{id:'future',date:new Date(2026,9,5)},{id:'invalid',date:'oops'}];
 const groups=ctx.calendar.groupExercises(items,now);assert.equal(groups.size,1);assert.equal(groups.get('2026-10-03').length,2);assert.equal(groups.get('2026-10-03')[0].id,'a');
});
test('Only upcoming unfinished sessions from the supplied active plan enter the calendar',()=>{
 const plan={id:'active',weeks:[{sessions:[{id:'a',name:'Tempo',scheduledDate:'2026-10-05'},{id:'b',name:'Sortie longue',scheduledDate:'2026-10-06',status:'done'},{id:'c',name:'Intervalles',scheduledDate:'2026-10-07'},{id:'past',name:'Footing',scheduledDate:'2026-10-01'}]}]};
 const groups=ctx.calendar.upcomingSessions(plan,new Date(2026,9,4),[{planLink:{planId:'active',sessionId:'c'}}]);assert.equal(groups.size,2);assert.ok(groups.has('2026-10-06'),'Legacy manual status alone does not mark an exercise as completed');assert.equal(groups.get('2026-10-05')[0].exerciseType,'tempo');assert.equal(groups.get('2026-10-05')[0].planned,true);assert.equal(ctx.calendar.upcomingSessions(null).size,0);
});
