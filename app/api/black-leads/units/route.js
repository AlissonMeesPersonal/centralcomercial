import {createHash} from "node:crypto";
import {database} from "../../../../lib/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;

const reply=(body,status=200)=>Response.json(body,{
 status,
 headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}
});

// Utiliza a chave já instalada no Apps Script. Sem credenciais da Central
// e sem expor dados pessoais de leads nesta rota.
export async function GET(request){
 const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!/^[A-Za-z0-9_-]{40,100}$/.test(token))return reply({error:"Integração não autorizada."},401);
 try{
  const sql=database(),hash=createHash("sha256").update(token).digest("hex");
  const valid=await sql.query(
   "SELECT 1 FROM cc_black_sync_sources WHERE token_hash=$1 AND active=true LIMIT 1",
   [hash]
  );
  if(!valid.length)return reply({error:"Integração revogada ou inválida."},403);

  const rows=await sql.query(
   "SELECT DISTINCT trim(payload->>'name') AS name, id, payload->>'state' AS state FROM (SELECT id,payload FROM cc_unit_seed UNION ALL SELECT id,payload FROM cc_unit_records) units WHERE payload->>'type' IN ('Unidade','Franquia','Eleve') AND length(trim(payload->>'name'))>5 ORDER BY name LIMIT 250"
  );
  const seen=new Set();
  const units=rows.filter(x=>{
   const key=x.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
   if(seen.has(key))return false;seen.add(key);return true;
  }).map(x=>({id:x.id,name:x.name,state:x.state}));
  units.sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
  return reply({units,count:units.length,source:"Central Comercial 26fit e Eleve"});
 }catch(e){
  console.error("black units feed failed",e?.code||"unknown");
  return reply({error:"Não foi possível consultar as unidades."},503);
 }
}
