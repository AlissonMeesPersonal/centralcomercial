import {getAccess} from "../../../../lib/access";
import {database} from "../../../../lib/db";
export const runtime="nodejs";export const dynamic="force-dynamic";export const revalidate=0;
const headers={"Cache-Control":"private,no-store","Vary":"Cookie"};
const fail=(message,status)=>Response.json({error:message},{status,headers});
async function authorize(){
 const access=await getAccess();
 return access;
}
export async function GET(){
 try{
  const access=await authorize();
  if(!access.signedIn)return fail("Faça login.",401);
  if(!access.allowed||!["developer","admin","gestor"].includes(access.role))return fail("Sem permissão para conciliar unidades.",403);
  const rows=await database().query("SELECT source_code,source_label,unit_id,match_status,match_revision FROM cc_churn_report_units ORDER BY source_code");
  return Response.json({rows},{headers});
 }catch{return fail("Conciliação de unidades indisponível.",503);}
}
export async function PATCH(request){
 try{
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return fail("Origem não autorizada.",403);
  if(Number(request.headers.get("content-length")||0)>1800)return fail("Solicitação excede o limite.",413);
  const access=await authorize();
  if(!access.signedIn)return fail("Faça login.",401);
  if(!access.allowed||!["developer","admin","gestor"].includes(access.role))return fail("Sem permissão.",403);
  let body;try{body=await request.json();}catch{return fail("Dados inválidos.",400);}
  const sourceCode=body?.sourceCode,revision=body?.revision,unitId=body?.unitId===null?null:String(body?.unitId||"");
  if(!Number.isSafeInteger(sourceCode)||sourceCode<1||sourceCode>10000||
     !Number.isSafeInteger(revision)||revision<0||
     (unitId!==null&&!/^[A-Za-z0-9-]{4,150}$/.test(unitId)))
   return fail("Código, unidade ou revisão inválidos.",422);
  const rows=await database().query(
   "SELECT cc_churn_set_unit_match($1,$2,$3,$4)::jsonb AS result",
   [sourceCode,unitId,revision,access.email]
  );
  const result=rows[0]?.result;
  if(!result)return fail("Erro de gravação.",503);
  if(result.error==="revision_conflict")return fail("Conflito: outra pessoa alterou o vínculo. Atualize a tela.",409);
  if(result.error==="unit_already_linked")return fail("Esta unidade já está vinculada a outro código. Confira a planilha.",409);
  if(result.error==="training_record")return fail("O registro de treinamento não pode ser atribuído a uma academia.",422);
  if(result.error==="unit_not_found")return fail("Unidade não encontrada no diretório.",422);
  if(result.error)return fail("Código de unidade não encontrado.",404);
  return Response.json({ok:true,...result},{headers});
 }catch{return fail("Não foi possível salvar a conciliação.",503);}
}
