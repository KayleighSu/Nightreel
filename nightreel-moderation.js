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
 const inspector=document.createElement('dialog');
 inspector.id='nr-moderation-inspector';inspector.className='extras-modal nr-moderation-inspector';
 inspector.innerHTML='<div class="extras-modal-inner">'+
  '<div class="extras-top"><h2>Review account</h2><button type="button" id="nr-inspector-close" class="extras-close">Close</button></div>'+
  '<p id="nr-inspector-status" class="extras-status" role="status"></p>'+
  '<div id="nr-inspector-content"></div></div>';
 document.body.append(inspector);
 $('nr-inspector-close').onclick=()=>inspector.close();
 inspector.addEventListener('click',e=>{if(e.target===inspector)inspector.close();});
 $('nr-moderation-close').onclick=()=>dialog.close();
 let inspectedId='';
 function elem(tag,className,textValue){
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(textValue!==undefined)el.textContent=String(textValue);
  return el;
 }
 function safeUrl(input){
  try{const u=new URL(input);return u.protocol==='https:'?u.href:null;}catch{return null;}
 }
 async function signedImage(bucket,path){
  if(!path)return null;
  const {data,error}=await state.supabase.storage.from(bucket).createSignedUrl(path,180);
  return error?null:safeUrl(data?.signedUrl);
 }
 async function takeAction(action,target,display){
  const map={
   suspend_7d:['Suspend for 7 days','SUSPEND ACCOUNT'],
   suspend_permanent:['Ban indefinitely','BAN ACCOUNT'],
   unsuspend:['Lift suspension','LIFT SUSPENSION'],
   remove_avatar:['Remove avatar','REMOVE ARTWORK'],
   remove_banner:['Remove banner','REMOVE ARTWORK']
  };
  const setting=map[action];if(!setting)return;
  const phrase=window.prompt(setting[0]+' for '+display+'? Type '+setting[1]+' to confirm. This action is logged.');
  if(phrase!==setting[1])return;
  const detail=window.prompt('Optional moderation note (not visible to the reported user):')||'';
  const status=$('nr-inspector-status');
  status.textContent='Applying '+setting[0].toLowerCase()+'…';
  const buttons=inspector.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
  try{
   const {data,error}=await state.supabase.functions.invoke('moderate-account',{
    body:{action,targetUserId:target,confirmation:phrase,detail}
   });
   if(error||!data?.ok)throw new Error(data?.error||error?.message||'Action failed');
   await inspect(target);
   $('nr-inspector-status').textContent=setting[0]+' completed. '+(data.warning||'');
  }catch(e){
   status.textContent='Could not apply action: '+(e.message||'Unknown error');
  }finally{buttons.forEach(b=>b.disabled=false);}
 }
 async function inspect(id){
  if(!id||open.hidden||!state.user?.id)return;
  inspectedId=id;
  if(!inspector.open)inspector.showModal();
  $('nr-inspector-status').textContent='Loading profile and artwork…';
  $('nr-inspector-content').replaceChildren();
  const {data,error}=await state.supabase.rpc('nightreel_moderator_inspect_user',{p_user_id:id});
  if(inspectedId!==id||!inspector.open)return;
  const panel=$('nr-inspector-content');
  if(error){$('nr-inspector-status').textContent='Access denied or profile unavailable: '+error.message;return;}
  if(!data?.profile){$('nr-inspector-status').textContent='This account profile no longer exists.';return;}
  $('nr-inspector-status').textContent='Moderator-only information · Profile inspection is logged when you take an action.';
  const profile=data.profile;
  const headline=elem('div','nr-inspector-identity');
  const names=elem('div');
  names.append(elem('h3','',profile.display_name||profile.username||'Unnamed account'),
   elem('p','nr-moderation-meta','@'+(profile.username||'unknown')+' · '+id),
   elem('p','nr-moderation-history','Times reported: '+Number(data.times_reported||0)),
   elem('p','nr-moderation-meta','Joined '+new Date(profile.created_at).toLocaleDateString()));
  const avatar=await signedImage('nightreel-avatars',profile.avatar_path);
  if(inspectedId!==id||!inspector.open)return;
  if(avatar){const im=elem('img','nr-inspector-avatar');im.src=avatar;im.alt='Reported account avatar';headline.append(im);}
  headline.append(names);
  panel.append(headline);
  const banner=await signedImage('nightreel-banners',profile.banner_path);
  if(inspectedId!==id||!inspector.open)return;
  if(banner){const im=elem('img','nr-inspector-banner');im.src=banner;im.alt='Reported account banner';panel.append(im);}
  const bannedUntil=data.banned_until?new Date(data.banned_until):null;
  const isBanned=!!bannedUntil && !Number.isNaN(bannedUntil.getTime()) && bannedUntil.getTime()>Date.now();
  panel.append(elem('p','nr-moderation-history',
   isBanned?'Account status: SUSPENDED until '+bannedUntil.toLocaleString():'Account status: No active suspension'));
  panel.append(elem('h3','','Account moderation'));
  panel.append(elem('p','nr-moderation-meta','Suspensions block new sign-ins, but an already-issued access token may remain valid until it expires. Reversible actions are preferred.'));
  const controls=elem('div','nr-inspector-actions');
  for(const [action,label,shown] of [
   ['suspend_7d','Suspend 7 days',true],
   ['suspend_permanent','Ban indefinitely',true],
   ['unsuspend','Lift suspension',true],
   ['remove_avatar','Remove avatar',!!profile.avatar_path],
   ['remove_banner','Remove banner',!!profile.banner_path]
  ]){
   if(!shown)continue;
   const button=elem('button','extras-secondary',label);
   button.type='button';
   button.onclick=()=>takeAction(action,id,profile.display_name||profile.username||id);
   controls.append(button);
  }
  panel.append(controls);
  panel.append(elem('h3','','Profile artwork and anime collection'));
  panel.append(elem('p','nr-moderation-meta','Only public-facing content is shown. Private anime notes and private messages are not exposed here.'));
  const collection=elem('div','nr-inspector-artwork');
  const entries=Array.isArray(data.entries)?data.entries:[];
  for(const entry of entries){
   const item=elem('article','nr-inspector-entry');
   const url=safeUrl(entry.image_url);
   if(url){const img=elem('img');img.src=url;img.loading='lazy';img.alt='Artwork for '+(entry.title||'anime');item.append(img);}
   const inner=elem('div');
   inner.append(elem('strong','',entry.title||'Untitled'));
   if(entry.public_notes)inner.append(elem('p','',entry.public_notes));
   item.append(inner);collection.append(item);
  }
  panel.append(collection);
  if(!entries.length)panel.append(elem('p','nr-moderation-meta','No anime entries found.'));
  const actions=Array.isArray(data.actions)?data.actions:[];
  panel.append(elem('h3','','Previous moderation actions'));
  if(!actions.length)panel.append(elem('p','nr-moderation-meta','No previous actions recorded.'));
  for(const a of actions)panel.append(elem('p','nr-moderation-meta',new Date(a.created_at).toLocaleString()+' · '+a.action+(a.detail?' · '+a.detail:'')));
 }
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
   const inspectButton=elem('button','extras-secondary','Inspect reported account');
   inspectButton.type='button';inspectButton.onclick=()=>inspect(item.reported_user_id);
   card.append(inspectButton);
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