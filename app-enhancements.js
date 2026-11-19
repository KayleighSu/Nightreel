/* Nightreel social UI and photo-card interactions. */
(function(){
'use strict';
const $s=id=>document.getElementById(id),esc=escapeHtml;
const sourceRender=render;
const summaries=new Map();
let ownProfile=null, links=[], friendItems=[], friendProfile=null, panel='library', ownBanner='';
let currentProfileOwner='', loadingProfile=false, displayedAccount='';
const social=document.createElement('section');social.id='social-ui';
social.innerHTML=[
'<div class="social-toolbar" id="social-navigation"><button type="button" data-social-view="library">◈ My library</button><button type="button" data-social-view="friends">♡ Friends</button><button type="button" data-social-view="profile">◉ My profile</button></div>',
'<div class="social-panel" id="social-friends-panel" hidden><h2>Find your people.</h2><p>Search usernames or names. Only accepted friends can see your anime and public notes.</p><div class="social-row"><label class="social-field" style="flex:1">Find a friend<input id="find-person" type="search" maxlength="32" placeholder="Search at least 2 letters"></label><button type="button" id="find-person-btn">Search</button></div><div id="people-results"></div><h2 style="margin-top:20px">Friends and requests</h2><div id="friends-results"></div><p class="social-message" id="friends-error" role="status"></p></div>',
'<div class="social-panel" id="social-profile-panel" hidden><h2>My public profile.</h2><p>Friends see your anime, ratings and public notes, never your email or private notes.</p><div class="social-hero"><img id="profile-banner" alt="" hidden><div class="social-hero-content"><span class="social-caption">STAY OBSESSED.</span><h2 id="profile-name">Anime fan</h2></div></div><form id="profile-editor"><div class="social-grid"><label class="social-field">Username<input id="profile-handle" pattern="[a-z][a-z0-9_]{2,31}" maxlength="32" required></label><label class="social-field">Display name<input id="profile-display" maxlength="60" required></label></div><p>Banner uses your most recently edited anime artwork unless you upload your own.</p><label class="social-field">Custom banner: JPG, PNG or WebP (maximum 4 MB)<input id="profile-image-file" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="social-toolbar" style="margin-top:15px"><button type="submit">Save profile</button><button type="button" id="remove-banner">Use latest anime image</button></div></form><p class="social-message" id="profile-error" role="status"></p></div>'
].join('');
const friendView=document.createElement('section');friendView.id='friend-view';friendView.hidden=true;
friendView.innerHTML=[
'<button type="button" class="btn btn-ghost btn-small" id="friend-back">← Friends</button>',
'<div class="social-hero" style="margin-top:16px"><img id="friend-banner" alt="" hidden><div class="social-hero-content"><span class="social-caption">FRIEND’S COLLECTION</span><h2 id="friend-name"></h2><p id="friend-handle"></p></div></div>',
'<p class="hint">Read-only. Friends cannot edit your anime or ratings. Private notes are never shared.</p><div id="friend-grid" class="anime-grid"></div>'
].join('');
const col=document.querySelector('.collection-section'), main=document.querySelector('.main-content');
if(!col||!main)return;
col.before(social);col.after(friendView);
const owner=()=>Boolean(state.supabase&&state.user&&!state.demo);
const lastArt=arr=>[...arr].sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''))).find(x=>cleanedUrl(x.image_url))?.image_url||'';
function putImage(id,url){const img=$s(id),safe=cleanedUrl(url);if(!img)return;img.hidden=!safe;if(safe)img.src=safe;else img.removeAttribute('src');}
function drawHero(){
 const account=state.user?.id||'';
 if(account!==displayedAccount){displayedAccount=account;ownProfile=null;ownBanner='';currentProfileOwner='';}
 putImage('hero-banner-image',ownBanner||lastArt(state.entries));
 if(owner() && (!ownProfile || currentProfileOwner!==state.user.id) && !loadingProfile){
  loadingProfile=true;
  state.supabase.from('profiles').select('id,username,display_name,banner_path').eq('id',state.user.id).maybeSingle().then(async r=>{
   if(!r.error && r.data && state.user?.id===r.data.id){
    ownProfile=r.data;currentProfileOwner=r.data.id;
    ownBanner=await getSignedBanner(ownProfile);
    putImage('hero-banner-image',ownBanner||lastArt(state.entries));
   }
  }).finally(()=>{loadingProfile=false;});
 }
}
function note(id,msg){$s(id).textContent=msg;}
function need(id){if(owner())return true;note(id,'Connect Nightreel to a Supabase project to use accounts and friends.');return false;}
function buildCard(e,index,readOnly){
 const title=esc(e.title),id=esc(e.id),rating=Number(e.rating)||0,watched=e.episodes_watched||0;
 const total=e.episodes_total,progress=total?watched+' / '+total+' episodes':watched+' episodes watched';
 const percent=total?Math.min(100,Math.round(100*watched/total)):(e.status==='completed'?100:0);
 const pic=cleanedUrl(e.image_url)?'<img class="card-image" loading="lazy" src="'+esc(cleanedUrl(e.image_url))+'" alt="">':'';
 const stars=[1,2,3,4,5].map(n=>'<button type="button" '+(readOnly?'disabled':'data-action="rate" data-id="'+id+'" data-rating="'+(n*2)+'"')+' class="'+(rating&&n<=Math.ceil(rating/2)?'rated':'unrated')+'" title="'+(readOnly?'Rating':'Rate '+n+' stars')+'">★</button>').join('');
 const synopsis=esc(e.synopsis||summaries.get(canonicalTitle(e.title))||'Tap here to load a story summary, or follow the IMDb link.');
 const publicNote=readOnly&&e.public_notes?'<div class="public-note"><strong>Public note:</strong> '+esc(e.public_notes)+'</div>':'';
 return '<article class="anime-card" data-card-id="'+id+'"><div class="flip-inner">'+
 '<div class="flip-face front">'+pic+'<div class="flip-top"><span class="status-pill">'+esc(statuses[e.status]||'Not sorted yet')+'</span>'+
 (readOnly?'':'<button type="button" class="favorite-icon '+(e.favorite?'active':'')+'" data-action="favorite" data-id="'+id+'" aria-label="Toggle favorite">♥</button>')+'</div>'+
 '<div class="flip-body"><div class="art-label">'+(originalByTitle.has(canonicalTitle(e.title))?'ORIGINAL HAND-PICKED ART':'YOUR ANIME LIBRARY')+'</div><h3>'+title+'</h3>'+
 '<div class="flip-rating">'+stars+'<span class="rating-text">'+(rating?rating+'/10':'Not rated')+'</span></div>'+
 '<div class="flip-progress">'+esc(progress)+'<div class="progress-track"><div class="progress-fill" style="width:'+percent+'%"></div></div></div>'+
 '<div class="flip-actions">'+(readOnly?'':'<button type="button" data-action="edit" data-id="'+id+'">Edit</button>')+
 '<button type="button" data-action="flip">Story ↻</button><a href="'+esc(imdbLink(e))+'" target="_blank" rel="noopener noreferrer">IMDb ↗</a></div></div></div>'+
 '<div class="flip-face back">'+pic+'<div class="flip-back-content"><span class="synopsis-heading">ABOUT THIS ANIME</span><h3>'+title+'</h3>'+
 '<p class="synopsis">'+synopsis+'</p>'+publicNote+
 '<div class="back-actions"><button type="button" data-action="flip">↶ Flip back</button><a href="'+esc(imdbLink(e))+'" target="_blank" rel="noopener noreferrer">IMDb ↗</a></div></div></div></div></article>';
}
cardHtml=(e,i)=>buildCard(e,i,false);
render=function(){sourceRender();drawHero();if(panel==='profile')drawMyBanner();};
state.sort='title';$s('sort-select').value='title';render();
function flip(card,e){
 card.classList.toggle('is-flipped');
 if(card.classList.contains('is-flipped')&&!e?.synopsis)lookupSynopsis(card,e);
}
async function lookupSynopsis(card,e){
 const target=card.querySelector('.synopsis'),key=canonicalTitle(e?.title||'');
 if(!target||!e)return;
 if(summaries.has(key)){target.textContent=summaries.get(key);return;}
 target.textContent='Loading a synopsis…';
 try{
  const resp=await fetch('https://api.jikan.moe/v4/anime?q='+encodeURIComponent(e.title)+'&limit=5');
  if(!resp.ok)throw Error('Unavailable');
  const json=await resp.json(),all=Array.isArray(json.data)?json.data:[];
  const match=all.find(x=>canonicalTitle(x.title)===key||canonicalTitle(x.title_english)===key)||all[0];
  const story=String(match?.synopsis||'No synopsis found. Open IMDb for more information.').slice(0,4500);
  summaries.set(key,story);if(!e.synopsis)e.synopsis=story;
  target.textContent=story;
 }catch{target.textContent='A synopsis is unavailable at the moment. The IMDb link is still available.';}
}
async function rate(e,n){
 if(!e||state.busy)return;
 state.busy=true;
 try{
  if(!state.demo){const r=await state.supabase.from('anime_entries').update({rating:n}).eq('id',e.id);if(r.error)throw r.error;}
  e.rating=n;e.updated_at=new Date().toISOString();if(state.demo)storeDemo();render();toast('Rating: '+n+'/10');
 }catch(err){toast('Rating not saved: '+err.message);}
 finally{state.busy=false;}
}
async function cardClick(ev,readOnly){
 const card=ev.target.closest('.anime-card');if(!card)return;
 const e=(readOnly?friendItems:state.entries).find(x=>String(x.id)===card.dataset.cardId);
 const action=ev.target.closest('[data-action]');
 if(action?.dataset.action==='flip'){ev.stopImmediatePropagation();flip(card,e);}
 else if(!readOnly&&action?.dataset.action==='rate'){ev.stopImmediatePropagation();await rate(e,Number(action.dataset.rating));}
 else if(!ev.target.closest('button,a,input,select,textarea'))flip(card,e);
}
$s('anime-grid').addEventListener('click',e=>cardClick(e,false),true);
$s('friend-grid').addEventListener('click',e=>cardClick(e,true));
function show(which){
 panel=which;
 const library=which==='library',friends=which==='friends',profile=which==='profile';
 document.querySelector('.hero').hidden=!library;
 document.querySelector('.stats').hidden=!library;
 col.hidden=!library;
 friendView.hidden=which!=='friend';
 $s('social-navigation').hidden=which==='friend';
 $s('social-friends-panel').hidden=!friends;
 $s('social-profile-panel').hidden=!profile;
 if(friends)refreshFriends();
 if(profile)loadProfile();
 if(!library)main.scrollIntoView({block:'start',behavior:'smooth'});
 if(library)render();
}
social.querySelectorAll('[data-social-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.socialView)));
$s('friend-back').onclick=()=>show('friends');
async function loadProfile(){
 if(!need('profile-error'))return;
 try{
  const r=await state.supabase.from('profiles').select('id,username,display_name,banner_path').eq('id',state.user.id).maybeSingle();
  if(r.error)throw r.error;
  ownProfile=r.data;
  if(!ownProfile)throw Error('No profile exists. Run the social database migration.');
  $s('profile-handle').value=ownProfile.username;
  $s('profile-display').value=ownProfile.display_name;
  ownBanner=await getSignedBanner(ownProfile);
  currentProfileOwner=ownProfile.id;
  drawMyBanner();drawHero();
  note('profile-error','Only accepted friends can see your profile.');
 }catch(err){note('profile-error','Profile unavailable: '+err.message);}
}
function drawMyBanner(){
 $s('profile-name').textContent=ownProfile?.display_name||'Anime fan';
 putImage('profile-banner',ownBanner||lastArt(state.entries));
}
async function getSignedBanner(p){
 if(!p?.banner_path||!owner())return '';
 try{
  const r=await state.supabase.storage.from('nightreel-banners').createSignedUrl(p.banner_path,300);
  if(r.error)throw r.error;return cleanedUrl(r.data?.signedUrl);
 }catch{return '';}
}
$s('profile-editor').addEventListener('submit',async ev=>{
 ev.preventDefault();if(!need('profile-error'))return;
 const username=$s('profile-handle').value.trim().toLowerCase(),display_name=$s('profile-display').value.trim();
 if(!/^[a-z][a-z0-9_]{2,31}$/.test(username)||!display_name||display_name.length>60){note('profile-error','Invalid username or display name.');return;}
 const file=$s('profile-image-file').files?.[0];
 if(file && (!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>4194304)){note('profile-error','Choose a JPG, PNG or WebP under 4 MB.');return;}
 try{
  let banner_path=ownProfile?.banner_path||null;
  if(file){
   const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];
   banner_path=state.user.id+'/'+newLocalId()+'.'+ext;
   const uploaded=await state.supabase.storage.from('nightreel-banners').upload(banner_path,file,{upsert:false,contentType:file.type});
   if(uploaded.error)throw uploaded.error;
  }
  const r=await state.supabase.from('profiles').update({username,display_name,banner_path}).eq('id',state.user.id);
  if(r.error)throw r.error;
  ownProfile={...ownProfile,username,display_name,banner_path};
  ownBanner=await getSignedBanner(ownProfile);
  drawMyBanner();drawHero();$s('profile-image-file').value='';note('profile-error','Profile saved.');
 }catch(e){note('profile-error','Save failed: '+e.message);}
});
$s('remove-banner').onclick=async()=>{
 if(!need('profile-error'))return;
 const r=await state.supabase.from('profiles').update({banner_path:null}).eq('id',state.user.id);
 if(r.error){note('profile-error',r.error.message);return;}
 ownProfile.banner_path=null;ownBanner='';drawMyBanner();drawHero();note('profile-error','Using your most recently edited anime image.');
};
async function refreshFriends(){
 if(!need('friends-error'))return;
 try{
  const r=await state.supabase.rpc('get_nightreel_connections');
  if(r.error)throw r.error;
  links=r.data||[];
  $s('friends-results').innerHTML=links.length?links.map(f=>{
   const id=f.requester_id===state.user.id?f.recipient_id:f.requester_id;
   const incoming=f.recipient_id===state.user.id;
   const controls=f.status==='pending'&&incoming?'<button data-friend-action="accept" data-friend-row="'+esc(f.id)+'">Accept</button><button data-friend-action="declined" data-friend-row="'+esc(f.id)+'">Decline</button>':
    f.status==='accepted'?'<button data-friend-action="view" data-friend-id="'+esc(id)+'">View profile</button><button data-friend-action="remove" data-friend-row="'+esc(f.id)+'">Unfriend</button>':
    '<button data-friend-action="remove" data-friend-row="'+esc(f.id)+'">Cancel / dismiss</button>';
   return '<div class="social-row"><div><strong>'+esc(f.display_name)+'</strong><small>@'+esc(f.username)+' · '+esc(f.status)+(incoming?' · incoming':'')+'</small></div><div class="social-toolbar" style="margin:0">'+controls+'</div></div>';
  }).join(''):'<p>No friends or pending requests yet.</p>';
  note('friends-error','');
 }catch(e){note('friends-error','Unable to load friends: '+e.message);}
}
$s('friends-results').addEventListener('click',async ev=>{
 const b=ev.target.closest('[data-friend-action]');if(!b||!owner())return;
 if(b.dataset.friendAction==='view'){viewFriend(b.dataset.friendId);return;}
 try{
  const r=b.dataset.friendAction==='remove'?
   await state.supabase.from('friendships').delete().eq('id',b.dataset.friendRow):
   await state.supabase.from('friendships').update({status:b.dataset.friendAction==='accept'?'accepted':'declined'}).eq('id',b.dataset.friendRow);
  if(r.error)throw r.error;
  await refreshFriends();
 }catch(e){note('friends-error','Request could not be updated: '+e.message);}
});
$s('find-person-btn').onclick=async()=>{
 if(!need('friends-error'))return;
 const q=$s('find-person').value.trim();
 if(q.length<2){note('friends-error','Search at least 2 characters.');return;}
 try{
  await refreshFriends();
  const r=await state.supabase.rpc('search_nightreel_users',{p_query:q});
  if(r.error)throw r.error;
  const ids=new Set(links.map(f=>f.requester_id===state.user.id?f.recipient_id:f.requester_id));
  $s('people-results').innerHTML=(r.data||[]).map(p=>'<div class="social-row"><div><strong>'+esc(p.display_name)+'</strong><small>@'+esc(p.username)+'</small></div>'+
   (ids.has(p.id)?'<small>Already connected / requested</small>':'<button type="button" data-request-id="'+esc(p.id)+'">Send request</button>')+'</div>').join('')||'<p>No people found.</p>';
  note('friends-error','');
 }catch(e){note('friends-error','Search unavailable: '+e.message);}
};
$s('find-person').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$s('find-person-btn').click();}});
$s('people-results').addEventListener('click',async ev=>{
 const b=ev.target.closest('[data-request-id]');if(!b||!owner())return;
 b.disabled=true;
 try{
  const r=await state.supabase.from('friendships').insert({requester_id:state.user.id,recipient_id:b.dataset.requestId,status:'pending'});
  if(r.error)throw r.error;
  b.textContent='Request sent';await refreshFriends();
 }catch(e){b.disabled=false;note('friends-error','Could not send request: '+e.message);}
});
async function viewFriend(id){
 if(!owner())return;
 if(!links.some(f=>f.status==='accepted'&&(f.requester_id===state.user.id?f.recipient_id:f.requester_id)===id))return;
 try{
  const [p,e]=await Promise.all([
   state.supabase.from('profiles').select('id,username,display_name,banner_path').eq('id',id).single(),
   state.supabase.rpc('get_friend_anime',{p_friend_id:id})
  ]);
  if(p.error)throw p.error;if(e.error)throw e.error;
  friendProfile=p.data;friendItems=e.data||[];
  const image=await getSignedBanner(friendProfile);
  putImage('friend-banner',image||lastArt(friendItems));
  $s('friend-name').textContent=friendProfile.display_name;
  $s('friend-handle').textContent='@'+friendProfile.username+' · '+friendItems.length+' anime';
  $s('friend-grid').innerHTML=[...friendItems].sort((a,b)=>a.title.localeCompare(b.title)).map((a,i)=>buildCard(a,i,true)).join('');
  show('friend');
 }catch(err){note('friends-error','Could not load friend profile: '+err.message);}
}
// Refresh private signed banner URLs periodically so custom artwork remains visible
// without making the storage bucket public.
setInterval(async()=>{
 if(!owner())return;
 if(ownProfile?.banner_path){ownBanner=await getSignedBanner(ownProfile);drawHero();if(panel==='profile')drawMyBanner();}
 if(panel==='friend' && friendProfile?.banner_path){const url=await getSignedBanner(friendProfile);putImage('friend-banner',url||lastArt(friendItems));}
},240000);
const header=document.querySelector('.topbar-right');
if(header){
 const b=document.createElement('button');b.className='btn btn-ghost btn-small';b.type='button';b.textContent='Friends ♡';
 b.addEventListener('click',()=>show('friends'));header.prepend(b);
}
})();
