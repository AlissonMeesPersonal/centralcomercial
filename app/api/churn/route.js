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
  let batches=[];
  if(all) batches=await sql.query(
   "SELECT id,filename,rows_total,rows_inserted,rows_updated,imported_by,created_at FROM cc_churn_batches ORDER BY created_at DESC LIMIT 20"
  );
  return Response.json({rows,batches,year,role:access.role,canImport:all},{headers:HEADERS});
 }catch{
  return error("Não foi possível consultar os dados de churn.",503);
 }
}
