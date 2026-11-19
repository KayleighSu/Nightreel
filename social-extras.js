/* Nightreel profiles, friend QR and private messaging. */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const urlSafe = value => {try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
const appUrl = 'https://kayleighsu.github.io/Nightreel/';
let currentUserId = '', myProfile = null, myAvatarUrl = '', friends = [], conversationId = null;
let stream = null, scanFrame = 0, scanBusy = false, scanContext = null, messagePoll = 0;
function loggedIn(){return Boolean(state.user?.id && state.supabase && !state.demo);}
function ensureLogin(el){if(loggedIn())return true;if(el)el.textContent='Sign in to use profiles, QR requests and messages.';return false;}
function message(el,text){if(el)el.textContent=text;}
function createDialog(id,title,contents){
 const d=document.createElement('dialog');d.className='extras-modal';d.id=id;
 d.innerHTML='<div class="extras-modal-inner"><div class="extras-top"><h2>'+safe(title)+'</h2><button type="button" class="extras-close" data-dismiss="'+id+'">✕ Close</button></div>'+contents+'</div>';
 document.body.append(d);
 d.addEventListener('click',e=>{if(e.target===d)d.close();});
 d.querySelector('[data-dismiss]').addEventListener('click',()=>d.close());
 return d;
}
function show(d){if(!d.open)d.showModal();}
function initials(name){return (name||'?').slice(0,1).toUpperCase();}
const account=document.createElement('button');
account.type='button';account.id='account-menu-button';account.title='Your profile and friend QR';
account.innerHTML='<span class="account-photo" id="account-button-photo">?</span><span id="account-button-name">Profile</span><span aria-hidden="true">⌄</span>';
const topRight=document.querySelector('.topbar-right');
if(!topRight)return;
topRight.insertBefore(account,topRight.firstChild);
const messagesTop=document.createElement('button');
messagesTop.type='button';messagesTop.className='btn btn-ghost btn-small';messagesTop.id='messages-top-button';
messagesTop.textContent='✉';messagesTop.title='Messages';
document.body.append(messagesTop);
const profileDialog=createDialog('extra-account-dialog','Your Nightreel profile',[
 '<div class="extras-profile-heading"><div class="extras-avatar-large" id="extra-avatar-large">?</div><div><strong id="extra-profile-handle">@username</strong><p id="extra-profile-name">Your anime, your universe.</p></div></div>',
 '<div class="extras-menu-actions">',
 '<button type="button" id="extra-edit-profile">Edit profile</button>',
 '<button type="button" id="extra-show-qr" class="extras-secondary">My friend QR</button>',
 '<button type="button" id="extra-invite" class="extras-primary">✦ Invite to Nightreel</button>',
 '<button type="button" id="extra-scan-qr" class="extras-secondary">Scan a QR</button>',
 '<button type="button" id="extra-open-messages" class="extras-secondary">Messages</button>',
 '<button type="button" id="extra-logout" class="extras-secondary">Log out</button></div>',
 '<div class="extras-fields"><label>Change profile picture (JPG, PNG or WebP, max 2 MB)',
 '<input type="file" id="extra-avatar-file" accept="image/jpeg,image/png,image/webp"></label>',
 '<button type="button" id="extra-avatar-upload" class="extras-primary">Save profile picture</button>',
 '<button type="button" id="extra-avatar-remove" class="extras-close">Remove profile picture</button></div>',
 '<p class="extras-status" id="extra-profile-status" role="status"></p>'
].join(''));
const qrDialog=createDialog('extra-qr-dialog','Your friend QR code',[
 '<p>Show this code to someone. They can scan it in Nightreel to find your username and send you a friend request. Scanning does not automatically grant access.</p>',
 '<div id="friend-qr" aria-label="Your friend QR code"></div>',
 '<p id="qr-username" style="text-align:center;font-weight:800"></p>',
 '<div class="extras-menu-actions"><button type="button" class="extras-primary" id="qr-copy-link">Copy friend link</button></div>',
 '<p class="extras-status" id="qr-status" role="status"></p>'
].join(''));
const scanDialog=createDialog('extra-scan-dialog','Scan a friend QR',[
 '<p>Point your camera at a Nightreel friend QR. You can also select an image or paste a friend link.</p>',
 '<video id="qr-reader-video" autoplay muted playsinline></video><canvas id="qr-scan-canvas"></canvas>',
 '<div class="extras-menu-actions"><button type="button" class="extras-primary" id="qr-start-camera">Start camera</button><button type="button" class="extras-secondary" id="qr-stop-camera">Stop camera</button></div>',
 '<label class="social-field">Scan a saved QR image<input type="file" id="qr-image-input" accept="image/png,image/jpeg,image/webp"></label>',
 '<div class="extras-fields"><label>Or paste a friend link / username<input id="qr-paste" placeholder="https://…?friend=Username"></label>',
 '<button type="button" class="extras-primary" id="qr-find-person">Find friend</button></div>',
 '<div id="qr-lookup-result" class="extra-friend-results"></div>',
 '<p class="extras-status" role="status" id="qr-scan-status"></p>'
].join(''));
const chatDialog=createDialog('extra-messages-dialog','Messages',[
 '<p>Private conversations with your accepted friends. Removing a friendship ends access to the conversation.</p>',
 '<div id="extra-conversations"></div>',
 '<div id="extra-open-chat" hidden><div class="extras-top"><h3 id="extra-chat-title">Conversation</h3><button type="button" class="extras-close" id="extra-back-chats">All chats</button></div>',
 '<div class="message-thread" id="extra-chat-thread" aria-live="polite"></div>',
 '<form id="extra-send-message" class="extras-fields"><label for="extra-chat-text">New message<textarea id="extra-chat-text" maxlength="2000" rows="3" placeholder="Write a message…" required></textarea></label>',
 '<button type="submit" class="extras-primary" id="extra-send-button">Send message</button></form></div>',
 '<p class="extras-status" id="extra-messages-status" role="status"></p>'
].join(''));
function setPicture(node,url,fall){
 const u=urlSafe(url);
 if(!node)return;
 node.replaceChildren();
 if(u){const im=document.createElement('img');im.alt='Profile picture';im.src=u;im.loading='lazy';node.append(im);}
 else node.textContent=initials(fall);
}
async function signedAvatar(profile){
 if(!loggedIn()||!profile?.avatar_path)return '';
 const r=await state.supabase.storage.from('nightreel-avatars').createSignedUrl(profile.avatar_path,240);
 return r.error?'':urlSafe(r.data?.signedUrl);
}
async function loadOwnProfile(){
 if(!loggedIn())return;
 const id=state.user.id;
 const r=await state.supabase.from('profiles').select('id,username,display_name,avatar_path').eq('id',id).maybeSingle();
 if(r.error)throw r.error;
 if(state.user?.id!==id)return;
 myProfile=r.data;
 myAvatarUrl=await signedAvatar(myProfile);
 const label=myProfile?.username||'Profile';
 $('account-button-name').textContent=label;
 $('extra-profile-handle').textContent='@'+label;
 $('extra-profile-name').textContent=myProfile?.display_name||'Anime fan';
 setPicture($('account-button-photo'),myAvatarUrl,label);
 setPicture($('extra-avatar-large'),myAvatarUrl,label);
}
function clearAccount(){
 myProfile=null;myAvatarUrl='';friends=[];conversationId=null;currentUserId='';
 $('account-button-name').textContent='Profile';
 setPicture($('account-button-photo'),'','?');
}
async function refreshAccount(){
 if(!loggedIn()){if(currentUserId)clearAccount();return;}
 if(currentUserId===state.user.id)return;
 currentUserId=state.user.id;
 try{await loadOwnProfile();}catch(e){message($('extra-profile-status'),'Profile unavailable: '+e.message);}
}
setInterval(refreshAccount,1400);
refreshAccount();
account.addEventListener('click',async()=>{
 if(!ensureLogin($('extra-profile-status')))return;
 show(profileDialog);
 try{await loadOwnProfile();}catch(e){message($('extra-profile-status'),e.message);}
});
$('extra-edit-profile').onclick=()=>{profileDialog.close();document.querySelector('[data-social-view="profile"]')?.click();};
$('extra-logout').onclick=()=>{profileDialog.close();$('signout-btn')?.click();};
$('extra-show-qr').onclick=async()=>{profileDialog.close();await showQR();};
$('extra-invite').onclick=()=>{
 const link=myProfile?.username?appUrl+'?friend='+encodeURIComponent(myProfile.username):appUrl;
 const invitation=myProfile?.username
  ?'Come track anime with me on Nightreel! Create your own watchlist, rank favorites, and find me @'+myProfile.username+'.'
  :'Come track anime with me on Nightreel! Create your own library and find friends.';
 profileDialog.close();
 if(typeof navigator.share==='function'){
  navigator.share({title:'Nightreel',text:invitation,url:link}).catch(async error=>{
   if(error?.name==='AbortError')return;
   try{await navigator.clipboard.writeText(link);toast('Invite link copied!');}
   catch{toast('Invite link: '+link);}
  });
 }else if(navigator.clipboard?.writeText){
  navigator.clipboard.writeText(link).then(()=>toast('Invite link copied!')).catch(()=>toast('Invite: '+link));
 }else{toast('Invite: '+link);}
};
$('extra-scan-qr').onclick=()=>{profileDialog.close();show(scanDialog);};
$('extra-open-messages').onclick=()=>{profileDialog.close();openMessages();};
messagesTop.onclick=()=>{nrClearUnread();openMessages();};
async function uploadAvatar(){
 if(!ensureLogin($('extra-profile-status')))return;
 const file=$('extra-avatar-file').files?.[0];
 if(!file){message($('extra-profile-status'),'Choose an image first.');return;}
 const formats={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 if(!formats[file.type]||file.size>2097152){message($('extra-profile-status'),'Use a JPG, PNG or WebP image no larger than 2 MB.');return;}
 const button=$('extra-avatar-upload');button.disabled=true;
 try{
  const path=state.user.id+'/'+crypto.randomUUID()+'.'+formats[file.type];
  const upload=await state.supabase.storage.from('nightreel-avatars').upload(path,file,{contentType:file.type,upsert:false});
  if(upload.error)throw upload.error;
  const update=await state.supabase.from('profiles').update({avatar_path:path}).eq('id',state.user.id);
  if(update.error)throw update.error;
  $('extra-avatar-file').value='';
  await loadOwnProfile();
  message($('extra-profile-status'),'Profile picture updated.');
 }catch(e){message($('extra-profile-status'),'Could not save picture: '+e.message);}
 finally{button.disabled=false;}
}
$('extra-avatar-upload').onclick=uploadAvatar;
$('extra-avatar-remove').onclick=async()=>{
 if(!ensureLogin($('extra-profile-status')))return;
 try{
  const r=await state.supabase.from('profiles').update({avatar_path:null}).eq('id',state.user.id);
  if(r.error)throw r.error;
  await loadOwnProfile();
  message($('extra-profile-status'),'Profile picture removed.');
 }catch(e){message($('extra-profile-status'),e.message);}
};
function inviteUrl(){return appUrl+'?friend='+encodeURIComponent(myProfile.username);}
async function showQR(){
 if(!ensureLogin($('qr-status')))return;
 if(!myProfile)await loadOwnProfile();
 if(!myProfile?.username){message($('qr-status'),'Choose a public username in My Profile first.');return;}
 const area=$('friend-qr');area.replaceChildren();
 $('qr-username').textContent='@'+myProfile.username;
 show(qrDialog);
 if(typeof QRCode==='undefined'){message($('qr-status'),'QR generator is unavailable. Use Copy friend link instead.');return;}
 new QRCode(area,{text:inviteUrl(),width:216,height:216,correctLevel:QRCode.CorrectLevel.M});
 message($('qr-status'),'');
}
$('qr-copy-link').onclick=async()=>{
 if(!myProfile?.username)return;
 try{await navigator.clipboard.writeText(inviteUrl());message($('qr-status'),'Friend link copied.');}
 catch{message($('qr-status'),inviteUrl());}
};
function parseFriend(value){
 let raw=String(value||'').trim();
 if(!raw)return '';
 if(raw.startsWith('http://')||raw.startsWith('https://')){
  try{
   const url=new URL(raw);
   if(url.origin!==new URL(appUrl).origin || !url.pathname.replace(/\/+$/,'').toLowerCase().endsWith('/nightreel'))return '';
   raw=url.searchParams.get('friend')||'';
  }catch{return '';}
 }
 return /^[A-Za-z][A-Za-z0-9_]{2,31}$/.test(raw)?raw:'';
}
async function findQRPerson(value){
 const status=$('qr-scan-status');
 const name=parseFriend(value);
 if(!name){message(status,'Not a valid Nightreel username or friend QR link.');return;}
 stopCamera();
 $('qr-paste').value=name;
 if(!ensureLogin(status))return;
 message(status,'Looking up @'+name+'…');
 $('qr-lookup-result').replaceChildren();
 const result=await state.supabase.rpc('search_nightreel_users',{p_query:name});
 if(result.error){message(status,result.error.message);return;}
 const found=(result.data||[]).find(p=>p.username.toLowerCase()===name.toLowerCase());
 if(!found){message(status,'No matching user. Check the spelling or try searching in Friends.');return;}
 const row=document.createElement('div');row.className='extras-convo';
 const text=document.createElement('span');text.textContent=found.display_name+' (@'+found.username+')';
 const button=document.createElement('button');button.type='button';button.className='extras-primary';button.textContent='Send friend request';
 button.addEventListener('click',async()=>{
  button.disabled=true;
  const resp=await state.supabase.from('friendships').insert({requester_id:state.user.id,recipient_id:found.id,status:'pending'});
  if(resp.error){button.disabled=false;message(status,'Could not send request: '+resp.error.message);}
  else{button.textContent='Request sent';message(status,'Friend request sent to @'+found.username+'.');}
 });
 row.append(text,button);$('qr-lookup-result').append(row);message(status,'');
}
$('qr-find-person').onclick=()=>findQRPerson($('qr-paste').value);
function stopCamera(){
 if(scanFrame)cancelAnimationFrame(scanFrame);scanFrame=0;
 if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
 const v=$('qr-reader-video');v.pause();v.srcObject=null;scanBusy=false;
}
scanDialog.addEventListener('close',stopCamera);
$('qr-stop-camera').onclick=stopCamera;
function decodeCanvas(canvas){
 if(!window.jsQR)return '';
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)return '';
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 return window.jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'})?.data||'';
}
async function scanLoop(){
 if(!stream || scanBusy)return;
 const video=$('qr-reader-video');
 if(video.readyState>=2 && video.videoWidth>0){
  const canvas=$('qr-scan-canvas');const ratio=Math.min(1,720/video.videoWidth);
  canvas.width=Math.round(video.videoWidth*ratio);canvas.height=Math.round(video.videoHeight*ratio);
  canvas.getContext('2d',{willReadFrequently:true}).drawImage(video,0,0,canvas.width,canvas.height);
  try{const found=decodeCanvas(canvas);if(found){scanBusy=true;await findQRPerson(found);return;}}
  catch(e){message($('qr-scan-status'),'Camera scan error: '+e.message);stopCamera();return;}
 }
 scanFrame=requestAnimationFrame(scanLoop);
}
$('qr-start-camera').onclick=async()=>{
 if(!navigator.mediaDevices?.getUserMedia){message($('qr-scan-status'),'Camera access is unsupported here. Select a saved QR image or paste a friend link.');return;}
 if(!window.jsQR){message($('qr-scan-status'),'QR scanner failed to load. You can still paste a friend link.');return;}
 stopCamera();
 try{
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
  $('qr-reader-video').srcObject=stream;await $('qr-reader-video').play();
  message($('qr-scan-status'),'Point the camera at the Nightreel QR code.');
  scanFrame=requestAnimationFrame(scanLoop);
 }catch(e){message($('qr-scan-status'),'Could not start camera: '+e.message+'. You can still use a saved QR image.');}
};
$('qr-image-input').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(!window.jsQR){message($('qr-scan-status'),'The QR scanner library failed to load.');return;}
 try{
  const bitmap=await createImageBitmap(file);
  const canvas=$('qr-scan-canvas');const factor=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
  canvas.width=Math.round(bitmap.width*factor);canvas.height=Math.round(bitmap.height*factor);
  canvas.getContext('2d',{willReadFrequently:true}).drawImage(bitmap,0,0,canvas.width,canvas.height);
  bitmap.close?.();
  const data=decodeCanvas(canvas);if(!data)throw Error('No QR code was found in that image.');
  await findQRPerson(data);
 }catch(err){message($('qr-scan-status'),err.message);}
 finally{e.target.value='';}
});
async function loadFriends(){
 if(!loggedIn())return [];
 const result=await state.supabase.rpc('get_nightreel_connections');
 if(result.error)throw result.error;
 const user=state.user.id;
 friends=(result.data||[]).filter(f=>f.status==='accepted').map(f=>({
  id:f.requester_id===user?f.recipient_id:f.requester_id,
  username:f.username,display_name:f.display_name
 }));
 return friends;
}
const nrLastMobileKey='nightreel-last-mobile-chat';
let nrMobileRequest=0;
function nrRememberMobileConversation(id){
 if(!loggedIn())return;
 try{localStorage.setItem(nrLastMobileKey+':'+state.user.id,id);}catch{}
}
async function nrMostRecentFriend(){
 const uid=state.user.id;
 // Direct messages are participant-only under the existing database policies.
 const r=await state.supabase.from('direct_messages')
  .select('sender_id,recipient_id,created_at').or('sender_id.eq.'+uid+',recipient_id.eq.'+uid)
  .order('created_at',{ascending:false}).limit(60);
 if(r.error)throw r.error;
 const latest=(r.data||[]).find(m=>friends.some(f=>f.id===(m.sender_id===uid?m.recipient_id:m.sender_id)));
 if(latest)return latest.sender_id===uid?latest.recipient_id:latest.sender_id;
 try{
  const remembered=localStorage.getItem(nrLastMobileKey+':'+uid);
  if(friends.some(f=>f.id===remembered))return remembered;
 }catch{}
 return friends.length===1?friends[0].id:null;
}
async function openMessages(friendId,showList=false){
 nrClearUnread();
 if(!nrIsMobile()&&typeof friendId==='string'){await loadFriends();nrOpenDock(friendId);return;}
 if(!ensureLogin($('extra-messages-status')))return;
 const request=++nrMobileRequest;
 show(chatDialog);
 message($('extra-messages-status'),'Loading conversations…');
 try{
  await loadFriends();
  if(request!==nrMobileRequest||!chatDialog.open)return;
  const listing=$('extra-conversations');listing.replaceChildren();
  $('extra-open-chat').hidden=true;listing.hidden=false;conversationId=null;
  if(messagePoll){clearInterval(messagePoll);messagePoll=0;}
  if(!friends.length){
   listing.innerHTML='<p>No accepted friends yet. Use the Friends tab or a friend QR to add someone.</p>';
  }else{
   for(const f of friends){
    const row=document.createElement('div');row.className='extras-convo';
    const label=document.createElement('span');label.textContent=f.display_name&&f.display_name.toLowerCase()!=='anime fan'?f.display_name:'@'+f.username;
    const btn=document.createElement('button');btn.textContent='Open chat';btn.type='button';btn.onclick=()=>{if(nrIsMobile()){openConversation(f.id);}else{chatDialog.close();nrOpenDock(f.id);}};
    row.append(label,btn);listing.append(row);
   }
  }
  let target=typeof friendId==='string'&&friends.some(f=>f.id===friendId)?friendId:null;
  if(!target&&nrIsMobile()&&!showList&&friends.length){
   try{target=await nrMostRecentFriend();}catch(error){
    message($('extra-messages-status'),'Could not determine most recent conversation: '+error.message);
   }
  }
  if(request!==nrMobileRequest||!chatDialog.open)return;
  if(target)await openConversation(target);
  else if(!friends.length||showList)message($('extra-messages-status'),'');
 }catch(e){if(request===nrMobileRequest)message($('extra-messages-status'),'Could not load friends: '+e.message);}
}
async function openConversation(id){
 const f=friends.find(x=>x.id===id);if(!f)return;
 conversationId=id;
 if(nrIsMobile())nrRememberMobileConversation(id);
 $('extra-conversations').hidden=true;$('extra-open-chat').hidden=false;
 $('extra-chat-title').textContent=f.display_name&&f.display_name.toLowerCase()!=='anime fan'?f.display_name:'@'+(f.username||'Friend');
 await loadMessages();
 if(messagePoll)clearInterval(messagePoll);
 messagePoll=setInterval(()=>{if(chatDialog.open&&conversationId)loadMessages(true);},6000);
}
function timeLabel(ts){const date=new Date(ts);return Number.isFinite(date.valueOf())?date.toLocaleString():'';}
async function loadMessages(quiet=false){
 if(!loggedIn()||!conversationId)return;
 const user=state.user.id,id=conversationId;
 // Participant-only RLS is enforced by Postgres; both directions are fetched.
 const query='and(sender_id.eq.'+user+',recipient_id.eq.'+id+'),and(sender_id.eq.'+id+',recipient_id.eq.'+user+')';
 try{
  const r=await state.supabase.from('direct_messages')
   .select('id,sender_id,recipient_id,body,created_at').or(query).order('created_at',{ascending:false}).limit(100);
  if(r.error)throw r.error;if(id!==conversationId)return;
  const box=$('extra-chat-thread');const pinned=box.scrollTop+box.clientHeight>=box.scrollHeight-65;
  box.replaceChildren();
  const data=(r.data||[]).reverse();
  if(!data.length)box.textContent='No messages yet. Say hello!';
  for(const item of data){
   const bubble=document.createElement('div');bubble.className='message-bubble'+(item.sender_id===user?' mine':'');
   const body=document.createElement('span');body.textContent=item.body;
   const when=document.createElement('small');when.textContent=timeLabel(item.created_at);
   bubble.append(body,when);box.append(bubble);
  }
  if(pinned||!quiet)box.scrollTop=box.scrollHeight;
  if(!quiet)message($('extra-messages-status'),'');
 }catch(e){if(!quiet)message($('extra-messages-status'),'Could not load messages: '+e.message);}
}
$('extra-back-chats').onclick=()=>openMessages(null,true);
// Phone keyboards may emit beforeinput(insertLineBreak) instead of keydown Enter.
const nrMobileInput=$('extra-chat-text');
nrMobileInput.setAttribute('enterkeyhint','send');
nrMobileInput.setAttribute('inputmode','text');
function nrSubmitMobileMessage(e){
 if(e.isComposing||e.inputType==='insertCompositionText')return;
 e.preventDefault();
 if(nrMobileInput.value.trim())$('extra-send-message').requestSubmit();
}
nrMobileInput.addEventListener('keydown',e=>{
 if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing)nrSubmitMobileMessage(e);
});
nrMobileInput.addEventListener('beforeinput',e=>{
 if((e.inputType==='insertLineBreak'||e.inputType==='insertParagraph')&&
    !e.isComposing&&!e.shiftKey)nrSubmitMobileMessage(e);
});
$('extra-send-message').addEventListener('submit',async e=>{
 e.preventDefault();
 if(!loggedIn()||!conversationId)return;
 const input=$('extra-chat-text'),body=input.value.trim();
 if(!body||body.length>2000){message($('extra-messages-status'),'Messages must be 1–2,000 characters.');return;}
 const button=$('extra-send-button');button.disabled=true;
 try{
  const r=await state.supabase.from('direct_messages').insert({sender_id:state.user.id,recipient_id:conversationId,body});
  if(r.error)throw r.error;
  input.value='';
  await loadMessages();
 }catch(err){message($('extra-messages-status'),'Could not send: '+err.message);}
 finally{button.disabled=false;}
});
chatDialog.addEventListener('close',()=>{++nrMobileRequest;conversationId=null;if(messagePoll)clearInterval(messagePoll);messagePoll=0;});
// Friend list integrations
document.getElementById('friends-results')?.addEventListener('click',e=>{
 const el=e.target.closest('[data-friend-action="view"]');if(!el)return;
 // Existing app still handles opening the friend profile. A message button is added when it loads.
});
const friendHero=document.getElementById('friend-hero');
if(friendHero){
 const avatar=document.createElement('img');avatar.id='friend-view-avatar';avatar.alt="Friend's profile photo";avatar.hidden=true;friendHero.append(avatar);
 const observer=new MutationObserver(async()=>{
  const visible=friendHero.closest('#friend-view')?.hidden===false;
  if(!visible||!loggedIn())return;
  const label=document.getElementById('friend-handle')?.textContent||'';
  const username=label.match(/@([A-Za-z][A-Za-z0-9_]{2,31})/)?.[1];
  if(!username)return;
  try{
   const list=await loadFriends();const f=list.find(x=>x.username.toLowerCase()===username.toLowerCase());
   if(!f)return;
   const r=await state.supabase.from('profiles').select('avatar_path').eq('id',f.id).maybeSingle();
   if(r.error||!r.data?.avatar_path){avatar.hidden=true;return;}
   const url=await signedAvatar(r.data);
   avatar.hidden=!url;if(url)avatar.src=url;
  }catch{}
 });
 observer.observe(document.getElementById('friend-view'),{attributes:true,attributeFilter:['hidden']});
 const messageButton=document.createElement('button');messageButton.className='btn btn-secondary btn-small';messageButton.textContent='✉ Message';messageButton.type='button';
 messageButton.addEventListener('click',async()=>{
  if(!loggedIn())return;
  const match=(document.getElementById('friend-handle')?.textContent||'').match(/@([A-Za-z][A-Za-z0-9_]{2,31})/);
  if(!match)return;
  await loadFriends();const f=friends.find(x=>x.username.toLowerCase()===match[1].toLowerCase());
  if(f)openMessages(f.id);
 });
 document.getElementById('friend-back')?.after(messageButton);
}
// QR invite link opens a search prompt (not an automatic request).
let inviteHandled=false;
async function pendingInvite(){
 if(inviteHandled||!loggedIn())return;
 const name=new URLSearchParams(location.search).get('friend');
 if(!name)return;
 inviteHandled=true;
 show(scanDialog);
 await findQRPerson(name);
}
setInterval(pendingInvite,1800);
/* Messenger-style desktop dock and mobile floating entry point. */
const nrDock=document.createElement('aside');nrDock.id='nr-chat-dock';nrDock.setAttribute('aria-label','Open conversations');document.body.append(nrDock);
const nrBubble=document.createElement('button');nrBubble.id='nr-chat-fab';nrBubble.type='button';nrBubble.setAttribute('aria-label','Open messages');nrBubble.textContent='✉';document.body.append(nrBubble);
const nrBadge=document.createElement('span');nrBadge.className='nr-notification-badge';nrBadge.hidden=true;messagesTop.append(nrBadge);
const nrFabBadge=document.createElement('span');nrFabBadge.className='nr-notification-badge';nrFabBadge.hidden=true;nrBubble.append(nrFabBadge);
const nrSoundToggle=document.createElement('button');nrSoundToggle.type='button';nrSoundToggle.className='extras-secondary';nrSoundToggle.textContent='🔊 Notification sounds on';
profileDialog.querySelector('.extras-menu-actions')?.append(nrSoundToggle);
let nrSoundEnabled=localStorage.getItem('nightreel-sounds')!=='off';
let nrAudioContext=null,nrAudioUnlocked=false,nrSeenMessages=new Set(),nrSeenRequests=new Set(),nrSeenAcceptances=new Set(),nrNoticesReady=false,nrUnread=0;
const nrWindows=new Map();
function nrIsMobile(){return matchMedia('(max-width: 720px)').matches;}
function nrPlaySound(kind){
 if(!nrSoundEnabled||!nrAudioUnlocked)return;
 try{
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  nrAudioContext ||= new C();
  const now=nrAudioContext.currentTime;
  const pitches=kind==='friend'?[659,880,988]:kind==='accept'?[523,784,1047]:[880,659];
  pitches.forEach((pitch,i)=>{
   const osc=nrAudioContext.createOscillator(),gain=nrAudioContext.createGain(),t=now+i*.095;
   osc.type=kind==='message'?'sine':'triangle';osc.frequency.setValueAtTime(pitch,t);
   gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.055,t+.012);gain.gain.exponentialRampToValueAtTime(.0001,t+.14);
   osc.connect(gain).connect(nrAudioContext.destination);osc.start(t);osc.stop(t+.15);
  });
 }catch{}
}
document.addEventListener('pointerdown',()=>{nrAudioUnlocked=true;},{once:true});
nrSoundToggle.onclick=()=>{
 nrSoundEnabled=!nrSoundEnabled;localStorage.setItem('nightreel-sounds',nrSoundEnabled?'on':'off');
 nrSoundToggle.textContent=nrSoundEnabled?'🔊 Notification sounds on':'🔇 Notification sounds off';
 if(nrSoundEnabled)nrPlaySound('accept');
};
nrSoundToggle.textContent=nrSoundEnabled?'🔊 Notification sounds on':'🔇 Notification sounds off';
function nrBadgeUpdate(){
 nrBadge.hidden=nrUnread===0;nrFabBadge.hidden=nrUnread===0;
 const label=nrUnread>99?'99+':String(nrUnread);nrBadge.textContent=label;nrFabBadge.textContent=label;
 messagesTop.setAttribute('aria-label',nrUnread?label+' new notifications; open messages':'Open messages');
}
function nrClearUnread(){nrUnread=0;nrBadgeUpdate();}
async function nrCheckNotifications(){
 if(!loggedIn()){nrRestoredFor='';nrNoticesReady=false;nrSeenMessages.clear();nrSeenRequests.clear();nrSeenAcceptances.clear();nrClearUnread();nrDock.replaceChildren();nrWindows.clear();return;}
 const uid=state.user.id;
 try{
  const [m,f]=await Promise.all([
   state.supabase.from('direct_messages').select('id,sender_id,created_at').eq('recipient_id',uid).order('created_at',{ascending:false}).limit(40),
   state.supabase.from('friendships').select('id,status,requester_id,recipient_id').or('requester_id.eq.'+uid+',recipient_id.eq.'+uid).limit(200)
  ]);
  if(m.error||f.error)return;
  const msgs=(m.data||[]).map(r=>r.id);
  const pending=(f.data||[]).filter(r=>r.status==='pending'&&r.recipient_id===uid).map(r=>r.id);
  const accepted=(f.data||[]).filter(r=>r.status==='accepted'&&r.requester_id===uid).map(r=>r.id);
  if(nrNoticesReady){
   const fresh=msgs.filter(id=>!nrSeenMessages.has(id));
   const requests=pending.filter(id=>!nrSeenRequests.has(id));
   const approvals=accepted.filter(id=>!nrSeenAcceptances.has(id));
   if(fresh.length||requests.length||approvals.length){
    nrUnread+=fresh.length+requests.length+approvals.length;nrBadgeUpdate();
    nrPlaySound(fresh.length?'message':requests.length?'friend':'accept');
   }
  }
  nrSeenMessages=new Set(msgs);nrSeenRequests=new Set(pending);nrSeenAcceptances=new Set(accepted);nrNoticesReady=true;
  for(const win of nrWindows.values())if(!win.classList.contains('nr-chat-minimized'))nrLoadDockMessages(win);
 }catch{}
}
const nrTabStorageKey='nightreel-open-chats';
function nrRememberTabs(){
 if(!loggedIn())return;
 try{sessionStorage.setItem(nrTabStorageKey+':'+state.user.id,JSON.stringify([...nrWindows].map(([id,w])=>({id,minimized:w.classList.contains('nr-chat-minimized')}))));}catch{}
}
function nrSetMinimized(win,minimized){
 win.classList.toggle('nr-chat-minimized',minimized);
 win.querySelector('.nr-chat-head-toggle')?.setAttribute('aria-expanded',String(!minimized));
 win.querySelector('.nr-chat-head-toggle')?.setAttribute('title',minimized?'Reopen conversation':'Minimize conversation');
 win.querySelector('.nr-chat-minimize')?.setAttribute('aria-label',minimized?'Restore conversation':'Minimize conversation');
 if(!minimized){win.querySelector('textarea')?.focus();nrLoadDockMessages(win);}
 nrRememberTabs();
}
function nrOpenDock(id,minimized=false){
 if(nrIsMobile()){openMessages(id);return;}
 const friend=friends.find(f=>f.id===id);if(!friend)return;
 if(nrWindows.has(id)){
  const existing=nrWindows.get(id);
  nrSetMinimized(existing,minimized);
  return;
 }
 const win=document.createElement('section');win.className='nr-chat-window';win.setAttribute('aria-label','Chat with '+(friend.display_name||friend.username));
 const header=document.createElement('div');header.className='nr-chat-head';
 const toggle=document.createElement('button');toggle.type='button';toggle.className='nr-chat-head-toggle';toggle.textContent=friend.display_name||friend.username||'Friend';
 toggle.setAttribute('aria-expanded',String(!minimized));toggle.onclick=()=>nrSetMinimized(win,!win.classList.contains('nr-chat-minimized'));
 const minimize=document.createElement('button');minimize.type='button';minimize.className='nr-chat-minimize';minimize.textContent='−';minimize.title='Minimize conversation';
 minimize.onclick=()=>nrSetMinimized(win,!win.classList.contains('nr-chat-minimized'));
 const close=document.createElement('button');close.type='button';close.textContent='×';close.title='Close conversation';close.onclick=()=>{nrWindows.delete(id);win.remove();nrRememberTabs();};
 header.append(toggle,minimize,close);
 const thread=document.createElement('div');thread.className='nr-dock-thread';thread.setAttribute('aria-live','polite');
 const form=document.createElement('form');form.className='nr-dock-form';
 const input=document.createElement('textarea');input.rows=1;input.maxLength=2000;input.placeholder='Write a message…';input.setAttribute('aria-label','Message '+(friend.display_name||friend.username));
 const send=document.createElement('button');send.type='submit';send.textContent='➤';send.setAttribute('aria-label','Send message');
 const status=document.createElement('small');status.className='nr-dock-status';
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit();}});
 form.onsubmit=async e=>{
  e.preventDefault();const body=input.value.trim();if(!body||!loggedIn())return;
  send.disabled=true;
  try{
   const r=await state.supabase.from('direct_messages').insert({sender_id:state.user.id,recipient_id:id,body});
   if(r.error)throw r.error;input.value='';status.textContent='';await nrLoadDockMessages(win);
  }catch(error){status.textContent='Unable to send: '+error.message;}
  finally{send.disabled=false;}
 };
 form.append(input,send);win.append(header,thread,form,status);win._friendId=id;nrWindows.set(id,win);nrDock.append(win);
 // Keep every conversation visible as a small clickable tab when minimized.
 if(minimized){win.classList.add('nr-chat-minimized');toggle.title='Reopen conversation';}
 // Limit fully expanded windows without discarding their tabs.
 const expanded=[...nrWindows.values()].filter(w=>!w.classList.contains('nr-chat-minimized'));
 if(expanded.length>2)nrSetMinimized(expanded[0],true);
 nrRememberTabs();
 if(!minimized){nrLoadDockMessages(win);input.focus();}
}
let nrRestoredFor='';
async function nrRestoreDockTabs(){
 if(!loggedIn()||nrIsMobile()||nrRestoredFor===state.user.id)return;
 nrRestoredFor=state.user.id;
 try{
  const entries=JSON.parse(sessionStorage.getItem(nrTabStorageKey+':'+state.user.id)||'[]');
  if(!Array.isArray(entries)||!entries.length)return;
  await loadFriends();
  for(const entry of entries.slice(0,8)){
   if(entry&&typeof entry.id==='string'&&friends.some(f=>f.id===entry.id))nrOpenDock(entry.id,entry.minimized===true);
  }
 }catch{}
}
setInterval(nrRestoreDockTabs,2000);
nrRestoreDockTabs();
async function nrLoadDockMessages(win){
 if(!loggedIn()||!win.isConnected||win.classList.contains('nr-chat-minimized')||win._busy)return;
 win._busy=true;
 const id=win._friendId,user=state.user.id;
 const query='and(sender_id.eq.'+user+',recipient_id.eq.'+id+'),and(sender_id.eq.'+id+',recipient_id.eq.'+user+')';
 try{
  const r=await state.supabase.from('direct_messages').select('id,sender_id,body,created_at').or(query).order('created_at',{ascending:false}).limit(100);
  if(r.error)throw r.error;
  if(!win.isConnected)return;
  const thread=win.querySelector('.nr-dock-thread');const pinned=thread.scrollTop+thread.clientHeight>=thread.scrollHeight-60;
  thread.replaceChildren();
  for(const m of (r.data||[]).reverse()){
   const bubble=document.createElement('div');bubble.className='message-bubble'+(m.sender_id===user?' mine':'');
   const body=document.createElement('span');body.textContent=m.body;
   const when=document.createElement('small');when.textContent=timeLabel(m.created_at);
   bubble.append(body,when);thread.append(bubble);
  }
  if(pinned)thread.scrollTop=thread.scrollHeight;
 }catch(error){win.querySelector('.nr-dock-status').textContent=error.message;}
 finally{win._busy=false;}
}
nrBubble.onclick=()=>{nrClearUnread();openMessages();};
setInterval(nrCheckNotifications,8000);
nrCheckNotifications();
})();
