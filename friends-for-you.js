/* For You: recommendations from MyAnimeList community recommendations via Jikan.
   Read-only suggestions until a user explicitly saves one in the existing add form. */
(()=>{
 'use strict';
 const feed=document.getElementById('nr-mobile-friend-activity');
 if(!feed)return;
 const view=document.createElement('section');view.id='nrf-for-you';view.hidden=true;
 view.innerHTML='<div class="nrf-rec-hero"><small>✧ PICKED FOR YOUR TASTE</small>'+
   '<h2>Your next <em>obsession.</em></h2><p>Suggestions inspired by your favorites and highest-rated anime. Already in your collection? We skip it.</p></div>'+
   '<div class="nrf-rec-results" aria-live="polite"><p class="nrf-message">Open For You to discover anime.</p></div>'+
   '<button class="nrf-rec-retry" type="button">↻ Find more recommendations</button>';
 feed.querySelector('.nrf-hero').before(view);
 const results=view.querySelector('.nrf-rec-results');
 const retry=view.querySelector('.nrf-rec-retry');
 const mobile=()=>matchMedia('(max-width:780px)').matches;
 const normalize=s=>String(s||'').toLowerCase().normalize('NFKC').replace(/[^a-z0-9]/g,'');
 const own=()=>Array.isArray(state?.entries)?state.entries:[];
 const imgUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:''}catch{return ''}};
 const add=(parent,tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);parent.append(el);return el};
 const showMessage=text=>{results.replaceChildren();add(results,'p','nrf-message',text)};
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const fetchJson=async(url)=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
   try{
     const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
     if(!response.ok)throw new Error('Catalogue request returned '+response.status);
     const data=await response.json();if(!Array.isArray(data?.data))throw new Error('Catalogue data unavailable');
     return data.data;
   }finally{clearTimeout(timer)}
 };
 let loading=false,cache=[],stamp='',updatedAt=0;
 const seeds=()=>own().filter(e=>e.title).sort((a,b)=>{
   const score=e=>(e.favorite?30:0)+(Number(e.rating)||0)*3+(e.status==='completed'?4:0);
   return score(b)-score(a);
 }).slice(0,12);
 const excluded=()=>new Set(own().flatMap(e=>[normalize(e.title),...(Array.isArray(e.alternative_titles)?e.alternative_titles.map(normalize):[])].filter(Boolean)));
 const alreadyHave=(a)=>{
   const ids=new Set(own().map(e=>Number(e.mal_id)).filter(Boolean));
   return ids.has(Number(a.mal_id))||excluded().has(normalize(a.title))||excluded().has(normalize(a.title_english));
 };
 const buildCard=(a)=>{
   const card=add(results,'article','nrf-rec-card');
   const image=imgUrl(a.images?.webp?.large_image_url||a.images?.webp?.image_url||a.images?.jpg?.image_url);
   const cover=add(card,'div','nrf-rec-cover');
   if(image){const pic=add(cover,'img');pic.alt='';pic.loading='lazy';pic.referrerPolicy='no-referrer';pic.src=image}
   else add(cover,'span',null,'✧');
   const body=add(card,'div','nrf-rec-body');
   add(body,'h3',null,a.title_english||a.title||'Untitled');
   const meta=[a.type,a.year,a.score?'★ '+Number(a.score).toFixed(1):''].filter(Boolean).join(' · ');
   add(body,'p','nrf-rec-meta',meta);
   if(a.because)add(body,'p','nrf-rec-because','Because you liked '+a.because);
   if(a.synopsis)add(body,'p','nrf-rec-summary',a.synopsis);
   const actions=add(body,'div','nrf-rec-actions');
   const button=add(actions,'button','nrf-rec-add','＋ Add to watchlist');
   button.type='button';
   button.addEventListener('click',()=>{
     if(typeof openAnime!=='function')return;
     // Use the existing editor so the user reviews and confirms before any save.
     openAnime();
     document.getElementById('anime-title').value=a.title_english||a.title||'';
     document.getElementById('anime-status').value='plan_to_watch';
     document.getElementById('anime-image').value=image;
     if(a.episodes)document.getElementById('anime-total').value=a.episodes;
     state.modalMetadata={...state.modalMetadata,mal_id:a.mal_id||null,mal_url:a.url||null,synopsis:a.synopsis||'',year:a.year||null};
   });
   return card;
 };
 async function recommend(force=false){
   if(!mobile()||view.hidden||loading)return;
   const favourites=seeds();
   const uid=state?.user?.id||'demo';
   const key=uid+'|'+own().length+'|'+favourites.slice(0,5).map(e=>e.mal_id||e.title).join('|');
   if(!force&&key===stamp&&Date.now()-updatedAt<15*60*1000&&cache.length){
     results.replaceChildren();cache.forEach(buildCard);return;
   }
   loading=true;retry.disabled=true;showMessage('Looking for shows that fans of your favorites recommend…');
   try{
     if(!favourites.length){showMessage('Add a few shows to your library first, then we can recommend similar anime.');return}
     const found=new Map();let attempts=0;
     // Use at most three strong, distinct seed anime to avoid overwhelming the public API.
     for(const seed of favourites.slice(0,3)){
       let id=Number(seed.mal_id);
       if(!id){
         await sleep(attempts?550:0);
         const match=await fetchJson('https://api.jikan.moe/v4/anime?q='+encodeURIComponent(seed.title)+'&limit=5&sfw=true');
         const exact=match.find(a=>normalize(a.title)===normalize(seed.title)||normalize(a.title_english)===normalize(seed.title));
         id=Number((exact||match[0])?.mal_id);
         attempts++;
       }
       if(!id)continue;
       await sleep(800);
       const recs=await fetchJson('https://api.jikan.moe/v4/anime/'+encodeURIComponent(id)+'/recommendations');
       for(const rec of recs.slice(0,30)){
         const anime=rec.entry;if(!anime||!anime.mal_id)continue;
         const k=String(anime.mal_id),prior=found.get(k);
         if(!prior)found.set(k,{...anime,because:seed.title,votes:Number(rec.votes)||0});
         else prior.votes+=Number(rec.votes)||0;
       }
       if(found.size>=22)break;
     }
     const candidate=[...found.values()].filter(a=>!alreadyHave(a)).sort((a,b)=>b.votes-a.votes).slice(0,16);
     if(!candidate.length){showMessage('No new matches were returned for those titles yet. Try again later or rate more favorites.');return}
     // Jikan's recommendation endpoint gives poster/title; optional extra details are not invented.
     cache=candidate;stamp=key;updatedAt=Date.now();
     results.replaceChildren();candidate.forEach(buildCard);
   }catch(error){
     console.warn('Nightreel For You unavailable',error);
     showMessage('Recommendations are temporarily unavailable from the anime catalogue. Try again in a moment.');
   }finally{loading=false;retry.disabled=false}
 }
 retry.addEventListener('click',()=>recommend(true));
 window.NightreelLoadForYou=()=>recommend(false);
})();