import {getAccess} from "../../../../lib/access";
import {database} from "../../../../lib/db";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(){
 try{
  const access=await getAccess();
  if(!access.signedIn)return Response.json({error:"Faça login."},{status:401});
  if(!access.allowed)return Response.json({error:"Acesso não autorizado."},{status:403});
  const members=await database().query("SELECT name,lower(email) AS email,role FROM cc_team_members WHERE status='active' ORDER BY name LIMIT 1000");
  return Response.json({members,currentEmail:access.email},{headers:{"Cache-Control":"private,no-store","Vary":"Cookie"}});
 }catch{return Response.json({error:"Equipe indisponível."},{status:503});}
}
