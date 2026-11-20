/* Nightreel mobile Discover — dedicated view, existing data / editor / social untouched. */
(()=>{
'use strict';
const main=document.querySelector('.main-content'),nav=document.getElementById('nightreel-mobile-bottom');
if(!main||!nav)return;
const mobile=()=>matchMedia('(max-width:780px)').matches;
const root=document.createElement('section');root.id='nightreel-discover';root.setAttribute('aria-label','Discover anime');
main.prepend(root);
const modal=document.createElement('dialog');modal.id='nr-discover-details';modal.setAttribute('aria-label','Anime details');document.body.append(modal);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:''}catch{return ''}};
const norm=s=>String(s||'').toLowerCase().normalize('NFKC').replace(/[^a-z0-9]/g,'');
const list=()=>Array.isArray(state?.entries)?state.entries:[];
const poster=a=>safeUrl(a?.images?.webp?.large_image_url||a?.images?.jpg?.large_image_url||a?.images?.jpg?.image_url||a?.image_url);
const title=a=>String(a?.title_english||a?.title||'Untitled');
const selectedCover=a=>poster(a)||'';
const findOwned=a=>list().find(e=>e.mal_id&&Number(e.mal_id)===Number(a.mal_id))||
 list().find(e=>norm(e.title)===norm(title(a))||norm(e.title)===norm(a.title));
const icon=n=>({
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
 bookmark:'<path d="M6 3h12v18l-6-5-6 5z"/>',
 chevron:'<path d="m9 6 6 6-6 6"/>',
 home:'<path d="m3 10 9-7 9 7v10h-6v-7H9v7H3z"/>',
 friends:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M18 5a3 3 0 0 1 0 6"/>',
 play:'<path d="m8 5 11 7-11 7z"/>'
 }[n]||'');
const svg=n=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icon(n)+'</svg>';
let active=false,tab='discover',search='',trending=[],recommendations=[],current=null,requesting=false,recLoading=false,searchResults=[],requestSeq=0,recKey='',searchTimer,featuredIndex=0;
const detailCache=new Set();
const useImage=(a,klass='')=>{const url=poster(a);return url?'<img class="'+klass+'" src="'+escape(url)+'" loading="lazy" alt="">':'<span class="nrd-empty-art">✦</span>'};
const infoText=a=>[a?.type,a?.episodes?a.episodes+' eps':'',a?.score?'★ '+Number(a.score).toFixed(1):''].filter(Boolean).join(' · ');
const percent=e=>{const watched=Number(e?.episodes_watched||0),total=Number(e?.episodes_total||e?.catalog_episode_total||0);return total?Math.max(0,Math.min(100,Math.round(watched*100/total))):0};
const getJson=async(url)=>{
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
 try{const r=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});if(!r.ok)throw Error('Catalog request failed '+r.status);const j=await r.json();if(!Array.isArray(j.data))throw Error('Catalog response unavailable');return j.data}
 finally{clearTimeout(timeout)}
};
const ownAnime=e=>({title:e.title,mal_id:e.mal_id||null,image_url:e.image_url,synopsis:e.synopsis,episodes:e.episodes_total||e.catalog_episode_total,score:e.rating?Number(e.rating)/2:null,_ownedId:e.id});
function save(a){
 const existing=findOwned(a);
 if(existing){openAnime(existing);return}
 openAnime();
 document.getElementById('anime-title').value=title(a);
 document.getElementById('anime-image').value=selectedCover(a);
 document.getElementById('anime-status').value='plan_to_watch';
 if(a.episodes)document.getElementById('anime-total').value=a.episodes;
 state.modalMetadata={...state.modalMetadata,mal_id:a.mal_id||null,mal_url:safeUrl(a.url)||null,synopsis:a.synopsis||null,year:a.year||null};
}
const openDetails=a=>{
 current=a;const own=findOwned(a);
 const synopsis=escape(a.synopsis||own?.synopsis||'Synopsis not available from the catalogue yet.');
 modal.innerHTML='<div class="nrd-dialog-cover">'+useImage(a)+'<button type="button" data-detail-close aria-label="Close">×</button></div>'+
 '<div class="nrd-dialog-body"><span>ANIME DETAILS</span><h2>'+escape(title(a))+'</h2><p class="nrd-dialog-meta">'+escape(infoText(a))+'</p>'+
 '<h3>About this anime</h3><p class="nrd-dialog-summary">'+synopsis+'</p>'+
 (own?'<p class="nrd-dialog-owned">✓ Already in your library · '+escape(own.status||'')+'</p>':'')+
 '<div class="nrd-dialog-actions"><button type="button" data-detail-add>'+ (own?'View / edit your entry':'＋ Add to watchlist')+'</button>'+
 '<button type="button" data-detail-close>Close</button></div></div>';
 if(!modal.open)modal.showModal();
 if(a.mal_id&&!a.synopsis&&!detailCache.has(a.mal_id)){
  detailCache.add(a.mal_id);
  fetch('https://api.jikan.moe/v4/anime/'+encodeURIComponent(a.mal_id)+'/full')
   .then(r=>r.ok?r.json():null).then(body=>{
    if(!body?.data||current!==a||!modal.open)return;
    Object.assign(a,{synopsis:body.data.synopsis||a.synopsis,episodes:body.data.episodes||a.episodes,
      score:body.data.score||a.score,year:body.data.year||a.year,type:body.data.type||a.type});
    openDetails(a);
   }).catch(error=>console.warn('Anime details unavailable',error));
 }
};
modal.addEventListener('click',e=>{
 if(e.target===modal||e.target.closest('[data-detail-close]'))modal.close();
 if(e.target.closest('[data-detail-add]')){modal.close();if(current)save(current)}
});
const card=(a,i,source)=>'<button type="button" class="nrd-poster" data-select="'+source+':'+i+'">'+
 '<span class="nrd-poster-art">'+useImage(a)+(findOwned(a)?'<span class="nrd-saved">✓</span>':'<span class="nrd-save-icon">'+svg('bookmark')+'</span>')+'</span>'+
 '<strong>'+escape(title(a))+'</strong><small>'+escape(infoText(a)||'Discover anime')+'</small></button>';
const section=(name,action,items,source)=>'<div class="nrd-section-heading"><h2>'+name+'</h2>'+(action?'<button type="button" data-discover-action="'+action+'">View all →</button>':'')+'</div>'+
 '<div class="nrd-rail">'+(items.length?items.map((a,i)=>card(a,i,source)).join(''):'<p class="nrd-message">No shows to display yet.</p>')+'</div>';
const makeFeatured=()=>{
 const a=trending[featuredIndex%trending.length]||list().find(e=>e.favorite&&e.image_url)||list().find(e=>e.image_url);
 if(!a)return '<div class="nrd-feature nrd-feature-empty"><strong>Discover something new.</strong><p>Browse the anime catalogue to start exploring.</p></div>';
 const desc=String(a.synopsis||'Explore the story, find out more, and add it to your watchlist.').replace(/<[^>]+>/g,'').slice(0,135);
 return '<div class="nrd-feature">'+useImage(a,'nrd-feature-image')+
 '<div class="nrd-feature-content"><span>✦ FEATURED</span><h2>'+escape(title(a))+'</h2><p>'+escape(desc)+'</p>'+
 '<div class="nrd-feature-actions"><button type="button" data-feature-details>▶ View Details</button>'+
 '<button type="button" data-feature-save>'+svg('bookmark')+(findOwned(a)?'In Library':'Add to Library')+'</button></div></div></div>'+
 '<div class="nrd-feature-dots">'+trending.slice(0,Math.min(4,trending.length)).map((_,i)=>'<button type="button" data-feature-index="'+i+'" aria-label="Featured anime '+(i+1)+'" class="'+(i===featuredIndex?'selected':'')+'"></button>').join('')+'</div>';
};
const watching=()=>list().filter(e=>e.status==='watching');
function build(){
 if(!active||!mobile())return;
 const focused=document.activeElement?.id==='nrd-query';
 const caret=focused?document.activeElement.selectionStart:null;
 const w=watching();
 const fav=list().filter(e=>e.favorite).sort((a,b)=>(Number(a.favorite_rank)||99)-(Number(b.favorite_rank)||99));
 const recs=recommendations.length?recommendations: fav.filter(x=>x.image_url).map(ownAnime).slice(0,8);
 const results=search.trim().length>1;
 root.innerHTML='<div class="nrd-inner">'+
 '<label class="nrd-search">'+svg('search')+'<input id="nrd-query" type="search" placeholder="Search anime, characters, or tags…" value="'+escape(search)+'" aria-label="Search anime"></label>'+
 '<nav class="nrd-tabs" aria-label="Discover navigation"><button type="button" data-nrd-tab="discover" class="'+(tab==='discover'?'active':'')+'">✧ Discover</button>'+
 '<button type="button" data-nrd-tab="browse" class="'+(tab==='browse'?'active':'')+'">▱ Browse</button>'+
 '<button type="button" data-nrd-tab="library">♧ My Library</button><button type="button" data-nrd-tab="friends">♧ Friends</button></nav>'+
 (results?
  '<div class="nrd-search-section"><div class="nrd-section-heading"><h2>Search results</h2></div>'+
  (requesting?'<p class="nrd-message">Searching the anime catalogue…</p>':searchResults.length?'<div class="nrd-search-grid">'+searchResults.map((a,i)=>card(a,i,'search')).join('')+'</div>':'<p class="nrd-message">No results yet. Try another title.</p>')+'</div>'
 :tab==='browse'?
   section('Popular anime','',trending,'trending')+section('Inspired by your favorites','',recs,'recs')
 :makeFeatured()+
   section('Popular Right Now','browse',trending.slice(0,14),'trending')+
   (w.length?'<div class="nrd-section-heading"><h2>▶ Continue Watching</h2><button type="button" data-discover-action="library">View all →</button></div>'+
    '<div class="nrd-watch-list">'+w.slice(0,4).map(e=>'<button type="button" class="nrd-watch-row" data-own-id="'+escape(e.id)+'">'+
    '<span class="nrd-watch-art">'+useImage(e)+'</span><span class="nrd-watch-info"><strong>'+escape(e.title)+'</strong><small>'+Number(e.episodes_watched||0)+' / '+(Number(e.episodes_total||e.catalog_episode_total)||'?')+' episodes</small>'+
    '<span class="nrd-progress"><span style="width:'+percent(e)+'%"></span></span></span><small>'+percent(e)+'%</small></button>').join('')+'</div>':'')+
   '<div class="nrd-recs">'+section(recommendations.length?'Because of Your Favorites':'Your Favorite Stories','',recs,'recs')+
   (recLoading?'<p class="nrd-message">Finding recommendations from anime fans…</p>':'')+'</div>'
 )+'</div>';
 if(focused){const next=root.querySelector('#nrd-query');next?.focus({preventScroll:true});try{if(caret!=null)next.setSelectionRange(caret,caret)}catch{}}
}
const catalogue=async()=>{
 if(trending.length)return;requesting=true;build();
 try{const items=await getJson('https://api.jikan.moe/v4/top/anime?filter=bypopularity&limit=20&sfw=true');
  trending=items.filter(a=>poster(a));featuredIndex=0;
 }catch(err){console.warn('Discover popular titles unavailable',err);trending=list().filter(e=>e.image_url).map(ownAnime);root.dataset.catalogFallback='true'}
 finally{requesting=false;build()}
};
const recommend=async()=>{
 if(recLoading||!active||!state.entries.length)return;
 const favorites=list().filter(e=>e.favorite||Number(e.rating)>=8).sort((a,b)=>Number(b.rating||0)-Number(a.rating||0)).slice(0,3);
 const key=favorites.map(e=>e.mal_id||e.title).join('|');
 if(key===recKey)return;recLoading=true;build();
 const out=new Map(),existing=new Set(list().map(e=>norm(e.title)));
 try{
  for(const e of favorites){
   let id=Number(e.mal_id);
   if(!id){
    const found=await getJson('https://api.jikan.moe/v4/anime?q='+encodeURIComponent(e.title)+'&limit=3&sfw=true');
    id=Number(found.find(x=>norm(x.title)===norm(e.title)||norm(x.title_english)===norm(e.title))?.mal_id||0);
   }
   if(!id)continue;
   await new Promise(resolve=>setTimeout(resolve,1200));
   try{
    const rows=await getJson('https://api.jikan.moe/v4/anime/'+id+'/recommendations');
    rows.forEach(x=>{const a=x.entry;if(a?.mal_id&&!existing.has(norm(title(a)))&&!out.has(a.mal_id))out.set(a.mal_id,a)});
   }catch(error){console.warn('Recommendation seed unavailable',error)}
   if(out.size>=14)break;
  }
 }catch(err){console.warn('Discover recommendations unavailable',err)}
 finally{
  recommendations=[...out.values()].slice(0,12);
  recKey=key;recLoading=false;build()
 }
};
const searchCatalogue=async(q)=>{
 const seq=++requestSeq;if(q.trim().length<2){searchResults=[];requesting=false;build();return}
 requesting=true;build();
 try{const items=await getJson('https://api.jikan.moe/v4/anime?q='+encodeURIComponent(q)+'&limit=20&sfw=true');
  if(seq!==requestSeq)return;searchResults=items.filter(x=>poster(x));
 }catch(err){if(seq!==requestSeq)return;console.warn('Discover search unavailable',err);searchResults=[]}
 finally{if(seq===requestSeq){requesting=false;build()}}
};
const activate=()=>{
 if(!mobile())return;
 // Do not route through the Friends "For You" tab or anime catalogue modal.
 // Discover is a standalone page with its own content.
 active=true;
 document.body.classList.add('nr-discover-active');
 const social=document.getElementById('social-friends-panel');
 if(social && !social.hidden)document.querySelector('[data-social-view="library"]')?.click();
 nav.querySelectorAll('[data-nightreel-tab]').forEach(b=>{
  if(b.dataset.nightreelTab==='discover')b.setAttribute('aria-current','page');
  else b.removeAttribute('aria-current');
 });
 build();
 window.scrollTo({top:0,behavior:'instant'});
 catalogue();recommend();
};
const deactivate=()=>{
 if(!active)return;
 active=false;document.body.classList.remove('nr-discover-active');
};
// The original bottom menu owns navigation; expose the dedicated view
// rather than competing with its earlier event listener.
window.NightreelDiscover={activate,deactivate};
nav.addEventListener('click',e=>{
 const button=e.target.closest('[data-nightreel-tab]');if(!button)return;
 if(button.dataset.nightreelTab!=='discover')deactivate();
},true);
root.addEventListener('click',e=>{
 const select=e.target.closest('[data-select]');
 if(select){const [source,num]=select.dataset.select.split(':');const data=source==='trending'?trending:source==='recs'?(recommendations.length?recommendations:list().filter(e=>e.favorite).map(ownAnime)):searchResults;const a=data[Number(num)];if(a)openDetails(a);return}
 const f=e.target.closest('[data-feature-index]');if(f){featuredIndex=Number(f.dataset.featureIndex);build();return}
 if(e.target.closest('[data-feature-details]')){const a=trending[featuredIndex]||list().find(x=>x.image_url);if(a)openDetails(a);return}
 if(e.target.closest('[data-feature-save]')){const a=trending[featuredIndex]||list().find(x=>x.image_url);if(a)save(a);return}
 const action=e.target.closest('[data-discover-action]');
 if(action){if(action.dataset.discoverAction==='browse'){tab='browse';build();window.scrollTo({top:0})}else nav.querySelector('[data-nightreel-tab="library"]')?.click();return}
 const t=e.target.closest('[data-nrd-tab]');if(!t)return;
 const next=t.dataset.nrdTab;
 if(next==='library'||next==='friends'){nav.querySelector('[data-nightreel-tab="'+next+'"]')?.click();return}
 tab=next;build();
});
root.addEventListener('input',e=>{
 if(e.target.id!=='nrd-query')return;
 search=e.target.value;clearTimeout(searchTimer);
 searchTimer=setTimeout(()=>searchCatalogue(search),330);
 // Keep native input focused; rerender only after the query is fetched.
});
root.addEventListener('keydown',e=>{if(e.target.id==='nrd-query'&&e.key==='Enter'){e.preventDefault();clearTimeout(searchTimer);searchCatalogue(search)}});
window.addEventListener('resize',()=>{if(!mobile())deactivate();else if(active)build()});
})();