import {getAccess} from "../../../../lib/access";
import {database} from "../../../../lib/db";
import {pushConfigured,validPushEndpoint} from "../../../../lib/web-push";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store","Vary":"Cookie"}});
const sameOrigin=request=>!request.headers.get("origin")||request.headers.get("origin")===new URL(request.url).origin;
const acceptableKey=(value,min,max)=>typeof value==="string"&&value.length>=min&&value.length<=max&&/^[A-Za-z0-9_+/-]+={0,2}$/.test(value);

export async function GET(){
 const access=await getAccess();
 if(!access.allowed)return reply({error:"Acesso não autorizado."},403);
 return reply({configured:pushConfigured(),publicKey:pushConfigured()?process.env.WEB_PUSH_VAPID_PUBLIC_KEY:""});
}

export async function POST(request){
 if(!sameOrigin(request))return reply({error:"Origem não autorizada."},403);
 const access=await getAccess();
 if(!access.allowed)return reply({error:"Acesso não autorizado."},403);
 if(!pushConfigured())return reply({error:"Notificações ainda não estão configuradas."},503);
 if(Number(request.headers.get("content-length")||0)>5500)return reply({error:"Dados muito extensos."},413);
 let data;try{data=await request.json();}catch{return reply({error:"Dados inválidos."},400);}
 const endpoint=String(data?.endpoint||"");
 const p256dh=data?.keys?.p256dh,auth=data?.keys?.auth;
 if(!validPushEndpoint(endpoint)||!acceptableKey(p256dh,80,110)||!acceptableKey(auth,20,35))
  return reply({error:"Esta inscrição do navegador não é válida."},422);
 try{
  await database().query(
   "INSERT INTO cc_push_subscriptions(owner_email,endpoint,p256dh,auth,user_agent) VALUES($1,$2,$3,$4,$5) ON CONFLICT(endpoint) DO UPDATE SET owner_email=EXCLUDED.owner_email,p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth,user_agent=EXCLUDED.user_agent,updated_at=now()",
   [access.email,endpoint,p256dh,auth,String(request.headers.get("user-agent")||"").slice(0,240)]
  );
  return reply({ok:true});
 }catch(e){console.error("Push subscription failed",e?.code||"unknown");return reply({error:"Não foi possível ativar as notificações."},503);}
}

export async function DELETE(request){
 if(!sameOrigin(request))return reply({error:"Origem não autorizada."},403);
 const access=await getAccess();
 if(!access.allowed)return reply({error:"Acesso não autorizado."},403);
 let data;try{data=await request.json();}catch{return reply({error:"Dados inválidos."},400);}
 const endpoint=String(data?.endpoint||"");
 if(!endpoint||endpoint.length>1600)return reply({error:"Inscrição inválida."},422);
 try{
  await database().query(
   "DELETE FROM cc_push_subscriptions WHERE owner_email=$1 AND endpoint=$2",[access.email,endpoint]
  );
  return reply({ok:true});
 }catch{return reply({error:"Não foi possível desativar as notificações."},503);}
}
