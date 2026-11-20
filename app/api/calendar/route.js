import {getAccess} from "../../../lib/access";
import {database} from "../../../lib/db";
import {validateCalendarInput,checkCalendarScope,isManager,unauthorized} from "../../../lib/calendar";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
const headers={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const respond=(data,status=200)=>Response.json(data,{status,headers});
const error=(msg,status)=>respond({error:msg},status);
const originOk=request=>!request.headers.get("origin")||request.headers.get("origin")===new URL(request.url).origin;
const canManage=(access,event)=>isManager(access.role)||event.owner_email.toLowerCase()===access.email;

export async function GET(request){
 try{
  const access=await getAccess();
  if(!access.signedIn)return error("Faça login.",401);
  if(!access.allowed)return error("Acesso não autorizado.",403);
  const url=new URL(request.url);
  const year=Number(url.searchParams.get("year")),month=Number(url.searchParams.get("month"));
  if(!Number.isInteger(year)||year<2020||year>2100||!Number.isInteger(month)||month<1||month>12)return error("Mês inválido.",422);
  const sql=database();
  const managed=isManager(access.role);
  const events=await sql.query(
   "SELECT e.id,e.kind,e.title,e.description,e.unit_id,e.unit_ids,e.location,e.starts_at,e.ends_at,e.owner_email,e.status,e.revision,e.external_task_id,e.created_at,COALESCE((SELECT array_agg(a.email ORDER BY a.email) FROM cc_calendar_attendees a WHERE a.event_id=e.id),ARRAY[]::text[]) AS attendees FROM cc_calendar_events e WHERE e.deleted_at IS NULL AND (e.external_task_id IS NULL OR NOT EXISTS (SELECT 1 FROM cc_commercial_tasks t WHERE t.id=e.external_task_id AND t.payload ? 'deletedAt')) AND EXTRACT(YEAR FROM e.starts_at AT TIME ZONE 'America/Sao_Paulo')=$1 AND EXTRACT(MONTH FROM e.starts_at AT TIME ZONE 'America/Sao_Paulo')=$2 AND ($3::boolean OR lower(e.owner_email)=$4 OR EXISTS(SELECT 1 FROM cc_calendar_attendees a WHERE a.event_id=e.id AND lower(a.email)=$4)) ORDER BY e.starts_at ASC LIMIT 2000",
   [year,month,managed,access.email]
  );
  const microsoftEvents=await sql.query(
   "SELECT m.graph_id AS id,'microsoft'::text AS kind,m.title,CASE WHEN m.is_private THEN '' ELSE m.description END AS description,CASE WHEN m.is_private THEN '[]'::jsonb ELSE m.participants END AS participants,NULL::text AS unit_id,ARRAY[]::text[] AS unit_ids,m.location,m.join_url,m.starts_at,m.ends_at,m.owner_email,'agendado'::text AS status,1::integer AS revision,NULL::text AS external_task_id,m.updated_at AS created_at,ARRAY[]::text[] AS attendees,true AS microsoft_imported,m.is_private FROM cc_microsoft_calendar_events m WHERE EXTRACT(YEAR FROM m.starts_at AT TIME ZONE 'America/Sao_Paulo')=$1 AND EXTRACT(MONTH FROM m.starts_at AT TIME ZONE 'America/Sao_Paulo')=$2 AND ($3::boolean OR lower(m.owner_email)=$4) ORDER BY m.starts_at LIMIT 2000",
   [year,month,managed,access.email]
  );
  const members=await sql.query("SELECT name,email,role FROM cc_team_members WHERE status='active' ORDER BY name LIMIT 1000");
  return respond({events:[...events,...microsoftEvents],members,canManageNetwork:managed,currentEmail:access.email,timezone:"America/Sao_Paulo",emailReady:Boolean(process.env.RESEND_API_KEY&&process.env.AUTH_EMAIL_FROM&&process.env.CRON_SECRET)});
 }catch{return error("Não foi possível consultar a agenda.",503);}
}
export async function POST(request){
 try{
  if(!originOk(request))return error("Origem não autorizada.",403);
  if(Number(request.headers.get("content-length")||0)>6000)return error("Dados excedem o tamanho permitido.",413);
  const access=await getAccess();
  if(!access.signedIn)return error("Faça login.",401);
  if(!access.allowed)return error("Acesso não autorizado.",403);
  let body;try{body=await request.json();}catch{return error("Dados inválidos.",400);}
  let payload;try{payload=validateCalendarInput(body);await checkCalendarScope(access,payload);}
  catch(e){return error(e.message,422);}
  const sql=database();
  const result=await sql.query(
   "WITH new_event AS (INSERT INTO cc_calendar_events(kind,title,description,unit_id,location,starts_at,ends_at,owner_email,status,unit_ids) VALUES($1,$2,$3,$4,$5,$6::timestamptz,$7::timestamptz,$8,$9,$11::text[]) RETURNING *), audience AS (INSERT INTO cc_calendar_attendees(event_id,email) SELECT new_event.id,a.email FROM new_event CROSS JOIN LATERAL unnest($10::text[]) a(email) ON CONFLICT DO NOTHING RETURNING email), audit AS (INSERT INTO cc_calendar_audit(event_id,actor_email,action,revision,after_data) SELECT id,$8,'created',revision,to_jsonb(new_event) FROM new_event RETURNING event_id) SELECT id,revision FROM new_event",
   [payload.kind,payload.title,payload.description,payload.unitId,payload.location,payload.startsAt,payload.endsAt,access.email,payload.status,payload.attendees,payload.unitIds]
  );
  return respond({ok:true,id:result[0]?.id,revision:result[0]?.revision},201);
 }catch{return error("Não foi possível agendar o evento.",503);}
}
export async function PATCH(request){
 try{
  if(!originOk(request))return error("Origem não autorizada.",403);
  if(Number(request.headers.get("content-length")||0)>6500)return error("Dados excedem o tamanho permitido.",413);
  const access=await getAccess();
  if(!access.signedIn)return error("Faça login.",401);
  if(!access.allowed)return error("Acesso não autorizado.",403);
  let body;try{body=await request.json();}catch{return error("Dados inválidos.",400);}
  const id=String(body.id||"");
  if(!/^[a-f0-9-]{36}$/i.test(id)||!Number.isSafeInteger(body.revision)||body.revision<1)return error("Identificador ou revisão inválidos.",422);
  const sql=database();
  const existing=await sql.query("SELECT * FROM cc_calendar_events WHERE id=$1::uuid LIMIT 1",[id]);
  if(!existing.length)return error("Evento não encontrado.",404);
  if(existing[0].deleted_at)return error("Este compromisso já foi excluído.",409);
  if(!canManage(access,existing[0]))return error("Somente a pessoa organizadora ou a gestão pode editar.",403);
  if(existing[0].kind==="prazo_demanda")return error("Prazos de demandas são atualizados pela própria demanda.",403);
  let data;try{data=validateCalendarInput(body);await checkCalendarScope(access,data);}
  catch(e){return error(e.message,422);}
  const rows=await sql.query(
   "SELECT cc_calendar_update_event($1::uuid,$2,$3::jsonb,$4::text[],$5)::integer AS revision",
   [id,body.revision,JSON.stringify(data),data.attendees,access.email]
  );
  const revision=Number(rows[0]?.revision);
  if(revision===-1)return error("Conflito de edição: outra pessoa atualizou este evento. Atualize a agenda.",409);
  if(revision===-2)return error("Evento não encontrado.",404);
  return respond({ok:true,id,revision});
 }catch{return error("Não foi possível atualizar o evento.",503);}
}

export async function DELETE(request){
 try{
  if(!originOk(request))return error("Origem não autorizada.",403);
  if(Number(request.headers.get("content-length")||0)>2000)return error("Solicitação excessiva.",413);
  const access=await getAccess();
  if(!access.signedIn)return error("Faça login.",401);
  if(!access.allowed)return error("Acesso não autorizado.",403);
  let body;try{body=await request.json();}catch{return error("Dados inválidos.",400);}
  const id=String(body?.id||""),revision=Number(body?.revision);
  if(!/^[a-f0-9-]{36}$/i.test(id)||!Number.isSafeInteger(revision)||revision<1)return error("Identificador ou revisão inválidos.",422);
  const sql=database();
  const current=await sql.query("SELECT * FROM cc_calendar_events WHERE id=$1::uuid LIMIT 1",[id]);
  if(!current.length)return error("Compromisso não encontrado.",404);
  if(current[0].deleted_at)return error("Compromisso já excluído.",409);
  if(!canManage(access,current[0]))return error("Apenas o organizador ou a gestão pode excluir.",403);
  if(current[0].kind==="prazo_demanda")return error("Este agendamento pertence a uma demanda. Exclua ou arquive a demanda correspondente.",409);
  const rows=await sql.query(
   "WITH changed AS (UPDATE cc_calendar_events SET deleted_at=now(),deleted_by=$3,status='cancelado',revision=revision+1,updated_at=now() WHERE id=$1::uuid AND revision=$2 AND deleted_at IS NULL RETURNING *), audited AS (INSERT INTO cc_calendar_audit(event_id,actor_email,action,revision,before_data,after_data) SELECT id,$3,'deleted',revision,$4::jsonb,to_jsonb(changed) FROM changed RETURNING event_id) SELECT id,revision FROM changed",
   [id,revision,access.email,JSON.stringify(current[0])]
  );
  if(!rows.length)return error("O compromisso foi alterado em outra sessão. Atualize a agenda e tente novamente.",409);
  return respond({ok:true,id,revision:rows[0].revision});
 }catch(e){
  console.error("calendar delete failed",e?.code||"unknown");
  return error("Não foi possível excluir o agendamento.",503);
 }
}
