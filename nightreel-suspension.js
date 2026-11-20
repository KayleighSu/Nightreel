/* Nightreel account restrictions. Server-side RLS is authoritative. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const account=$('extra-account-dialog');
if(!account)return;
const notice=document.createElement('div');notice.id='nr-suspension-notice';notice.hidden=true;
notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
const heading=document.createElement('strong');heading.textContent='Social features are suspended';
const description=document.createElement('p');
description.textContent='You can still access your account, read your existing messages, and submit an appeal. Sending messages and changing social connections are temporarily unavailable.';
const appeal=document.createElement('button');appeal.type='button';appeal.textContent='Review my appeals';
appeal.onclick=()=>{document.getElementById('nr-my-appeals')?.click();};
notice.append(heading,description,appeal);
account.querySelector('.extras-modal-inner')?.prepend(notice);
const banner=document.createElement('aside');banner.id='nr-suspension-banner';banner.hidden=true;
banner.setAttribute('role','status');
banner.innerHTML='<strong>Account suspended:</strong> Messages and social interactions are disabled. You can read conversations and appeal from your profile.';
document.body.append(banner);
let owner='',suspended=false,request=0;
const isSocialAction=el=>{
 if(!el)return false;
 return Boolean(el.closest(
  '#find-person-btn,#find-person,[data-request-id],[data-friend-action]:not([data-friend-action="view"]),'+
  '#nr-block-friend,#nr-unblock-friend,[data-block-id],#extra-request-list button,'+
  '#extra-scan-qr,#extra-invite,#extra-show-qr,[data-scan-action],#nr-chat-new-message'
 ));
};
function syncUi(){
 const active=suspended&&!!owner;
 notice.hidden=!active;banner.hidden=!active;
 document.body.classList.toggle('nr-is-suspended',active);
 const mobile=$('extra-send-message');
 const input=$('extra-chat-text'),send=$('extra-send-button');
 if(mobile)mobile.classList.toggle('nr-suspended-compose',active);
 if(input){input.disabled=active;input.placeholder=active?'Messaging unavailable during suspension':'Write a message…';}
 if(send)send.disabled=active;
 for(const dock of document.querySelectorAll('.nr-dock-form')){
  dock.classList.toggle('nr-suspended-compose',active);
  const area=dock.querySelector('textarea');const button=dock.querySelector('button[type=submit]');
  if(area){area.disabled=active;area.placeholder=active?'Messaging unavailable during suspension':'Write a message…';}
  if(button)button.disabled=active;
 }
 for(const button of document.querySelectorAll('#find-person-btn,[data-request-id],[data-friend-action]:not([data-friend-action="view"]),#nr-block-friend,#extra-scan-qr,#extra-invite,#extra-show-qr,#extra-request-list button')){
  button.disabled=active;
  if(active)button.title='Social features are unavailable during an account suspension';
 }
}
async function refresh(){
 const uid=state?.user?.id;
 if(!uid||!state.supabase||state.demo){
  owner='';suspended=false;syncUi();return;
 }
 const next=++request;owner=uid;
 try{
  const {data,error}=await state.supabase.rpc('nightreel_my_suspension');
  if(next!==request||owner!==state.user?.id)return;
  if(error)throw error;
  suspended=Boolean(data?.[0]?.is_suspended);
  syncUi();
 }catch(e){console.warn('Nightreel suspension status unavailable',e);syncUi();}
}
document.addEventListener('click',event=>{
 if(!suspended||!owner||!isSocialAction(event.target))return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
 const s=document.getElementById('nr-suspension-banner');
 if(s){s.hidden=false;s.classList.add('nr-suspension-flash');setTimeout(()=>s.classList.remove('nr-suspension-flash'),1300);}
},true);
document.addEventListener('submit',event=>{
 if(!suspended||!owner||!event.target.matches('#extra-send-message,.nr-dock-form'))return;
 event.preventDefault();event.stopImmediatePropagation();
},true);
const observer=new MutationObserver(()=>{if(suspended)syncUi();});
observer.observe(document.body,{subtree:true,childList:true});
document.addEventListener('nightreel:workspace-ready',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
setInterval(refresh,20000);
refresh();
})();
