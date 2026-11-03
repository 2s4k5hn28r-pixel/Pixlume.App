import { reconcile } from './sync-core.mjs';
import { execFileSync } from 'node:child_process';
import { mkdir,writeFile,readFile,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
const repo=process.env.GITHUB_REPOSITORY;
if(repo!=='2s4k5hn28r-pixel/Pixlume.App'||!process.env.GH_TOKEN)throw Error('Incorrect repository or missing Actions token');
const origin='https://pixlume.app';
const gh=args=>execFileSync('gh',args,{encoding:'utf8',maxBuffer:30*1024*1024,stdio:['pipe','pipe','pipe']});
async function retry(fn){for(let i=0;;i++){try{return await fn();}catch(e){if(i===3)throw e;await new Promise(r=>setTimeout(r,2000*2**i));}}}
async function request(url,options={}){return retry(async()=>{const r=await fetch(url,{...options,signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`HTTP ${r.status} on ${new URL(url).pathname}`);return r;});}
async function api(method,path,data){const r=await request(`https://api.github.com/repos/${repo}/${path}`,{method,headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return r.status===204?null:r.json();}
const temp=await mkdtemp(join(tmpdir(),'pixlume-sync-'));
try{
 const feed=await (await request(`${origin}/api/news`)).json();
 await reconcile(feed,{
  async list(){const results=[];for(let page=1;;page++){const batch=await api('GET',`releases?per_page=100&page=${page}`);results.push(...batch);if(batch.length<100)return results;}},
  create:data=>api('POST','releases',data),update:(id,data)=>api('PATCH',`releases/${id}`,data),remove:id=>api('DELETE',`releases/${id}`),
  async asset(target,r){
   if(!/^[a-f0-9]{64}$/.test(r.sha256)||!r.fileName?.toLowerCase().endsWith('.zip'))throw Error(`Release ${r.id} must have a ZIP and SHA-256`);
   const name=`Pixlume-${r.id}-${r.sha256}.zip`;
   const assets=await api('GET',`releases/${target.id}/assets?per_page=100`);
   if(assets.some(a=>a.name===name&&String(a.size)===r.fileSize))return;
   const url=new URL(r.downloadURL);if(url.origin!==origin||url.pathname!==`/api/releases/${r.id}/download`)throw Error('Untrusted download URL');
   const response=await request(url);const hash=createHash('sha256');let bytes=0;const file=join(temp,name);
   await pipeline(Readable.fromWeb(response.body),new Transform({transform(chunk,enc,done){bytes+=chunk.length;hash.update(chunk);done(null,chunk);}}),createWriteStream(file));
   if(hash.digest('hex')!==r.sha256||String(bytes)!==r.fileSize)throw Error('ZIP checksum or size mismatch');
   await retry(()=>gh(['release','upload',target.tag_name,file,'--repo',repo,'--clobber']));
   // Keep only the current managed ZIP, after the replacement is safely uploaded.
   for(const old of assets)if(old.name.startsWith(`Pixlume-${r.id}-`)&&old.name!==name)await api('DELETE',`releases/assets/${old.id}`);
  },
  async snapshot(feed){
   const json=JSON.stringify(feed,null,2)+'\n';await mkdir('publishing/history',{recursive:true});
   const mirror={...feed,releases:feed.releases.map(r=>({...r,githubReleaseURL:`https://github.com/${repo}/releases/tag/pixlume-${r.id}`,githubDownloadURL:r.downloadURL?`https://github.com/${repo}/releases/download/pixlume-${r.id}/Pixlume-${r.id}-${r.sha256}.zip`:null}))};
   await writeFile('publishing/news.json',JSON.stringify(mirror,null,2)+'\n');
   await writeFile(`publishing/history/${feed.revision}.json`,json);
   gh(['api',`repos/${repo}`]); // Fail before committing if repository access was lost.
   execFileSync('git',['config','user.name','github-actions[bot]']);execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
   execFileSync('git',['add','publishing']);
   try{execFileSync('git',['diff','--cached','--quiet']);return;}catch{}
   execFileSync('git',['commit','-m',`Sync Pixlume publishing ${feed.revision.slice(0,12)}`]);
   execFileSync('git',['push','origin','HEAD:main']);
  }
 });
 console.log(`Synchronized revision ${feed.revision}`);
}catch(e){console.error('Pixlume sync failed:',e instanceof Error?e.message:'Unknown error');process.exitCode=1;}finally{await rm(temp,{recursive:true,force:true});}
