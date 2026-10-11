const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app-v2.js'),'utf8');
function extract(ctx,names){vm.createContext(ctx);for(const name of names){const a=source.indexOf('function '+name+'('),b=source.indexOf('\nfunction ',a+1);vm.runInContext(source.slice(a,b),ctx);}}
test('Editing a trophy loads all existing fields before opening its editor',()=>{
 const race={id:'a',raceName:'Paris',type:'Marathon',date:'2026-04-12',hours:'3',minutes:'45',seconds:'12'},fields={},elements={};let route;
 const ctx={loadRaces:()=>[race],raceForm:{reset(){},elements:{namedItem:k=>fields[k]??={value:''}}},setRaceTypeFields(){},$:s=>elements[s]??={},navigateToRoute:r=>route=r};extract(ctx,['editRace']);ctx.editRace('a');
 for(const [key,value] of Object.entries(race))assert.equal(fields[key].value,value);assert.equal(route,'#modifier-course');
});
test('Saving an edited trophy updates the result without duplicating it and returns to the profile',()=>{
 const original={id:'a',raceName:'Paris',minutes:'50'},edited={id:'a',raceName:'Paris 2026',type:'10 km',date:'2026-04-12',minutes:'45',seconds:'12'};let saved,route;
 const ctx={raceForm:{},FormData:class{entries(){return Object.entries(edited);}},loadRaces:()=>[original],saveRaces:r=>saved=r,resetRaceForm(){},navigateToRoute:r=>route=r,showToast(){}};extract(ctx,['saveRace']);ctx.saveRace({preventDefault(){}});assert.equal(saved.length,1);assert.equal(saved[0].raceName,'Paris 2026');assert.equal(saved[0].minutes,'45');assert.equal(route,'#profil');
});
