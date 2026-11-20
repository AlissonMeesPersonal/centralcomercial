import {createHash,randomBytes} from "node:crypto";
import {getAccess} from "../../../lib/access";
import {database} from "../../../lib/db";
import {CAMPAIGN,STATUSES,canManageLeads,headers,importLeads} from "../../../lib/black-leads";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
const respond=(payload,status=200)=>Response.json(payload,{status,headers});
const fail=(error,status=400)=>respond({error},status);
const originOK=request=>!request.headers.get("origin")||request.headers.get("origin")===new URL(request.url).origin;
export async function GET(request){
 try{
  const access=await getAccess();
  if(!canManageLeads(access))return fail("Acesso restrito à gestão comercial.",403);
  const params=new URL(request.url).searchParams;
  const unit=String(params.get("unit")||"").trim().slice(0,180);
  const status=String(params.get("status")||"");
  const q=String(params.get("q")||"").trim().slice(0,100);
  if(status&&!STATUSES.includes(status))return fail("Status inválido.",422);
  const sql=database();
  const [summary,byUnit,byDay,leads,history,sources]=await Promise.all([
   sql.query("SELECT count(*)::integer AS total,count(DISTINCT phone)::integer AS unique_contacts,count(*) FILTER(WHERE status='convertido')::integer AS converted,count(*) FILTER(WHERE status IN ('em_contato','interessado','convertido','sem_retorno','perdido'))::integer AS contacted,count(*) FILTER(WHERE status='interessado')::integer AS interested FROM cc_black_leads WHERE campaign=$1 AND import_quarantined=false",[CAMPAIGN]),
   sql.query("SELECT unit_label,count(*)::integer AS leads,count(DISTINCT phone)::integer AS unique_contacts,count(*) FILTER(WHERE status='convertido')::integer AS converted,count(*) FILTER(WHERE status IN ('em_contato','interessado','convertido','sem_retorno','perdido'))::integer AS contacted FROM cc_black_leads WHERE campaign=$1 AND import_quarantined=false GROUP BY unit_label ORDER BY leads DESC,unit_label LIMIT 400",[CAMPAIGN]),
   sql.query("SELECT to_char(response_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD') AS day,count(*)::integer AS leads FROM cc_black_leads WHERE campaign=$1 AND import_quarantined=false AND response_at IS NOT NULL GROUP BY 1 ORDER BY day DESC LIMIT 90",[CAMPAIGN]),
   sql.query("SELECT id,lead_name AS name,phone,email,unit_label AS unit,status,notes,response_at,contacted_at,converted_at,imported_at FROM cc_black_leads WHERE campaign=$1 AND import_quarantined=false AND ($2='' OR unit_label=$2) AND ($3='' OR status=$3) AND ($4='' OR lead_name ILIKE '%'||$4||'%' OR phone ILIKE '%'||$4||'%') ORDER BY response_at DESC NULLS LAST,imported_at DESC LIMIT 2000",[CAMPAIGN,unit,status,q]),
   sql.query("SELECT filename,total_rows,imported_rows,imported_by,created_at FROM cc_black_import_history WHERE campaign=$1 ORDER BY created_at DESC LIMIT 12",[CAMPAIGN]),
   sql.query("SELECT id,label,active,created_at,last_sync_at,last_error FROM cc_black_sync_sources ORDER BY created_at DESC LIMIT 20")
  ]);
  return respond({summary:summary[0]||{},byUnit,byDay,leads,history,sources,limit:2000});
 }catch(e){console.error("black leads GET failed",e?.code||"unknown");return fail("Falha ao carregar a campanha Black Friday.",503);}
}
export async function POST(request){
 try{
  if(!originOK(request))return fail("Origem não autorizada.",403);
  if(Number(request.headers.get("content-length")||0)>750000)return fail("Lote acima do limite de 750 KB.",413);
  const access=await getAccess();
  if(!canManageLeads(access))return fail("Acesso restrito à gestão comercial.",403);
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=="object")return fail("Solicitação inválida.",400);
  const sql=database();
  if(body.action==="import"){
   let result;
   try{result=await importLeads(body.leads,access.email,body.filename||"Planilha importada","excel");}
   catch(e){return fail(e.message,422);}
   return respond({ok:true,...result});
  }
  if(body.action==="update_status"){
   const id=String(body.id||""),status=String(body.status||"");
   if(!/^[a-f0-9-]{36}$/i.test(id)||!STATUSES.includes(status))return fail("Lead ou situação inválida.",422);
   const notes=String(body.notes||"").slice(0,2000);
   const rows=await sql.query("UPDATE cc_black_leads SET status=$2,notes=$3,contacted_at=CASE WHEN $2='novo' THEN contacted_at ELSE COALESCE(contacted_at,now()) END,converted_at=CASE WHEN $2='convertido' THEN COALESCE(converted_at,now()) ELSE NULL END,updated_at=now() WHERE id=$1::uuid AND campaign=$4 AND import_quarantined=false RETURNING id,status,notes",[id,status,notes,CAMPAIGN]);
   if(!rows.length)return fail("Lead não encontrado.",404);
   return respond({ok:true,lead:rows[0]});
  }
  if(body.action==="create_webhook"){
   const label=String(body.label||"Formulário Google Black Friday").trim().slice(0,120);
   if(label.length<3)return fail("Informe a identificação da planilha.",422);
   const token=randomBytes(32).toString("base64url");
   const hash=createHash("sha256").update(token).digest("hex");
   const created=await sql.query("INSERT INTO cc_black_sync_sources(label,token_hash,created_by) VALUES($1,$2,$3) RETURNING id",[label,hash,access.email]);
   return respond({id:created[0].id,token,url:new URL("/api/black-leads/webhook",request.url).toString()},201);
  }
  if(body.action==="revoke_webhook"){
   if(!/^[a-f0-9-]{36}$/i.test(String(body.id||"")))return fail("Identificador inválido.",422);
   await sql.query("UPDATE cc_black_sync_sources SET active=false WHERE id=$1::uuid",[body.id]);
   return respond({ok:true});
  }
  return fail("Ação não reconhecida.",422);
 }catch(e){console.error("black leads POST failed",e?.code||"unknown",String(e?.message||"").slice(0,150));return fail("Falha ao atualizar a campanha. Dados anteriores preservados.",503);}
}