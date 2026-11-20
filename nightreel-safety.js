/* Nightreel social safety: friends can be reported or blocked; blocking ends friendship. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const friend=$('friend-view'),account=$('extra-account-dialog');
 if(!friend||!account)return;
 const bar=document.createElement('div');bar.className='nr-safety-controls';
 bar.innerHTML='<button type="button" id="nr-report-friend">Report profile or artwork</button>'+
  '<button type="button" id="nr-block-friend">Block user</button>';
 friend.querySelector('.social-hero')?.after(bar);
 const report=document.createElement('dialog');report.id='nr-report-dialog';report.className='extras-modal';
 report.innerHTML='<div class="extras-modal-inner"><div class="extras-top"><h2>Report a concern</h2><button type="button" class="extras-close" data-cancel>✕ Close</button></div>'+
  '<p>Tell us what concerns you about this person, their messages or artwork. Reports are private and can be reviewed by the Nightreel administrator.</p>'+
  '<form id="nr-report-form" class="extras-fields">'+
  '<label>What are you reporting?<select id="nr-report-type" required>'+
  '<option value="profile">Profile</option><option value="message">Messages</option><option value="artwork">Artwork</option><option value="other">Other</option></select></label>'+
  '<label>Describe the issue<textarea id="nr-report-reason" required minlength="5" maxlength="1000" rows="4" placeholder="Describe what happened (at least 5 characters)"></textarea></label>'+
  '<button type="submit" class="extras-primary">Send report</button></form>'+
  '<p class="extras-status" id="nr-report-status" role="status"></p></div>';
 document.body.append(report);
 report.querySelector('[data-cancel]').onclick=()=>report.close();
 report.addEventListener('click',e=>{if(e.target===report)report.close();});
 let reportedId=null;
 $('nr-report-friend').onclick=()=>{
  if(!state.user?.id||!friend.dataset.friendId)return;
  reportedId=friend.dataset.friendId;
  $('nr-report-form').reset();$('nr-report-status').textContent='';
  report.showModal();
 };
 $('nr-report-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const reason=$('nr-report-reason').value.trim();
  if(reason.length<5||!reportedId)return;
  const button=e.target.querySelector('button[type=submit]');button.disabled=true;
  try{
   const {error}=await state.supabase.from('nightreel_reports').insert({
    reporter_id:state.user.id,reported_user_id:reportedId,
    category:$('nr-report-type').value,reason
   });
   if(error)throw error;
   $('nr-report-status').textContent='Report submitted. Thank you for letting us know.';
   $('nr-report-form').reset();
  }catch(error){$('nr-report-status').textContent='Could not submit report: '+error.message;}
  finally{button.disabled=false;}
 });
 $('nr-block-friend').onclick=async()=>{
  const id=friend.dataset.friendId;
  const name=$('friend-name')?.textContent||'this person';
  if(!state.user?.id||!id||!confirm('Block '+name+'? You will be unfriended and neither of you can send new friend requests while blocked.'))return;
  const button=$('nr-block-friend');button.disabled=true;
  try{
   const {error}=await state.supabase.rpc('block_nightreel_user',{p_other_id:id});
   if(error)throw error;
   document.dispatchEvent(new CustomEvent('nightreel:friendship-changed'));
   document.querySelector('[data-social-view="friends"]')?.click();
   toast('Account blocked. You can unblock from your profile menu.');
  }catch(error){toast('Could not block account: '+error.message);}
  finally{button.disabled=false;}
 };
 const details=document.createElement('details');details.className='nr-safety-blocks';
 details.innerHTML='<summary>Blocked accounts</summary><div id="nr-blocked-list" class="extras-fields"></div>';
 account.querySelector('.extras-modal-inner')?.append(details);
 let loaded=false;
 details.addEventListener('toggle',async()=>{
  if(!details.open||!state.user?.id)return;
  const list=$('nr-blocked-list');list.textContent='Loading blocked accounts…';
  try{
   const {data,error}=await state.supabase.from('nightreel_blocks').select('blocked_id,created_at')
    .eq('blocker_id',state.user.id).order('created_at',{ascending:false});
   if(error)throw error;
   list.replaceChildren();
   if(!data?.length){list.textContent='No blocked accounts.';return;}
   for(const item of data){
    const row=document.createElement('div');row.className='nr-blocked-row';
    const label=document.createElement('span');label.textContent='Blocked account · '+item.blocked_id.slice(0,8);
    const button=document.createElement('button');button.type='button';button.textContent='Unblock';
    button.onclick=async()=>{
     button.disabled=true;
     const {error}=await state.supabase.from('nightreel_blocks').delete()
      .eq('blocker_id',state.user.id).eq('blocked_id',item.blocked_id);
     if(error){toast('Unblock failed: '+error.message);button.disabled=false;return;}
     row.remove();if(!list.children.length)list.textContent='No blocked accounts.';
     toast('Account unblocked. You can send a new friend request.');
    };
    row.append(label,button);list.append(row);
   }
  }catch(error){list.textContent='Could not load blocked accounts: '+error.message;}
 });
})();