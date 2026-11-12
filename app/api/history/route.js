import {getAccess} from "../../../lib/access";
import {database} from "../../../lib/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;

const headers={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const error=(message,status)=>Response.json({error:message},{status,headers});
const managers=["developer","admin","gestor"];
const modules=["Demandas","Campanhas","Equipe","Unidades","Churn","Configurações"];
const statuses=["concluido","em_andamento","arquivada"];
const allowedModules=["demanda","campanha","configuracoes"];
const allowedActions=["created","updated","completed","stage_changed","archived","restored","demo_removed","backup_imported"];
const maxTitle=140,maxDetails=240;
const expectedStatus=action=>action==="archived"||action==="demo_removed"?"arquivada":
 action==="completed"||action==="backup_imported"?"concluido":"em_andamento";

export async function GET(request){
 try{
  const access=await getAccess();
  if(!access.signedIn)return error("Faça login para consultar o histórico.",401);
  if(!access.allowed||!managers.includes(access.role))return error("Acesso ao histórico restrito à gestão.",403);

  const url=new URL(request.url),params=url.searchParams;
  const module=params.get("module")||"",status=params.get("status")||"";
  const q=(params.get("q")||"").trim().slice(0,100);
  const start=params.get("start")||"",end=params.get("end")||"";
  const page=Number(params.get("page")||"1");
  if(module&&!modules.includes(module))return error("Módulo inválido.",422);
  if(status&&!statuses.includes(status))return error("Status inválido.",422);
  if(!Number.isSafeInteger(page)||page<1||page>10000)return error("Página inválida.",422);
  if((start&&!/^\d{4}-\d{2}-\d{2}$/.test(start))||(end&&!/^\d{4}-\d{2}-\d{2}$/.test(end)))
   return error("Informe datas no formato AAAA-MM-DD.",422);
  const sql=database(),filters=[module,status,q,start||null,end||null];
  const predicate="($1::text='' OR module=$1) AND ($2::text='' OR status=$2) AND ($3::text='' OR title ILIKE '%'||$3||'%' OR details ILIKE '%'||$3||'%' OR actor_email ILIKE '%'||$3||'%' OR action ILIKE '%'||$3||'%') AND ($4::date IS NULL OR occurred_at >= $4::date) AND ($5::date IS NULL OR occurred_at < ($5::date + INTERVAL '1 day'))";
  const [items,total,summary]=await Promise.all([
   sql.query("SELECT event_key,module,action,title,details,status,actor_email,unit_id,occurred_at,source FROM cc_history_feed WHERE "+predicate+" ORDER BY occurred_at DESC,event_key DESC LIMIT $6 OFFSET $7",
     [...filters,30,(page-1)*30]),
   sql.query("SELECT COUNT(*)::int AS count FROM cc_history_feed WHERE "+predicate,filters),
   sql.query("SELECT status,COUNT(*)::int AS count FROM cc_history_feed GROUP BY status")
  ]);
  return Response.json({items,page,pageSize:30,total:total[0]?.count||0,
   summary:Object.fromEntries(statuses.map(s=>[s,summary.find(x=>x.status===s)?.count||0]))},{headers});
 }catch{
  return error("Não foi possível carregar o histórico da Central.",503);
 }
}

export async function POST(request){
 try{
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return error("Origem não autorizada.",403);
  const length=Number(request.headers.get("content-length")||0);
  if(length>3500)return error("Registro excede o tamanho permitido.",413);
  const access=await getAccess();
  if(!access.signedIn)return error("Faça login antes de registrar uma ação.",401);
  if(!access.allowed)return error("Acesso não autorizado.",403);

  let body;try{body=await request.json();}catch{return error("Registro inválido.",400);}
  if(!body||typeof body!=="object")return error("Registro inválido.",400);
  const module=String(body.module||""),action=String(body.action||"");
  const eventId=String(body.eventId||""),entityId=String(body.entityId||"");
  const title=String(body.title||"").trim(),details=String(body.details||"").trim();
  const unitId=body.unitId===null||body.unitId===undefined?null:String(body.unitId).trim();
  if(!allowedModules.includes(module)||!allowedActions.includes(action))return error("Tipo de ação não permitido.",422);
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(eventId))
   return error("Identificador de evento inválido.",422);
  if(entityId.length<1||entityId.length>140||title.length<1||title.length>maxTitle||details.length>maxDetails)
   return error("Dados do registro inválidos.",422);
  if(unitId!==null&&(unitId.length>150||!/^[a-zA-Z0-9-]+$/.test(unitId)))return error("Unidade inválida.",422);
  if(module==="configuracoes"&&!managers.includes(access.role))return error("Permissão insuficiente.",403);
  if(module==="campanha"&&!managers.includes(access.role))return error("Permissão insuficiente para campanhas.",403);
  // Demanda local: o evento é reportado pelo navegador e não prova que o
  // conteúdo local esteja sincronizado com outras pessoas.
  if(module==="demanda"&&["lider","colaborador"].includes(access.role)){
   const units=await database().query("SELECT unit_id FROM cc_team_unit_assignments WHERE lower(email)=$1",[access.email]);
   if(unitId===null||!units.some(x=>x.unit_id===unitId))return error("Demanda fora das suas unidades autorizadas.",403);
  }
  const status=expectedStatus(action);
  const rows=await database().query(
   "INSERT INTO cc_activity_events(event_id,module,action,entity_id,title,details,status,unit_id,actor_email) VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(event_id) DO NOTHING RETURNING event_id",
   [eventId,module,action,entityId,title,details||null,status,unitId,access.email]
  );
  return Response.json({ok:true,recorded:rows.length===1,status},{status:rows.length?201:200,headers});
 }catch{return error("Não foi possível registrar esta atividade. Tente novamente.",503);}
}
