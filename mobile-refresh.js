/* Pull-to-refresh for installed Nightreel on iOS/Android. */
(() => {
 'use strict';
 const isInstalled=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
 const isPhone=()=>window.matchMedia('(max-width: 720px) and (pointer: coarse)').matches;
 const atTop=()=>window.scrollY<=2 && (document.scrollingElement?.scrollTop||0)<=2;
 const ignored=target=>Boolean(target?.closest('dialog,[role="dialog"],input,textarea,select,[contenteditable="true"],.message-thread,.nr-dock-thread'));
 const indicator=document.createElement('div');
 indicator.id='nr-pull-refresh';indicator.setAttribute('role','status');indicator.setAttribute('aria-live','polite');
 indicator.textContent='↓ Pull to refresh';document.body.append(indicator);
 let startY=0,tracking=false,ready=false,refreshing=false;
 const reset=()=>{
  tracking=false;ready=false;
  indicator.classList.remove('nr-pull-ready','nr-pull-active');
  indicator.style.transform='';
  indicator.textContent='↓ Pull to refresh';
 };
 document.addEventListener('touchstart',event=>{
  if(refreshing||!isInstalled()||!isPhone()||event.touches.length!==1||!atTop()||ignored(event.target)){
   tracking=false;return;
  }
  tracking=true;ready=false;startY=event.touches[0].clientY;
 },{passive:true});
 document.addEventListener('touchmove',event=>{
  if(!tracking||event.touches.length!==1)return;
  const distance=event.touches[0].clientY-startY;
  if(distance<=0||!atTop()){reset();return;}
  // Only interrupt native overscroll after the user has clearly started pulling.
  if(distance>12&&event.cancelable)event.preventDefault();
  ready=distance>=95;
  indicator.classList.add('nr-pull-active');
  indicator.classList.toggle('nr-pull-ready',ready);
  indicator.textContent=ready?'↑ Release to refresh':'↓ Pull to refresh';
  indicator.style.transform='translate(-50%, '+Math.min(70,distance*.44)+'px)';
 },{passive:false});
 document.addEventListener('touchend',()=>{
  if(!tracking)return;
  const shouldReload=ready;reset();
  if(shouldReload&&!refreshing){
   refreshing=true;
   indicator.classList.add('nr-pull-active');
   indicator.textContent='↻ Refreshing…';
   window.location.reload();
  }
 },{passive:true});
 document.addEventListener('touchcancel',reset,{passive:true});
})();
