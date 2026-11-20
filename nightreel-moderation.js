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
 open.setAttribute('aria-label','Review user reports');
 const countBadge=document.createElement('span');countBadge.id='nr-moderation-count';countBadge.hidden=true;
 countBadge.className='nr-moderation-count';countBadge.setAttribute('aria-live','polite');
 open.append(countBadge);
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
 let countBusy=false;
 const friendView=$('friend-view');
 const reportHistory=document.createElement('p');
 reportHistory.id='nr-profile-report-history';
 reportHistory.className='nr-profile-report-history';
 reportHistory.hidden=true;
 if(friendView)friendView.querySelector('.social-hero-content')?.append(reportHistory);
 let profileLookup=0;
 async function updateProfileReportCount(){
  const id=friendView?.dataset.friendId,shown=friendView&&!friendView.hidden;
  const request=++profileLookup;
  reportHistory.hidden=true;
  if(!shown||!id||open.hidden||!state?.user?.id)return;
  const {data,error}=await state.supabase.rpc('nightreel_moderation_report_counts',{p_user_ids:[id]});
  if(request!==profileLookup||friendView?.dataset.friendId!==id||open.hidden||friendView.hidden)return;
  if(error||!data?.length)return;
  reportHistory.textContent='Moderator only · Times reported: '+Number(data[0].times_reported||0);
  reportHistory.hidden=false;
 }
 if(friendView){
  const obs=new MutationObserver(updateProfileReportCount);
  obs.observe(friendView,{attributes:true,attributeFilter:['hidden','data-friend-id']});
 }
 async function loadReportCounts(reports){
  const ids=[...new Set(reports.map(x=>x.reported_user_id).filter(Boolean))];
  if(!ids.length)return new Map();
  const counts=new Map();
  for(let i=0;i<ids.length;i+=200){
   const {data,error}=await state.supabase.rpc('nightreel_moderation_report_counts',{p_user_ids:ids.slice(i,i+200)});
   if(error)throw error;
   for(const entry of data||[])counts.set(entry.user_id,Number(entry.times_reported)||0);
  }
  return counts;
 }
 async function checkModerator(){
  const id=state?.user?.id;
  if(!id||!state.supabase||state.demo){
   open.hidden=true;countBadge.hidden=true;reportHistory.hidden=true;currentUserId='';return;
  }
  if(currentUserId===id)return;
  currentUserId=id;open.hidden=true;
  try{
   const {data,error}=await state.supabase.from('nightreel_moderators')
    .select('user_id').eq('user_id',id).maybeSingle();
   if(currentUserId!==id)return;
   if(error)throw error;
   open.hidden=!data;
   if(data){await refreshCount();updateProfileReportCount();}
  }catch{open.hidden=true;countBadge.hidden=true;reportHistory.hidden=true;}
 }
 async function refreshCount(){
  if(open.hidden||countBusy||!state?.user?.id)return;
  countBusy=true;
  const userId=state.user.id;
  try{
   const {count,error}=await state.supabase.from('nightreel_reports')
    .select('id',{count:'exact',head:true}).is('reviewed_at',null);
   if(error)throw error;
   if(userId!==state.user?.id||open.hidden)return;
   const total=Math.max(0,Number(count)||0);
   countBadge.hidden=total===0;
   countBadge.textContent=total>99?'99+':String(total);
   open.setAttribute('aria-label',total===1?'Review 1 pending report':'Review '+total+' pending reports');
  }catch{
   countBadge.hidden=true;
  }finally{countBusy=false;}
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
  refreshCount();
  if(!data?.length){const p=document.createElement('p');p.textContent='No reports yet.';list.append(p);return;}
  let history;
  try{history=await loadReportCounts(data);}
  catch(e){status.textContent='Reports loaded, but history counts could not be retrieved: '+e.message;history=new Map();}
  for(const item of data){
   const card=document.createElement('article');card.className='nr-moderation-card';
   const h=document.createElement('h3');h.textContent=item.category+' · '+(item.reviewed_at?'Reviewed':'Awaiting review');
   const meta=document.createElement('p');meta.className='nr-moderation-meta';
   meta.textContent='Reported: '+item.reported_user_id+' · By: '+item.reporter_id+' · '+new Date(item.created_at).toLocaleString();
   const reason=document.createElement('p');reason.textContent=item.reason;
   const prior=document.createElement('p');prior.className='nr-moderation-history';
   prior.textContent=history.has(item.reported_user_id)
    ?'Times reported: '+history.get(item.reported_user_id)+' · All submitted reports, including reviewed'
    :'Times reported: unavailable';
   card.append(h,meta,prior,reason);
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
 setInterval(refreshCount,60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCount();});
 checkModerator();
})();