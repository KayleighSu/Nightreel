// Nightreel catalogue search. Authenticated API endpoint; no personal library data.
const cors={
 'Access-Control-Allow-Origin':'https://kayleighsu.github.io',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Content-Type':'application/json; charset=utf-8',
 'Vary':'Origin'
};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const timeout=10500;
async function remote(url:string,options:RequestInit={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const res=await fetch(url,{...options,signal:controller.signal,headers:{'Accept':'application/json',...(options.headers||{})}});
  if(!res.ok)throw Error('Catalogue service returned HTTP '+res.status);
  return await res.json();
 }finally{clearTimeout(timer);}
}
function clean(text:unknown){
 return String(text||'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ')
   .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
   .replace(/\s+/g,' ').trim().slice(0,6500);
}
function jikanRow(a:any){
 return {
  mal_id:Number(a.mal_id)||null,
  url:String(a.url||''),
  title:String(a.title||''),
  title_english:String(a.title_english||''),
  type:String(a.type||''),
  episodes:Number.isInteger(a.episodes)?a.episodes:null,
  year:Number.isInteger(a.year)?a.year:null,
  synopsis:clean(a.synopsis),
  images:{jpg:{image_url:String(a.images?.jpg?.image_url||''),
    large_image_url:String(a.images?.jpg?.large_image_url||'')}}
 };
}
const aniQuery='query($q:String!){Page(perPage:15){media(search:$q,type:ANIME,sort:SEARCH_MATCH){idMal siteUrl title{english romaji} coverImage{large medium} format episodes seasonYear description(asHtml:false)}}}';
async function searchAniList(query:string){
 const json=await remote('https://graphql.anilist.co',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({query:aniQuery,variables:{q:query}})
 });
 if(json.errors?.length)throw Error('AniList search returned an error.');
 const rows=Array.isArray(json?.data?.Page?.media)?json.data.Page.media:[];
 return rows.map((item:any)=>({
  mal_id:Number(item.idMal)||null,
  url:String(item.siteUrl||''),
  title:String(item.title?.romaji||item.title?.english||'Untitled'),
  title_english:String(item.title?.english||item.title?.romaji||''),
  type:String(item.format||'').replace(/_/g,' '),
  episodes:Number.isInteger(item.episodes)?item.episodes:null,
  year:Number.isInteger(item.seasonYear)?item.seasonYear:null,
  synopsis:clean(item.description),
  images:{jpg:{image_url:String(item.coverImage?.medium||item.coverImage?.large||''),
    large_image_url:String(item.coverImage?.large||'')}}
 }));
}
const cache=new Map<string,{until:number,result:unknown}>();
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'Only POST is supported.'},405);
 let q='';
 try{
  const data=await req.json();
  q=String(data?.query||'').trim().slice(0,90);
 }catch{return reply({error:'Invalid search request.'},400);}
 if(q.length<2)return reply({error:'Enter at least two characters.'},400);
 const key=q.toLocaleLowerCase();
 const cached=cache.get(key);
 if(cached && cached.until>Date.now())return reply(cached.result);
 try{
  let results:any[]=[];
  let source='Jikan / MyAnimeList';
  try{
   const result=await remote('https://api.jikan.moe/v4/anime?q='+encodeURIComponent(q)+'&limit=15&sfw=true');
   results=Array.isArray(result?.data)?result.data.map(jikanRow):[];
  }catch{/* Try AniList if Jikan is slow, rate limited, or unavailable. */}
  if(results.length===0){
   source='AniList';
   results=await searchAniList(q);
  }
  const payload={data:results.slice(0,15),source};
  cache.set(key,{until:Date.now()+10*60*1000,result:payload});
  if(cache.size>150)cache.delete(cache.keys().next().value);
  return reply(payload);
 }catch{return reply({error:'Both anime catalogue services are unavailable right now. Please try again.'},503);}
});
