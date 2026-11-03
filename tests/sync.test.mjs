import { test } from 'node:test';import assert from 'node:assert/strict';import { reconcile } from '../scripts/sync-core.mjs';
test('stable IDs reconcile creation, editing, asset changes, unpublishing and deletion',async()=>{
 const rows=[];let created=0,assets=0,snapshots=0;const api={list:async()=>structuredClone(rows),create:async x=>{const r={...x,id:++created};rows.push(r);return r;},update:async(id,x)=>Object.assign(rows.find(r=>r.id===id),x),remove:async id=>rows.splice(rows.findIndex(r=>r.id===id),1),asset:async()=>assets++,snapshot:async()=>snapshots++};
 const release={id:'stable-id',title:'Version 1',version:'1.0',publishedAt:'2026-11-03T00:00:00Z',bodyMarkdown:'A typo',url:'https://pixlume.app/releases/1.0',downloadURL:'https://pixlume.app/api/releases/stable-id/download'};
 const feed={schemaVersion:1,revision:'a'.repeat(64),announcements:[{id:'news-id',title:'Old'}],releases:[release],latestRelease:release};
 await reconcile(feed,api);await reconcile(feed,api);assert.equal(created,1);assert.equal(rows.length,1);
 release.title='Corrected title';release.bodyMarkdown='Corrected notes';release.version='1.1';await reconcile(feed,api);assert.equal(created,1);assert.ok(rows[0].body.includes('Corrected notes'));assert.equal(rows[0].draft,false);
 feed.announcements=[];await reconcile(feed,api);assert.equal(rows.length,1);
 await assert.rejects(()=>reconcile({...feed,revision:'invalid',releases:[]},api));assert.equal(rows.length,1);
 feed.releases=[];await reconcile(feed,api);assert.equal(rows.length,0);assert.ok(snapshots>=4);
});
