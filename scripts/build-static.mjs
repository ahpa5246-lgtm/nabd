// Explicit no-dependency allowlist: do not publish SQL migrations, audit fixtures,
// server code, GitHub metadata, docs or tests as public static website assets.
import {mkdir,rm,copyFile,stat,readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const destination=path.join(root,'dist');
const allow=[
 'index.html','product-ui.css','product-app.js','agents.js','demo-data.js',
 'transaction-utils.js','cloud-service.js','cloud-config.js','sw.js',
 'manifest.webmanifest','privacy.html','terms.html'
];
if(path.dirname(destination)!==root||path.basename(destination)!=='dist')throw Error('Invalid build path');
await rm(destination,{recursive:true,force:true});
await mkdir(destination,{recursive:true});
for(const name of allow){
 const from=path.join(root,name),target=path.join(destination,name);
 if(!(await stat(from)).isFile())throw Error('Missing app asset: '+name);
 await copyFile(from,target);
}
const config=await readFile(path.join(destination,'cloud-config.js'),'utf8');
const match=config.match(/publishableKey\s*:\s*(['"])([^'"]*)\1/);
if(!match)throw Error('Cloud config must declare an explicit publishableKey');
if(/^(sb_secret_|service_role)/i.test(match[2]))throw Error('Privileged key must never enter release');

console.log('PASS: minimal static release containing '+allow.length+' explicit assets');
