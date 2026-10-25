import {it,expect} from 'vitest';
import {generate} from './engine';
import {updateDiplomacy,getRelation,treaty} from './diplomacy';
import {researchRate} from './progression';
import {manufacturing} from './resources';
import {emptyStock} from './livingTypes';
const make=()=>generate({seed:42,size:48,preset:'four',sea:.4,forest:.35,mountains:.05});
it('legacy alliance webs are reduced to three direct partners per nation',()=>{
 const w=make(); const source=structuredClone(w.nations[0]);
 while(w.nations.length<7)w.nations.push({...structuredClone(source),id:w.nations.length+1});
 for(let i=2;i<=7;i++)treaty(w,getRelation(w,1,i),'alliance','test');
 w.year=80;updateDiplomacy(w);
 expect(w.relations.filter(r=>r.allied&&(r.a===1||r.b===1)).length).toBeLessThanOrEqual(3);
});
it('education and delivered trade accelerate research without promoting starving countries',()=>{
 const w=make(),n=w.nations[0]; n.tech=30;n.population=5000;n.food=10000;n.stability=.9;n.wealth=10000;
 const cities=w.life!.settlements.filter(c=>c.nation===n.id);cities.forEach(c=>{c.population=500;c.urban!.education=0;});
 const base=researchRate(w,n);cities.forEach(c=>c.urban!.education=.9);
 expect(researchRate(w,n)).toBeGreaterThan(base*2);n.food=0;expect(researchRate(w,n)).toBeLessThan(0);
});
it('industrial water power needs workforce and capital but survives exhausted fossil deposits',()=>{
 expect(manufacturing(emptyStock(),8,100,1,100).energy).toBeGreaterThan(0);
 expect(manufacturing(emptyStock(),8,0,1,100).energy).toBe(0);
 expect(manufacturing(emptyStock(),8,100,1,0).energy).toBe(0);
});
