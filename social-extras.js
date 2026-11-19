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
topRight.insertBefore(messagesTop,account);
const profileDialog=createDialog('extra-account-dialog','Your Nightreel profile',[
 '<div class="extras-profile-heading"><div class="extras-avatar-large" id="extra-avatar-large">?</div><div><strong id="extra-profile-handle">@username</strong><p id="extra-profile-name">Your anime, your universe.</p></div></div>',
 '<div class="extras-menu-actions">',
 '<button type="button" id="extra-edit-profile">Edit profile</button>',
 '<button type="button" id="extra-show-qr" class="extras-secondary">My friend QR</button>',
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
$('extra-scan-qr').onclick=()=>{profileDialog.close();show(scanDialog);};
$('extra-open-messages').onclick=()=>{profileDialog.close();openMessages();};
messagesTop.onclick=openMessages;
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
async function openMessages(friendId){
 if(!ensureLogin($('extra-messages-status')))return;
 show(chatDialog);
 message($('extra-messages-status'),'Loading friends…');
 try{
  await loadFriends();
  const listing=$('extra-conversations');listing.replaceChildren();
  $('extra-open-chat').hidden=true;listing.hidden=false;conversationId=null;
  if(!friends.length){
   listing.innerHTML='<p>No accepted friends yet. Use the Friends tab or a friend QR to add someone.</p>';
  }else{
   for(const f of friends){
    const row=document.createElement('div');row.className='extras-convo';
    const label=document.createElement('span');label.textContent=f.display_name+' (@'+f.username+')';
    const btn=document.createElement('button');btn.textContent='Message';btn.type='button';btn.onclick=()=>openConversation(f.id);
    row.append(label,btn);listing.append(row);
   }
  }
  message($('extra-messages-status'),'');
  if(typeof friendId==='string'&&friends.some(f=>f.id===friendId))openConversation(friendId);
 }catch(e){message($('extra-messages-status'),'Could not load friends: '+e.message);}
}
async function openConversation(id){
 const f=friends.find(x=>x.id===id);if(!f)return;
 conversationId=id;
 $('extra-conversations').hidden=true;$('extra-open-chat').hidden=false;
 $('extra-chat-title').textContent='Chat with @'+f.username;
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
$('extra-back-chats').onclick=()=>openMessages();
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
chatDialog.addEventListener('close',()=>{conversationId=null;if(messagePoll)clearInterval(messagePoll);messagePoll=0;});
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
})();
