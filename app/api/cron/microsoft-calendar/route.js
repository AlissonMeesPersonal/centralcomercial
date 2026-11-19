import {database} from "../../../../lib/db";
import {configured,performSync} from "../../../../lib/microsoft-calendar";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get("authorization")!=="Bearer "+secret)return Response.json({error:"Não autorizado."},{status:401});
 if(!configured())return Response.json({skipped:true,reason:"Microsoft não configurado."});
 const sql=database();
 // Processa um número limitado de conexões a cada execução para evitar timeouts.
 const connections=await sql("SELECT * FROM cc_microsoft_calendar_connections ORDER BY last_synced_at ASC NULLS FIRST LIMIT 8");
 const results=[];
 for(const connection of connections){
  try{const updated=await performSync(connection);results.push({owner:connection.owner_email,ok:true,synced:updated.synced});}
  catch(e){results.push({owner:connection.owner_email,ok:false});}
 }
 return Response.json({processed:results.length,ok:results.filter(x=>x.ok).length,failed:results.filter(x=>!x.ok).length},{headers:{"Cache-Control":"no-store"}});
}