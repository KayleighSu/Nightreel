/* Nightreel: account identity, QR friend invites and profile avatar display. */
(function(){
'use strict';
const el=id=>document.getElementById(id);
const btn=document.createElement('button');
btn.id='nr-profile-menu-button';btn.type='button';btn.className='nr-profile-menu-button';btn.setAttribute('aria-label','Open my profile and friend QR');btn.setAttribute('aria-expanded','false');
const header=document.querySelector('.topbar-right'),label=el('account-label'),avatar=el('account-avatar');
if(!header||!label||!avatar)return;
label.before(btn);btn.append(label,avatar);
const menu=document.createElement('div');menu.id='nr-profile-menu';menu.className='nr-profile-menu';menu.hidden=true;
menu.innerHTML='<button type="button" data-nr-menu="profile">My profile</button><button type="button" data-nr-menu="qr">My friend QR</button><button type="button" data-nr-menu="scan">Scan QR to add</button><button type="button" data-nr-menu="chat">Messages</button>';
header.append(menu);
btn.addEventListener('click',()=>{menu.hidden=!menu.hidden;btn.setAttribute('aria-expanded',String(!menu.hidden));});
document.addEventListener('click',e=>{if(!btn.contains(e.target)&&!menu.contains(e.target)){menu.hidden=true;btn.setAttribute('aria-expanded','false');}});
const root=document.createElement('dialog');root.id='nr-qr-modal';root.className='nr-feature-modal';
root.innerHTML='<div class="nr-feature-inner"><header><h2>Find friends with a QR code</h2><button type="button" id="nr-qr-close" aria-label="Close QR dialog">×</button></header><p>Show this code to a friend. It contains your public username, not your email.</p><div id="nr-qr-art" class="nr-qr-art"></div><p id="nr-qr-username"></p><button type="button" id="nr-copy-qr-link">Copy my friend link</button><hr><p>Scan a friend’s code using your camera, or select a screenshot.</p><div class="nr-feature-actions"><button type="button" id="nr-start-scan">Scan with camera</button><label>Upload QR screenshot<input type="file" id="nr-file-scan" accept="image/*"></label></div><video id="nr-scan-video" autoplay muted playsinline hidden></video><div id="nr-qr-confirm" hidden><p id="nr-scanned-username"></p><button type="button" id="nr-qr-add-friend">Send friend request</button></div><p id="nr-qr-notice" role="status"></p></div>';
document.body.append(root);
const signed=(profile)=>profile?.username ? new URL('?friend='+encodeURIComponent(profile.username),location.origin+location.pathname).href : '';
const active=()=>!!(state?.supabase && state?.user && !state.demo);
let currentProfile=null,photoStamp='',scanStream=null,scanFrame=0,cameraActive=false,found=null;
const notice=s=>el('nr-qr-notice').textContent=s;
async function profile(){
 if(!active())return null;
 const r=await state.supabase.from('profiles').select('id,username,display_name,avatar_path').eq('id',state.user.id).maybeSingle();
 if(r.error)throw r.error;
 currentProfile=r.data;return currentProfile;
}
async function refreshProfileButton(){
 if(!active()){label.textContent='Guest preview';avatar.textContent='G';return;}
 const p=await profile();if(!p)return;
 label.textContent='@'+p.username;
 const path=p.avatar_path||'';
 const stamp=state.user.id+'::'+path+'::'+Math.floor(Date.now()/240000);
 if(photoStamp===stamp)return;
 photoStamp=stamp;
 avatar.textContent=(p.username||'?')[0].toUpperCase();
 if(path){
  const r=await state.supabase.storage.from('nightreel-avatars').createSignedUrl(path,300);
  if(!r.error && r.data?.signedUrl){
   const img=document.createElement('img');img.alt='';img.className='nr-avatar-img';img.src=r.data.signedUrl;
   avatar.replaceChildren(img);
   const preview=el('nr-my-avatar-preview');if(preview){preview.replaceChildren(img.cloneNode(true));}
  }
 }
}
function drawQR(p){
 const art=el('nr-qr-art');art.replaceChildren();
 el('nr-qr-username').textContent='@'+p.username;
 if(typeof qrcode==='function'){
  try{const qr=qrcode(0,'M');qr.addData(signed(p));qr.make();art.innerHTML=qr.createSvgTag({cellSize:6,margin:4});}
  catch(e){art.textContent='QR unavailable. Share the link instead.';}
 }else art.textContent='QR generation is unavailable. Share the link instead.';
}
async function openQR(){
 if(!active())return;
 root.showModal();notice('');found=null;el('nr-qr-confirm').hidden=true;el('nr-qr-add-friend').disabled=false;
 try{drawQR(await profile());}catch(e){notice('Unable to load profile: '+e.message);}
}
function stopCamera(){
 cameraActive=false;cancelAnimationFrame(scanFrame);
 if(scanStream){scanStream.getTracks().forEach(track=>track.stop());scanStream=null;}
 const video=el('nr-scan-video');video.srcObject=null;video.hidden=true;
}
el('nr-qr-close').onclick=()=>root.close();
root.addEventListener('close',stopCamera);
el('nr-copy-qr-link').onclick=async()=>{
 if(!currentProfile)return notice('Sign in to get your link.');
 const link=signed(currentProfile);
 try{await navigator.clipboard.writeText(link);notice('Your friend link was copied.');}
 catch{notice('Copy this address: '+link);}
};
function parseCode(value){
 const str=String(value||'').trim();
 try{
  const url=new URL(str);
  if(url.origin!==location.origin||url.pathname.replace(/\/+$/,'')!==location.pathname.replace(/\/+$/,''))return '';
  const name=url.searchParams.get('friend')||'';
  return /^[A-Za-z][A-Za-z0-9_]{2,31}$/.test(name)?name:'';
 }catch{return /^[A-Za-z][A-Za-z0-9_]{2,31}$/.test(str)?str:'';}
}
async function acceptCode(value){
 const handle=parseCode(value);
 if(!handle)return notice('That is not a valid Nightreel friend code.');
 stopCamera();
 const r=await state.supabase.rpc('search_nightreel_users',{p_query:handle});
 if(r.error)return notice('Username lookup failed: '+r.error.message);
 found=(r.data||[]).find(p=>p.username.toLowerCase()===handle.toLowerCase())||null;
 if(!found)return notice('No matching user was found, or this is your own QR code.');
 el('nr-scanned-username').textContent='Send a friend request to @'+found.username+'?';
 el('nr-qr-confirm').hidden=false;notice('Confirm to send the request.');
}
el('nr-qr-add-friend').onclick=async()=>{
 if(!found||!active())return;
 el('nr-qr-add-friend').disabled=true;
 const r=await state.supabase.from('friendships').insert({requester_id:state.user.id,recipient_id:found.id,status:'pending'});
 if(r.error){notice(r.error.code==='23505'?'You already have a request or friendship with this user.':r.error.message);el('nr-qr-add-friend').disabled=false;}
 else notice('Friend request sent to @'+found.username+'.');
};
const canvas=document.createElement('canvas');
async function inspect(video){
 canvas.width=video.videoWidth;canvas.height=video.videoHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.drawImage(video,0,0);
 if(typeof jsQR==='function'){
  const image=ctx.getImageData(0,0,canvas.width,canvas.height);
  return jsQR(image.data,image.width,image.height)?.data||'';
 }
 if('BarcodeDetector' in window){
  const d=new BarcodeDetector({formats:['qr_code']});
  return (await d.detect(canvas))[0]?.rawValue||'';
 }
 return '';
}
async function scanLoop(){
 if(!cameraActive)return;
 const video=el('nr-scan-video');
 if(video.readyState>=2 && video.videoWidth){
  try{const raw=await inspect(video);if(raw){await acceptCode(raw);return;}}
  catch(e){notice('Scan failed: '+e.message);stopCamera();return;}
 }
 if(cameraActive)scanFrame=requestAnimationFrame(scanLoop);
}
el('nr-start-scan').onclick=async()=>{
 if(!active())return;
 stopCamera();
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera access is unavailable.');
  scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  const v=el('nr-scan-video');v.hidden=false;v.srcObject=scanStream;await v.play();
  cameraActive=true;notice('Point the camera at a Nightreel QR code.');scanLoop();
 }catch(e){notice('Camera could not start: '+e.message+' You can upload a QR screenshot instead.');stopCamera();}
};
el('nr-file-scan').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  const picture=await createImageBitmap(file);
  canvas.width=picture.width;canvas.height=picture.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(picture,0,0);picture.close();
  if(typeof jsQR!=='function')throw Error('Image QR reader unavailable on this device.');
  const data=ctx.getImageData(0,0,canvas.width,canvas.height);
  const raw=jsQR(data.data,data.width,data.height)?.data;
  if(!raw)throw Error('No QR code found in that image.');
  await acceptCode(raw);
 }catch(err){notice(err.message);}finally{e.target.value='';}
};
menu.addEventListener('click',async e=>{
 const action=e.target.closest('[data-nr-menu]')?.dataset.nrMenu;
 if(!action)return;
 menu.hidden=true;btn.setAttribute('aria-expanded','false');
 if(action==='profile')document.querySelector('[data-social-view="profile"]')?.click();
 if(action==='qr'||action==='scan'){await openQR();if(action==='scan')el('nr-start-scan').focus();}
 if(action==='chat')window.NightreelOpenMessages?.();
});
const hero=el('profile-name');
if(hero){
 const avatarSpot=document.createElement('div');avatarSpot.id='nr-my-avatar-preview';avatarSpot.className='nr-profile-preview';hero.before(avatarSpot);
}
const invite=new URL(location.href).searchParams.get('friend');
if(invite && /^[A-Za-z][A-Za-z0-9_]{2,31}$/.test(invite)){
 const interval=setInterval(()=>{
  if(!active())return;
  clearInterval(interval);
  openQR().then(()=>acceptCode(invite)).catch(()=>{});
 },1500);
 setTimeout(()=>clearInterval(interval),90000);
}
const profileUpload=el('profile-avatar-file');
if(profileUpload)profileUpload.addEventListener('change',()=>setTimeout(()=>refreshProfileButton().catch(()=>{}),1000));
setInterval(()=>{if(active())refreshProfileButton().catch(()=>{});},6000);
window.NightreelOpenQR=openQR;
})();