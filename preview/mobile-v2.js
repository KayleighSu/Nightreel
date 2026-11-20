/* Nightreel mobile showcase: UI-only, reuses existing collection records and edit controls. */
(()=>{'use strict';
 const mobile=()=>matchMedia('(max-width:720px)').matches;
 const app=document.getElementById('app-shell');
 const main=document.querySelector('.main-content');
 if(!app||!main)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const validImage=s=>{try{const u=new URL(s,location.href);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}};
 const icon=(key)=>({
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 discover:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
 library:'<path d="M6 3h12v18l-6-4-6 4z"/>',
 social:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 5"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 back:'<path d="m14 6-6 6 6 6"/>'
 }[key]||'');
 const svg=key=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icon(key)+'</svg>';
 let tab='discover',filter='watchlists',query='',dialogEntry=null;
 const shell=document.createElement('div');shell.id='nr-mobile-experience';
 shell.innerHTML='<div id="nr-mobile-view"></div><nav id="nr-mobile-bottom" aria-label="Mobile navigation">'+
 ['discover','library','social','search','more'].map((t,i)=>'<button type="button" data-mobile-tab="'+t+'" aria-label="'+({discover:'Home',library:'Library',social:'Friends',search:'Search',more:'More'}[t])+'">'+svg(['home','library','social','discover','more'][i])+'<span>'+({discover:'Home',library:'Library',social:'Friends',search:'Search',more:'More'}[t])+'</span></button>').join('')+'</nav>';
 main.prepend(shell);
 const view=shell.querySelector('#nr-mobile-view');
 const detail=document.createElement('dialog');detail.id='nr-mobile-details';detail.setAttribute('aria-label','Anime details');document.body.append(detail);
 const entries=()=>Array.isArray(state?.entries)?state.entries:[];
 const status=e=>String(e.status||'untracked');
 const rating=e=>Number(e.rating)?(Number(e.rating)/2).toFixed(1).replace(/\.0$/,'')+'/5':'Not rated';
 const total=e=>Number(e.episodes_total||e.catalog_episode_total||0);
 const percent=e=>e.is_movie?(status(e)==='completed'?100:0):total(e)?Math.min(100,Math.round(100*(e.episodes_watched||0)/total(e))):(status(e)==='completed'?100:0);
 const progress=e=>e.is_movie?(status(e)==='completed'?'Watched':'Movie'):(Number(e.episodes_watched)||0)+(total(e)?' / '+total(e):'')+' episodes';
 const image=e=>validImage(e?.image_url||e?.cover_url||'');
 const title=e=>esc(e.title||'Untitled');
 const cover=(e,klass='')=>'<div class="nrm-art '+klass+'">'+(image(e)?'<img src="'+esc(image(e))+'" loading="lazy" alt="">':'<div class="nrm-fallback">✦<span>'+title(e)+'</span></div>')+'</div>';
 const poster=(e)=>'<button type="button" class="nrm-poster" data-open-anime="'+esc(e.id)+'" aria-label="View '+title(e)+'">'+cover(e)+'<span class="nrm-poster-bottom"><strong>'+title(e)+'</strong><small>'+esc(progress(e))+'</small><span class="nrm-bar"><i style="width:'+percent(e)+'%"></i></span></span></button>';
 const row=(e)=>'<button type="button" class="nrm-continue" data-open-anime="'+esc(e.id)+'">'+cover(e)+'<span class="nrm-continue-info"><strong>'+title(e)+'</strong><small>'+esc(progress(e))+'</small><span class="nrm-bar"><i style="width:'+percent(e)+'%"></i></span></span><b>›</b></button>';
 const heading=(label,count,action)=>'<div class="nrm-section-head"><h2>'+esc(label)+(count===undefined?'':' <span>'+count+'</span>')+'</h2>'+(action?'<button type="button" data-mobile-action="'+action+'">View all ↗</button>':'')+'</div>';
 const strip=(list)=>'<div class="nrm-poster-strip">'+list.map(poster).join('')+'</div>';
 const order=()=>entries().slice().sort((a,b)=>(Number(b.favorite_rank||0)&&Number(a.favorite_rank||0)?Number(a.favorite_rank)-Number(b.favorite_rank):Number(b.rating||0)-Number(a.rating||0)));
 const topSearch=()=>'<label class="nrm-search">'+svg('discover')+'<input id="nrm-search-input" type="search" placeholder="Search your anime collection..." value="'+esc(query)+'" aria-label="Search anime"></label>';
 function discover(){
  const all=order(),featured=all.find(e=>e.favorite&&image(e))||all.find(e=>image(e))||all[0];
  const watching=entries().filter(e=>status(e)==='watching');
  const favorites=order().filter(e=>e.favorite);
  const more=entries().filter(e=>status(e)==='plan_to_watch'||status(e)==='untracked').slice(0,10);
  return '<section class="nrm-discover">'+topSearch()+
  '<div class="nrm-discover-tabs"><button class="active" data-mobile-tab="discover">✦ Discover</button><button data-mobile-tab="library">▱ Browse</button><button data-mobile-tab="library">♡ My Library</button><button data-mobile-tab="social">♧ Friends</button></div>'+
  (featured?'<button type="button" class="nrm-feature" data-open-anime="'+esc(featured.id)+'">'+cover(featured)+
   '<span class="nrm-feature-content"><small>✦ FEATURED FROM YOUR LIBRARY</small><strong>'+title(featured)+'</strong>'+
   '<span>'+esc((featured.synopsis||'Your next anime obsession.').slice(0,140))+'</span>'+
   '<em>View Details ↗</em></span></button>':'<div class="nrm-empty">Your personal anime universe starts here. Add your first title!</div>')+
  (favorites.length?heading('Your favorites',favorites.length,'favorites')+strip(favorites.slice(0,10)):'')+
  (watching.length?heading('Continue Watching',watching.length,'watching')+'<div class="nrm-continue-list">'+watching.slice(0,3).map(row).join('')+'</div>':'')+
  (more.length?heading('On your radar',more.length,'plan_to_watch')+strip(more):'')+
  '<button type="button" class="nrm-wide-link" data-mobile-tab="library">Explore your entire collection →</button></section>';
 }
 const groupDefs=[['watching','Watching','Currently in progress.'],['completed','Completed','Finished stories.'],['plan_to_watch','Plan to Watch','On your radar for later.'],['on_hold','On Hold','Paused for now.'],['untracked','Not Sorted Yet','Ready to organize.'],['dropped','Dropped','Not for you.']];
 function library(){
  const all=entries(),faves=order().filter(e=>e.favorite);
  const header='<div class="nrm-library-head"><div><h1>My Library</h1><p>Track, organize, and keep up with your anime.</p></div><button data-mobile-action="add" type="button">Add anime +</button></div>';
  const tabs='<div class="nrm-library-tabs">'+[['watchlists','Watchlists'],['all','All Anime '+all.length],['favorites','♡ Favorites '+faves.length],['stats','Stats']].map(([f,label])=>'<button data-mobile-filter="'+f+'" class="'+(filter===f?'active':'')+'">'+esc(label)+'</button>').join('')+'</div>';
  let result='';
  const searching=query.trim().toLowerCase();
  const matches=e=>[e.title,e.synopsis,e.notes].join(' ').toLowerCase().includes(searching);
  if(searching||filter==='all'){const list=all.filter(matches);result=heading('All Anime',list.length)+ (list.length?strip(list):'<p class="nrm-empty">No matching shows.</p>');}
  else if(filter==='favorites'){result=heading('Your Favorites',faves.length)+strip(faves);}
  else if(filter==='stats'){
   result='<div class="nrm-stats">'+[['Total anime',all.length],['Watching',all.filter(e=>status(e)==='watching').length],['Completed',all.filter(e=>status(e)==='completed').length],['Favorites',faves.length]].map(([l,n])=>'<div><strong>'+n+'</strong><span>'+l+'</span></div>').join('')+'</div>';
  }else{
   result=groupDefs.map(([key,label,sub])=>{const list=all.filter(e=>status(e)===key);return list.length?'<section class="nrm-shelf"><div class="nrm-shelf-header"><div><h2>'+esc(label)+' <b>'+list.length+'</b></h2><p>'+esc(sub)+'</p></div><button type="button" data-mobile-action="'+key+'">View all ↗</button></div>'+strip(list.slice(0,12))+'</section>':''}).join('');
  }
  return '<section class="nrm-library">'+header+topSearch()+tabs+result+'</section>';
 }
 function social(){
  return '<section class="nrm-community"><div class="nrm-community-heading"><small>THE NIGHTREEL COMMUNITY</small><h1>What your friends<br>are <em>watching.</em></h1><p>Your friends’ current obsessions and favorites, straight from Nightreel.</p></div>'+
  '<div class="nrm-social-actions"><button type="button" data-mobile-action="friends">Friends & requests</button><button type="button" data-mobile-action="messages">Messages</button><button type="button" data-mobile-action="profile">My profile</button></div>'+
  '<div id="nrm-friend-slot"></div></section>';
 }
 function details(e){
  const syn=esc(e.synopsis||'No synopsis available for this title.');
  const note=e.public_notes?'<div class="nrm-detail-box"><small>PUBLIC NOTE</small><p>'+esc(e.public_notes)+'</p></div>':'';
  detail.innerHTML='<div class="nrm-detail-content"><button type="button" data-detail-close class="nrm-detail-close" aria-label="Close details">×</button>'+
   '<div class="nrm-detail-art">'+cover(e)+'</div><div class="nrm-detail-body"><small>YOUR ANIME COLLECTION</small><h2>'+title(e)+'</h2>'+
   '<div class="nrm-detail-chips"><span>'+esc(status(e).replaceAll('_',' '))+'</span><span>★ '+esc(rating(e))+'</span><span>'+esc(progress(e))+'</span></div>'+
   '<span class="nrm-bar"><i style="width:'+percent(e)+'%"></i></span><h3>About this anime</h3><p>'+syn+'</p>'+note+
   '<div class="nrm-detail-actions"><button data-detail-edit type="button">Edit / update progress</button><button data-detail-close type="button">Close</button></div></div></div>';
  dialogEntry=e;
  if(!detail.open)detail.showModal();
 }
 function build(){
  if(!mobile()||app.hidden)return;
  view.innerHTML=tab==='library'?library():tab==='social'?social():discover();
  shell.querySelectorAll('[data-mobile-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.mobileTab===tab);if(b.dataset.mobileTab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(tab==='social'){
   const feed=document.getElementById('nr-friends-watching'),slot=document.getElementById('nrm-friend-slot');
   if(feed&&slot){slot.append(feed);feed.hidden=false;}
  }
 }
 function changeTab(next){
  if(next==='search'){tab='library';filter='all';build();view.querySelector('#nrm-search-input')?.focus();return;}
  if(next==='more'){document.getElementById('account-menu-button')?.click();return;}
  if(next==='social'){document.querySelector('[data-social-view="library"]')?.click();}
  else document.querySelector('[data-social-view="library"]')?.click();
  tab=next;query='';build();window.scrollTo({top:0,behavior:'instant'});
 }
 shell.addEventListener('click',event=>{
  const open=event.target.closest('[data-open-anime]');
  if(open){const e=entries().find(e=>String(e.id)===open.dataset.openAnime);if(e)details(e);return;}
  const nav=event.target.closest('[data-mobile-tab]');if(nav){changeTab(nav.dataset.mobileTab);return;}
  const fil=event.target.closest('[data-mobile-filter]');if(fil){filter=fil.dataset.mobileFilter;query='';build();return;}
  const action=event.target.closest('[data-mobile-action]');if(!action)return;
  const a=action.dataset.mobileAction;
  if(a==='add'){document.getElementById('add-btn')?.click();return;}
  if(a==='messages'){document.getElementById('extra-open-messages')?.click();return;}
  if(a==='profile'||a==='friends'){document.querySelector('[data-social-view="'+a+'"]')?.click();document.body.classList.add('nrm-original-social');return;}
  if(a==='favorites'){tab='library';filter='favorites';build();return;}
  if(groupDefs.some(x=>x[0]===a)){tab='library';filter='all';query='';build();const orig=document.querySelector('[data-filter="'+a+'"]');orig?.click();return;}
 });
 shell.addEventListener('input',e=>{if(e.target.id!=='nrm-search-input')return;const pos=e.target.selectionStart;query=e.target.value;if(tab!=='library'){tab='library';filter='all';}build();const field=view.querySelector('#nrm-search-input');if(field){field.focus();try{field.setSelectionRange(pos,pos)}catch{}}});
 detail.addEventListener('click',event=>{
  if(event.target.closest('[data-detail-close]')){detail.close();return;}
  if(event.target.closest('[data-detail-edit]')){detail.close();if(dialogEntry&&typeof openAnime==='function')openAnime(dialogEntry);}
 });
 detail.addEventListener('click',e=>{if(e.target===detail)detail.close();});
 // Leave the legacy functionality and all original event listeners untouched.
 const oldRender=render;
 render=function(){const result=oldRender.apply(this,arguments);requestAnimationFrame(build);return result;};
 window.addEventListener('resize',build);
 document.querySelector('.sidebar')?.addEventListener('click',e=>{if(e.target.closest('[data-filter]')){tab='library';filter='all';document.body.classList.remove('nrm-original-social');requestAnimationFrame(build);}},true);
 document.getElementById('brand-home')?.addEventListener('click',()=>changeTab('discover'));
 const feedObserver=new MutationObserver(()=>{if(tab==='social'&&mobile())requestAnimationFrame(()=>{const feed=document.getElementById('nr-friends-watching');const slot=document.getElementById('nrm-friend-slot');if(feed&&slot&&feed.parentElement!==slot)slot.append(feed);});});
 const friendFeed=document.getElementById('nr-friends-carousel-track');if(friendFeed)feedObserver.observe(friendFeed,{childList:true,subtree:false});
 setTimeout(build,100);setTimeout(build,850);
})();