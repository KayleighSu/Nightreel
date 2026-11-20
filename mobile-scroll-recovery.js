/* Restore the user's library scroll position after an unexpected mobile reload.
   Does not change collection data, navigation, or intentional tab changes. */
(()=>{
 'use strict';
 const key='nightreel:mobile-scroll-recovery-v1';
 const phone=()=>matchMedia('(max-width:780px) and (pointer:coarse)').matches;
 const currentUser=()=>state?.user?.id||(state?.demo?'demo':null);
 const collectionVisible=()=>!!document.querySelector('.collection-section:not([hidden])');
 const canRecord=()=>phone()&&currentUser()&&collectionVisible()&&document.getElementById('app-shell')?.hidden===false;
 const nav=performance.getEntriesByType('navigation')[0];
 const shouldRecover=nav?.type==='reload'||nav?.type==='back_forward';
 let blocked=shouldRecover,timer=0,abandoned=false;
 let stored=null;try{stored=JSON.parse(sessionStorage.getItem(key)||'null')}catch{}
 if(!stored||Date.now()-Number(stored.at)>120000)stored=null;
 const save=()=>{
  if(!canRecord()||blocked)return;
  try{
   const y=Math.max(0,Math.round(window.scrollY||document.scrollingElement?.scrollTop||0));
   if(y<160){sessionStorage.removeItem(key);return;}
   sessionStorage.setItem(key,JSON.stringify({userId:currentUser(),filter:state.filter,y,at:Date.now()}));
  }catch{}
 };
 window.addEventListener('scroll',()=>{
  if(timer||blocked)return;
  timer=setTimeout(()=>{timer=0;save()},350);
 },{passive:true});
 window.addEventListener('pagehide',save);
 if(!shouldRecover||!stored){blocked=false;return;}
 const interacted=()=>{abandoned=true;blocked=false;};
 window.addEventListener('touchstart',interacted,{once:true,passive:true});
 window.addEventListener('wheel',interacted,{once:true,passive:true});
 const restore=()=>{
  if(abandoned||!phone()||!collectionVisible()||currentUser()!==stored.userId)return;
  if(typeof state.filter==='string'&&stored.filter!==state.filter)return;
  const max=Math.max(0,(document.scrollingElement?.scrollHeight||0)-innerHeight);
  if(max<stored.y*.8)return;
  window.scrollTo({top:Math.min(stored.y,max),behavior:'instant'});
 };
 const attempt=()=>{
  if(abandoned||!stored)return;
  restore();
  setTimeout(restore,650);
  setTimeout(restore,1600);
  setTimeout(()=>{restore();blocked=false;},3000);
 };
 document.addEventListener('nightreel:workspace-ready',attempt,{once:true});
 if(document.getElementById('app-shell')?.hidden===false)setTimeout(attempt,200);
})();