import {createServer} from 'node:http';
import {build} from 'esbuild';
import {loadEnv} from 'vite';
await build({entryPoints:['server/epi.ts'],outfile:'test-results/epi-server.mjs',bundle:true,platform:'node',format:'esm'});
const {handleEpi}=await import('../test-results/epi-server.mjs');
const env={...loadEnv('development',process.cwd(),''),...process.env};
createServer(async(req,res)=>{
 if(req.url!=='/api/epi'){res.writeHead(404);res.end();return;}
 const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort();});
 try{const chunks=[];let size=0;for await(const b of req){size+=b.length;if(size>96000){res.writeHead(413);res.end();return;}chunks.push(b);}
 const r=await handleEpi(new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,body:req.method==='GET'?undefined:Buffer.concat(chunks),signal:abort.signal}),env);
 res.writeHead(r.status,Object.fromEntries(r.headers));if(r.body){for await(const b of r.body){if(res.destroyed)break;res.write(b);}}res.end();
 }catch{if(!res.headersSent)res.writeHead(500);res.end();}
}).listen(5174,'127.0.0.1',()=>console.log('Epi local API: http://127.0.0.1:5174/api/epi (no secrets logged)'));
