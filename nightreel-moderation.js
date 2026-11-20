/* Private Nightreel moderation inbox. Database RLS is authoritative. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const account=$('extra-account-dialog');
 if(!account)return;
 const actions=account.querySelector('.extras-menu-actions');
 if(!actions)return;
 const open=document.createElement('button');
 open.type='button';open.id='nr-moderation-open';
 open.className='extras-secondary';open.textContent='Review user reports';open.hidden=true;
 actions.append(open);
 const dialog=document.createElement('dialog');dialog.id='nr-moderation-dialog';dialog.className='extras-modal';
 dialog.innerHTML='<div class="extras-modal-inner">'+
 '<div class="extras-top"><h2>Nightreel reports</h2><button type="button" id="nr-moderation-close" class="extras-close">Close</button></div>'+
 '<p>Reports are private. Review the reason and decide whether any action is needed. Marking reviewed does not automatically remove or ban anyone.</p>'+
 '<button type="button" class="extras-secondary" id="nr-moderation-refresh">Refresh reports</button>'+
 '<p id="nr-moderation-status" class="extras-status" role="status"></p>'+
 '<div id="nr-moderation-list" class="nr-moderation-list"></div></div>';
 document.body.append(dialog);
 $('nr-moderation-close').onclick=()=>dialog.close();
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 let currentUserId='';
 async function checkModerator(){
  const id=state?.user?.id;
  if(!id||!state.supabase||state.demo){
   open.hidden=true;currentUserId='';return;
  }
  if(currentUserId===id)return;
  currentUserId=id;open.hidden=true;
  try{
   const {data,error}=await state.supabase.from('nightreel_moderators')
    .select('user_id').eq('user_id',id).maybeSingle();
   if(currentUserId!==id)return;
   if(error)throw error;
   open.hidden=!data;
  }catch{open.hidden=true;}
 }
 async function refresh(){
  if(!state?.user?.id||open.hidden){dialog.close();return;}
  const list=$('nr-moderation-list'),status=$('nr-moderation-status');
  status.textContent='Loading reports…';list.replaceChildren();
  const {data,error}=await state.supabase.from('nightreel_reports')
   .select('id,reporter_id,reported_user_id,category,reason,created_at,reviewed_at')
   .order('created_at',{ascending:false}).limit(200);
  if(error){status.textContent='Could not retrieve reports: '+error.message;return;}
  const pending=(data||[]).filter(x=>!x.reviewed_at).length;
  status.textContent=(data||[]).length+' reports shown · '+pending+' awaiting review';
  if(!data?.length){const p=document.createElement('p');p.textContent='No reports yet.';list.append(p);return;}
  for(const item of data){
   const card=document.createElement('article');card.className='nr-moderation-card';
   const h=document.createElement('h3');h.textContent=item.category+' · '+(item.reviewed_at?'Reviewed':'Awaiting review');
   const meta=document.createElement('p');meta.className='nr-moderation-meta';
   meta.textContent='Reported: '+item.reported_user_id+' · By: '+item.reporter_id+' · '+new Date(item.created_at).toLocaleString();
   const reason=document.createElement('p');reason.textContent=item.reason;
   card.append(h,meta,reason);
   if(item.reviewed_at){
    const date=document.createElement('p');date.className='nr-moderation-meta';
    date.textContent='Reviewed '+new Date(item.reviewed_at).toLocaleString();card.append(date);
   }else{
    const button=document.createElement('button');button.type='button';button.className='extras-secondary';
    button.textContent='Mark reviewed';
    button.onclick=async()=>{
     button.disabled=true;
     const {error}=await state.supabase.from('nightreel_reports')
      .update({reviewed_at:new Date().toISOString()}).eq('id',item.id);
     if(error){button.disabled=false;status.textContent='Could not update report: '+error.message;return;}
     await refresh();
    };
    card.append(button);
   }
   list.append(card);
  }
 }
 open.onclick=()=>{account.close();dialog.showModal();refresh();};
 $('nr-moderation-refresh').onclick=refresh;
 document.addEventListener('nightreel:workspace-ready',checkModerator);
 setInterval(checkModerator,4500);
 checkModerator();
})();