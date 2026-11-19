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
function jikanRecord(data:any,sequel:any){
 const j=data||{};
 return {
  matched:true,source:'Jikan / MyAnimeList',malId:Number(j.mal_id)||null,
  title:String(j.title_english||j.title||''),synopsis:trimText(j.synopsis),
  episodeTotal:Number.isInteger(j.episodes)&&j.episodes>0?j.episodes:null,
  airingStatus:String(j.status||'').slice(0,90)||null,
  broadcast:String(j.broadcast?.string||'').slice(0,110)||null,
  premiereAt:dateIso(j.aired?.from),
  nextEpisodeAt:null,nextEpisodeNumber:null,
  sequelTitle:sequel?.title||null,sequelMalId:sequel?.malId||null,
  sequelStatus:sequel?.status||null,sequelPremiereAt:sequel?.premiereAt||null,
  url:j.url||null,fetchedAt:new Date().toISOString()
 };
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
 const sequelEntry=relations.filter((r:any)=>String(r.relation).toLowerCase()==='sequel')
   .flatMap((r:any)=>Array.isArray(r.entry)?r.entry:[])
   .find((r:any)=>r.type==='anime'&&Number.isInteger(r.mal_id));
 let sequel=null;
 if(sequelEntry){
  sequel={title:String(sequelEntry.name||''),malId:Number(sequelEntry.mal_id),status:null,premiereAt:null};
  try{
   const detail=await fetchJson('https://api.jikan.moe/v4/anime/'+sequel.malId);
   const item=detail.data;
   sequel.status=String(item?.status||'')||null;
   sequel.premiereAt=dateIso(item?.aired?.from);
  }catch{/* The sequel link remains useful even when release details are unavailable. */}
 }
 return jikanRecord(full,sequel);
}
const anilistQuery='query($search:String){Media(search:$search,type:ANIME){id idMal title{romaji english native} description(asHtml:false) episodes status startDate{year month day} nextAiringEpisode{airingAt episode} relations{edges{relationType node{idMal title{romaji english} status startDate{year month day}}}}}}';
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
 const sequel=m.relations?.edges?.find((e:any)=>e.relationType==='SEQUEL'&&e.node);
 const other=sequel?.node;
 return {
  matched:true,source:'AniList',malId:Number(m.idMal)||null,
  title:String(m.title?.english||m.title?.romaji||title),synopsis:trimText(m.description),
  episodeTotal:Number.isInteger(m.episodes)&&m.episodes>0?m.episodes:null,
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
      if(!value.episodeTotal && airing.episodeTotal)value.episodeTotal=airing.episodeTotal;
      if(!value.synopsis && airing.synopsis)value.synopsis=airing.synopsis;
    }catch{/* AniList lookup can fail independently. */}
  }
  cache.set(key,{expires:Date.now()+12*60*60*1000,value});
  if(cache.size>300)cache.delete(cache.keys().next().value);
  return reply(value);
 }catch(error){return reply({error:'Failed to retrieve anime metadata. Please retry.'},500);}
});
