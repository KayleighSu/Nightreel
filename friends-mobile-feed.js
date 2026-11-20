/* Mobile Friends activity presentation — uses existing accepted-friend RPCs only. */
(() => {
  'use strict';
  const mobile=()=>window.matchMedia('(max-width:780px)').matches;
  const panel=document.getElementById('social-friends-panel');
  if(!panel)return;
  const feed=document.createElement('section');
  feed.id='nr-mobile-friend-activity';
  feed.setAttribute('aria-label','Friends anime activity');
  feed.innerHTML='<nav class="nrf-page-tabs" aria-label="Community sections"><button type="button" data-community-view="home">⌂ For You</button><button type="button" data-community-view="activity" aria-current="page">♧ Activity</button><button type="button" data-community-view="friends">♧ Friends</button><button type="button" data-community-view="messages">✉ Messages</button></nav>'+ 
    '<div class="nrf-hero"><span>THE COMMUNITY FEED</span><h2>What your friends<br>are <em>watching.</em></h2><p>Anime updates and recommendations from your accepted friends.</p></div>'+
    '<div class="nrf-filters" role="group" aria-label="Activity filter">'+
    '<button type="button" data-feed-filter="all" aria-pressed="true">All activity</button>'+
    '<button type="button" data-feed-filter="watching" aria-pressed="false">Watching</button>'+
    '<button type="button" data-feed-filter="favorites" aria-pressed="false">Favorites</button></div>'+
    '<div class="nrf-items" aria-live="polite"><p class="nrf-message">Loading your friends’ collections…</p></div>'+
    '<div class="nrf-bottom"><button type="button" data-feed-refresh>Refresh activity ↻</button></div>';
  panel.prepend(feed);
  // Preserve Nightreel's existing friend search, requests and profile actions.
  const manager=document.createElement('div');manager.id='nrf-friend-manager';
  const first=feed.nextSibling;
  while(feed.nextSibling)manager.append(feed.nextSibling);
  panel.append(manager);
  manager.hidden=mobile();
  let communityView='activity';
  function switchCommunity(view){
    communityView=view;
    feed.querySelectorAll('[data-community-view]').forEach(b=>{
      if(b.dataset.communityView===view)b.setAttribute('aria-current','page');
      else b.removeAttribute('aria-current');
    });
    feed.querySelector('.nrf-hero').hidden=view==='friends';
    feed.querySelector('.nrf-filters').hidden=view==='friends';
    feed.querySelector('.nrf-items').hidden=view==='friends';
    feed.querySelector('.nrf-bottom').hidden=view==='friends';
    manager.hidden=mobile() && view!=='friends';
    if(view==='friends')manager.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  const list=feed.querySelector('.nrf-items');
  const validImage=(s)=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:''}catch{return ''}};
  const values=[];let selected='all',userId='',loadedAt=0,loading=false,loadSeq=0;
  const add=(el,tag,cl,text)=>{const node=document.createElement(tag);if(cl)node.className=cl;if(text!=null)node.textContent=String(text);el.append(node);return node};
  const fallback=(text)=>{list.replaceChildren();add(list,'p','nrf-message',text)};
  const createCard=(friend,anime,kind)=>{
    const card=document.createElement('article');card.className='nrf-card';
    const header=add(card,'div','nrf-card-header');
    const avatar=add(header,'span','nrf-avatar',(friend.display_name||friend.username||'?').slice(0,1).toUpperCase());
    avatar.setAttribute('aria-hidden','true');
    const who=add(header,'div','nrf-identity');
    add(who,'strong',null,friend.display_name||friend.username||'Nightreel friend');
    add(who,'span',null,kind==='watching'?'Currently watching':'One of their favorites');
    const profile=add(header,'button','nrf-profile','View profile ↗');profile.type='button';
    profile.addEventListener('click',()=>{document.querySelector('[data-social-view="friends"]')?.click();
      // Existing friend profile buttons enforce privacy and access rules.
      const existing=document.querySelector('#friends-results [data-friend-action="view"][data-friend-id="'+String(friend.id)+'"]');
      if(existing)existing.click();
      else document.getElementById('friends-results')?.scrollIntoView({behavior:'smooth',block:'start'});
    });
    const content=add(card,'div','nrf-show');
    const artwork=validImage(anime.image_url);
    const picture=add(content,'div','nrf-cover');
    if(artwork){const img=add(picture,'img');img.alt='';img.loading='lazy';img.src=artwork;img.referrerPolicy='no-referrer'}
    else add(picture,'span','nrf-cover-fallback','✦');
    const info=add(content,'div','nrf-show-info');
    add(info,'h3',null,anime.title||'Untitled anime');
    if(kind==='watching'){
      const watched=Number(anime.episodes_watched)||0;
      const total=Number(anime.episodes_total||anime.catalog_episode_total)||0;
      add(info,'p','nrf-subtitle',total?watched+' / '+total+' episodes':watched+' episodes watched');
      if(total>0){
        const bar=add(info,'div','nrf-progress');bar.setAttribute('role','progressbar');
        bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');
        const pct=Math.max(0,Math.min(100,Math.round(watched/total*100)));
        bar.setAttribute('aria-valuenow',String(pct));
        const fill=add(bar,'span');fill.style.width=pct+'%';
      }
    }else{
      const rating=Number(anime.rating);
      if(rating>0)add(info,'p','nrf-rating','★ '+(rating/2).toFixed(1).replace(/\.0$/,'')+' / 5');
      if(anime.public_notes)add(info,'p','nrf-note',anime.public_notes);
    }
    const actions=add(card,'div','nrf-actions');
    const already=(state.entries||[]).some(e=>String(e.title||'').trim().toLowerCase()===String(anime.title||'').trim().toLowerCase());
    const button=add(actions,'button','nrf-watchlist',already?'In your collection ✓':'＋ Add to watchlist');
    button.type='button';button.disabled=already;
    button.addEventListener('click',()=>{
      if(typeof openAnime!=='function')return;
      openAnime();
      document.getElementById('anime-title').value=anime.title||'';
      document.getElementById('anime-image').value=artwork||'';
      document.getElementById('anime-status').value='plan_to_watch';
      if(anime.mal_id)state.modalMetadata.mal_id=anime.mal_id;
      if(anime.mal_url)state.modalMetadata.mal_url=anime.mal_url;
      if(anime.synopsis)state.modalMetadata.synopsis=anime.synopsis;
      // Saving is still performed by the existing form, not by this view.
    });
    return card;
  };
  function render(){
    list.replaceChildren();
    const available=values.filter(x=>selected==='all'||x.kind===selected);
    if(!available.length){fallback(values.length?'No activity in this category yet.':'Your accepted friends’ watching and favorite shows will appear here.');return}
    const fragment=document.createDocumentFragment();
    available.forEach(({friend,anime,kind})=>fragment.append(createCard(friend,anime,kind)));
    list.append(fragment);
  }
  async function refresh(force=false){
    if(!mobile()||panel.hidden||!state.user?.id||!state.supabase)return;
    if(loading)return;
    const uid=state.user.id;
    if(!force&&uid===userId&&Date.now()-loadedAt<60000){render();return}
    loading=true;const seq=++loadSeq;fallback('Loading your friends’ activity…');
    try{
      const connections=await state.supabase.rpc('get_nightreel_connections');
      if(connections.error)throw connections.error;
      const accepted=(connections.data||[]).filter(f=>f.status==='accepted').map(f=>({
        id:f.requester_id===uid?f.recipient_id:f.requester_id,
        username:f.username,display_name:f.display_name
      }));
      if(!accepted.length){values.length=0;userId=uid;loadedAt=Date.now();fallback('No accepted friends yet. Use the Find Friends section below to connect.');return}
      const results=await Promise.all(accepted.slice(0,40).map(async friend=>{
        try{const r=await state.supabase.rpc('get_friend_anime_v7',{p_friend_id:friend.id});
          if(r.error)throw r.error;return {friend,items:r.data||[]}
        }catch(error){console.warn('Friends feed collection unavailable',error);return {friend,items:[]}}
      }));
      if(seq!==loadSeq||state.user?.id!==uid)return;
      values.length=0;
      for(const {friend,items} of results){
        const watching=items.filter(x=>x.status==='watching').sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')));
        const favorites=items.filter(x=>x.favorite).sort((a,b)=>(Number(a.favorite_rank)||99)-(Number(b.favorite_rank)||99));
        if(watching[0])values.push({friend,anime:watching[0],kind:'watching'});
        if(favorites[0]&&favorites[0].id!==watching[0]?.id)values.push({friend,anime:favorites[0],kind:'favorites'});
      }
      userId=uid;loadedAt=Date.now();render();
    }catch(error){console.warn('Nightreel Friends feed:',error);fallback('Could not load friend activity. Tap Refresh activity to try again.')}
    finally{loading=false}
  }
  feed.addEventListener('click',e=>{
    const viewButton=e.target.closest('[data-community-view]');
    if(viewButton){
      const target=viewButton.dataset.communityView;
      if(target==='home'){
        document.querySelector('[data-social-view="library"]')?.click();
        document.getElementById('brand-home')?.click();
        return;
      }
      if(target==='messages'){document.getElementById('messages-top-button')?.click();return;}
      switchCommunity(target);return;
    }
    const filter=e.target.closest('[data-feed-filter]');
    if(filter){selected=filter.dataset.feedFilter;feed.querySelectorAll('[data-feed-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===filter)));render()}
    if(e.target.closest('[data-feed-refresh]'))refresh(true);
  });
  const observer=new MutationObserver(()=>{
    if(!panel.hidden&&mobile()){switchCommunity('activity');refresh();}
  });
  observer.observe(panel,{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('resize',()=>{manager.hidden=mobile() && communityView!=='friends';if(mobile()&&!panel.hidden)refresh()});
  document.querySelector('[data-social-view="friends"]')?.addEventListener('click',()=>setTimeout(()=>refresh(),50));
  if(!panel.hidden)refresh();
})();