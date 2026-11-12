import {getAccess} from "../../../lib/access";
import {database} from "../../../lib/db";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
const headers={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
export async function GET(){
 try{
  const access=await getAccess();
  if(!access.signedIn)return Response.json({error:"Faça login para selecionar unidades."},{status:401,headers});
  if(!access.allowed)return Response.json({error:"Conta sem acesso autorizado."},{status:403,headers});
  const records=await database().query(
   "SELECT DISTINCT a.unit_id FROM cc_team_unit_assignments a JOIN cc_team_members m ON lower(m.email)=lower(a.email) WHERE m.status='active' AND EXISTS (SELECT 1 FROM cc_unit_seed s WHERE s.id=a.unit_id UNION SELECT 1 FROM cc_unit_records r WHERE r.id=a.unit_id) ORDER BY a.unit_id"
  );
  return Response.json({unitIds:records.map(x=>x.unit_id),total:records.length},{headers});
 }catch{
  return Response.json({error:"Não foi possível conferir os cadastros das unidades."},{status:503,headers});
 }
}
