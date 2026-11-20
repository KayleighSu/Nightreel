/* Nightreel moderator workspace. Authorization is enforced by Supabase, not by these controls. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const account=$('extra-account-dialog');
if(!account?.querySelector('.extras-menu-actions'))return;
const elt=(tag,cls,content)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(content!==undefined)node.textContent=String(content);
 return node;
};
const linkUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
const date=value=>value?new Date(value).toLocaleString():'Unknown';
const trigger=elt('button','extras-secondary','Review user reports');
trigger.id='nr-moderation-open';trigger.type='button';trigger.hidden=true;
const countTag=elt('span','nr-moderation-count');
countTag.id='nr-moderation-count';countTag.hidden=true;trigger.append(countTag);
account.querySelector('.extras-menu-actions').append(trigger);
const dialog=elt('dialog','extras-modal nr-mod-workspace');
dialog.id='nr-moderation-dialog';
dialog.innerHTML=`
 <div class="nr-mod-shell">
  <header class="nr-mod-header">
   <div><p class="nr-mod-eyebrow">NIGHTREEL · ADMINISTRATION</p><h2>Moderation center</h2><p>Review reports, inspect accounts, and record a decision.</p></div>
   <button class="extras-close" type="button" id="nr-moderation-close" aria-label="Close moderation center">✕ Close</button>
  </header>
  <div class="nr-mod-toolbar">
   <div id="nr-mod-summary" class="nr-mod-summary" aria-live="polite">Loading…</div>
   <div class="nr-mod-toolbar-actions">
    <label for="nr-mod-filter">Show</label>
    <select id="nr-mod-filter"><option value="pending">Awaiting review</option><option value="all">All reports</option><option value="reviewed">Reviewed</option></select>
    <button type="button" id="nr-moderation-refresh" class="extras-secondary">↻ Refresh</button>
   </div>
  </div>
  <p id="nr-moderation-status" class="nr-mod-status" role="status"></p>
  <div class="nr-mod-columns">
   <section class="nr-mod-queue" aria-label="Submitted reports">
    <div id="nr-moderation-list" class="nr-moderation-list"></div>
   </section>
   <section class="nr-mod-detail" id="nr-mod-detail" aria-label="Account review">
    <div class="nr-mod-empty"><strong>Select a report</strong><p>Choose a report to inspect the account and its public-facing content.</p></div>
   </section>
  </div>
 </div>`;
document.body.append(dialog);
$('nr-moderation-close').onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
let moderatorId='',selectedReport='',currentReports=[],profiles=new Map(),history=new Map(),loadId=0,inspectedId='';
const status=$('nr-moderation-status'),list=$('nr-moderation-list'),detail=$('nr-mod-detail'),filter=$('nr-mod-filter');
async function isModerator(){
 const id=state?.user?.id;
 if(!id||!state.supabase||state.demo){trigger.hidden=true;countTag.hidden=true;moderatorId='';return false;}
 if(moderatorId===id)return !trigger.hidden;
 moderatorId=id;trigger.hidden=true;
 const {data,error}=await state.supabase.from('nightreel_moderators').select('user_id').eq('user_id',id).maybeSingle();
 if(moderatorId!==id)return false;
 trigger.hidden=!!error||!data;
 if(!trigger.hidden){refreshCount();updateFriendHistory();}
 return !trigger.hidden;
}
async function refreshCount(){
 if(trigger.hidden||!state?.user?.id)return;
 const id=state.user.id;
 const {count,error}=await state.supabase.from('nightreel_reports').select('id',{count:'exact',head:true}).is('reviewed_at',null);
 if(error||state.user?.id!==id)return;
 countTag.hidden=!count;countTag.textContent=Number(count)>99?'99+':String(count||0);
 trigger.setAttribute('aria-label',count?'Review '+count+' pending reports':'Review user reports');
}
async function loadHistory(rows){
 const ids=[...new Set(rows.map(r=>r.reported_user_id).filter(Boolean))],counts=new Map();
 for(let i=0;i<ids.length;i+=200){
  const {data,error}=await state.supabase.rpc('nightreel_moderation_report_counts',{p_user_ids:ids.slice(i,i+200)});
  if(error)throw error;
  for(const r of data||[])counts.set(r.user_id,Number(r.times_reported)||0);
 }
 return counts;
}
function actionButton(text,cls,callback){
 const b=elt('button',cls,text);b.type='button';b.addEventListener('click',callback);return b;
}
async function loadReports(preselect){
 if(trigger.hidden||!state.user?.id)return;
 const request=++loadId;
 status.textContent='Loading reports…';list.replaceChildren();
 const {data,error}=await state.supabase.from('nightreel_reports')
   .select('id,reporter_id,reported_user_id,category,reason,created_at,reviewed_at,review_decision')
   .order('created_at',{ascending:false}).limit(200);
 if(request!==loadId)return;
 if(error){status.textContent='Unable to retrieve reports: '+error.message;return;}
 currentReports=data||[];
 const ids=[...new Set(currentReports.map(r=>r.reported_user_id).filter(Boolean))];
 profiles=new Map();
 try{
  for(let i=0;i<ids.length;i+=100){
   const {data:found,error:pe}=await state.supabase.from('profiles').select('id,username,display_name,avatar_path').in('id',ids.slice(i,i+100));
   if(pe)throw pe;
   for(const p of found||[])profiles.set(p.id,p);
  }
 }catch(e){status.textContent='Reports loaded; profile names unavailable: '+e.message;}
 try{history=await loadHistory(currentReports);}catch(e){history=new Map();status.textContent='Reports loaded; history unavailable: '+e.message;}
 const total=currentReports.length,pending=currentReports.filter(r=>!r.reviewed_at).length;
 $('nr-mod-summary').textContent=pending+' awaiting review · '+total+' recent reports';
 if(!status.textContent.startsWith('Reports loaded'))status.textContent='';
 renderReports();
 const chosen=preselect||selectedReport;
 const narrow=window.matchMedia('(max-width:720px)').matches;
 if(chosen&&currentReports.some(r=>r.id===chosen)&&(!narrow||detail.classList.contains('nr-mod-detail-open'))){showDetail(chosen);}
 else if(!narrow&&currentReports.some(r=>!r.reviewed_at)){showDetail(currentReports.find(r=>!r.reviewed_at).id);}
 else if(!narrow&&currentReports.length&&filter.value!=='pending'){showDetail(currentReports[0].id);}
 else {selectedReport='';detail.innerHTML='<div class="nr-mod-empty"><strong>Select a report</strong><p>Use the review buttons to inspect an account.</p></div>';}
 refreshCount();
}
function renderReports(){
 list.replaceChildren();
 const selected=currentReports.filter(r=>filter.value==='all'||(filter.value==='pending'?!r.reviewed_at:!!r.reviewed_at));
 if(!selected.length){list.append(elt('p','nr-mod-no-reports','No reports in this view.'));return;}
 for(const item of selected){
  const profile=profiles.get(item.reported_user_id)||{};
  const card=elt('article','nr-mod-case');
  if(item.id===selectedReport)card.classList.add('is-selected');
  const top=elt('div','nr-mod-case-top');
  top.append(elt('span','nr-mod-category',item.category||'Other'),
    elt('span','nr-mod-state '+(item.reviewed_at?'is-reviewed':'is-pending'),
     item.reviewed_at?(item.review_decision==='dismissed'?'Dismissed':item.review_decision==='resolved'?'Resolved':'Reviewed'):'Awaiting review'));
  const identity=elt('div','nr-mod-case-identity');
  const face=elt('div','nr-mod-case-avatar',(profile.display_name||profile.username||'?').charAt(0).toUpperCase());
  const names=elt('div');
  names.append(elt('strong','',profile.display_name||profile.username||'Account unavailable'),
    elt('small','',profile.username?'@'+profile.username:'Account ID: '+item.reported_user_id.slice(0,8)));
  identity.append(face,names);
  const note=elt('p','nr-mod-case-reason',item.reason);
  const stats=elt('p','nr-mod-case-meta',
    'Times reported: '+(history.has(item.reported_user_id)?history.get(item.reported_user_id):'—')+' · '+date(item.created_at));
  const actions=elt('div','nr-mod-card-actions');
  actions.append(
   actionButton('View profile','nr-mod-button',()=>showDetail(item.id,'profile')),
   actionButton('Review content','nr-mod-button',()=>showDetail(item.id,'content')),
   actionButton('Suspend account','nr-mod-button nr-mod-button-warn',()=>showDetail(item.id,'actions')),
   actionButton('Dismiss report','nr-mod-button nr-mod-button-muted',()=>dismiss(item)));
  if(item.reviewed_at)actions.lastElementChild.disabled=true;
  card.append(top,identity,note,stats,actions);list.append(card);
 }
}
async function signedImage(bucket,path){
 if(!path)return '';
 const {data,error}=await state.supabase.storage.from(bucket).createSignedUrl(path,180);
 return error?'':linkUrl(data?.signedUrl);
}
async function dismiss(item){
 if(item.reviewed_at)return;
 if(!confirm('Dismiss this report without taking action against the account? The report will remain in history.'))return;
 await decide(item,'dismissed');
}
async function decide(item,decision){
 const {error}=await state.supabase.from('nightreel_reports')
  .update({reviewed_at:new Date().toISOString(),review_decision:decision}).eq('id',item.id).is('reviewed_at',null);
 if(error){status.textContent='Could not save review: '+error.message;return;}
 await loadReports(item.id);
 status.textContent=decision==='dismissed'?'Report dismissed and retained in history.':'Report marked resolved.';
}
async function takeAction(action,id,name){
 const labels={
  suspend_7d:['Suspend account for 7 days','SUSPEND ACCOUNT'],
  suspend_permanent:['Ban account indefinitely','BAN ACCOUNT'],
  unsuspend:['Lift account suspension','LIFT SUSPENSION'],
  remove_avatar:['Remove avatar','REMOVE ARTWORK'],
  remove_banner:['Remove banner','REMOVE ARTWORK']
 };
 if(!labels[action])return;
 const phrase=prompt(labels[action][0]+' for '+name+'? Type '+labels[action][1]+' to confirm.');
 if(phrase!==labels[action][1])return;
 const notes=prompt('Optional internal moderation note:')||'';
 const buttons=[...detail.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 status.textContent='Applying '+labels[action][0].toLowerCase()+'…';
 try{
  const {data,error}=await state.supabase.functions.invoke('moderate-account',{
   body:{action,targetUserId:id,confirmation:phrase,detail:notes}});
  if(error||!data?.ok)throw Error(data?.error||error?.message||'Action failed');
  status.textContent=labels[action][0]+' completed. '+(data.warning||'');
  await showDetail(selectedReport,'actions');
 }catch(e){status.textContent='Action failed: '+e.message;}
 finally{buttons.forEach(b=>b.disabled=false);}
}
let detailRequest=0;
async function showDetail(reportId,focus){
 const item=currentReports.find(r=>r.id===reportId);if(!item)return;
 selectedReport=reportId;inspectedId=item.reported_user_id;
 const sequence=++detailRequest;
 renderReports();
 detail.replaceChildren();
 const heading=elt('div','nr-mod-detail-header');
 const headingText=elt('div');
 headingText.append(elt('span','nr-mod-eyebrow','REPORTED ACCOUNT'),elt('h3','','Account review'));
 const close=actionButton('← Reports','nr-mod-mobile-back',()=>detail.classList.remove('nr-mod-detail-open'));
 heading.append(headingText,close);detail.append(heading,elt('p','nr-mod-wait','Loading account…'));
 detail.classList.add('nr-mod-detail-open');
 const {data,error}=await state.supabase.rpc('nightreel_moderator_inspect_user',{p_user_id:item.reported_user_id});
 if(sequence!==detailRequest||!dialog.open)return;
 detail.replaceChildren(heading);
 if(error||!data?.profile){
  detail.append(elt('p','nr-mod-error',error?.message||'This user no longer has a profile.'));
  const dismissButton=actionButton('Dismiss report','nr-mod-button',()=>dismiss(item));detail.append(dismissButton);
  return;
 }
 const profile=data.profile;
 const identity=elt('div','nr-mod-user');
 const avatarBox=elt('div','nr-mod-user-avatar',(profile.display_name||profile.username||'?').slice(0,1).toUpperCase());
 const avatar=await signedImage('nightreel-avatars',profile.avatar_path);
 if(sequence!==detailRequest||!dialog.open)return;
 if(avatar){avatarBox.textContent='';const img=elt('img');img.src=avatar;img.alt='Profile avatar';avatarBox.append(img);}
 const info=elt('div');
 info.append(elt('h3','',profile.display_name||profile.username||'Unnamed user'),
  elt('p','nr-mod-muted','@'+(profile.username||'unknown')),
  elt('p','nr-mod-muted','Joined '+new Date(profile.created_at).toLocaleDateString()));
 identity.append(avatarBox,info);detail.append(identity);
 const statrow=elt('div','nr-mod-stats');
 const times=elt('div','nr-mod-stat');times.append(elt('strong','',Number(data.times_reported)||0),elt('span','','Times reported'));
 const until=data.banned_until?new Date(data.banned_until):null;
 const banned=until&&!Number.isNaN(until.getTime())&&until.getTime()>Date.now();
 const ban=elt('div','nr-mod-stat');ban.append(elt('strong','',banned?'Suspended':'Active'),elt('span','',banned?'Until '+date(data.banned_until):'Account status'));
 statrow.append(times,ban);detail.append(statrow);
 const reported=elt('section','nr-mod-detail-section');
 reported.append(elt('h4','','Current report'),elt('p','nr-mod-muted',(item.category||'Other')+' · '+date(item.created_at)),elt('p','nr-mod-reason-full',item.reason));
 detail.append(reported);
 const profileSection=elt('section','nr-mod-detail-section');profileSection.id='nr-mod-profile-section';
 profileSection.append(elt('h4','','Profile & banner'));
 const banner=await signedImage('nightreel-banners',profile.banner_path);
 if(sequence!==detailRequest||!dialog.open)return;
 if(banner){const image=elt('img','nr-mod-banner');image.src=banner;image.alt='User banner';profileSection.append(image);}
 else profileSection.append(elt('p','nr-mod-muted','No uploaded profile banner.'));
 detail.append(profileSection);
 const content=elt('section','nr-mod-detail-section');content.id='nr-mod-content-section';
 content.append(elt('h4','','Public-facing anime content'),
   elt('p','nr-mod-muted','Review submitted artwork and public notes. Private messages and private notes are not shown.'));
 const grid=elt('div','nr-mod-art-grid');
 for(const e of Array.isArray(data.entries)?data.entries:[]){
  const card=elt('article','nr-mod-art-card');
  const url=linkUrl(e.image_url);
  if(url){const img=elt('img');img.src=url;img.loading='lazy';img.alt='Artwork for '+(e.title||'anime');card.append(img);}
  const text=elt('div');text.append(elt('strong','',e.title||'Untitled'));
  if(e.public_notes)text.append(elt('p','',e.public_notes));
  card.append(text);grid.append(card);
 }
 if(!grid.children.length)grid.append(elt('p','nr-mod-muted','No anime entries.'));
 content.append(grid);detail.append(content);
 const control=elt('section','nr-mod-detail-section');control.id='nr-mod-actions-section';
 control.append(elt('h4','','Administrator actions'),elt('p','nr-mod-muted','Suspensions are reversible. An existing login token may remain active until expiry.'));
 const buttons=elt('div','nr-mod-action-grid');
 for(const [code,label,show]of [
  ['suspend_7d','Suspend 7 days',true],
  ['suspend_permanent','Ban indefinitely',true],
  ['unsuspend','Lift suspension',!!banned],
  ['remove_avatar','Remove avatar',!!profile.avatar_path],
  ['remove_banner','Remove banner',!!profile.banner_path]
 ]){
  if(show)buttons.append(actionButton(label,'nr-mod-button'+(code.includes('suspend')?' nr-mod-button-warn':''),()=>takeAction(code,item.reported_user_id,profile.display_name||profile.username||'account')));
 }
 control.append(buttons);detail.append(control);
 const decisions=elt('section','nr-mod-detail-section');
 decisions.append(elt('h4','','Close report'));
 const finish=elt('div','nr-mod-action-grid');
 if(!item.reviewed_at){
  finish.append(actionButton('Mark resolved','nr-mod-button nr-mod-button-primary',()=>decide(item,'resolved')),
   actionButton('Dismiss report','nr-mod-button',()=>dismiss(item)));
 }else finish.append(elt('p','nr-mod-muted','Report '+(item.review_decision||'reviewed')+' on '+date(item.reviewed_at)));
 decisions.append(finish);detail.append(decisions);
 const prev=elt('section','nr-mod-detail-section');prev.append(elt('h4','','Previous account actions'));
 for(const a of data.actions||[])prev.append(elt('p','nr-mod-muted',date(a.created_at)+' · '+a.action+(a.detail?' · '+a.detail:'')));
 if(!(data.actions||[]).length)prev.append(elt('p','nr-mod-muted','No previous moderator actions.'));
 detail.append(prev);
 if(focus==='content'||focus==='actions'){
  const section=focus==='content'?content:control;
  requestAnimationFrame(()=>section.scrollIntoView({block:'start',behavior:'smooth'}));
 }
}
filter.onchange=()=>{renderReports();detail.classList.remove('nr-mod-detail-open');};
$('nr-moderation-refresh').onclick=()=>loadReports(selectedReport);
trigger.onclick=async()=>{
 account.close();if(!dialog.open)dialog.showModal();
 if(await isModerator())await loadReports();
 else dialog.close();
};
const friendView=$('friend-view');
const friendCount=elt('p','nr-profile-report-history');
friendCount.id='nr-profile-report-history';friendCount.hidden=true;
friendView?.querySelector('.social-hero-content')?.append(friendCount);
let friendSeq=0;
async function updateFriendHistory(){
 const id=friendView?.dataset.friendId,sequence=++friendSeq;
 friendCount.hidden=true;
 if(!id||friendView.hidden||trigger.hidden||!state?.user?.id)return;
 const {data,error}=await state.supabase.rpc('nightreel_moderation_report_counts',{p_user_ids:[id]});
 if(sequence!==friendSeq||friendView?.dataset.friendId!==id||friendView.hidden||trigger.hidden||error||!data?.length)return;
 friendCount.textContent='Moderator only · Times reported: '+Number(data[0].times_reported||0);
 friendCount.hidden=false;
}
if(friendView)new MutationObserver(updateFriendHistory).observe(friendView,{attributes:true,attributeFilter:['hidden','data-friend-id']});
document.addEventListener('nightreel:workspace-ready',isModerator);
setInterval(isModerator,4500);
setInterval(refreshCount,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshCount();if(dialog.open)loadReports(selectedReport);}});
isModerator();
})();