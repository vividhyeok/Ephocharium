import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('test-results/baseline-0.5',{recursive:true});
execFileSync('git',['archive','--format=tar','--output=test-results/baseline-0.5.tar','a61983a','src']);
execFileSync('tar',['-xf','test-results/baseline-0.5.tar','-C','test-results/baseline-0.5']);
for(const [entry,out]of [['test-results/baseline-0.5/src/engine.ts','test-results/baseline-engine.mjs'],['src/engine.ts','test-results/current-engine.mjs']])await build({entryPoints:[entry],outfile:out,bundle:true,platform:'node',format:'esm'});
const old=await import('../test-results/baseline-engine.mjs'),current=await import('../test-results/current-engine.mjs');
const source=old.generate({seed:91,size:256,preset:'four',sea:.4,forest:.35,mountains:.05});
for(let i=0;i<1000;i++)old.step(source);
const result=[];
for(const [version,engine]of [['0.5.0',old],['0.6.0',current]]) {
 const w=structuredClone(source);for(let i=0;i<30;i++)engine.step(w);
 const before=performance.now();for(let i=0;i<200;i++)engine.step(w);const ms=performance.now()-before;
 result.push({version,seed:91,size:256,tiles:w.tiles.length,initialYear:1030,years:200,elapsedMs:Math.round(ms),msPerYear:+(ms/200).toFixed(2),valid:engine.validate(w),cities:w.life.settlements.length,alive:w.nations.filter(n=>n.alive).length,bytes:Buffer.byteLength(JSON.stringify(w))});
}
console.log(JSON.stringify(result));writeFileSync('docs/performance-0.6.json',JSON.stringify({method:'Same 0.5.0 large-world starting snapshot, 30-year warmup then 200 annual steps; sequential on this machine. Different rules may change the resulting state.',results:result,ratio:+(result[1].msPerYear/result[0].msPerYear).toFixed(2)},null,2));
