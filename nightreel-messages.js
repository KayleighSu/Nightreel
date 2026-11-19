/* Nightreel: private direct messages for accepted friends. */
(function(){
'use strict';
const el=id=>document.getElementById(id);
const signedIn=()=>Boolean(state?.supabase && state?.user && !state.demo);
const modal=document.createElement('dialog');modal.id='nr-messages-modal';modal.className='nr-feature-modal';
modal.innerHTML='<div class="nr-feature-inner"><header><h2>Messages</h2><button type="button" id="nr-close-chat" aria-label="Close messages">×</button></header><p>Talk with accepted friends. Messages are private to the conversation but are not end-to-end encrypted.</p><label class="social-field">Choose a friend<select id="nr-chat-friend"><option value="">Select a friend…</option></select></label><div class="nr-chat-history" id="nr-chat-history" aria-live="polite" role="log"></div><form id="nr-chat-compose"><label class="social-field" for="nr-chat-body">Your message</label><textarea id="nr-chat-body" rows="3" maxlength="2000" placeholder="Write a message…" required></textarea><div class="nr-feature-actions"><button class="btn btn-primary" type="submit" id="nr-chat-send">Send</button><span role="status" id="nr-chat-feedback"></span></div></form></div>';
document.body.append(modal);
let activeFriend='',pollTimer=null,inFlight=false;
const feedback=s=>el('nr-chat-feedback').textContent=s;
function clearPoll(){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}}
el('nr-close-chat').onclick=()=>modal.close();
modal.addEventListener('close',clearPoll);
async function getPeers(){
 const r=await state.supabase.rpc('get_nightreel_connections');
 if(r.error)throw r.error;
 return (r.data||[]).filter(f=>f.status==='accepted').map(f=>({
  id:f.requester_id===state.user.id?f.recipient_id:f.requester_id,
  username:f.username,display:f.display_name
 }));
}
async function openMessages(wanted=''){
 if(!signedIn())return;
 if(!modal.open)modal.showModal();
 feedback('');
 try{
  const friends=await getPeers(),selector=el('nr-chat-friend');
  selector.replaceChildren(new Option('Select a friend…',''));
  friends.forEach(f=>selector.append(new Option(f.display+' (@'+f.username+')',f.id)));
  const pick=wanted||activeFriend;
  activeFriend=friends.some(f=>f.id===pick)?pick:'';
  selector.value=activeFriend;
  el('nr-chat-history').replaceChildren();
  if(activeFriend)await loadConversation(true);
  else el('nr-chat-history').textContent='Choose a friend to begin.';
 }catch(e){feedback('Could not load friends: '+e.message);}
 clearPoll();
 pollTimer=setInterval(()=>{if(modal.open && !document.hidden)loadConversation(false);},8000);
}
async function loadConversation(scroll){
 if(!modal.open||!signedIn()||!activeFriend||inFlight)return;
 inFlight=true;
 const who=activeFriend;
 try{
  if(!/^[a-f0-9-]{36}$/i.test(who))throw Error('Invalid friend ID');
  const me=state.user.id;
  const filter='and(sender_id.eq.'+me+',recipient_id.eq.'+who+'),and(sender_id.eq.'+who+',recipient_id.eq.'+me+')';
  const r=await state.supabase.from('direct_messages').select('id,sender_id,recipient_id,body,created_at').or(filter).order('created_at',{ascending:true}).limit(200);
  if(r.error)throw r.error;
  if(who!==activeFriend)return;
  const list=el('nr-chat-history'),atEnd=list.scrollHeight-list.clientHeight-list.scrollTop<90;
  list.replaceChildren();
  for(const row of r.data||[]){
   const wrapper=document.createElement('div');wrapper.className='nr-message '+(row.sender_id===me?'nr-outgoing':'nr-incoming');
   const p=document.createElement('p');p.textContent=row.body;
   const meta=document.createElement('small');meta.textContent=new Date(row.created_at).toLocaleString();
   wrapper.append(p,meta);list.append(wrapper);
  }
  if(scroll||atEnd)list.scrollTop=list.scrollHeight;
  feedback('');
 }catch(e){feedback('Could not load messages: '+e.message);}
 finally{inFlight=false;}
}
el('nr-chat-friend').onchange=()=>{
 activeFriend=el('nr-chat-friend').value;
 el('nr-chat-history').replaceChildren();
 if(activeFriend)loadConversation(true);
};
el('nr-chat-compose').onsubmit=async e=>{
 e.preventDefault();
 if(!signedIn()||!activeFriend)return feedback('Choose a friend.');
 const body=el('nr-chat-body').value.trim();
 if(!body||body.length>2000)return feedback('Type a message (maximum 2,000 characters).');
 el('nr-chat-send').disabled=true;
 try{
  const r=await state.supabase.from('direct_messages').insert({
    sender_id:state.user.id,recipient_id:activeFriend,body
  });
  if(r.error)throw r.error;
  el('nr-chat-body').value='';
  await loadConversation(true);
 }catch(e){feedback('Message could not be sent: '+e.message);}
 finally{el('nr-chat-send').disabled=false;}
};
document.getElementById('friends-results')?.addEventListener('click',e=>{
 const b=e.target.closest('[data-nr-message-to]');
 if(!b)return;
 e.stopImmediatePropagation();
 openMessages(b.dataset.nrMessageTo);
},true);
function addFriendMessageButtons(){
 const area=document.getElementById('friends-results');
 if(!area)return;
 area.querySelectorAll('[data-friend-action="view"]').forEach(b=>{
  if(b.nextElementSibling?.dataset.nrMessageTo===b.dataset.friendId)return;
  const button=document.createElement('button');button.type='button';button.textContent='Message';
  button.dataset.nrMessageTo=b.dataset.friendId;b.after(button);
 });
}
const target=document.getElementById('friends-results');
if(target)new MutationObserver(addFriendMessageButtons).observe(target,{childList:true,subtree:true});
window.NightreelOpenMessages=openMessages;
})();