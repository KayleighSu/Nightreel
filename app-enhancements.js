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
'<div class="social-panel" id="social-profile-panel" hidden><h2>My public profile.</h2><p>Friends see your anime, ratings and public notes, never your email or private notes.</p><div class="social-hero"><img id="profile-banner" alt="" hidden><div class="social-hero-content"><span class="social-caption">STAY OBSESSED.</span><h2 id="profile-name">Anime fan</h2></div></div><form id="profile-editor"><div class="social-grid"><label class="social-field">Username<input id="profile-handle" pattern="[A-Za-z][A-Za-z0-9_]{2,31}" maxlength="32" required></label><label class="social-field">Display name<input id="profile-display" maxlength="60" required></label></div><p>Banner uses your most recently edited anime artwork unless you upload your own.</p><label class="social-field">Custom banner: JPG, PNG or WebP (maximum 4 MB)<input id="profile-image-file" type="file" accept="image/jpeg,image/png,image/webp"></label><label class="social-field">Profile picture (JPG, PNG or WebP, max 2 MB)<input id="profile-avatar-file" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="social-toolbar" style="margin-top:15px"><button type="submit">Save profile</button><button type="button" id="remove-banner">Use latest anime image</button></div></form><p class="social-message" id="profile-error" role="status"></p></div>'
].join('');
const friendView=document.createElement('section');friendView.id='friend-view';friendView.hidden=true;
friendView.innerHTML=[
'<button type="button" class="btn btn-ghost btn-small" id="friend-back">← Friends</button>',
'<div class="social-hero" style="margin-top:16px"><img id="friend-banner" alt="" hidden><div class="social-hero-content"><span class="social-caption">FRIEND’S COLLECTION</span><h2 id="friend-name"></h2><p id="friend-handle"></p><div class="nr-watchtime nr-friend-watchtime"><strong id="nr-friend-hours">0 h</strong><span>ESTIMATED WATCH TIME</span></div></div></div>',
'<p class="hint">Read-only. Friends cannot edit your anime or ratings. Private notes are never shared.</p><div id="friend-grid" class="anime-grid"></div>'
].join('');

// A unique username is required after the first sign-in, not assigned from email.
// The database's UNIQUE constraint and lowercase-format CHECK are authoritative.
const handleDialog=document.createElement('dialog');
handleDialog.id='username-setup-dialog';
handleDialog.className='modal';
handleDialog.setAttribute('aria-labelledby','username-setup-title');
handleDialog.innerHTML=[
 '<div class="modal-inner">',
 '<div class="section-kicker">YOUR PUBLIC IDENTITY</div>',
 '<h2 id="username-setup-title" style="font:700 28px var(--head);margin:12px 0">Choose your username.</h2>',
 '<p class="modal-note">Friends will search for you using this public username. Every username is unique. Your email address stays private.</p>',
 '<form id="username-setup-form">',
 '<label class="social-field" for="username-setup-input">Public username',
 '<input id="username-setup-input" name="username" required minlength="3" maxlength="32" pattern="[A-Za-z][A-Za-z0-9_]{2,31}" placeholder="animefan_123" autocomplete="off" spellcheck="false"></label>',
 '<p class="hint">3–32 characters: letters (uppercase allowed), numbers and underscores. Start with a letter. Capitalization is preserved.</p>',
 '<p class="form-error" id="username-setup-error" role="alert" hidden></p>',
 '<div class="modal-actions"><button type="submit" class="btn btn-primary" id="username-setup-save">Save username</button></div>',
 '</form></div>'
].join('');
document.body.append(handleDialog);
let handleCheckId='',handleCheckRunning=false;
function needsUsername(profile) {
 return profile?.username && /^user_[0-9a-f]{24}$/.test(profile.username);
}
function askForUsername(profile) {
 if(!owner() || !profile || !needsUsername(profile) || handleDialog.open)return;
 handleDialog.showModal();
 document.getElementById('username-setup-input').focus();
}
handleDialog.addEventListener('cancel',e=>{if(owner() && needsUsername(ownProfile))e.preventDefault();});
handleDialog.addEventListener('click',e=>{if(e.target===handleDialog && owner() && needsUsername(ownProfile)) e.preventDefault();});
document.getElementById('username-setup-input').addEventListener('input',e=>{
 const start=e.target.selectionStart;
 e.target.value=e.target.value.replace(/[^A-Za-z0-9_]/g,'');
 if(start!==null) e.target.setSelectionRange(Math.min(start,e.target.value.length),Math.min(start,e.target.value.length));
});
document.getElementById('username-setup-form').addEventListener('submit',async e=>{
 e.preventDefault();
 if(!owner())return;
 const username=document.getElementById('username-setup-input').value.trim();
 const err=document.getElementById('username-setup-error');
 err.hidden=true;
 if(!/^[A-Za-z][A-Za-z0-9_]{2,31}$/.test(username)){
  err.textContent='Use 3–32 letters (uppercase allowed), numbers, or underscores, starting with a letter.';
  err.hidden=false;return;
 }
 const button=document.getElementById('username-setup-save');
 button.disabled=true;
 try{
  const result=await state.supabase.from('profiles').update({username}).eq('id',state.user.id).select('id,username,display_name,banner_path,avatar_path,banner_desktop_x,banner_desktop_y,banner_desktop_zoom,banner_mobile_x,banner_mobile_y,banner_mobile_zoom').single();
  if(result.error)throw result.error;
  ownProfile=result.data;
  handleCheckId=state.user.id;
  if(handleDialog.open)handleDialog.close();
  document.getElementById('profile-handle').value=username;
  note('profile-error','Your public username is now @'+username+'.');
  if(panel==='profile')drawMyBanner();
  toast('Your public username is @'+username);
 }catch(error){
  err.textContent=error.code==='23505'?'That username is already taken. Choose another.':'Could not save your username: '+(error.message||'Please retry.');
  err.hidden=false;
 }finally{button.disabled=false;}
});
async function checkUsernameSetup(){
 if(!owner())return;
 const id=state.user.id;
 if(handleCheckId===id || handleCheckRunning)return;
 handleCheckRunning=true;
 try{
  const result=await state.supabase.from('profiles').select('id,username,display_name,banner_path,avatar_path,banner_desktop_x,banner_desktop_y,banner_desktop_zoom,banner_mobile_x,banner_mobile_y,banner_mobile_zoom').eq('id',id).maybeSingle();
  if(result.error)throw result.error;
  if(!result.data)return;
  if(state.user?.id!==id)return;
  ownProfile=result.data;
  currentProfileOwner=id;
  handleCheckId=id;
  askForUsername(result.data);
 }catch(error){console.warn('Unable to check public username',error);}
 finally{handleCheckRunning=false;}
}

const col=document.querySelector('.collection-section'), main=document.querySelector('.main-content');
if(!col||!main)return;
col.before(social);col.after(friendView);
const owner=()=>Boolean(state.supabase&&state.user&&!state.demo);
const lastArt=arr=>[...arr].sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''))).find(x=>cleanedUrl(x.image_url))?.image_url||'';
function putImage(id,url){const img=$s(id),safe=cleanedUrl(url);if(!img)return;img.hidden=!safe;if(safe)img.src=safe;else img.removeAttribute('src');}

/* Custom banner framing: independently positioned for phone and desktop, stored per owner. */
const bannerDefaults={banner_desktop_x:50,banner_desktop_y:50,banner_desktop_zoom:1,banner_mobile_x:50,banner_mobile_y:50,banner_mobile_zoom:1};
let bannerDraft={...bannerDefaults},bannerPendingUrl='';
const bannerClamp=(val,min,max,fallback)=>Math.max(min,Math.min(max,Number.isFinite(Number(val))?Number(val):fallback));
function bannerFrame(profile) {
 const out={};
 for(const mode of ['desktop','mobile']){
  out['banner_'+mode+'_x']=Math.round(bannerClamp(profile?.['banner_'+mode+'_x'],0,100,50));
  out['banner_'+mode+'_y']=Math.round(bannerClamp(profile?.['banner_'+mode+'_y'],0,100,50));
  out['banner_'+mode+'_zoom']=Math.round(bannerClamp(profile?.['banner_'+mode+'_zoom'],1,3,1)*100)/100;
 }
 return out;
}
function activeBannerMode(){return window.matchMedia('(max-width: 580px)').matches?'mobile':'desktop';}
function positionBanner(img,profile,mode){
 if(!img)return;
 const f=bannerFrame(profile),which=mode||activeBannerMode();
 const x=f['banner_'+which+'_x'],y=f['banner_'+which+'_y'],zoom=f['banner_'+which+'_zoom'];
 img.style.objectPosition=x+'% '+y+'%';
 img.style.transformOrigin=x+'% '+y+'%';
 img.style.transform='scale('+zoom+')';
}
function frameBannerAt(id,profile,mode){positionBanner($s(id),profile,mode);}
function repaintBanners(){
 frameBannerAt('hero-banner-image',ownProfile);
 frameBannerAt('profile-banner',ownProfile);
 frameBannerAt('friend-banner',friendProfile);
}
function resetBannerObjectUrl(){if(bannerPendingUrl){URL.revokeObjectURL(bannerPendingUrl);bannerPendingUrl='';}}
function previewBannerSrc(){return bannerPendingUrl||ownBanner||lastArt(state.entries);}

let bannerPreviewPlacement='home';
function bannerPreviewSize(mode){
 const isHome=bannerPreviewPlacement==='home';
 return mode==='desktop'
   ?{width:1140,height:isHome?278:210}
   :{width:354,height:isHome?230:200};
}
function scaleBannerPreviews(){
 for(const mode of ['desktop','mobile']){
  const stage=$s('nr-banner-stage-'+mode);
  if(!stage)continue;
  const {width,height}=bannerPreviewSize(mode);
  stage.style.aspectRatio=width+'/'+height;
  stage.style.setProperty('--nr-source-width',width+'px');
  stage.style.setProperty('--nr-source-height',height+'px');
  if(stage.clientWidth>0)stage.style.setProperty('--nr-preview-scale',String(stage.clientWidth/width));
 }
}
function rebuildBannerPreviews(){
 const source=bannerPreviewPlacement==='profile'
  ?$s('profile-banner')?.closest('.social-hero')
  :document.querySelector('.main-content>.hero');
 if(!source)return;
 for(const mode of ['desktop','mobile']){
  const viewport=$s('nr-banner-viewport-'+mode);
  if(!viewport)continue;
  const sample=source.cloneNode(true);
  sample.hidden=false;
  sample.removeAttribute('hidden');
  sample.classList.add('nr-banner-simulation');
  sample.setAttribute('aria-hidden','true');
  const sampleImage=bannerPreviewPlacement==='profile'
   ?sample.querySelector('img')
   :sample.querySelector('.hero-banner-image');
  sample.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
  sample.querySelectorAll('button').forEach(button=>{button.disabled=true;button.tabIndex=-1});
  sample.querySelectorAll('a').forEach(link=>link.removeAttribute('href'));
  if(sampleImage){sampleImage.id='nr-banner-preview-'+mode;sampleImage.hidden=false;}
  viewport.replaceChildren(sample);
  const stage=$s('nr-banner-stage-'+mode);
  if(stage){stage.dataset.placement=bannerPreviewPlacement;}
 }
 scaleBannerPreviews();
}

function updateBannerEditor(){
 const url=bannerPendingUrl||cleanedUrl(ownBanner||lastArt(state.entries));
 for(const mode of ['desktop','mobile']){
  const img=$s('nr-banner-preview-'+mode),frame=bannerFrame(bannerDraft);
  if(!img)continue;
  if(url){if(img.src!==url)img.src=url;img.hidden=false;}else{img.removeAttribute('src');img.hidden=true;}
  positionBanner(img,frame,mode);
  scaleBannerPreviews();
  for(const axis of ['x','y','zoom']){
   const val=frame['banner_'+mode+'_'+axis];
   const input=$s('nr-banner-'+mode+'-'+axis);
   if(input)input.value=String(axis==='zoom'?Math.round(val*100):val);
   const output=$s('nr-banner-'+mode+'-'+axis+'-value');
   if(output)output.textContent=axis==='zoom'?Math.round(val*100)+'%':val+'%';
  }
 }
}
function initializeBannerEditor(){
 const fileInput=$s('profile-image-file');
 if(!fileInput || $s('nr-banner-editor'))return;
 const editor=document.createElement('section');
 editor.id='nr-banner-editor';editor.className='nr-banner-editor';
 editor.innerHTML='<h3>Position your banner</h3><p>Position the artwork while viewing Nightreel’s real home or profile banner layouts. Desktop and phone framing is saved independently.</p>'+
  '<div class="nr-banner-preview-mode"><label for="nr-banner-preview-placement">Preview placement</label><select id="nr-banner-preview-placement"><option value="home">Home · Stay Obsessed banner</option><option value="profile">Public profile banner</option></select></div>'+
  '<div class="nr-banner-previews">'+['desktop','mobile'].map(mode=>
   '<fieldset class="nr-banner-panel nr-banner-panel-'+mode+'"><legend>'+(mode==='desktop'?'Desktop preview · 1440px screen':'Phone preview · 390px screen')+'</legend>'+
   '<div class="nr-banner-stage nr-banner-stage-'+mode+'" id="nr-banner-stage-'+mode+'" data-banner-stage="'+mode+'" aria-label="'+mode+' banner; drag to reposition">'+
   '<div class="nr-banner-viewport" id="nr-banner-viewport-'+mode+'"></div></div>'+
   '<label>Zoom <output id="nr-banner-'+mode+'-zoom-value">100%</output><input type="range" id="nr-banner-'+mode+'-zoom" min="100" max="300" step="5" value="100"></label>'+
   '<label>Left / right <output id="nr-banner-'+mode+'-x-value">50%</output><input type="range" id="nr-banner-'+mode+'-x" min="0" max="100" step="1" value="50"></label>'+
   '<label>Up / down <output id="nr-banner-'+mode+'-y-value">50%</output><input type="range" id="nr-banner-'+mode+'-y" min="0" max="100" step="1" value="50"></label>'+
   '<button type="button" data-banner-reset="'+mode+'" class="nr-banner-reset">Reset '+mode+' position</button></fieldset>'
  ).join('')+'</div><p class="nr-banner-hint">Preview changes are saved with <strong>Save profile</strong>. Friends see your chosen layout on their screen size.</p>';
 fileInput.closest('label').after(editor);
 const placement=$s('nr-banner-preview-placement');
 placement.addEventListener('change',()=>{
  bannerPreviewPlacement=placement.value;
  rebuildBannerPreviews();
  updateBannerEditor();
 });
 rebuildBannerPreviews();
 if(typeof ResizeObserver==='function'){
  const observer=new ResizeObserver(scaleBannerPreviews);
  for(const mode of ['desktop','mobile'])observer.observe($s('nr-banner-stage-'+mode));
 }
 window.addEventListener('resize',scaleBannerPreviews);
 for(const mode of ['desktop','mobile']){
  for(const axis of ['zoom','x','y']){
   $s('nr-banner-'+mode+'-'+axis).addEventListener('input',e=>{
    bannerDraft['banner_'+mode+'_'+axis]=axis==='zoom'?Number(e.target.value)/100:Number(e.target.value);
    updateBannerEditor();
   });
  }
 }
 editor.addEventListener('click',e=>{
  const reset=e.target.closest('[data-banner-reset]');if(!reset)return;
  const mode=reset.dataset.bannerReset;
  for(const axis of ['x','y','zoom'])bannerDraft['banner_'+mode+'_'+axis]=bannerDefaults['banner_'+mode+'_'+axis];
  updateBannerEditor();
 });
 for(const stage of editor.querySelectorAll('[data-banner-stage]')){
  const mode=stage.dataset.bannerStage;
  let start=null;
  stage.addEventListener('pointerdown',e=>{
   if(e.button!==0 || !owner())return;
   start={x:e.clientX,y:e.clientY,left:bannerDraft['banner_'+mode+'_x'],top:bannerDraft['banner_'+mode+'_y']};
   stage.setPointerCapture(e.pointerId);
   e.preventDefault();
  });
  stage.addEventListener('pointermove',e=>{
   if(!start || !stage.hasPointerCapture(e.pointerId))return;
   const rect=stage.getBoundingClientRect();
   const zoom=bannerDraft['banner_'+mode+'_zoom']||1;
   bannerDraft['banner_'+mode+'_x']=bannerClamp(start.left-(e.clientX-start.x)*100/(rect.width*zoom),0,100,50);
   bannerDraft['banner_'+mode+'_y']=bannerClamp(start.top-(e.clientY-start.y)*100/(rect.height*zoom),0,100,50);
   updateBannerEditor();
  });
  for(const evt of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(evt,()=>{start=null;});
 }
 fileInput.addEventListener('change',()=>{
  resetBannerObjectUrl();
  const file=fileInput.files?.[0];
  if(file && ['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size<=4194304)
   bannerPendingUrl=URL.createObjectURL(file);
  updateBannerEditor();
 });
 updateBannerEditor();
}
window.addEventListener('resize',repaintBanners);
window.addEventListener('pagehide',resetBannerObjectUrl);

function drawHero(){
 if(owner() && (!handleCheckId || handleCheckId!==state.user.id))checkUsernameSetup();
 const account=state.user?.id||'';
 if(account!==displayedAccount){displayedAccount=account;ownProfile=null;ownBanner='';currentProfileOwner='';handleCheckId='';if(handleDialog.open)handleDialog.close();}
 putImage('hero-banner-image',ownBanner||lastArt(state.entries));frameBannerAt('hero-banner-image',ownProfile);
 if(owner() && (!ownProfile || currentProfileOwner!==state.user.id) && !loadingProfile){
  loadingProfile=true;
  state.supabase.from('profiles').select('id,username,display_name,banner_path,avatar_path,banner_desktop_x,banner_desktop_y,banner_desktop_zoom,banner_mobile_x,banner_mobile_y,banner_mobile_zoom').eq('id',state.user.id).maybeSingle().then(async r=>{
   if(!r.error && r.data && state.user?.id===r.data.id){
    ownProfile=r.data;currentProfileOwner=r.data.id;
    ownBanner=await getSignedBanner(ownProfile);
    putImage('hero-banner-image',ownBanner||lastArt(state.entries));frameBannerAt('hero-banner-image',ownProfile);
   }
  }).finally(()=>{loadingProfile=false;});
 }
}
function note(id,msg){$s(id).textContent=msg;}
function need(id){if(owner())return true;note(id,'Connect Nightreel to a Supabase project to use accounts and friends.');return false;}
function buildCard(e,index,readOnly){
 const title=esc(e.title),id=esc(e.id),rating=Number(e.rating)||0,watched=e.episodes_watched||0;
 const isRegular=!e.catalog_format||['TV','TV_SHORT','ONA'].includes(String(e.catalog_format).toUpperCase());
 const catalogCount=Number(e.catalog_episode_total)||0,savedCount=Number(e.episodes_total)||0;
 const total=isRegular?(catalogCount && (!savedCount||catalogCount>=savedCount-2)?catalogCount:(savedCount||catalogCount||null)):null;
 const movieMinutes=Number(e.movie_runtime_minutes)||0;
 const progress=e.is_movie?('Movie'+(movieMinutes>0?' · '+movieMinutes+' min':'')+
   (e.status==='completed'?' · Watched':'')):
  !isRegular?String(e.catalog_format).replace(/_/g,' ')+' · excluded from episode totals':
  total&&watched>total?total+' / '+total+' regular episodes · '+watched+' watched saved':
  total?watched+' / '+total+' episodes':watched+' episodes watched';
 const percent=e.is_movie?(e.status==='completed'?100:0):
  !isRegular?0:total?Math.min(100,Math.round(100*watched/total)):(e.status==='completed'?100:0);
 const pic=cleanedUrl(e.image_url)?'<img class="card-image" loading="lazy" src="'+esc(cleanedUrl(e.image_url))+'" alt="">':'';
 const stars=[1,2,3,4,5].map(n=>'<button type="button" '+(readOnly?'disabled':'data-action="rate" data-id="'+id+'" data-rating="'+(n*2)+'"')+' class="'+(rating&&n<=Math.floor(rating/2)?'rated':rating&&n===Math.ceil(rating/2)?'half-rated':'unrated')+'" title="'+(readOnly?'Rating':'Rate '+n+' stars')+'">★</button>').join('');
 const synopsis=esc(e.synopsis||summaries.get(canonicalTitle(e.title))||'Tap here to load a story summary, or follow the IMDb link.');
 const publicNote=readOnly
  ? '<section class="nr-public-note"><strong>Public note</strong><p>'+(e.public_notes?esc(e.public_notes):'No public note added yet.')+'</p></section>'
  : '<section class="nr-public-note nr-note-editor"><label for="nr-note-'+id+'">Public note <small>Visible to accepted friends</small></label><textarea id="nr-note-'+id+'" data-public-note maxlength="5000" rows="3" placeholder="Share your thoughts with friends…">'+esc(e.public_notes||'')+'</textarea><button type="button" data-action="save-public-note" data-id="'+id+'">Save public note</button></section>';
 return '<article class="anime-card" data-card-id="'+id+'"><div class="flip-inner">'+
 '<div class="flip-face front">'+pic+'<div class="flip-top">'+(readOnly
  ? '<span class="status-pill">'+esc(statuses[e.status]||'Not sorted yet')+'</span>'
  : '<select class="nr-status-select status-pill" data-action="quick-status" data-id="'+id+'" aria-label="Change watch status of '+title+'" title="Change watch status without opening Edit">'+Object.entries(statuses).map(([value,text])=>'<option value="'+value+'"'+(e.status===value?' selected':'')+'>'+esc(text)+'</option>').join('')+'</select>')+
 (readOnly?'':'<button type="button" class="favorite-icon '+(e.favorite?'active':'')+'" data-action="favorite" data-id="'+id+'" aria-label="Toggle favorite"><span class="nr-heart-glyph" aria-hidden="true">♥</span></button>')+'</div>'+
 '<div class="flip-body">'+(e.public_notes?'<span class="nr-note-indicator">✎ Public note</span>':'')+'<h3>'+title+'</h3>'+
 '<div class="flip-rating">'+stars+'<span class="rating-text">'+(rating?(rating/2)+'/5':'Not rated')+'</span></div>'+
 '<div class="flip-progress">'+esc(progress)+'<div class="progress-track"><div class="progress-fill" style="width:'+percent+'%"></div></div></div>'+
 '<div class="flip-actions">'+(readOnly?'':'<button type="button" data-action="edit" data-id="'+id+'">Edit</button>')+
 '<button type="button" data-action="flip">Story ↻</button><a href="'+esc(imdbLink(e))+'" target="_blank" rel="noopener noreferrer">IMDb ↗</a></div></div></div>'+
 '<div class="flip-face back">'+pic+'<div class="flip-back-content">'+(originalByTitle.has(canonicalTitle(e.title))?'<span class="nr-original-art-credit">Your original artwork</span>':'')+'<span class="synopsis-heading">ABOUT THIS ANIME</span><h3>'+title+'</h3>'+
 '<p class="synopsis">'+synopsis+'</p>'+publicNote+
 '<div class="back-actions"><button type="button" data-action="flip">↶ Flip back</button><a href="'+esc(imdbLink(e))+'" target="_blank" rel="noopener noreferrer">IMDb ↗</a></div></div></div></div></article>';
}
cardHtml=(e,i)=>buildCard(e,i,false);
const nrStatusOrder=[
 ['untracked','Not sorted yet'],
 ['watching','Currently watching'],
 ['plan_to_watch','Plan to watch'],
 ['on_hold','On hold'],
 ['dropped','Dropped'],
 ['completed','Completed']
];
function rankFavorites(entries){
 return [...entries].sort((a,b)=>{
  const ar=Number.isInteger(a.favorite_rank)&&a.favorite_rank>0?a.favorite_rank:Infinity;
  const br=Number.isInteger(b.favorite_rank)&&b.favorite_rank>0?b.favorite_rank:Infinity;
  return ar-br||a.title.localeCompare(b.title);
 });
}
function spotlightMarkup(items,readOnly){
 if(!items.length)return '';
 const primary=items[0];
 const topFour=items.slice(1,5);
 const rankCard=(entry,rank)=>
  '<div class="nr-ranked-favorite nr-rank-'+rank+'">'+
  '<div class="nr-rank-heading"><span>#'+String(rank).padStart(2,'0')+'</span><small>'+
  (rank===1?(readOnly?'ALL-TIME #1':'YOUR ALL-TIME #1'):'TOP FIVE FAVORITE')+'</small></div>'+
  buildCard(entry,rank-1,readOnly)+
  (rank===1?'':'<button type="button" class="nr-favorite-mobile-toggle" data-favorite-expand aria-expanded="false" aria-label="Expand details for '+esc(entry.title)+'">View details <span aria-hidden="true">⌄</span></button>')+
  '</div>';
 return '<section class="nr-library-section nr-featured-section" data-library-section="featured">'+
  '<div class="nr-section-heading"><div><span class="nr-section-eyebrow">'+(readOnly?'✦ ALL-TIME TOP FIVE':'✦ YOUR ALL-TIME TOP FIVE')+'</span>'+
  '<h3>Favorite anime <small>'+items.length+'</small></h3></div>'+
  (readOnly?'':'<button type="button" data-manage-favorites class="nr-manage-favorites">↕ Rank favorites</button>')+
  '</div>'+
  (!items.some(e=>Number.isInteger(e.favorite_rank)&&e.favorite_rank>0) && !readOnly
   ? '<p class="nr-rank-tip">Shown alphabetically until you choose your personal order. Make your #1 the centerpiece.</p>':'')+
  '<div class="nr-featured-layout">'+
  '<div class="nr-primary-spotlight">'+rankCard(primary,1)+'</div>'+
  (topFour.length?'<div class="nr-supporting-spotlight">'+topFour.map((e,i)=>rankCard(e,i+2)).join('')+'</div>':'')+
  '</div></section>';
}
function organizedMarkup(entries,readOnly){
 const sections=[];
 const favorites=rankFavorites(entries.filter(e=>e.favorite));
 const normal=favorites.slice(5);
 const regular=entries.filter(e=>!e.favorite);
 const output=[];
 if(favorites.length)output.push(spotlightMarkup(favorites,readOnly));
 if(normal.length)sections.push({key:'other-favorites',name:'More favorites',items:normal,eyebrow:'♥ STILL LOVED'});
 for(const [key,name] of nrStatusOrder){
  if(key==='completed'){
   const films=regular.filter(e=>e.is_movie);
   if(films.length)sections.push({key:'movies',name:'Movies',items:films,eyebrow:'FEATURE FILMS'});
  }
  const items=regular.filter(e=>!e.is_movie && e.status===key);
  if(items.length)sections.push({key,name,items});
 }
 output.push(...sections.map(section=>
  '<section class="nr-library-section" data-library-section="'+section.key+'">'+
  '<div class="nr-section-heading"><div><span class="nr-section-eyebrow">'+(section.eyebrow||'WATCH STATUS')+'</span>'+
  '<h3>'+section.name+' <small>'+section.items.length+'</small></h3></div></div>'+
  '<div class="anime-grid nr-section-grid">'+section.items.map((entry,i)=>
    section.key==='other-favorites'
      ? '<div class="nr-more-ranked"><span class="nr-more-ranked-number">#'+String(i+6).padStart(2,'0')+'</span>'+buildCard(entry,i,readOnly)+'</div>'
      : buildCard(entry,i,readOnly)).join('')+'</div></section>'
 ));
 return output.join('');
}
function displayOrganizedLibrary(){
 const grid=$s('anime-grid');
 const grouped=(state.filter==='all'||state.filter==='favorites')&&!state.search.trim();
 grid.classList.toggle('nr-grouped-library',grouped);
 if(grouped)grid.innerHTML=organizedMarkup(filteredEntries(),false);
}
const rankDialog=document.createElement('dialog');
rankDialog.id='nr-rank-dialog';rankDialog.className='nr-rank-dialog';
rankDialog.innerHTML='<div class="nr-rank-dialog-content">'+
 '<div class="nr-rank-dialog-head"><div><span class="nr-section-eyebrow">YOUR PERSONAL ORDER</span>'+
 '<h2>Rank your favorites.</h2></div><button type="button" data-rank-cancel aria-label="Close ranking editor">×</button></div>'+
 '<p>Put your most-loved anime at #1. The first five receive the spotlight. Every favorite below them stays in More Favorites.</p>'+
 '<div id="nr-rank-list" class="nr-rank-list"></div>'+
 '<p id="nr-rank-error" class="nr-rank-error" role="status"></p>'+
 '<div class="nr-rank-dialog-buttons"><button type="button" data-rank-cancel>Cancel</button>'+
 '<button type="button" id="nr-save-rank" class="nr-rank-save">Save my ranking</button></div></div>';
document.body.append(rankDialog);
let rankDraft=[];
function showRankRows(){
 const holder=$s('nr-rank-list');holder.replaceChildren();
 const count=rankDraft.length;
 rankDraft.forEach((entry,index)=>{
  const row=document.createElement('div');row.className='nr-rank-row';
  const position=document.createElement('span');position.className='nr-rank-number';
  position.textContent=String(index+1).padStart(2,'0');
  const img=document.createElement('img');img.className='nr-rank-thumb';img.alt='';img.loading='lazy';
  const image=cleanedUrl(entry.image_url);if(image)img.src=image;else img.hidden=true;
  const title=document.createElement('span');title.className='nr-rank-title';title.textContent=entry.title;
  const controls=document.createElement('div');controls.className='nr-rank-controls';
  const select=document.createElement('select');select.dataset.rankPosition=entry.id;
  select.setAttribute('aria-label','Rank '+entry.title);
  for(let pos=1;pos<=count;pos++)select.append(new Option('#'+pos,String(pos)));
  select.value=String(index+1);
  const up=document.createElement('button');up.type='button';up.textContent='↑';
  up.dataset.rankMove='up';up.dataset.rankId=entry.id;up.disabled=index===0;up.setAttribute('aria-label','Move '+entry.title+' up');
  const down=document.createElement('button');down.type='button';down.textContent='↓';
  down.dataset.rankMove='down';down.dataset.rankId=entry.id;down.disabled=index===count-1;down.setAttribute('aria-label','Move '+entry.title+' down');
  const first=document.createElement('button');first.type='button';first.textContent='Make #1';first.dataset.rankMove='first';first.dataset.rankId=entry.id;
  first.disabled=index===0;
  controls.append(select,up,down,first);
  row.append(position,img,title,controls);holder.append(row);
 });
}
function moveFavorite(entryId,toPosition){
 const from=rankDraft.findIndex(item=>String(item.id)===String(entryId));
 if(from<0)return;
 const to=Math.max(0,Math.min(rankDraft.length-1,toPosition));
 if(from===to)return;
 const [item]=rankDraft.splice(from,1);
 rankDraft.splice(to,0,item);
 showRankRows();
}
function openRanking(){
 if(!state.demo&&!owner())return toast('Sign in to rank favorites.');
 rankDraft=rankFavorites(state.entries.filter(e=>e.favorite));
 if(!rankDraft.length)return toast('Heart a few anime to create your Top Five.');
 $s('nr-rank-error').textContent='';
 showRankRows();
 if(!rankDialog.open)rankDialog.showModal();
}
rankDialog.addEventListener('click',event=>{
 if(event.target.closest('[data-rank-cancel]')){rankDialog.close();return;}
 const button=event.target.closest('[data-rank-move]');if(!button)return;
 const from=rankDraft.findIndex(e=>String(e.id)===button.dataset.rankId);
 if(from<0)return;
 const action=button.dataset.rankMove;
 moveFavorite(button.dataset.rankId,action==='first'?0:from+(action==='up'?-1:1));
});
rankDialog.addEventListener('change',event=>{
 const select=event.target.closest('[data-rank-position]');
 if(select)moveFavorite(select.dataset.rankPosition,Number(select.value)-1);
});
$s('nr-save-rank').addEventListener('click',async()=>{
 const saveButton=$s('nr-save-rank');if(saveButton.disabled)return;
 const order=rankDraft.map(e=>e.id);
 saveButton.disabled=true;$s('nr-rank-error').textContent='';
 try{
  if(!state.demo){
   const result=await state.supabase.rpc('rank_my_favorites',{p_order:order});
   if(result.error)throw result.error;
   if(Number(result.data)!==order.length)throw Error('The favorites list changed. Refresh and retry.');
  }
  rankDraft.forEach((e,i)=>{
   const current=state.entries.find(item=>String(item.id)===String(e.id));
   if(current)current.favorite_rank=i+1;
  });
  if(state.demo)storeDemo();
  rankDialog.close();render();toast('Your Top Five ranking is saved ♥');
 }catch(error){$s('nr-rank-error').textContent='Could not save ranking: '+error.message;}
 finally{saveButton.disabled=false;}
});
$s('anime-grid').addEventListener('click',event=>{
 if(event.target.closest('[data-manage-favorites]')){
  event.preventDefault();event.stopImmediatePropagation();openRanking();
 }
},true);

render=function(){sourceRender();displayOrganizedLibrary();drawHero();if(panel==='profile')drawMyBanner();};
state.sort='title';$s('sort-select').value='title';render();
function flip(card,e){
 card.classList.toggle('is-flipped');
 if(card.classList.contains('is-flipped')&&!e?.synopsis)lookupSynopsis(card,e);
}
async function lookupSynopsis(card,e){
 const target=card.querySelector('.synopsis'),key=canonicalTitle(e?.title||'');
 if(!target||!e)return;
 const cached=summaries.get(key);
 if(cached){target.textContent=cached;return;}
 if(e.synopsis){target.textContent=e.synopsis;return;}
 target.textContent='Finding a verified story summary…';
 try{
  let info=null;
  if(window.NightreelReleaseCatalog?.refreshEntry && state.user && !state.demo){
   // Fetches via the authenticated Nightreel catalogue proxy, with AniList fallback.
   // Saves the synopsis and release details without modifying any personal tracking fields.
   info=await window.NightreelReleaseCatalog.refreshEntry(e,true);
  }else{
   // Local preview fallback. Live accounts use the server-side catalogue.
   const response=await fetch('https://api.jikan.moe/v4/anime?q='+encodeURIComponent(e.title)+'&limit=10');
   if(!response.ok)throw new Error('Catalogue unavailable');
   const data=await response.json(),all=Array.isArray(data.data)?data.data:[];
   const match=all.find(x=>canonicalTitle(x.title)===key||canonicalTitle(x.title_english)===key||
     (Array.isArray(x.title_synonyms)&&x.title_synonyms.some(n=>canonicalTitle(n)===key)));
   if(!match)throw new Error('No confident title match');
   info={synopsis:match.synopsis};
  }
  const description=String(info?.synopsis||e.synopsis||'').trim();
  if(!description)throw new Error('No synopsis published for this anime yet');
  summaries.set(key,description);
  if(!e.synopsis)e.synopsis=description;
  if(target.isConnected)target.textContent=description;
 }catch(error){
  if(target.isConnected)target.textContent='No story description is available right now. Try “Story” again later, or open the IMDb link. ('+String(error?.message||'Lookup failed').slice(0,100)+')';
 }
}

async function rate(e,n){
 if(!e||state.busy)return;
 state.busy=true;
 try{
  if(!state.demo){const r=await state.supabase.from('anime_entries').update({rating:n}).eq('id',e.id);if(r.error)throw r.error;}
  e.rating=n;e.updated_at=new Date().toISOString();if(state.demo)storeDemo();render();toast('Rating: '+(n/2)+'/5');
 }catch(err){toast('Rating not saved: '+err.message);}
 finally{state.busy=false;}
}
function setMobileFavoriteExpanded(wrapper,expanded){
 if(!wrapper)return;
 // Keep only one supporting favorite expanded at a time.
 const grid=wrapper.closest('.nr-supporting-spotlight');
 if(expanded&&grid)for(const other of grid.querySelectorAll('.nr-ranked-favorite.is-expanded')){
  if(other!==wrapper)setMobileFavoriteExpanded(other,false);
 }
 wrapper.classList.toggle('is-expanded',expanded);
 const button=wrapper.querySelector('[data-favorite-expand]');
 if(button){
  button.setAttribute('aria-expanded',String(expanded));
  button.innerHTML=expanded?'Show less <span aria-hidden="true">⌃</span>':'View details <span aria-hidden="true">⌄</span>';
  const card=wrapper.querySelector('.anime-card');
  const title=card?.querySelector('.flip-body h3')?.textContent||'favorite';
  button.setAttribute('aria-label',(expanded?'Collapse':'Expand')+' details for '+title);
 }
 if(!expanded)wrapper.querySelector('.anime-card')?.classList.remove('is-flipped');
}
function favoriteToggleClick(event){
 const button=event.target.closest('[data-favorite-expand]');
 if(!button)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 const wrapper=button.closest('.nr-ranked-favorite');
 setMobileFavoriteExpanded(wrapper,!wrapper?.classList.contains('is-expanded'));
}
async function cardClick(ev,readOnly){
 const card=ev.target.closest('.anime-card');if(!card)return;
 const compact=card.closest('.nr-supporting-spotlight .nr-ranked-favorite');
 if(compact&&window.matchMedia('(max-width:580px)').matches&&!compact.classList.contains('is-expanded')){
  // The first tap opens the full card instead of flipping an unreadably small tile.
  ev.preventDefault();ev.stopImmediatePropagation();
  setMobileFavoriteExpanded(compact,true);
  return;
 }
 const e=(readOnly?friendItems:state.entries).find(x=>String(x.id)===card.dataset.cardId);
 const action=ev.target.closest('[data-action]');
 if(action?.dataset.action==='flip'){ev.stopImmediatePropagation();flip(card,e);}
 else if(!readOnly&&action?.dataset.action==='rate'){ev.stopImmediatePropagation();await rate(e,Number(action.dataset.rating));}
 else if(!ev.target.closest('button,a,input,select,textarea'))flip(card,e);
}
async function saveQuickStatus(event){
 const select=event.target.closest('[data-action="quick-status"]');
 if(!select||state.busy)return;
 const entry=state.entries.find(e=>String(e.id)===select.dataset.id);
 if(!entry||!Object.prototype.hasOwnProperty.call(statuses,select.value))return;
 if(entry.status===select.value)return;
 const previous=entry.status,next=select.value;
 state.busy=true;select.disabled=true;
 try{
  if(!state.demo){
   const r=await state.supabase.from('anime_entries').update({status:next}).eq('id',entry.id);
   if(r.error)throw r.error;
  }
  entry.status=next;entry.updated_at=new Date().toISOString();
  if(state.demo)storeDemo();
  render();toast('Moved to '+statuses[next]+'.');
 }catch(error){entry.status=previous;render();toast('Status not saved: '+error.message);}
 finally{state.busy=false;}
}
async function savePublicNote(event){
 const button=event.target.closest('[data-action="save-public-note"]');
 if(!button||state.busy)return;
 const card=button.closest('.anime-card');
 const entry=state.entries.find(e=>String(e.id)===button.dataset.id);
 const textarea=card?.querySelector('[data-public-note]');
 if(!entry||!textarea)return;
 const text=textarea.value.trim().slice(0,5000);
 state.busy=true;button.disabled=true;
 try{
  if(!state.demo){
   const r=await state.supabase.from('anime_entries').update({public_notes:text}).eq('id',entry.id);
   if(r.error)throw r.error;
  }
  entry.public_notes=text;entry.updated_at=new Date().toISOString();
  if(state.demo)storeDemo();
  render();
  const cards=Array.from($s('anime-grid').querySelectorAll('.anime-card'));
  const restored=cards.find(node=>node.dataset.cardId===String(entry.id));
  restored?.classList.add('is-flipped');
  toast(text?'Public note saved for accepted friends.':'Public note cleared.');
 }catch(error){button.disabled=false;toast('Note was not saved: '+error.message);}
 finally{state.busy=false;}
}
$s('anime-grid').addEventListener('change',saveQuickStatus,true);
$s('anime-grid').addEventListener('click',savePublicNote,true);
$s('anime-grid').addEventListener('click',favoriteToggleClick,true);
$s('friend-grid').addEventListener('click',favoriteToggleClick,true);
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
  const r=await state.supabase.from('profiles').select('id,username,display_name,banner_path,avatar_path,banner_desktop_x,banner_desktop_y,banner_desktop_zoom,banner_mobile_x,banner_mobile_y,banner_mobile_zoom').eq('id',state.user.id).maybeSingle();
  if(r.error)throw r.error;
  ownProfile=r.data;
  if(!ownProfile)throw Error('No profile exists. Run the social database migration.');
  askForUsername(ownProfile);
  $s('profile-handle').value=ownProfile.username;
  $s('profile-display').value=ownProfile.display_name;
  ownBanner=await getSignedBanner(ownProfile);
  currentProfileOwner=ownProfile.id;
  bannerDraft=bannerFrame(ownProfile);updateBannerEditor();
  drawMyBanner();drawHero();
  refreshAccountAvatar();
  note('profile-error','Only accepted friends can see your profile.');
 }catch(err){note('profile-error','Profile unavailable: '+err.message);}
}
function drawMyBanner(){
 $s('profile-name').textContent=ownProfile?.display_name||'Anime fan';
 refreshAccountAvatar();
 putImage('profile-banner',ownBanner||lastArt(state.entries));frameBannerAt('profile-banner',ownProfile);
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
 const username=$s('profile-handle').value.trim(),display_name=$s('profile-display').value.trim();
 if(!/^[A-Za-z][A-Za-z0-9_]{2,31}$/.test(username)||!display_name||display_name.length>60){note('profile-error','Invalid username or display name.');return;}
 const file=$s('profile-image-file').files?.[0];
 const avatarFile=$s('profile-avatar-file').files?.[0];
 if(avatarFile && (!['image/png','image/jpeg','image/webp'].includes(avatarFile.type)||avatarFile.size>2097152)){note('profile-error','Profile picture must be JPG, PNG or WebP and under 2 MB.');return;}
 if(file && (!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>4194304)){note('profile-error','Choose a JPG, PNG or WebP under 4 MB.');return;}
 try{
  let banner_path=ownProfile?.banner_path||null;
  let avatar_path=ownProfile?.avatar_path||null;
  if(avatarFile){
   const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[avatarFile.type];
   avatar_path=state.user.id+'/'+newLocalId()+'.'+ext;
   const uploaded=await state.supabase.storage.from('nightreel-avatars').upload(avatar_path,avatarFile,{upsert:false,contentType:avatarFile.type});
   if(uploaded.error)throw uploaded.error;
  }
  if(file){
   const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];
   banner_path=state.user.id+'/'+newLocalId()+'.'+ext;
   const uploaded=await state.supabase.storage.from('nightreel-banners').upload(banner_path,file,{upsert:false,contentType:file.type});
   if(uploaded.error)throw uploaded.error;
  }
  const r=await state.supabase.from('profiles').update({username,display_name,banner_path,avatar_path,...bannerFrame(bannerDraft)}).eq('id',state.user.id);
  if(r.error)throw r.error;
  ownProfile={...ownProfile,username,display_name,banner_path,avatar_path,...bannerFrame(bannerDraft)};
  ownBanner=await getSignedBanner(ownProfile);
  drawMyBanner();drawHero();resetBannerObjectUrl();updateBannerEditor();$s('profile-image-file').value='';$s('profile-avatar-file').value='';refreshAccountAvatar();note('profile-error','Profile saved.');
 }catch(e){note('profile-error', e.code==='23505'?'That username is already taken. Please choose another.':'Save failed: '+e.message);}
});
$s('remove-banner').onclick=async()=>{
 if(!need('profile-error'))return;
 const r=await state.supabase.from('profiles').update({banner_path:null}).eq('id',state.user.id);
 if(r.error){note('profile-error',r.error.message);return;}
 ownProfile.banner_path=null;ownBanner='';resetBannerObjectUrl();$s('profile-image-file').value='';updateBannerEditor();drawMyBanner();drawHero();note('profile-error','Using your most recently edited anime image.');
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
   state.supabase.from('profiles').select('id,username,display_name,banner_path,avatar_path,banner_desktop_x,banner_desktop_y,banner_desktop_zoom,banner_mobile_x,banner_mobile_y,banner_mobile_zoom').eq('id',id).single(),
   state.supabase.rpc('get_friend_anime_v5',{p_friend_id:id})
  ]);
  if(p.error)throw p.error;if(e.error)throw e.error;
  friendProfile=p.data;friendItems=e.data||[];
  const image=await getSignedBanner(friendProfile);
  putImage('friend-banner',image||lastArt(friendItems));frameBannerAt('friend-banner',friendProfile);
  $s('friend-name').textContent=friendProfile.display_name;
  $s('friend-handle').textContent='@'+friendProfile.username+' · '+friendItems.length+' titles';
  $s('nr-friend-hours').textContent=estimatedHours(friendItems);
  $s('friend-grid').classList.add('nr-grouped-library');
  $s('friend-grid').innerHTML=organizedMarkup([...friendItems].sort((a,b)=>a.title.localeCompare(b.title)),true);
  show('friend');
 }catch(err){note('friends-error','Could not load friend profile: '+err.message);}
}
// Refresh private signed banner URLs periodically so custom artwork remains visible
// without making the storage bucket public.
setInterval(async()=>{
 if(!owner())return;
 if(ownProfile?.banner_path){ownBanner=await getSignedBanner(ownProfile);drawHero();if(panel==='profile')drawMyBanner();}
 if(panel==='friend' && friendProfile?.banner_path){const url=await getSignedBanner(friendProfile);putImage('friend-banner',url||lastArt(friendItems));frameBannerAt('friend-banner',friendProfile);}
},240000);
const header=document.querySelector('.topbar-right');
if(header){
 const b=document.createElement('button');b.id='top-friends-button';b.className='btn btn-ghost btn-small';b.type='button';b.textContent='Friends ♡';
 b.addEventListener('click',()=>show('friends'));header.prepend(b);
}

async function refreshAccountAvatar(){
 if(!owner() || !ownProfile || ownProfile.id!==state.user.id)return;
 const label=document.getElementById('account-label'),avatar=document.getElementById('account-avatar');
 if(label)label.textContent='@'+ownProfile.username;
 if(!avatar)return;
 avatar.textContent=(ownProfile.username||'?')[0].toUpperCase();
 if(ownProfile.avatar_path){
  const r=await state.supabase.storage.from('nightreel-avatars').createSignedUrl(ownProfile.avatar_path,300);
  if(!r.error && r.data?.signedUrl){const img=document.createElement('img');img.alt='';img.src=r.data.signedUrl;img.className='nr-round-avatar';avatar.replaceChildren(img);}
 }
}
initializeBannerEditor();
})();
