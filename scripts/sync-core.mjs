export const marker=id=>`<!-- pixlume-release:${id} -->`;
export async function reconcile(feed,api){
 if(feed.schemaVersion!==1||!Array.isArray(feed.releases)||!Array.isArray(feed.announcements)||!/^[a-f0-9]{64}$/.test(feed.revision))throw Error('Invalid publishing feed; no deletions performed');
 const ids=new Set();for(const r of feed.releases){if(!/^[a-zA-Z0-9-]+$/.test(r.id)||ids.has(r.id))throw Error('Invalid or duplicate ID');ids.add(r.id);}
 const existing=await api.list();
 for(const release of feed.releases){
  let matches=existing.filter(r=>r.body?.includes(marker(release.id)));if(matches.length>1)throw Error('Duplicate managed release identity; manual review required');
  const body=`${marker(release.id)}\nPublished on Pixlume: ${release.publishedAt}\n\n${release.bodyMarkdown}\n\n[Release notes](${release.url})`;
  let target=matches[0];const changes={name:release.title,body,prerelease:/beta|alpha|rc/i.test(release.version)};
  if(!target)target=await api.create({...changes,tag_name:`pixlume-${release.id}`,draft:true,make_latest:'false'});
  if(release.downloadURL)await api.asset(target,release);
  if(target.body!==body||target.name!==release.title||target.draft)await api.update(target.id,{...changes,draft:false,make_latest:feed.latestRelease?.id===release.id?'true':'false'});
 }
 for(const r of existing){const match=r.body?.match(/<!-- pixlume-release:([a-zA-Z0-9-]+) -->/);if(match&&!ids.has(match[1]))await api.remove(r.id);}
 await api.snapshot(feed);
}
