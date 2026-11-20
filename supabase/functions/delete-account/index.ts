import { createClient } from 'npm:@supabase/supabase-js@2';

const supportedOrigins=new Set([
 'https://kayleighsu.github.io','capacitor://localhost',
 'https://localhost','http://localhost'
]);
function cors(req:Request){
 const origin=req.headers.get('origin')||'';
 return {
  'Access-Control-Allow-Origin':supportedOrigins.has(origin)?origin:'https://kayleighsu.github.io',
  'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Content-Type':'application/json; charset=utf-8',
  'Vary':'Origin'
 };
}
Deno.serve(async(req:Request)=>{
 const headers=cors(req);
 const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return respond({error:'POST required'},405);
 const url=Deno.env.get('SUPABASE_URL');
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return respond({error:'Service unavailable'},503);
 const token=(req.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return respond({error:'Sign in is required'},401);
 let body:{confirmation?:string}={};
 try{body=await req.json();}catch{return respond({error:'Invalid request'},400);}
 if(body.confirmation!=='DELETE MY ACCOUNT')return respond({error:'Type the required confirmation phrase'},400);
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:verifyError}=await admin.auth.getUser(token);
 if(verifyError||!user)return respond({error:'Your session has expired. Sign in again.'},401);
 // Only ever delete the bearer token's verified user ID, never an arbitrary user-supplied ID.
 const uid=user.id;
 try{
  // Delete private/public user-owned media before deleting Auth user.
  for(const bucket of ['nightreel-covers','nightreel-avatars','nightreel-banners']){
   for(let batch=0;batch<100;batch++){
    const {data:objects,error:listError}=await admin.storage.from(bucket).list(uid,{limit:100,offset:0});
    if(listError)throw listError;
    if(!objects?.length)break;
    const paths=objects.filter(obj=>obj.name && obj.id).map(obj=>uid+'/'+obj.name);
    if(!paths.length)break;
    const {error:removeError}=await admin.storage.from(bucket).remove(paths);
    if(removeError)throw removeError;
   }
  }
  // Foreign keys cascade removal of anime entries, profiles, messages and friendships.
  const {error:deleteError}=await admin.auth.admin.deleteUser(uid);
  if(deleteError)throw deleteError;
  return respond({deleted:true});
 }catch(error){
  console.error('Nightreel account deletion failed for verified user',uid,error);
  return respond({error:'Account deletion could not be completed. Contact support for assistance.'},500);
 }
});