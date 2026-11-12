import { database } from "../../../lib/unit-db";
export const runtime="nodejs";export const dynamic="force-dynamic";export const revalidate=0;
const headers={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
export async function GET(){
 if(process.env.VERCEL_ENV!=="production")
   return Response.json({error:"Diretório indisponível fora de produção"},{status:403,headers});
 try{
  const original=JSON.parse(process.env.CENTRAL_INTERNAL_DIRECTORY_JSON||"{}");
  if(!Array.isArray(original.units)||original.units.length!==83)throw Error("Fonte incompleta");
  const rows=await database().query("SELECT id,payload,revision,updated_at FROM cc_unit_records ORDER BY created_at");
  const map=new Map(original.units.map(unit=>[unit.id,{...unit,revision:0}]));
  for(const row of rows){map.set(row.id,{...(map.get(row.id)||{}),...row.payload,revision:row.revision,updatedAt:row.updated_at});}
  return Response.json({units:[...map.values()],total:map.size,shared:true},{headers});
 }catch{return Response.json({error:"Banco de unidades indisponível"},{status:503,headers});}
}
