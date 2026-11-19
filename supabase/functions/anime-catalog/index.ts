// Nightreel anime metadata proxy. Receives only anime titles or MyAnimeList IDs;
// never reads or sends private notes, ratings, emails, or Supabase credentials.
const origin='https://kayleighsu.github.io';
const headers={
  'Access-Control-Allow-Origin':origin,
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json; charset=utf-8',
  'Vary':'Origin'
};
const cache=new Map<string,{expires:number,value:unknown}>();
function reply(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers});}
function canon(value:unknown){return String(value||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');}
function dateIso(value:unknown){
 if(!value)return null;
 const d=typeof value==='number'?new Date(value):new Date(String(value));return Number.isFinite(d.valueOf())?d.toISOString():null;
}
function calendarDate(d:any){
 const y=Number(d?.year),m=Number(d?.month),day=Number(d?.day);
 if(!(y>=1900&&y<=2200&&m>=1&&m<=12&&day>=1&&day<=31))return null;
 return new Date(Date.UTC(y,m-1,day)).toISOString();
}
function trimText(value:unknown,max=6500){return String(value||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim().slice(0,max);}
async function fetchJson(url:string,options?:RequestInit){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),11500);
 try{
  const r=await fetch(url,{...options,signal:controller.signal,headers:{'Accept':'application/json',...(options?.headers||{})}});
  if(!r.ok)throw Error('Catalogue returned HTTP '+r.status);
  return await r.json();
 }finally{clearTimeout(timeout);}
}
// Count broadcast/streamed series episodes only: never movies, OVAs, specials, recaps, music or promotional entries.
function isRegularSeries(format:unknown){
 const type=String(format||'').trim().toUpperCase().replace(/[ -]/g,'_');
 return type==='TV'||type==='TV_SHORT'||type==='ONA';
}
function jikanRecord(data:any,sequel:any){
 const j=data||{};
 return {
  matched:true,source:'Jikan / MyAnimeList',malId:Number(j.mal_id)||null,
  title:String(j.title_english||j.title||''),synopsis:trimText(j.synopsis),
  format:String(j.type||'').trim().toUpperCase().replace(/[ -]/g,'_')||null,
  episodeTotal:isRegularSeries(j.type)&&Number.isInteger(j.episodes)&&j.episodes>0?j.episodes:null,
  airingStatus:String(j.status||'').slice(0,90)||null,
  broadcast:String(j.broadcast?.string||'').slice(0,110)||null,
  premiereAt:dateIso(j.aired?.from),
  nextEpisodeAt:null,nextEpisodeNumber:null,
  sequelTitle:sequel?.title||null,sequelMalId:sequel?.malId||null,
  sequelStatus:sequel?.status||null,sequelPremiereAt:sequel?.premiereAt||null,
  url:j.url||null,fetchedAt:new Date().toISOString()
 };
}

/* Follow main-series TV season links rather than using a season-one episode count.
   We deliberately reject movies, OVA/ONA extras without a clear main-series relationship,
   spinoffs, and distinct series titles. A partial/inconclusive chain is not a verified total. */
function sameSeasonTitle(root:any,next:any){
 const names=[root.title_english,root.title].filter(Boolean);
 const candidates=[next.title_english,next.title].filter(Boolean);
 const isSeasonSuffix=(s:string)=>/^(?:\d+(?:st|nd|rd|th)?(?:season)?(?:part\d+)?|(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th)?)season(?:part\d+)?|season\d+(?:part\d+)?|(?:part|cour)\d+|(?:the)?final(?:season)?(?:part\d+)?|(?:the)?(?:second|third|fourth|fifth)plate|[a-z0-9]+arc|[a-z0-9]+saga|stonewars|newworld|sciencefuture)$/i.test(s);
 return names.some(base=>candidates.some(name=>{
  const start=canon(base),full=canon(name);
  if(!start||!full.startsWith(start))return false;
  const suffix=full.slice(start.length);
  return !suffix||isSeasonSuffix(suffix);
 }));
}
function regularEps(item:any){
 return isRegularSeries(item.type) && Number.isInteger(item.episodes) && item.episodes>0 &&
    !/not yet aired/i.test(String(item.status||'')) ? Number(item.episodes) : 0;
}
function linkEntries(item:any){
 return (Array.isArray(item?.relations)?item.relations:[])
   .filter((r:any)=>['sequel','prequel'].includes(String(r.relation||'').toLowerCase()))
   .flatMap((r:any)=>Array.isArray(r.entry)?r.entry:[])
   .filter((e:any)=>e.type==='anime'&&Number.isInteger(e.mal_id));
}
async function surveyMainSeries(root:any){
 const start=Date.now();
 const queue=[root],seen=new Set<number>(),included=[];
 let truncated=false;
 while(queue.length){
  if(seen.size>=14||Date.now()-start>16000){truncated=true;break;}
  const pending=queue.shift();
  if(!pending || seen.has(Number(pending.mal_id)))continue;
  seen.add(Number(pending.mal_id));
  let item:any=pending;
  if(pending!==root){
   try{
    const result=await fetchJson('https://api.jikan.moe/v4/anime/'+pending.mal_id+'/full');
    item=result?.data;
   }catch{truncated=true;continue;}
  }
  if(!item || !isRegularSeries(item.type) || !sameSeasonTitle(root,item))continue;
  included.push(item);
  for(const rel of linkEntries(item)){
   // Avoid walking to films, side stories, and unrelated franchise branches.
   if(sameSeasonTitle(root,{title:rel.name}) && !seen.has(Number(rel.mal_id)))queue.push(rel);
  }
  if(queue.length)await new Promise(resolve=>setTimeout(resolve,400));
 }
 const count=included.reduce((sum,item)=>sum+regularEps(item),0);
 const next=included.filter(item=>{
  const date=dateIso(item.aired?.from);
  return (/not yet aired/i.test(String(item.status||'')) || !!(date&&new Date(date).getTime()>Date.now())) &&
    isRegularSeries(item.type);
 }).sort((a,b)=>{
  const da=dateIso(a.aired?.from),db=dateIso(b.aired?.from);
  return (da?Date.parse(da):Infinity)-(db?Date.parse(db):Infinity);
 })[0];
 return {episodeTotal:!truncated&&count>0?count:null,
   observedTotal:count,seasonCount:included.length,complete:!truncated,
   next:next?{title:String(next.title_english||next.title||''),malId:Number(next.mal_id),
     status:String(next.status||'')||null,premiereAt:dateIso(next.aired?.from)}:null};
}

async function fromJikan(title:string,id:number|null){
 let candidate:any=null;
 if(id){
  const direct=await fetchJson('https://api.jikan.moe/v4/anime/'+id);
  candidate=direct?.data;
  if(!candidate?.mal_id)throw Error('The saved catalogue ID was not found.');
 }else{
  const response=await fetchJson('https://api.jikan.moe/v4/anime?q='+encodeURIComponent(title)+'&limit=10');
  const results=Array.isArray(response?.data)?response.data:[];
  const wanted=canon(title);
  candidate=results.find((r:any)=>{
   const names=[r.title,r.title_english,r.title_japanese,...(Array.isArray(r.title_synonyms)?r.title_synonyms:[]),...(Array.isArray(r.titles)?r.titles.map((t:any)=>t.title):[])];
   return names.some((v:unknown)=>canon(v)===wanted);
  });
  if(!candidate)throw Error('No confident MyAnimeList title match.');
 }
 let full=candidate;
 try{
  const r=await fetchJson('https://api.jikan.moe/v4/anime/'+candidate.mal_id+'/full');
  if(r?.data?.mal_id===candidate.mal_id)full=r.data;
 }catch{/* Keep the search result as an offline-compatible fallback. */}
 const relations=Array.isArray(full.relations)?full.relations:[];
 const sequelEntries=relations.filter((r:any)=>String(r.relation).toLowerCase()==='sequel')
   .flatMap((r:any)=>Array.isArray(r.entry)?r.entry:[])
   .filter((r:any)=>r.type==='anime'&&Number.isInteger(r.mal_id));
 let sequel=null;
 // A "Sequel" relation may refer to a movie or OVA. It is not a new TV season.
 // Look at a few related entries and only identify a not-yet-aired regular series.
 for(const related of sequelEntries.slice(0,4)){
  try{
   const response=await fetchJson('https://api.jikan.moe/v4/anime/'+related.mal_id);
   const anime=response?.data;
   if(!anime || !isRegularSeries(anime.type))continue;
   const premiereAt=dateIso(anime.aired?.from);
   const upcoming=String(anime.status||'').toLowerCase().includes('not yet')
     || (premiereAt && new Date(premiereAt).getTime()>Date.now());
   if(!upcoming)continue;
   sequel={
     title:String(anime.title_english||anime.title||related.name||''),
     malId:Number(anime.mal_id),status:String(anime.status||'')||null,
     premiereAt
   };
   break;
  }catch{/* Ignore a broken relation rather than showing an invented season date. */}
 }
 const record=jikanRecord(full,sequel);
 try{
  const series=await surveyMainSeries(full);
  // Never present the first season's count as an entire series total when
  // traversing its known sequel chain was incomplete or rate-limited.
  record.episodeTotal=series.episodeTotal;
  record.aggregatedSeasons=series.seasonCount;
  record.seriesCountComplete=series.complete;
  if(series.next){
    record.sequelTitle=series.next.title;
    record.sequelMalId=series.next.malId;
    record.sequelStatus=series.next.status;
    record.sequelPremiereAt=series.next.premiereAt;
  }
 }catch{/* Preserve the original record rather than claiming a made-up total. */}
 return record;
}
const anilistQuery='query($search:String){Media(search:$search,type:ANIME){id idMal format title{romaji english native} description(asHtml:false) episodes status startDate{year month day} nextAiringEpisode{airingAt episode} relations{edges{relationType node{idMal format title{romaji english} status startDate{year month day}}}}}}';
async function fromAniList(title:string){
 const response=await fetchJson('https://graphql.anilist.co',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({query:anilistQuery,variables:{search:title}})
 });
 const m=response?.data?.Media;
 if(!m)throw Error('AniList did not find that anime.');
 const wanted=canon(title);
 if(![m.title?.romaji,m.title?.english,m.title?.native].some(n=>canon(n)===wanted))
  throw Error('No confident anime title match.');
 const label:any={
  RELEASING:'Currently Airing',FINISHED:'Finished Airing',NOT_YET_RELEASED:'Not yet aired',
  HIATUS:'On hiatus',CANCELLED:'Cancelled'
 };
 const next=m.nextAiringEpisode;
 const sequel=m.relations?.edges?.find((e:any)=>
   e.relationType==='SEQUEL'&&e.node&&isRegularSeries(e.node.format)&&
   (e.node.status==='NOT_YET_RELEASED' ||
    (calendarDate(e.node.startDate)&&new Date(calendarDate(e.node.startDate)).getTime()>Date.now()))
 );
 const other=sequel?.node;
 return {
  matched:true,source:'AniList',malId:Number(m.idMal)||null,
  title:String(m.title?.english||m.title?.romaji||title),synopsis:trimText(m.description),
  format:String(m.format||'').trim().toUpperCase()||null,
  episodeTotal:isRegularSeries(m.format)&&Number.isInteger(m.episodes)&&m.episodes>0?m.episodes:null,
  airingStatus:label[m.status]||String(m.status||'')||null,
  broadcast:null,premiereAt:calendarDate(m.startDate),
  nextEpisodeAt:next?.airingAt?dateIso(Number(next.airingAt)*1000):null,
  nextEpisodeNumber:Number(next?.episode)||null,
  sequelTitle:other?String(other.title?.english||other.title?.romaji||''):null,
  sequelMalId:Number(other?.idMal)||null,
  sequelStatus:other?(label[other.status]||String(other.status||'')):null,
  sequelPremiereAt:other?calendarDate(other.startDate):null,
  url:null,fetchedAt:new Date().toISOString()
 };
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'POST required'},405);
 try{
  const input=await req.json();
  const title=String(input?.title||'').trim().slice(0,200);
  const proposed=Number(input?.malId);
  const malId=Number.isSafeInteger(proposed)&&proposed>0&&proposed<10000000?proposed:null;
  if(!malId && (title.length<2 || title.length>200))return reply({error:'Valid anime title or ID required.'},400);
  const key=malId?'id:'+malId:'title:'+canon(title);
  const stored=cache.get(key);
  if(stored&&stored.expires>Date.now())return reply(stored.value);
  let value:any;
  try{value=await fromJikan(title,malId);}
  catch(firstError){
   if(!title)return reply({error:String(firstError)},503);
   try{value=await fromAniList(title);}
   catch(secondError){return reply({error:'Catalogues temporarily unavailable or unable to identify this title. Try again later or select the title from catalogue search.',details:String(firstError)},503);}
  }
  // Jikan does not provide the exact upcoming-episode timestamp.
  // Cross-check AniList for that field, and for seasons not yet listed in MAL relations.
  if(value.source==='Jikan / MyAnimeList' && title){
    try{
      const airing=await fromAniList(title);
      if(airing.nextEpisodeAt){value.nextEpisodeAt=airing.nextEpisodeAt;value.nextEpisodeNumber=airing.nextEpisodeNumber;}
      if(!value.sequelTitle && airing.sequelTitle){
        value.sequelTitle=airing.sequelTitle;value.sequelMalId=airing.sequelMalId;
        value.sequelStatus=airing.sequelStatus;value.sequelPremiereAt=airing.sequelPremiereAt;
      }
      // Never count an AniList episode figure for a movie/OVA/special.
      // A format mismatch also means the title match is uncertain: do not mix counts.
      if(isRegularSeries(value.format) && isRegularSeries(airing.format) &&
        value.format===airing.format && !value.episodeTotal && airing.episodeTotal)
        value.episodeTotal=airing.episodeTotal;
      if(!value.synopsis && airing.synopsis)value.synopsis=airing.synopsis;
    }catch{/* AniList lookup can fail independently. */}
  }
  cache.set(key,{expires:Date.now()+12*60*60*1000,value});
  if(cache.size>300)cache.delete(cache.keys().next().value);
  return reply(value);
 }catch(error){return reply({error:'Failed to retrieve anime metadata. Please retry.'},500);}
});
