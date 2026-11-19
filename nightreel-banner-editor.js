/* Editable, account-owned Nightreel banners: separate desktop and phone crops. */
(function(){
'use strict';
const el=id=>document.getElementById(id);
const panel=el('social-profile-panel'),input=el('profile-image-file');
if(!panel||!input)return;
const defaults=()=>({x:50,y:50,zoom:1});
const frames={desktop:defaults(),mobile:defaults()};
const clamp=(n,low,high)=>Math.max(low,Math.min(high,Number.isFinite(n)?n:low));
const fields=(p,key)=>({
 x:clamp(Number(p?.['banner_'+key+'_x']??50),0,100),
 y:clamp(Number(p?.['banner_'+key+'_y']??50),0,100),
 zoom:clamp(Number(p?.['banner_'+key+'_zoom']??1),1,3)
});
function profilePatch(){
 const result={};
 for(const key of ['desktop','mobile']){
  result['banner_'+key+'_x']=Math.round(frames[key].x);
  result['banner_'+key+'_y']=Math.round(frames[key].y);
  result['banner_'+key+'_zoom']=Math.round(frames[key].zoom*100)/100;
 }
 return result;
}
const section=document.createElement('section');
section.id='nr-banner-crop-editor';section.className='nr-banner-crop-editor';
section.innerHTML=[
 '<div class="nr-crop-title"><strong>Adjust your banner</strong><p>Reposition the picture by dragging it. Zoom and framing can be different on desktop and phone. Your original image is not cropped or modified.</p></div>',
 '<div class="nr-crop-grid">',
 '<div class="nr-crop-device"><div class="nr-crop-heading"><strong>Desktop</strong><button type="button" data-crop-reset="desktop">Reset</button></div>',
 '<div class="nr-crop-preview nr-crop-desktop" data-crop-surface="desktop" tabindex="0" role="group" aria-label="Desktop banner preview, drag or use arrow keys to reposition image"><img alt="" draggable="false"><span>Stay obsessed.</span></div>',
 '<label class="nr-crop-zoom">Zoom <output id="nr-crop-desktop-value">100%</output><input id="nr-crop-desktop-slider" type="range" min="100" max="300" step="5" value="100" aria-label="Desktop banner zoom"></label></div>',
 '<div class="nr-crop-device"><div class="nr-crop-heading"><strong>Phone</strong><button type="button" data-crop-reset="mobile">Reset</button></div>',
 '<div class="nr-crop-preview nr-crop-mobile" data-crop-surface="mobile" tabindex="0" role="group" aria-label="Phone banner preview, drag or use arrow keys to reposition image"><img alt="" draggable="false"><span>Stay obsessed.</span></div>',
 '<label class="nr-crop-zoom">Zoom <output id="nr-crop-mobile-value">100%</output><input id="nr-crop-mobile-slider" type="range" min="100" max="300" step="5" value="100" aria-label="Phone banner zoom"></label></div>',
 '</div><p class="nr-crop-hint">Drag a preview to move the image, use arrow keys when focused, and adjust the zoom slider. Select <b>Save profile</b> to keep your changes.</p>'
].join('');
input.closest('label')?.after(section);
let objectUrl='';
let savedSource='';
let currentOwner='';
function currentDevice(){return matchMedia('(max-width:780px)').matches?'mobile':'desktop';}
function applyToImage(image,profile,device){
 if(!image)return;
 const frame=fields(profile,device);
 image.style.objectPosition=frame.x+'% '+frame.y+'%';
 image.style.transform='scale('+frame.zoom+')';
 image.style.transformOrigin=frame.x+'% '+frame.y+'%';
}
function drawPreviews(){
 const src=objectUrl||savedSource;
 for(const key of ['desktop','mobile']){
  const host=document.querySelector('[data-crop-surface="'+key+'"]'),image=host?.querySelector('img');
  if(image){
   if(src){if(image.src!==src)image.src=src;image.hidden=false;}
   else{image.hidden=true;image.removeAttribute('src');}
   applyToImage(image,profilePatch(),key);
  }
  const slider=el('nr-crop-'+key+'-slider');
  if(slider)slider.value=String(Math.round(frames[key].zoom*100));
  const output=el('nr-crop-'+key+'-value');
  if(output)output.value=String(Math.round(frames[key].zoom*100))+'%';
 }
}
function setPreviewSource(url){
 savedSource=url||'';
 drawPreviews();
}
function load(profile,source){
 if(profile?.id!==currentOwner){
  currentOwner=profile?.id||'';
  if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}
 }
 for(const key of ['desktop','mobile'])frames[key]=fields(profile,key);
 setPreviewSource(source);
}
input.addEventListener('change',()=>{
 if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}
 const file=input.files?.[0];
 if(file&&['image/png','image/jpeg','image/webp'].includes(file.type)&&file.size<=4194304){
  objectUrl=URL.createObjectURL(file);
 }
 drawPreviews();
});
document.querySelectorAll('[data-crop-surface]').forEach(surface=>{
 const key=surface.dataset.cropSurface;
 let drag=null;
 surface.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  const rect=surface.getBoundingClientRect();
  drag={x:event.clientX,y:event.clientY,fx:frames[key].x,fy:frames[key].y,width:rect.width,height:rect.height};
  surface.setPointerCapture(event.pointerId);
 });
 surface.addEventListener('pointermove',event=>{
  if(!drag)return;
  frames[key].x=clamp(drag.fx-(event.clientX-drag.x)/Math.max(drag.width,1)*100,0,100);
  frames[key].y=clamp(drag.fy-(event.clientY-drag.y)/Math.max(drag.height,1)*100,0,100);
  drawPreviews();
 });
 const stop=()=>drag=null;
 surface.addEventListener('pointerup',stop);
 surface.addEventListener('pointercancel',stop);
 surface.addEventListener('lostpointercapture',stop);
 surface.addEventListener('keydown',event=>{
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
  event.preventDefault();
  const distance=event.shiftKey?10:2;
  if(event.key==='ArrowLeft')frames[key].x=clamp(frames[key].x-distance,0,100);
  if(event.key==='ArrowRight')frames[key].x=clamp(frames[key].x+distance,0,100);
  if(event.key==='ArrowUp')frames[key].y=clamp(frames[key].y-distance,0,100);
  if(event.key==='ArrowDown')frames[key].y=clamp(frames[key].y+distance,0,100);
  drawPreviews();
 });
});
for(const key of ['desktop','mobile']){
 el('nr-crop-'+key+'-slider')?.addEventListener('input',e=>{
  frames[key].zoom=clamp(Number(e.target.value)/100,1,3);
  drawPreviews();
 });
}
section.querySelectorAll('[data-crop-reset]').forEach(button=>{
 button.addEventListener('click',()=>{
  frames[button.dataset.cropReset]=defaults();drawPreviews();
 });
});
function applyHero(profile){
 applyToImage(el('hero-banner-image'),profile,currentDevice());
 applyToImage(el('profile-banner'),profile,currentDevice());
}
function applyFriend(profile){applyToImage(el('friend-banner'),profile,currentDevice());}
function saved(profile,src){
 if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}
 load(profile,src);
 applyHero(profile);
}
window.NightreelBannerEditor={load,profilePatch,applyHero,applyFriend,saved,setPreviewSource};
window.addEventListener('resize',()=>{ /* Device layout shifts are reflected at the next profile render. */
  if(window.NightreelBannerEditor.lastOwn)applyHero(window.NightreelBannerEditor.lastOwn);
  if(window.NightreelBannerEditor.lastFriend)applyFriend(window.NightreelBannerEditor.lastFriend);
});
})();