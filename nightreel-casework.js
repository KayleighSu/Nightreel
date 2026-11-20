/* Nightreel: consent-based message reports, user appeals and private moderator appeal inbox. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const make=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=String(value);return e};
const btn=(label,handler,cls='extras-secondary')=>{const e=make('button',cls,label);e.type='button';e.onclick=handler;return e;};
const fmt=ts=>new Date(ts).toLocaleString();
const session=()=>state?.user?.id&&state?.supabase&&!state?.demo;
const account=$('extra-account-dialog');
if(!account)return;
function dialog(id,title){
 const d=make('dialog','extras-modal nr-casework-dialog');d.id=id;
 const inner=make('div','extras-modal-inner');
 const header=make('div','extras-top');const h=make('h2','',title);
 header.append(h,btn('✕ Close',()=>d.close(),'extras-close'));inner.append(header);d.append(inner);
 d.addEventListener('click',e=>{if(e.target===d)d.close();});document.body.append(d);
 return {d,inner};
}
const report=dialog('nr-evidence-report','Report this message');
const explanation=make('p','nr-casework-help','The selected message and up to six nearby messages may be shared with authorized Nightreel moderators to help assess context. They are not shown to the reported account. This does not automatically suspend anyone.');
const reportForm=make('form','nr-casework-form');
const reasonLabel=make('label','','Why are you reporting this message?');
const reason=make('textarea');reason.required=true;reason.minLength=5;reason.maxLength=1000;reason.rows=4;reason.placeholder='Describe the concern (5–1,000 characters)';
reasonLabel.append(reason);
const reportSubmit=make('button','extras-primary','Send message report');reportSubmit.type='submit';
const reportStatus=make('p','extras-status');reportStatus.setAttribute('role','status');
reportForm.append(reasonLabel,reportSubmit,reportStatus);
report.inner.append(explanation,reportForm);
let selectedMessage='';
let activeMenu=null;
function closeMessageMenu(){activeMenu?.remove();activeMenu=null;}
document.addEventListener('click',e=>{
 const target=e.target.closest?.('.nr-message-options');
 if(target){
  e.preventDefault();e.stopPropagation();
  if(!session())return;
  if(activeMenu?.dataset.messageId===target.dataset.messageId){closeMessageMenu();return;}
  closeMessageMenu();
  const menu=make('div','nr-message-option-menu');
  menu.dataset.messageId=target.dataset.messageId||'';
  const option=btn('Report this message',()=>{
   selectedMessage=menu.dataset.messageId;
   closeMessageMenu();
   if(!selectedMessage)return;
   reason.value='';reportStatus.textContent='';
   if(!report.d.open)report.d.showModal();
  },'nr-menu-report-action');
  menu.append(option);
  target.closest('.message-bubble')?.append(menu);
  activeMenu=menu;return;
 }
 if(activeMenu&&!e.target.closest?.('.nr-message-option-menu'))closeMessageMenu();
});
reportForm.onsubmit=async e=>{
 e.preventDefault();if(!session()||!selectedMessage)return;
 if(!window.confirm('Submit this message and up to six nearby messages to Nightreel moderators for review?'))return;
 reportSubmit.disabled=true;reportStatus.textContent='Submitting evidence…';
 try{
  const {data,error}=await state.supabase.rpc('nightreel_report_message',{p_message_id:selectedMessage,p_reason:reason.value.trim()});
  if(error)throw error;
  reportStatus.textContent='Report submitted with message evidence. Reference: '+String(data||'').slice(0,8)+'.';
  reason.value='';
 }catch(err){reportStatus.textContent='Could not report message: '+err.message;}
 finally{reportSubmit.disabled=false;}
};

const appealButton=btn('My moderation appeals',()=>openAppeals());
appealButton.id='nr-my-appeals';appealButton.hidden=true;
account.querySelector('.extras-menu-actions')?.append(appealButton);
const own=dialog('nr-user-appeals','Appeal a moderation action');
const ownHelp=make('p','nr-casework-help','You can appeal a suspension or removed profile artwork within 90 days. An accusation alone is not a penalty. You may submit up to eight messages as evidence; selected messages are copied securely for moderator review. Suspensions still allow you to sign in, read existing messages, and submit an appeal.');
const ownStatus=make('p','extras-status');ownStatus.setAttribute('role','status');
const ownList=make('div','nr-casework-list');
own.inner.append(ownHelp,ownStatus,ownList);
async function openAppeals(){
 if(!session())return;
 account.close();if(!own.d.open)own.d.showModal();await refreshOwn();
}
async function refreshOwn(){
 ownList.replaceChildren();ownStatus.textContent='Loading eligible actions…';
 const {data,error}=await state.supabase.rpc('nightreel_get_appealable_actions');
 if(error){ownStatus.textContent='Unable to load actions: '+error.message;return;}
 ownStatus.textContent='';
 if(!data?.length){ownList.append(make('p','nr-casework-help','No appealable enforcement actions in the last 90 days. Reports without action do not require an appeal.'));return;}
 for(const item of data){
  const card=make('article','nr-casework-card');
  card.append(make('strong','',item.action_type.replaceAll('_',' ')+' · '+fmt(item.action_at)));
  if(item.appeal_id){
   const r=await state.supabase.from('nightreel_appeals').select('status,reason,moderator_response,reviewed_at').eq('id',item.appeal_id).maybeSingle();
   if(r.error){card.append(make('p','','Appeal details unavailable.'));}else{
    card.append(make('p','','Appeal status: '+(r.data?.status||item.appeal_status||'pending')));
    if(r.data?.moderator_response)card.append(make('p','',r.data.moderator_response));
   }
  }else card.append(btn('Submit appeal',()=>composeAppeal(item.action_id)));
  ownList.append(card);
 }
}
async function composeAppeal(actionId){
 ownList.replaceChildren();ownStatus.textContent='Choose any messages relevant to the action. You can leave evidence blank and submit a written explanation.';
 const form=make('form','nr-casework-form');
 const label=make('label','','Your appeal (20–3,000 characters)');
 const statement=make('textarea');statement.rows=6;statement.required=true;statement.minLength=20;statement.maxLength=3000;
 statement.placeholder='Explain why you believe this moderation action should be reconsidered.';
 label.append(statement);form.append(label);
 const evidence=make('fieldset','nr-casework-evidence');
 evidence.append(make('legend','','Optional message evidence — maximum 8'));
 const {data:messages,error}=await state.supabase.rpc('nightreel_get_appeal_messages');
 if(error)evidence.append(make('p','','Could not load message history: '+error.message));
 else if(!messages?.length)evidence.append(make('p','','No messages available. Your written appeal can still be submitted.'));
 else{
  for(const m of messages){
   const lbl=make('label','nr-casework-choice');
   const cb=make('input');cb.type='checkbox';cb.value=m.id;cb.name='evidence';
   cb.addEventListener('change',()=>{if(form.querySelectorAll('input[name=evidence]:checked').length>8){cb.checked=false;ownStatus.textContent='Select no more than eight messages.';}});
   const phrase=make('span','',fmt(m.sent_at)+' · '+(m.sender_id===state.user.id?'You':'Other participant')+': '+m.body);
   lbl.append(cb,phrase);evidence.append(lbl);
  }
 }
 form.append(evidence);
 const actions=make('div','nr-casework-actions');
 const submit=make('button','extras-primary','Submit appeal');submit.type='submit';
 actions.append(btn('Back',refreshOwn),submit);form.append(actions);
 form.onsubmit=async e=>{
  e.preventDefault();submit.disabled=true;ownStatus.textContent='Submitting appeal…';
  try{
   const selected=[...form.querySelectorAll('input[name=evidence]:checked')].map(x=>x.value);
   const {error}=await state.supabase.rpc('nightreel_submit_appeal',{p_action_id:actionId,p_reason:statement.value.trim(),p_message_ids:selected});
   if(error)throw error;
   await refreshOwn();ownStatus.textContent='Appeal submitted. You can check the decision here.';
  }catch(err){ownStatus.textContent='Unable to submit appeal: '+err.message;}
  finally{submit.disabled=false;}
 };
 ownList.append(form);
}
document.addEventListener('nightreel:workspace-ready',()=>{appealButton.hidden=!session();});
setInterval(()=>{appealButton.hidden=!session();},4000);

const modButton=btn('Review appeals',()=>openModeratorAppeals());
modButton.id='nr-review-appeals';modButton.hidden=true;
const toolbar=$('nr-moderation-dialog')?.querySelector('.nr-mod-toolbar-actions');
toolbar?.append(modButton);
const inbox=dialog('nr-mod-appeals','Moderation appeals');
const modStatus=make('p','extras-status');modStatus.setAttribute('role','status');
const modList=make('div','nr-casework-list');
inbox.inner.append(make('p','nr-casework-help','Review the user’s statement and chosen messages. Uphold or accept the appeal with a written explanation. For suspension appeals, acceptance first lifts the ban. Removed artwork cannot be restored automatically.'),modStatus,modList);
let modAccount='';
async function isMod(){
 if(!session()){modButton.hidden=true;modAccount='';return;}
 if(modAccount===state.user.id)return;
 modAccount=state.user.id;
 const {data,error}=await state.supabase.from('nightreel_moderators').select('user_id').eq('user_id',modAccount).maybeSingle();
 modButton.hidden=!!error||!data;
}
async function openModeratorAppeals(){
 if(!session()||modButton.hidden)return;
 const main=$('nr-moderation-dialog');if(main?.open)main.close();
 if(!inbox.d.open)inbox.d.showModal();
 await refreshMod();
}
async function refreshMod(){
 modList.replaceChildren();modStatus.textContent='Loading appeals…';
 const {data,error}=await state.supabase.from('nightreel_appeals').select('id,action_id,appellant_id,reason,status,created_at,reviewed_at,moderator_response').order('created_at',{ascending:false}).limit(100);
 if(error){modStatus.textContent='Unable to load appeals: '+error.message;return;}
 modStatus.textContent=(data||[]).filter(x=>x.status==='pending').length+' pending appeals';
 if(!data?.length){modList.append(make('p','','No appeals submitted.'));return;}
 for(const a of data){
  const card=make('article','nr-casework-card');
  const {data:acts}=await state.supabase.from('nightreel_moderation_actions').select('action,target_user_id,created_at').eq('id',a.action_id).maybeSingle();
  const action=acts?.action||'moderation action';
  const {data:prof}=await state.supabase.from('profiles').select('display_name,username').eq('id',a.appellant_id).maybeSingle();
  const name=prof?.display_name||prof?.username||('Account '+a.appellant_id.slice(0,8));
  card.append(make('strong','',name+' · '+action.replaceAll('_',' ')+' · '+a.status));
  card.append(make('small','',fmt(a.created_at)));
  card.append(make('p','nr-casework-statement',a.reason));
  const {data:evidence,error:ee}=await state.supabase.from('nightreel_appeal_evidence')
   .select('body,sender_id,recipient_id,sent_at').eq('appeal_id',a.id).order('sent_at');
  if(ee)card.append(make('p','','Evidence unavailable: '+ee.message));
  else if(evidence?.length){
   const box=make('div','nr-casework-evidence-list');
   box.append(make('h4','','Submitted message evidence'));
   for(const m of evidence)box.append(make('p','nr-casework-evidence-item',fmt(m.sent_at)+' · '+(m.sender_id===a.appellant_id?'Appellant':'Other participant')+': '+m.body));
   card.append(box);
  }
  if(a.status==='pending'){
   const response=make('textarea');response.rows=3;response.maxLength=2000;response.placeholder='Explanation to the user (at least 10 characters)';
   card.append(response);
   const choices=make('div','nr-casework-actions');
   choices.append(btn('Uphold action',()=>resolveAppeal(a,acts,'upheld',response,card)),
    btn('Accept appeal',()=>resolveAppeal(a,acts,'accepted',response,card)));
   card.append(choices);
  }else if(a.moderator_response)card.append(make('p','',a.moderator_response));
  modList.append(card);
 }
}
async function resolveAppeal(appeal,action,decision,input,card){
 const response=input.value.trim();
 if(response.length<10){modStatus.textContent='Write at least 10 characters explaining the decision.';return;}
 if(!confirm((decision==='accepted'?'Accept':'Uphold')+' this appeal?'))return;
 const buttons=[...card.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 modStatus.textContent='Recording appeal decision…';
 try{
  if(decision==='accepted'&&['suspend_7d','suspend_permanent'].includes(action?.action)){
   const {data,error}=await state.supabase.functions.invoke('moderate-account',{body:{
    action:'unsuspend',targetUserId:appeal.appellant_id,confirmation:'LIFT SUSPENSION',detail:'Accepted appeal '+appeal.id
   }});
   if(error||!data?.ok)throw Error(data?.error||error?.message||'Could not remove suspension');
  }
  const {error}=await state.supabase.rpc('nightreel_review_appeal',{p_appeal_id:appeal.id,p_decision:decision,p_response:response});
  if(error)throw error;
  await refreshMod();modStatus.textContent='Appeal '+(decision==='accepted'?'accepted':'upheld')+'.';
 }catch(err){modStatus.textContent='Could not resolve appeal: '+err.message;}
 finally{buttons.forEach(b=>b.disabled=false);}
}
document.addEventListener('nightreel:workspace-ready',isMod);
setInterval(isMod,4500);
isMod();
})();
