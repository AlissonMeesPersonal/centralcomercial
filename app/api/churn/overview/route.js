import {getAccess} from "../../../../lib/access";
import {database} from "../../../../lib/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;

const HEADERS={
 "Cache-Control":"private, no-store, max-age=0",
 "Vary":"Cookie",
 "X-Content-Type-Options":"nosniff"
};
const fail=(message,status)=>Response.json({error:message},{status,headers:HEADERS});
const safeNumber=n=>n===null||n===undefined?null:Number(n);

export async function GET(){
 try{
  const access=await getAccess();
  if(!access.signedIn)return fail("Faça login na Central Comercial.",401);
  if(!access.allowed||!["developer","admin","gestor","lider"].includes(access.role)){
   return fail("Sem permissão para consultar o churn.",403);
  }
  const isNetwork=["developer","admin","gestor"].includes(access.role);
  const sql=database();

  // Na gestão, utilizamos os totais oficiais dos rodapés importados.
  // Os valores do rodapé nem sempre são idênticos à soma das linhas.
  const history=isNetwork
   ?await sql.query(
    "SELECT to_char(period,'YYYY-MM') AS month, total_entries_reported::int AS entries, total_exits_reported::int AS exits, (churn_reported*100)::float AS churn_pct FROM cc_churn_report_totals ORDER BY period DESC LIMIT 6"
   )
   :await sql.query(
    "SELECT to_char(r.period,'YYYY-MM') AS month, SUM(r.total_entries)::int AS entries, SUM(r.total_exits)::int AS exits, SUM(r.active_start)::int AS base, COUNT(DISTINCT u.unit_id)::int AS unit_count FROM cc_churn_report_rows r JOIN cc_churn_report_units u ON u.source_code=r.source_code JOIN cc_team_unit_assignments a ON a.unit_id=u.unit_id AND lower(a.email)=$1 WHERE u.unit_id IS NOT NULL GROUP BY r.period ORDER BY r.period DESC LIMIT 6",
    [access.email]
   );

  const ordered=history.map(x=>{
   const base=safeNumber(x.base);
   return {
    month:x.month,
    entries:Number(x.entries)||0,
    exits:Number(x.exits)||0,
    churnPct:isNetwork?safeNumber(x.churn_pct):base>0?Number(x.exits)/base*100:null,
    unitCount:x.unit_count===undefined?null:Number(x.unit_count)
   };
  });
  if(!ordered.length)return Response.json({scope:isNetwork?"rede":"unidades",latest:null,previous:null,trend:[],highlights:[]},{headers:HEADERS});

  const latest=ordered[0];
  const previous=ordered.length>1?ordered[1]:null;
  const queryArgs=isNetwork?[latest.month+"-01"]:[latest.month+"-01",access.email];
  // Classificação por percentual, somente academias com base >= 50.
  // A unidade Treinamento e registros não conciliados não entram na lista.
  const highlights=await sql.query(
   "SELECT u.source_code, u.unit_id, COALESCE(NULLIF(o.payload->>'name',''),NULLIF(s.payload->>'name',''),u.source_label) AS name, r.active_start::int AS base, r.total_exits::int AS exits, ROUND(100.0*r.total_exits/NULLIF(r.active_start,0),2)::float AS churn_pct "+
   "FROM cc_churn_report_rows r JOIN cc_churn_report_units u ON u.source_code=r.source_code "+
   "LEFT JOIN cc_unit_seed s ON s.id=u.unit_id LEFT JOIN cc_unit_records o ON o.id=u.unit_id "+
   (isNetwork
    ?"WHERE r.period=$1::date AND u.unit_id IS NOT NULL AND r.active_start>=50 "
    :"JOIN cc_team_unit_assignments a ON a.unit_id=u.unit_id AND lower(a.email)=$2 WHERE r.period=$1::date AND u.unit_id IS NOT NULL AND r.active_start>=50 ")+
   "ORDER BY churn_pct DESC, r.total_exits DESC, u.source_code LIMIT 3",
   queryArgs
  );
  const data={
   scope:isNetwork?"rede":"unidades",
   latest:{...latest,netChange:latest.entries-latest.exits},
   previous:previous?{month:previous.month,churnPct:previous.churnPct}:null,
   trend:ordered.slice().reverse(),
   highlights:highlights.map(x=>({
    code:Number(x.source_code),unitId:x.unit_id,name:x.name,
    base:Number(x.base),exits:Number(x.exits),churnPct:safeNumber(x.churn_pct)
   }))
  };
  return Response.json(data,{headers:HEADERS});
 }catch{
  return fail("Não foi possível carregar os indicadores de churn.",503);
 }
}
