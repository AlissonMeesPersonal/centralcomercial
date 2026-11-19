import {getAccess} from "../../../lib/access";
import {database} from "../../../lib/db";
import {configured,performSync} from "../../../lib/microsoft-calendar";
export const runtime="nodejs";export const dynamic="force-dynamic";
const json=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store","Vary":"Cookie"}});
const originOK=request=>!request.headers.get("origin")||request.headers.get("origin")===new URL(request.url).origin;
export async function GET(){
 try{
  const access=await getAccess();
  if(!access.allowed)return json({error:"Acesso não autorizado."},403);
  const all=await database()("SELECT owner_email,microsoft_email,microsoft_name,connected_at,last_synced_at,last_error FROM cc_microsoft_calendar_connections ORDER BY connected_at DESC");
  const own=all.find(x=>x.owner_email===access.email)||null;
  return json({configured:configured(),connected:!!own,connection:own?{email:own.microsoft_email,name:own.microsoft_name,lastSyncedAt:own.last_synced_at,lastError:own.last_error}:null,
   connections:["developer","admin"].includes(access.role)?all.map(x=>({owner:x.owner_email,email:x.microsoft_email,name:x.microsoft_name,lastSyncedAt:x.last_synced_at})):[]});
 }catch(e){console.error("MS status failed",e?.code||"unknown");return json({error:"Não foi possível consultar o Teams."},503);}
}
export async function POST(request){
 if(!originOK(request))return json({error:"Origem não autorizada."},403);
 try{
  const access=await getAccess();
  if(!access.allowed)return json({error:"Acesso não autorizado."},403);
  const body=await request.json().catch(()=>({}));
  if(body.action!=="sync")return json({error:"Ação inválida."},422);
  if(!configured())return json({error:"A integração Microsoft ainda precisa ser configurada na Vercel."},503);
  const rows=await database()("SELECT * FROM cc_microsoft_calendar_connections WHERE owner_email=$1",[access.email]);
  if(!rows.length)return json({error:"Conecte sua conta Microsoft primeiro."},404);
  const result=await performSync(rows[0]);
  return json({ok:true,...result});
 }catch(e){console.error("MS sync failed",e?.code||"unknown",String(e.message).slice(0,140));return json({error:"Falha na sincronização da agenda. Tente novamente ou reconecte sua conta."},503);}
}
export async function DELETE(request){
 if(!originOK(request))return json({error:"Origem não autorizada."},403);
 try{
  const access=await getAccess();
  if(!access.allowed)return json({error:"Acesso não autorizado."},403);
  // Exclusão apenas da própria conexão, com remoção dos eventos importados por FK.
  await database()("DELETE FROM cc_microsoft_calendar_connections WHERE owner_email=$1",[access.email]);
  return json({ok:true});
 }catch(e){console.error("MS disconnect failed",e?.code||"unknown");return json({error:"Não foi possível desvincular a conta."},503);}
}
