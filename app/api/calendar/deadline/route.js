import {getAccess} from "../../../../lib/access";
import {database} from "../../../../lib/db";
import {checkCalendarScope,isManager} from "../../../../lib/calendar";
export const runtime="nodejs";export const dynamic="force-dynamic";
const fail=(error,status)=>Response.json({error},{status,headers:{"Cache-Control":"private,no-store"}});
export async function POST(request){
 try{
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return fail("Origem não autorizada.",403);
  const access=await getAccess();
  if(!access.signedIn)return fail("Faça login.",401);
  if(!access.allowed)return fail("Conta não autorizada.",403);
  if(Number(request.headers.get("content-length")||0)>3500)return fail("Dados excessivos.",413);
  let body;try{body=await request.json();}catch{return fail("Solicitação inválida.",400);}
  const taskId=String(body.taskId||""),title=String(body.title||"").trim();
  const unitId=body.unitId?String(body.unitId):null;
  const due=String(body.due||""),rev=body.expectedRevision;
  const attendees=Array.isArray(body.attendees)?[...new Set(body.attendees.map(x=>String(x).trim().toLowerCase()))]:[];
  const status=body.status==="concluido"?"concluido":body.status==="cancelado"?"cancelado":"agendado";
  if(taskId.length<8||taskId.length>140||title.length<2||title.length>160||!/^\d{4}-\d{2}-\d{2}$/.test(due))
    return fail("Demanda ou prazo inválido.",422);
  if(!Number.isSafeInteger(rev)||rev<0)return fail("Revisão inválida.",422);
  const startsAt=new Date(due+"T17:00:00-03:00");
  const endsAt=new Date(due+"T17:30:00-03:00");
  if(!Number.isFinite(startsAt.getTime())||startsAt.toISOString().slice(0,10)!==due)return fail("Data inválida.",422);
  const scope={unitId,attendees};
  try{await checkCalendarScope(access,scope);}
  catch(e){return fail(e.message,403);}
  const sql=database();
  const result=await sql.query(
   "SELECT cc_calendar_sync_task($1,$2,$3::jsonb,$4::text[],$5,$6)::jsonb AS result",
   [taskId,rev,JSON.stringify({title,unitId,startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString(),status}),attendees,access.email,isManager(access.role)]
  );
  const value=result[0]?.result;
  if(value?.error==="conflict")return fail("Conflito: este prazo foi alterado em outra sessão. Atualize antes de salvar.",409);
  if(value?.error==="forbidden")return fail("Você não pode alterar o prazo desta demanda.",403);
  if(!value?.revision)return fail("Não foi possível sincronizar o prazo.",503);
  return Response.json({ok:true,...value},{headers:{"Cache-Control":"private,no-store"}});
 }catch{return fail("Falha ao sincronizar o prazo da demanda.",503);}
}
