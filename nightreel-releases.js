/* Nightreel release radar and resilient synopsis lookup.
 * Catalogue metadata never overwrites personal watch progress, ratings, favorites, or notes.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const safe=escapeHtml;
const validDate=value=>{if(!value)return null;const d=new Date(value);return Number.isFinite(d.valueOf())?d:null;};
const dateLabel=value=>{const d=validDate(value);return d?d.toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'Date not announced';};
const shortDate=value=>{const d=validDate(value);return d?d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'Date not announced';};
const isRegularSeries=value=>!value || ['TV','TV_SHORT','ONA'].includes(String(value).toUpperCase());
const isConfirmedFuture=value=>{const d=validDate(value);return !!d && d.getTime()>Date.now();};
const sequelLabel=e=>!e.catalog_sequel_title?'':isConfirmedFuture(e.catalog_sequel_premiere_at)
 ?'Next season airing '+shortDate(e.catalog_sequel_premiere_at)
 :e.catalog_sequel_window&&/not yet|upcoming/i.test(e.catalog_sequel_status||'')
 ?'Next season airing '+e.catalog_sequel_window
 :!e.catalog_sequel_premiere_at&&/not yet|upcoming/i.test(e.catalog_sequel_status||'')
 ?'Next season: date TBA':'';
const authenticated=()=>Boolean(!state.demo&&state.supabase&&state.user);
const cached=new Map(),inFlight=new Map(),failedUntil=new Map();
const day=86400000;
const detailKeys=[
 'mal_id','synopsis','catalog_episode_total','catalog_airing_status','catalog_broadcast',
 'catalog_premiere_at','catalog_next_episode_at','catalog_next_episode_number',
 'catalog_sequel_title','catalog_sequel_mal_id','catalog_sequel_status',
 'catalog_sequel_premiere_at','catalog_source','catalog_checked_at'
];
function cacheData(e){return {
  title:e.title,malId:e.mal_id||null,synopsis:e.synopsis||'',format:e.catalog_format||null,
  durationMinutes:e.catalog_duration_minutes||null,streaming:e.catalog_streaming||[],
  episodeTotal:e.catalog_episode_total,airingStatus:e.catalog_airing_status,
  broadcast:e.catalog_broadcast,premiereAt:e.catalog_premiere_at,
  nextEpisodeAt:e.catalog_next_episode_at,nextEpisodeNumber:e.catalog_next_episode_number,
  sequelTitle:e.catalog_sequel_title,sequelWindow:e.catalog_sequel_window,sequelMalId:e.catalog_sequel_mal_id,
  sequelStatus:e.catalog_sequel_status,sequelPremiereAt:e.catalog_sequel_premiere_at,
  source:e.catalog_source,fetchedAt:e.catalog_checked_at
};}
async function fetchMetadata(e){
 if(!authenticated())throw Error('Sign in to refresh catalogue details.');
 const r=await state.supabase.functions.invoke('anime-catalog',{
  body:{title:String(e.title||''),malId:e.mal_id||null}
 });
 if(r.error)throw Error(r.data?.error||r.error.message||'Catalogue service unavailable.');
 const info=r.data;
 if(!info || info.matched!==true)throw Error(info?.error||'No verified catalogue match.');
 return info;
}
function makePatch(e,d){
 const regularEpisodes=isRegularSeries(d.format)&&Number.isSafeInteger(d.episodeTotal)&&d.episodeTotal>0?d.episodeTotal:null;
 const originalTotal=Number(e.episodes_total)||0;
 // Reject suspicious season-one undercounts when the user's record clearly covers
 // several seasons. An official total one or two below the saved value can be
 // genuine when the saved value includes an OVA.
 const verifiedCount=!e.is_movie && regularEpisodes && (!originalTotal || regularEpisodes>=originalTotal-2)
   ? regularEpisodes : null;
 const result={
  catalog_format:String(d.format||'').trim().toUpperCase().slice(0,30)||null,
  catalog_duration_minutes:Number.isInteger(d.durationMinutes)&&d.durationMinutes>=1&&d.durationMinutes<=600
    ?d.durationMinutes:null,
  catalog_streaming:Array.isArray(d.streaming)?d.streaming.slice(0,15).filter(link=>{
    try{return !!link?.name&&new URL(link.url).protocol==='https:'}catch{return false}
  }).map(link=>({name:String(link.name).slice(0,90),url:String(link.url).slice(0,1200)})):[],

  catalog_episode_total:verifiedCount,
  catalog_airing_status:String(d.airingStatus||'').slice(0,90)||null,
  catalog_broadcast:String(d.broadcast||'').slice(0,110)||null,
  catalog_premiere_at:d.premiereAt||null,
  catalog_next_episode_at:d.nextEpisodeAt||null,
  catalog_next_episode_number:Number.isSafeInteger(d.nextEpisodeNumber)&&d.nextEpisodeNumber>0?d.nextEpisodeNumber:null,
  catalog_sequel_title:String(d.sequelTitle||e.catalog_sequel_title||'').slice(0,200)||null,
  catalog_sequel_mal_id:Number.isSafeInteger(d.sequelMalId)&&d.sequelMalId>0?d.sequelMalId:e.catalog_sequel_mal_id||null,
  catalog_sequel_status:String(d.sequelStatus||e.catalog_sequel_status||'').slice(0,100)||null,
  catalog_sequel_premiere_at:d.sequelPremiereAt||(
   !d.sequelTitle||canonicalTitle(d.sequelTitle)===canonicalTitle(e.catalog_sequel_title)
    ?e.catalog_sequel_premiere_at:null)||null,
  catalog_sequel_window:String(d.sequelWindow||(
   !d.sequelTitle||canonicalTitle(d.sequelTitle)===canonicalTitle(e.catalog_sequel_title)
    ?e.catalog_sequel_window:'')||'').slice(0,40)||null,
  catalog_source:String(d.source||'Anime catalogue').slice(0,90),
  catalog_checked_at:new Date().toISOString()
 };
 // Infer typical episode length only while the user has not manually overridden it.
 if(!e.is_movie && !e.episode_minutes_manual &&
    Number.isInteger(d.durationMinutes)&&d.durationMinutes>=1&&d.durationMinutes<=600)
   result.episode_minutes=d.durationMinutes;
 // Persist an identified synopsis only when the user hasn't previously saved one.
 // Never replace a personal edit or incorrectly assign a speculative MAL match.
 if(!e.synopsis && d.synopsis)result.synopsis=String(d.synopsis).slice(0,6500);
 if(!e.mal_id && Number.isSafeInteger(d.malId) && d.malId>0)result.mal_id=d.malId;
 return result;
}
async function refreshEntry(entry,force=false){
 if(!authenticated())throw Error('Sign in first.');
 const e=state.entries.find(x=>String(x.id)===String(entry.id));
 if(!e)throw Error('This anime is no longer in your library.');
 const last=validDate(e.catalog_checked_at)?.getTime()||0;
 if(!force&&e.catalog_format&&Date.now()-last<48*60*60*1000&&(e.synopsis||e.catalog_airing_status))
  return cacheData(e);
 const key=state.user.id+'::'+e.id;
 if(inFlight.has(key))return inFlight.get(key);
 if(!force && (failedUntil.get(key)||0)>Date.now())throw Error('This title was recently unavailable.');
 const promise=(async()=>{
  try{
   const details=await fetchMetadata(e);
   if(!authenticated()||state.user.id!==key.split('::')[0])throw Error('Account changed during lookup.');
   const patch=makePatch(e,details);
   const r=await state.supabase.from('anime_entries').update(patch).eq('id',e.id);
   if(r.error)throw r.error;
   Object.assign(e,patch);
   cached.set(key,details);failedUntil.delete(key);
   updateCardReleaseInfo();drawCompactRadar();drawDashboard();
   return details;
  }catch(error){failedUntil.set(key,Date.now()+45*60*1000);throw error;}
  finally{inFlight.delete(key);}
 })();
 inFlight.set(key,promise);return promise;
}
function summary(e){
 const pieces=[];
 const episodes=isRegularSeries(e.catalog_format)?Number(e.catalog_episode_total)||null:null;
 if(e.is_movie){
  const minutes=Number(e.movie_runtime_minutes)||Number(e.catalog_duration_minutes)||null;
  pieces.push(minutes?'Movie · '+minutes+' min':'Movie');
 }else if(!isRegularSeries(e.catalog_format))pieces.push(safe(e.catalog_format).replaceAll('_',' '));
 else if(episodes)pieces.push('<strong>'+episodes+' regular episodes</strong> (catalogue)');
 else if(e.episodes_total)pieces.push('<strong>'+e.episodes_total+' episodes</strong> (saved)');
 if(!e.is_movie && (e.episode_minutes||e.catalog_duration_minutes))
  pieces.push(String(e.episode_minutes||e.catalog_duration_minutes)+' min/episode');
 if(e.catalog_airing_status)pieces.push(safe(e.catalog_airing_status));
 if(e.catalog_broadcast)pieces.push(safe(e.catalog_broadcast));
 if(e.catalog_next_episode_at){
  pieces.push('Next episode '+(e.catalog_next_episode_number?'#'+e.catalog_next_episode_number+' · ':'')+safe(dateLabel(e.catalog_next_episode_at)));
 }
 if(sequelLabel(e)){
  const malId=e.catalog_sequel_mal_id;
  const name=safe(e.catalog_sequel_title);
  const sequelUrl=Number.isInteger(malId)&&malId>0?'https://myanimelist.net/anime/'+malId:null;
  const linked=sequelUrl?'<a href="'+sequelUrl+'" target="_blank" rel="noopener noreferrer">'+name+' ↗</a>':name;
  pieces.push('Next season: '+linked+' · '+safe(sequelLabel(e).replace(/^Next season(?: airing)?:?\s*/,'')));
 }
 if(!pieces.length)return '<p>Release details not checked yet.</p>';
 return '<p>'+pieces.join(' <span aria-hidden="true">·</span> ')+'</p>';
}
function updateCardReleaseInfo(){
 document.querySelectorAll('#anime-grid .anime-card[data-card-id]').forEach(card=>{
  const e=state.entries.find(x=>String(x.id)===card.dataset.cardId);
  if(!e)return;
  const progress=card.querySelector('.flip-progress');
  if(progress){
   const watched=Number(e.episodes_watched)||0;
   const regular=isRegularSeries(e.catalog_format);
   const storedTotal=Number(e.episodes_total)||0,listed=Number(e.catalog_episode_total)||0;
   const total=regular?(listed&&(!storedTotal||listed>=storedTotal-2)?listed:(storedTotal||listed||null)):null;
   const movieMinutes=Number(e.movie_runtime_minutes)||0;
   const line=e.is_movie?('Movie'+(movieMinutes>0?' · '+movieMinutes+' min':'')+
       (e.status==='completed'?' · Watched':'')):
     !regular?String(e.catalog_format).replace(/_/g,' ')+' · excluded from episode totals':
     total&&watched>total?total+' / '+total+' regular episodes · '+watched+' watched saved':
     total?watched+' / '+total+' episodes':watched+' episodes watched';
   if(progress.firstChild?.nodeType===Node.TEXT_NODE && progress.firstChild.nodeValue!==line)progress.firstChild.nodeValue=line;
   const bar=progress.querySelector('.progress-fill');
   if(bar)bar.style.width=(e.is_movie?(e.status==='completed'?100:0):
     !regular?0:total?Math.min(100,Math.round(100*watched/total)):(e.status==='completed'?100:0))+'%';
  }
  const back=card.querySelector('.flip-back-content');
  if(back){
   let box=back.querySelector('.nr-card-release-summary');
   if(!box){
    box=document.createElement('section');box.className='nr-card-release-summary';
    const body=back.querySelector('.nr-public-note');
    if(body)body.before(box);else back.append(box);
   }
   const summaryMarkup='<strong>Release info</strong>'+summary(e);
   // Avoid replacing the release details (and their focused buttons) in
   // every card when only one title's metadata changed in the background.
   if(box.dataset.summaryMarkup!==summaryMarkup){
    box.innerHTML=summaryMarkup;
    box.dataset.summaryMarkup=summaryMarkup;
   }
   const watch=back.querySelector('.nr-where-watch');
   if(watch && window.NightreelStreamingMarkup){
    const streamingMarkup=window.NightreelStreamingMarkup(e);
    if(watch.dataset.streamingMarkup!==streamingMarkup){
     watch.innerHTML=streamingMarkup;
     watch.dataset.streamingMarkup=streamingMarkup;
    }
   }
   let refresh=box.querySelector('button[data-release-refresh]');
   if(!refresh){
    refresh=document.createElement('button');refresh.type='button';refresh.dataset.releaseRefresh=e.id;
    refresh.textContent='↻ Refresh details';box.append(refresh);
   }
  }
  const front=card.querySelector('.flip-body');
  if(front){
   let chip=front.querySelector('.nr-airing-chip');
   const hasNextEpisode=!e.is_movie&&isRegularSeries(e.catalog_format)&&isConfirmedFuture(e.catalog_next_episode_at);
   const nextSeason=e.is_movie?'':sequelLabel(e);
   const releaseInfo=!e.is_movie&&isRegularSeries(e.catalog_format)&&/currently airing|releasing|not yet aired|not yet released/i.test(e.catalog_airing_status||'');
   if(hasNextEpisode || nextSeason || releaseInfo){
    if(!chip){chip=document.createElement('span');chip.className='nr-airing-chip';front.querySelector('h3')?.before(chip);}
    if(chip){const label=nextSeason||(hasNextEpisode?'Next ep '+shortDate(e.catalog_next_episode_at):'Release tracking');if(chip.textContent!==label)chip.textContent=label;}
   }else chip?.remove();
  }
 });
}
const library=document.querySelector('.collection-section');
const navigation=$('social-navigation');
if(!library||!navigation)return;
const radar=document.createElement('section');radar.id='nr-release-radar';radar.hidden=true;
radar.innerHTML=[
 '<div class="nr-radar-head"><div><span class="nr-section-eyebrow">KEEP UP WITH WHAT IS AIRING</span>',
 '<h2>Release radar<span class="accent-dot">.</span></h2>',
 '<p>Track new episodes, announced seasons and premiere dates for titles in your collection. Sources: MyAnimeList and AniList.</p></div>',
 '<div class="nr-radar-controls"><button type="button" id="nr-radar-refresh">↻ Refresh next 12 titles</button><button type="button" id="nr-radar-close">Back to library</button></div></div>',
 '<p id="nr-radar-progress" role="status" class="nr-radar-progress"></p>',
 '<div id="nr-radar-results" class="nr-radar-results"></div>'
].join('');
library.before(radar);
const btn=document.createElement('button');btn.type='button';btn.id='nr-release-button';btn.textContent='◷ Releases';navigation.append(btn);
function timelineCard(e,what,eventAt){
 const image=cleanedUrl(e.image_url);
 return '<article class="nr-radar-event">'+(image?'<img src="'+safe(image)+'" alt="" loading="lazy">':'')+
 '<div><small>'+safe(what)+'</small><h3>'+safe(e.title)+'</h3>'+
 '<p>'+(eventAt?safe(dateLabel(eventAt)):(what==='SEQUEL / NEW SEASON'&&e.catalog_sequel_window?safe(e.catalog_sequel_window):'No confirmed date yet'))+'</p>'+
 (e.catalog_sequel_title?'<p>Season / sequel: '+safe(e.catalog_sequel_title)+'</p>':'')+
 '</div></article>';
}

/* Compact release list beneath Favorites; no duplicates when the library rerenders. */
function releaseWindowSort(text){
 const v=String(text||'').trim();
 if(/^\d{4}$/.test(v))return Date.UTC(Number(v),0,1);
 const parsed=Date.parse('1 '+v);
 return Number.isFinite(parsed)?parsed:Infinity;
}
function compactEvents(){
 const now=Date.now(),events=[];
 for(const e of state.entries||[]){
  if(e.catalog_sequel_title&&(isConfirmedFuture(e.catalog_sequel_premiere_at)||
    e.catalog_sequel_window||/not yet aired|not yet released|upcoming/i.test(e.catalog_sequel_status||''))){
   events.push({
    title:e.title,description:e.catalog_sequel_title,
    when:isConfirmedFuture(e.catalog_sequel_premiere_at)?shortDate(e.catalog_sequel_premiere_at):
      e.catalog_sequel_window||'Date TBA',
    sort:validDate(e.catalog_sequel_premiere_at)?.getTime()||
      releaseWindowSort(e.catalog_sequel_window)
   });
  }
  const air=validDate(e.catalog_next_episode_at)?.getTime();
  if(air&&air>now){
   events.push({title:e.title,description:'Episode '+(e.catalog_next_episode_number||'upcoming'),
    when:dateLabel(e.catalog_next_episode_at),sort:air});
  }
  const premiere=validDate(e.catalog_premiere_at)?.getTime();
  if(/not yet aired|not yet released/i.test(e.catalog_airing_status||'')&&(!premiere||premiere>now)){
   events.push({title:e.title,description:'Series premiere',
    when:premiere?shortDate(e.catalog_premiere_at):'Date TBA',sort:premiere||Infinity});
  }
 }
 events.sort((a,b)=>a.sort-b.sort||a.title.localeCompare(b.title));
 return events.slice(0,8);
}
function drawCompactRadar(){
 const grid=$('anime-grid');if(!grid)return;
 const existing=grid.querySelector('#nr-compact-radar');
 if(state.filter!=='all'||String(state.search||'').trim()){
  existing?.remove();return;
 }
 const events=compactEvents();
 const rows=events.map(e=>
  '<div class="nr-compact-release-row"><span class="nr-compact-release-name">'+
  safe(e.title)+'<small>'+safe(e.description)+'</small></span>'+
  '<span class="nr-compact-release-date">'+safe(e.when)+'</span></div>'
 ).join('');
 const content='<div class="nr-compact-radar-heading"><div>'+
   '<span class="nr-section-eyebrow">COMING UP IN YOUR COLLECTION</span><h3>Release Radar</h3></div>'+
   '<button type="button" data-radar-full aria-label="Open full release calendar">View all ↗</button></div>'+
   (events.length?'<div class="nr-compact-release-list">'+rows+'</div>':
    '<p class="nr-compact-empty">No upcoming dates found yet. Check the full radar to refresh your collection.</p>');
 // Auto catalogue refreshes can run while someone is scrolling deep in their library.
 // Never remove and reinsert the entire radar: that shifts the document and
 // can cause iOS Safari to jump to the top of a long grouped collection.
 if(existing){
  if(existing.dataset.renderedContent!==content){
   existing.innerHTML=content;
   existing.dataset.renderedContent=content;
  }
  return;
 }
 const block=document.createElement('section');
 block.id='nr-compact-radar';block.className='nr-compact-radar';
 block.setAttribute('aria-label','Upcoming anime releases');
 block.innerHTML=content;block.dataset.renderedContent=content;
 const featured=grid.querySelector('.nr-featured-section');
 if(featured)featured.after(block);else grid.prepend(block);
}
function drawDashboard(){
 const area=$('nr-radar-results');if(!area)return;
 const entries=state.entries||[],now=Date.now();
 const scheduled=entries.filter(e=>validDate(e.catalog_next_episode_at)?.getTime()>now).sort((a,b)=>new Date(a.catalog_next_episode_at)-new Date(b.catalog_next_episode_at));
 const sequels=entries.filter(e=>e.catalog_sequel_title && (
   (validDate(e.catalog_sequel_premiere_at)?.getTime()||0)>now ||
   /not yet aired|not yet released|upcoming/i.test(e.catalog_sequel_status||'') ||
   (!e.catalog_sequel_premiere_at && !/finished|released|completed/i.test(e.catalog_sequel_status||''))
 )).sort((a,b)=>{
  const d=a.catalog_sequel_premiere_at?new Date(a.catalog_sequel_premiere_at).getTime():Infinity;
  const f=b.catalog_sequel_premiere_at?new Date(b.catalog_sequel_premiere_at).getTime():Infinity;
  return d-f;
 });
 const upcoming=entries.filter(e=>/not yet aired|not yet released/i.test(e.catalog_airing_status||''));
 const airing=entries.filter(e=>/currently airing|releasing/i.test(e.catalog_airing_status||''));
 const checked=entries.filter(e=>!!e.catalog_checked_at).length;
 const groups=[
  {label:'Next episodes',items:scheduled,render:e=>timelineCard(e,'EPISODE '+(e.catalog_next_episode_number||'UPCOMING'),e.catalog_next_episode_at)},
  {label:'New seasons & sequels',items:sequels,render:e=>timelineCard(e,'SEQUEL / NEW SEASON',e.catalog_sequel_premiere_at)},
  {label:'Upcoming premieres',items:upcoming,render:e=>timelineCard(e,'PREMIERE',e.catalog_premiere_at)},
  {label:'Currently airing',items:airing,render:e=>timelineCard(e,'AIRING',null)}
 ];
 area.innerHTML='<p class="nr-radar-coverage">Release details checked for '+checked+' of '+entries.length+' titles. Updates are refreshed when you use Nightreel.</p>'+
 groups.filter(g=>g.items.length).map(g=>'<section><h3>'+g.label+' <small>'+g.items.length+'</small></h3><div class="nr-radar-event-grid">'+g.items.slice(0,30).map(g.render).join('')+'</div></section>').join('')+
 (!groups.some(g=>g.items.length)?'<p class="nr-radar-empty">No confirmed upcoming releases in your checked titles yet. Use Refresh to look for new season information.</p>':'');
}
function showRadar(){
 document.querySelector('[data-social-view="library"]')?.click();
 radar.hidden=false;
 drawDashboard();
 radar.scrollIntoView({behavior:'smooth',block:'start'});
}
btn.onclick=showRadar;
$('nr-radar-close').onclick=()=>{radar.hidden=true;library.scrollIntoView({behavior:'smooth',block:'start'});};
navigation.addEventListener('click',e=>{if(e.target.closest('[data-social-view]'))radar.hidden=true;},true);
const originalRender=render;
render=function(){originalRender();updateCardReleaseInfo();drawCompactRadar();if(!radar.hidden)drawDashboard();};
updateCardReleaseInfo();drawCompactRadar();drawDashboard();
$('anime-grid').addEventListener('click',event=>{
 if(event.target.closest('[data-radar-full]')){event.preventDefault();showRadar();}
});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let refreshRunning=false,autoProcessed=0,autoUser='';
function sortForUpdate(){
 const priorities={watching:0,plan_to_watch:1,on_hold:2,untracked:3,completed:4,dropped:5};
 return [...state.entries].sort((a,b)=>(Date.parse(a.catalog_checked_at)||0)-(Date.parse(b.catalog_checked_at)||0) ||
 (priorities[a.status]??4)-(priorities[b.status]??4));
}
async function refreshBatch(max,manual){
 if(refreshRunning||!authenticated())return;
 refreshRunning=true;
 const progress=$('nr-radar-progress'),user=state.user.id;
 const candidates=sortForUpdate().filter(e=>{
  const time=validDate(e.catalog_checked_at)?.getTime()||0;
  return manual || Date.now()-time>48*60*60*1000;
 }).filter(e=>manual||(failedUntil.get(user+'::'+e.id)||0)<Date.now()).slice(0,max);
 let okay=0,failed=0;
 try{
  for(const e of candidates){
   if(!authenticated()||state.user.id!==user || (document.hidden&&!manual))break;
   progress.textContent='Checking release information: '+(okay+failed+1)+' of '+candidates.length;
   try{await refreshEntry(e,manual);okay++;}
   catch(error){failed++;console.warn('Nightreel release metadata: '+e.title,error.message);}
   await delay(3500); // Polite pacing for community-maintained catalogue rate limits
  }
  progress.textContent='Release check finished: '+okay+' updated'+(failed?' · '+failed+' unavailable':'')+'.';
 }finally{refreshRunning=false;drawDashboard();}
}
$('nr-radar-refresh').onclick=()=>{if(!authenticated())return $('nr-radar-progress').textContent='Sign in to refresh your collection.';refreshBatch(12,true);};
let scheduledUser='';
const autoCheck=setInterval(()=>{
 // Avoid decoding hundreds of poster cards while Safari is scrolling a long
 // mobile library. Manual release refresh remains available everywhere.
 if(window.matchMedia('(max-width:780px) and (pointer:coarse)').matches)return;
 if(!authenticated()||document.hidden||!state.entries.length)return;
 const id=state.user.id;
 if(id!==scheduledUser){scheduledUser=id;autoProcessed=0;}
 if(refreshRunning||autoProcessed>=20)return;
 const stale=sortForUpdate().find(e=>Date.now()-(validDate(e.catalog_checked_at)?.getTime()||0)>48*60*60*1000 && (failedUntil.get(id+'::'+e.id)||0)<Date.now());
 if(!stale)return;
 autoProcessed++;
 // Low-priority single-title background refresh; never interrupts the editor.
 refreshBatch(1,false);
},12000);
window.addEventListener('pagehide',()=>clearInterval(autoCheck));
document.querySelector('#anime-grid')?.addEventListener('click',e=>{
 const button=e.target.closest('[data-release-refresh]');
 if(!button)return;
 e.preventDefault();e.stopImmediatePropagation();
 const entry=state.entries.find(a=>String(a.id)===button.dataset.releaseRefresh);
 if(!entry)return;
 button.disabled=true;button.textContent='Checking…';
 refreshEntry(entry,true).then(()=>{
  const live=document.querySelector('#anime-grid .anime-card[data-card-id="'+CSS.escape(String(entry.id))+'"]');
  live?.classList.add('is-flipped');
 }).catch(error=>{
  button.disabled=false;button.textContent='Try again';
  const status=button.closest('.nr-card-release-summary');
  if(status){const p=document.createElement('p');p.textContent='Unavailable: '+error.message;status.append(p);}
 });
},true);
window.NightreelReleaseCatalog={refreshEntry,lookup:fetchMetadata,cacheData,updateCardReleaseInfo};
})();
