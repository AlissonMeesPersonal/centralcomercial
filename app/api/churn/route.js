import {getAccess} from "../../../lib/access";
import {database} from "../../../lib/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;

const HEADERS={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const error=(message,status)=>Response.json({error:message},{status,headers:HEADERS});

export async function GET(request){
 try{
  const access=await getAccess();
  if(!access.signedIn)return error("Entre na Central Comercial.",401);
  if(!access.allowed||!["developer","admin","gestor","lider"].includes(access.role))
   return error("Você não possui acesso aos indicadores de churn.",403);
  const yearText=new URL(request.url).searchParams.get("year")||String(new Date().getFullYear());
  if(!/^\d{4}$/.test(yearText)||Number(yearText)<2015||Number(yearText)>2100)
   return error("Ano inválido.",422);
  const year=Number(yearText),all=["developer","admin","gestor"].includes(access.role);
  const sql=database();
  const rows=await sql.query(
   "SELECT unit_id,to_char(period,'YYYY-MM') AS month,active_start,cancellations,enrollments,reactivations,active_end,revision,updated_at,CASE WHEN active_start>0 THEN round(100.0*cancellations/active_start,2)::float ELSE NULL END AS churn FROM cc_churn_monthly WHERE period>=make_date($1,1,1) AND period<make_date($1+1,1,1) AND ($2::boolean OR EXISTS(SELECT 1 FROM cc_team_unit_assignments a WHERE lower(a.email)=$3 AND a.unit_id=cc_churn_monthly.unit_id)) ORDER BY period DESC,unit_id LIMIT 10000",
   [year,all,access.email]
  );
  // Relatório da rede: churn = TOTAL DE SAÍDAS / ativos no início.
  // Preserva os cancelados individualmente; são componentes distintos.
  const reportRows=await sql.query(
   "SELECT u.unit_id,to_char(r.period,'YYYY-MM') AS month,r.active_start,r.total_exits AS cancellations,r.total_exits,r.cancelled AS cancelled_count,r.expired,r.dropouts,r.suspended,r.total_entries,r.new_members AS enrollments,r.returns AS reactivations,r.renewals,r.suspension_returns,r.active_end,r.revision,r.updated_at,CASE WHEN r.active_start>0 THEN round(100.0*r.total_exits/r.active_start,2)::float ELSE NULL END AS churn,'relatorio_26fit'::text AS source,u.source_code FROM cc_churn_report_rows r JOIN cc_churn_report_units u ON u.source_code=r.source_code WHERE u.unit_id IS NOT NULL AND r.period>=make_date($1,1,1) AND r.period<make_date($1+1,1,1) AND ($2::boolean OR EXISTS(SELECT 1 FROM cc_team_unit_assignments a WHERE lower(a.email)=$3 AND a.unit_id=u.unit_id)) ORDER BY r.period DESC,u.source_code LIMIT 10000",
   [year,all,access.email]
  );
  const keys=new Set(reportRows.map(r=>r.unit_id+"|"+r.month));
  const combined=[
   ...reportRows,
   ...rows.filter(r=>!keys.has(r.unit_id+"|"+r.month)).map(r=>({...r,source:"manual",total_exits:Number(r.cancellations)}))
  ];
  let sourceTotals=[],unmatched=[],sourceImports=[];
  if(all){
   sourceTotals=await sql.query(
    "SELECT to_char(r.period,'YYYY-MM') AS month,SUM(r.active_start)::int AS active_start,SUM(r.total_entries)::int AS entries_detail,SUM(r.total_exits)::int AS exits_detail,SUM(r.cancelled)::int AS cancelled,SUM(r.expired)::int AS expired,SUM(r.dropouts)::int AS dropouts,SUM(r.suspended)::int AS suspended,COUNT(*)::int AS source_rows,t.total_entries_reported,t.total_exits_reported,t.churn_reported::float AS churn_reported,t.growth_reported FROM cc_churn_report_rows r JOIN cc_churn_report_totals t ON t.period=r.period WHERE EXTRACT(YEAR FROM r.period)=$1 GROUP BY r.period,t.total_entries_reported,t.total_exits_reported,t.churn_reported,t.growth_reported ORDER BY r.period",
    [year]
   );
   unmatched=await sql.query(
    "SELECT to_char(r.period,'YYYY-MM') AS month,u.source_code,u.source_label,r.active_start,r.total_exits,r.cancelled,r.total_entries,r.active_end,CASE WHEN r.active_start>0 THEN round(100.0*r.total_exits/r.active_start,2)::float ELSE NULL END AS churn FROM cc_churn_report_rows r JOIN cc_churn_report_units u ON u.source_code=r.source_code WHERE u.unit_id IS NULL AND r.period>=make_date($1,1,1) AND r.period<make_date($1+1,1,1) ORDER BY r.period DESC,u.source_code LIMIT 1000",
    [year]
   );
   sourceImports=await sql.query(
    "SELECT source_hash,file_name,months,source_rows,imported_by,created_at FROM cc_churn_report_imports ORDER BY created_at DESC LIMIT 20"
   );
  }
  let batches=[];
  if(all) batches=await sql.query(
   "SELECT id,filename,rows_total,rows_inserted,rows_updated,imported_by,created_at FROM cc_churn_batches ORDER BY created_at DESC LIMIT 20"
  );
  return Response.json({rows:combined,batches,sourceTotals,unmatched,sourceImports,year,role:access.role,canImport:all},{headers:HEADERS});
 }catch{
  return error("Não foi possível consultar os dados de churn.",503);
 }
}
