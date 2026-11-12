import { database } from "../../../lib/unit-db";
import { getAccess } from "../../../lib/access";
export const runtime="nodejs";export const dynamic="force-dynamic";export const revalidate=0;
const headers={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
export async function GET(){
 if(process.env.VERCEL_ENV!=="production")
   return Response.json({error:"Diretório indisponível fora de produção"},{status:403,headers});
 try{
  const access=await getAccess();
  if(!access.signedIn)return Response.json({error:"Entre na sua conta."},{status:401,headers});
  if(!access.allowed)return Response.json({error:"Acesso não autorizado."},{status:403,headers});
  const sql=database();
  const seed=await sql.query("SELECT id,payload FROM cc_unit_seed ORDER BY id");
  if(seed.length!==83)throw Error("Fonte incompleta");
  const rows=await sql.query("SELECT id,payload,revision,updated_at FROM cc_unit_records ORDER BY created_at");
  const map=new Map(seed.map(record=>[record.id,{...record.payload,revision:0}]));
  for(const row of rows){map.set(row.id,{...(map.get(row.id)||{}),...row.payload,revision:row.revision,updatedAt:row.updated_at});}
  // O código comercial vem exclusivamente do registro de conciliação
  // do churn. Nunca inferir pelo código sequencial do PDF.
  const codes=await sql.query("SELECT unit_id,source_code FROM cc_churn_report_units WHERE unit_id IS NOT NULL AND match_status='conciliada'");
  const byCode=new Map(codes.map(row=>[row.unit_id,Number(row.source_code)]));
  const full=[...map.values()].map(unit=>({
    ...unit,
    churnCode:byCode.get(unit.id)??null
  }));
  const visible=["developer","admin","gestor"].includes(access.role)?full:full.map(x=>({
    id:x.id,name:x.name,city:x.city,state:x.state,region:x.region,
    type:x.type,status:x.status,siteUrl:x.siteUrl,source:x.source,demo:false,revision:x.revision,churnCode:x.churnCode
  }));
  return Response.json({units:visible,total:map.size,shared:true},{headers});
 }catch{return Response.json({error:"Banco de unidades indisponível"},{status:503,headers});}
}
