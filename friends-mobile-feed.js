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
    feed.querySelector('.nrf-hero').hidden=view!=='activity';
    feed.querySelector('.nrf-filters').hidden=view!=='activity';
    feed.querySelector('.nrf-items').hidden=view!=='activity';
    feed.querySelector('.nrf-bottom').hidden=view!=='activity';
    manager.hidden=mobile() && view!=='friends';
    const forYou=feed.querySelector('#nrf-for-you');
    if(forYou)forYou.hidden=view!=='home';
    if(view==='home')window.NightreelLoadForYou?.();
    if(view==='friends')manager.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  const list=feed.querySelector('.nrf-items');
  const validImage=(s)=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:''}catch{return ''}};
  const values=[];let selected='all',userId='',loadedAt=0,loading=false,loadSeq=0;
  const add=(el,tag,cl,text)=>{const node=document.createElement(tag);if(cl)node.className=cl;if(text!=null)node.textContent=String(text);el.append(node);return node};
  const fallback=(text)=>{list.replaceChildren();add(list,'p','nrf-message',text)};
  const reactions=new Map();
  const reactionKey=anime=>String(anime.id||'');
  const icon=kind=>({
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    comment:'<path d="M20 11.2a8 8 0 0 1-8.3 8.1 9 9 0 0 1-4-.9L3 20l1.3-4A8.1 8.1 0 1 1 20 11.2Z"/>',
    bookmark:'<path d="M6 3.5h12v17l-6-4.5-6 4.5Z"/>'
  }[kind]);
  const svg=kind=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'+icon(kind)+'</svg>';
  const refreshReactions=async()=>{
    const ids=[...new Set(values.map(x=>reactionKey(x.anime)).filter(Boolean))];
    if(!ids.length||!state.supabase||!state.user)return;
    try{
      const [likes,comments]=await Promise.all([
        state.supabase.from('anime_activity_likes').select('entry_id,user_id').in('entry_id',ids),
        state.supabase.from('anime_activity_comments').select('id,entry_id').in('entry_id',ids)
      ]);
      if(likes.error||comments.error)throw likes.error||comments.error;
      ids.forEach(id=>reactions.set(id,{likes:0,comments:0,liked:false}));
      (likes.data||[]).forEach(r=>{const item=reactions.get(String(r.entry_id));if(item){item.likes++;if(r.user_id===state.user.id)item.liked=true}});
      (comments.data||[]).forEach(r=>{const item=reactions.get(String(r.entry_id));if(item)item.comments++});
      list.querySelectorAll('[data-reaction-entry]').forEach(node=>{
        const item=reactions.get(node.dataset.reactionEntry);
        if(!item)return;
        node.querySelector('[data-like-count]').textContent=String(item.likes);
        node.querySelector('[data-comment-count]').textContent=String(item.comments);
        node.querySelector('[data-like-toggle]').setAttribute('aria-pressed',String(item.liked));
      });
    }catch(error){console.warn('Unable to load feed reactions',error)}
  };
  const openComments=async(card,anime)=>{
    const panel=card.querySelector('.nrf-comment-panel');
    if(!panel.hidden){panel.hidden=true;return;}
    panel.hidden=false;
    const listEl=panel.querySelector('.nrf-comment-list');
    listEl.textContent='Loading comments…';
    const result=await state.supabase.from('anime_activity_comments')
      .select('id,user_id,body,created_at').eq('entry_id',anime.id).order('created_at',{ascending:true}).limit(100);
    if(result.error){listEl.textContent='Unable to load comments. Please retry.';return;}
    listEl.replaceChildren();
    if(!result.data.length)add(listEl,'p','nrf-no-comments','No comments yet.');
    for(const comment of result.data){
      const row=add(listEl,'div','nrf-comment');
      const author=comment.user_id===state.user.id?'You':'Friend';
      add(row,'strong',null,author);
      add(row,'p',null,comment.body);
      if(comment.user_id===state.user.id){
        const del=add(row,'button','nrf-comment-delete','Delete');del.type='button';
        del.addEventListener('click',async()=>{
          del.disabled=true;
          const res=await state.supabase.from('anime_activity_comments').delete().eq('id',comment.id);
          if(res.error){del.disabled=false;alert('Could not delete comment: '+res.error.message);return;}
          row.remove();await refreshReactions();
        });
      }
    }
  };
  const createCard=(friend,anime,kind)=>{
    const card=document.createElement('article');card.className='nrf-card';
    card.dataset.entryId=String(anime.id||'');
    const header=add(card,'div','nrf-card-header');
    const avatar=add(header,'span','nrf-avatar',(friend.display_name||friend.username||'?').slice(0,1).toUpperCase());
    avatar.setAttribute('aria-hidden','true');
    const who=add(header,'div','nrf-identity');
    add(who,'strong',null,friend.display_name||friend.username||'Nightreel friend');
    add(who,'span',null,kind==='watching'?'Currently watching '+(anime.title||'an anime'):'Added '+(anime.title||'an anime')+' to favorites');
    const profile=add(header,'button','nrf-profile','⋯');profile.type='button';
    profile.setAttribute('aria-label','View '+(friend.display_name||friend.username||'friend')+' profile');
    profile.addEventListener('click',()=>{
      const existing=document.querySelector('#friends-results [data-friend-action="view"][data-friend-id="'+String(friend.id)+'"]');
      if(existing)existing.click();else{
        const tab=feed.querySelector('[data-community-view="friends"]');tab?.click();
      }
    });
    const content=add(card,'div','nrf-show');
    const artwork=validImage(anime.image_url);
    const picture=add(content,'div','nrf-cover');
    if(artwork){const img=add(picture,'img');img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.src=artwork}
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
      if(rating>0)add(info,'p','nrf-rating','★ '.repeat(Math.round(rating/2)).trim()+'  '+(rating/2).toFixed(1).replace(/\.0$/,'')+'/5');
      if(anime.public_notes)add(info,'p','nrf-note',anime.public_notes);
    }
    const actions=add(card,'div','nrf-actions');
    const social=add(actions,'div','nrf-social-actions');
    social.dataset.reactionEntry=String(anime.id||'');
    const like=add(social,'button','nrf-action-icon');like.type='button';
    like.innerHTML=svg('heart')+'<span data-like-count>0</span>';like.dataset.likeToggle='';
    like.setAttribute('aria-label','Like post');like.setAttribute('aria-pressed','false');
    const commentBtn=add(social,'button','nrf-action-icon');commentBtn.type='button';
    commentBtn.innerHTML=svg('comment')+'<span data-comment-count>0</span>';
    commentBtn.setAttribute('aria-label','View comments');
    const bookmark=add(social,'button','nrf-action-icon nrf-bookmark');bookmark.type='button';
    bookmark.innerHTML=svg('bookmark');bookmark.setAttribute('aria-label','Add to watchlist');
    const already=(state.entries||[]).some(e=>String(e.title||'').trim().toLowerCase()===String(anime.title||'').trim().toLowerCase());
    const button=add(actions,'button','nrf-watchlist',already?'In your collection ✓':'＋ Add to watchlist');
    button.type='button';button.disabled=already;
    const addToWatchlist=()=>{
      if(typeof openAnime!=='function')return;
      openAnime();
      document.getElementById('anime-title').value=anime.title||'';
      document.getElementById('anime-image').value=artwork||'';
      document.getElementById('anime-status').value='plan_to_watch';
      if(anime.mal_id)state.modalMetadata.mal_id=anime.mal_id;
      if(anime.mal_url)state.modalMetadata.mal_url=anime.mal_url;
      if(anime.synopsis)state.modalMetadata.synopsis=anime.synopsis;
    };
    button.addEventListener('click',addToWatchlist);
    bookmark.disabled=already;
    bookmark.addEventListener('click',addToWatchlist);
    like.addEventListener('click',async()=>{
      if(like.disabled)return;like.disabled=true;
      const liked=like.getAttribute('aria-pressed')==='true';
      const query=state.supabase.from('anime_activity_likes');
      const result=liked
        ?await query.delete().eq('entry_id',anime.id).eq('user_id',state.user.id)
        :await query.insert({entry_id:anime.id,user_id:state.user.id});
      if(result.error){alert('Could not update like: '+result.error.message);like.disabled=false;return;}
      await refreshReactions();like.disabled=false;
    });
    const comments=add(card,'div','nrf-comment-panel');comments.hidden=true;
    const commentList=add(comments,'div','nrf-comment-list');
    const form=add(comments,'form','nrf-comment-form');
    const input=add(form,'input');input.name='comment';input.type='text';input.maxLength=1000;
    input.required=true;input.placeholder='Write a comment…';input.setAttribute('aria-label','Comment');
    const send=add(form,'button',null,'Post');send.type='submit';
    commentBtn.addEventListener('click',()=>openComments(card,anime));
    form.addEventListener('submit',async(event)=>{
      event.preventDefault();const body=input.value.trim();if(!body)return;
      send.disabled=true;
      const result=await state.supabase.from('anime_activity_comments').insert({entry_id:anime.id,user_id:state.user.id,body});
      send.disabled=false;
      if(result.error){alert('Could not post comment: '+result.error.message);return;}
      input.value='';comments.hidden=true;await openComments(card,anime);await refreshReactions();
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
    refreshReactions();
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
      if(target==='home'){switchCommunity('home');return;}
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