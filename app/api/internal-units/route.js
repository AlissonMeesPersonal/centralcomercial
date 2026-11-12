import { database } from "../../../lib/unit-db";
export const runtime="nodejs";export const dynamic="force-dynamic";export const revalidate=0;
const headers={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
export async function GET(){
 if(process.env.VERCEL_ENV!=="production")
   return Response.json({error:"Diretório indisponível fora de produção"},{status:403,headers});
 try{
  const sql=database();
  const seed=await sql.query("SELECT id,payload FROM cc_unit_seed ORDER BY id");
  if(seed.length!==83)throw Error("Fonte incompleta");
  const rows=await sql.query("SELECT id,payload,revision,updated_at FROM cc_unit_records ORDER BY created_at");
  const map=new Map(seed.map(record=>[record.id,{...record.payload,revision:0}]));
  for(const row of rows){map.set(row.id,{...(map.get(row.id)||{}),...row.payload,revision:row.revision,updatedAt:row.updated_at});}
  return Response.json({units:[...map.values()],total:map.size,shared:true},{headers});
 }catch{return Response.json({error:"Banco de unidades indisponível"},{status:503,headers});}
}
