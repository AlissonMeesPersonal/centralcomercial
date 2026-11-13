import { randomBytes } from "node:crypto";
import { getAccess,canInviteRole } from "../../../lib/access";
import {database} from "../../../lib/db";
import {hashToken,normalizeEmail} from "../../../lib/invitations";
import {sendCentralTeamInvite} from "../../../lib/emails/team-invite";
export const runtime="nodejs";export const dynamic="force-dynamic";export const revalidate=0;
const headers={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const fail=(error,status)=>Response.json({error},{status,headers});
async function authorise(){
 const access=await getAccess();
 if(!access.signedIn)return {error:fail("Faça login para gerenciar a equipe.",401)};
 if(!access.allowed||!access.canManage)return {error:fail("Seu perfil não pode administrar a equipe.",403)};
 return {access};
}
export async function GET(){
 try{
  const {access,error}=await authorise();if(error)return error;
  const sql=database();
  const members=await sql.query(
   "SELECT m.email,m.name,m.role,m.status,m.unit_revision,m.role_revision,m.created_at FROM cc_team_members m WHERE NOT EXISTS (SELECT 1 FROM cc_hidden_developers h WHERE lower(h.email)=lower(m.email)) ORDER BY m.created_at DESC"
  );
  const invitations=await sql.query(
   "SELECT email,name,role,unit_ids,invited_by,created_at,expires_at FROM cc_team_invitations i WHERE i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now() AND NOT EXISTS (SELECT 1 FROM cc_hidden_developers h WHERE lower(h.email)=lower(i.email)) ORDER BY created_at DESC"
  );
  const links=await sql.query("SELECT email,array_agg(unit_id ORDER BY unit_id) AS unit_ids FROM cc_team_unit_assignments GROUP BY email");
  const linked=new Map(links.map(x=>[x.email,x.unit_ids]));
  return Response.json({members:members.map(x=>({...x,unit_ids:linked.get(x.email)||[]})),invitations,role:access.role},{headers});
 }catch{return fail("Não foi possível carregar o cadastro da equipe.",503);}
}
export async function POST(request) {
 try{
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return fail("Origem não autorizada.",403);
  const {access,error}=await authorise();if(error)return error;
  if(Number(request.headers.get("content-length")||0)>5000)return fail("Dados excedem o limite.",413);
  let data;try{data=await request.json();}catch{return fail("Solicitação inválida.",400);}
  if(data.action==="resend_invitation"){
   const email=normalizeEmail(data.email);
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>255)
    return fail("Informe um e-mail válido.",422);
   if(!process.env.RESEND_API_KEY||!process.env.AUTH_EMAIL_FROM)
    return fail("O remetente do Resend ainda não está configurado.",503);
   const sql=database();
   const pending=await sql.query(
    "SELECT name,role,unit_ids,created_at FROM cc_team_invitations WHERE lower(email)=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1",
    [email]
   );
   if(!pending.length)return fail("Não existe convite ativo para este endereço. Gere um novo convite.",404);
   if(!canInviteRole(access.role,pending[0].role))
    return fail("Seu perfil não pode reenviar convites para este cargo.",403);
   if(new Date(pending[0].created_at).getTime()>Date.now()-120000)
    return fail("Um convite acabou de ser gerado. Aguarde dois minutos antes de reenviar.",429);
   const member=await sql.query("SELECT status FROM cc_team_members WHERE lower(email)=$1 LIMIT 1",[email]);
   if(member[0]?.status==="active")return fail("Este usuário já possui acesso ativo e não precisa de novo convite.",409);
   const token=randomBytes(32).toString("base64url"),tokenHash=hashToken(token);
   // Revoga o link antigo e gera um novo em uma única instrução.
   const renewed=await sql.query(
    "WITH previous AS (UPDATE cc_team_invitations SET revoked_at=now() WHERE lower(email)=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now() RETURNING name,role,unit_ids), added AS (INSERT INTO cc_team_invitations(token_hash,email,name,role,invited_by,expires_at,unit_ids) SELECT $2,$1,name,role,$3,now()+interval '7 days',unit_ids FROM previous ORDER BY name LIMIT 1 RETURNING email,name,role) SELECT * FROM added",
    [email,tokenHash,access.email]
   );
   if(!renewed.length)return fail("O convite foi alterado em outra sessão. Atualize a lista.",409);
   const url="https://centralcomercial-eta.vercel.app/convite/"+token;
   await sql.query(
    "INSERT INTO cc_team_audit(actor_email,target_email,action,new_value) VALUES($1,$2,'invite',$3::jsonb)",
    [access.email,email,JSON.stringify({action:"resend",role:renewed[0].role})]
   );
   const delivery=await sendCentralTeamInvite({
    email,name:renewed[0].name,role:renewed[0].role,url,tokenHash
   });
   return Response.json({
    url,email,emailStatus:delivery.status,
    message:delivery.status==="accepted"
      ?"Convite enviado ao Resend. O destinatário deve conferir a caixa de entrada e o spam."
      :"O convite foi renovado, mas o Resend não confirmou o envio. Copie o novo link e envie manualmente."
   },{status:200,headers});
  }
  const email=normalizeEmail(data.email),name=String(data.name||"").trim(),role=String(data.role||"").trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>255)return fail("Informe um e-mail válido.",422);
  if(name.length<2||name.length>120)return fail("Informe o nome do colaborador (2 a 120 caracteres).",422);
  if(!canInviteRole(access.role,role))return fail("Seu perfil não permite conceder este nível de acesso.",403);
  const sql=database();
  const hidden=await sql.query("SELECT 1 FROM cc_hidden_developers WHERE lower(email)=$1 LIMIT 1",[email]);
  if(hidden.length)return fail("Este e-mail não pode ser cadastrado na equipe.",403);
  const existing=await sql.query("SELECT status FROM cc_team_members WHERE lower(email)=$1 LIMIT 1",[email]);
  if(existing[0]?.status==="active")return fail("Este e-mail já possui acesso à equipe.",409);
  const unitIds=Array.isArray(data.unitIds)?[...new Set(data.unitIds)]:[];
  if(unitIds.length>200||unitIds.some(id=>typeof id!=="string"||!/^[-a-zA-Z0-9]{6,180}$/.test(id)))return fail("Seleção de unidades inválida.",422);
  if(["lider","colaborador"].includes(role)&&unitIds.length===0)return fail("Selecione pelo menos uma unidade para esse perfil.",422);
  if(unitIds.length){
   const found=await sql.query("SELECT id FROM cc_unit_seed WHERE id=ANY($1::text[]) UNION SELECT id FROM cc_unit_records WHERE id=ANY($1::text[])",[unitIds]);
   if(found.length!==unitIds.length)return fail("Alguma unidade não está cadastrada no diretório.",422);
  }
  const token=randomBytes(32).toString("base64url"),tokenHash=hashToken(token);
  await sql.query(
   "WITH old AS (UPDATE cc_team_invitations SET revoked_at=now() WHERE lower(email)=$1 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING token_hash) INSERT INTO cc_team_invitations(token_hash,email,name,role,invited_by,expires_at,unit_ids) VALUES($2,$1,$3,$4,$5,now()+interval '7 days',$6::text[])",
   [email,tokenHash,name,role,access.email,unitIds]
  );
  await sql.query(
   "INSERT INTO cc_team_audit(actor_email,target_email,action,new_value) VALUES($1,$2,'invite',$3::jsonb)",
   [access.email,email,JSON.stringify({role,name,unitIds})]
  );
  const url="https://centralcomercial-eta.vercel.app/convite/"+token;
  const delivery=await sendCentralTeamInvite({email,name,role,url,tokenHash});
  const message=delivery.status==="accepted"
   ?"Convite criado e aceito pelo Resend para envio. Confira se o destinatário recebeu."
   :delivery.status==="not_configured"
   ?"Convite criado. O e-mail automático não está configurado; compartilhe o link manualmente."
   :"Convite criado, mas o Resend não confirmou o envio. Compartilhe o link manualmente.";
  return Response.json({url,email,name,role,emailStatus:delivery.status,message},{status:201,headers});
 }catch{return fail("Não foi possível gerar o convite. Tente novamente.",500);}
}
export async function PATCH(request){
 try{
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return fail("Origem não autorizada.",403);
  const {access,error}=await authorise();if(error)return error;
  let body;try{body=await request.json();}catch{return fail("Solicitação inválida.",400);}
  const email=normalizeEmail(body.email),status=body.status;
  if(!["assign_units","set_role"].includes(body.action)&&!["active","suspended"].includes(status))return fail("Situação inválida.",422);
  if(email===access.email)return fail("Você não pode suspender o próprio acesso.",403);
  const sql=database();
  if((await sql.query("SELECT 1 FROM cc_hidden_developers WHERE lower(email)=$1",[email])).length)return fail("Conta indisponível para alterações.",403);
  const target=await sql.query("SELECT role,status,role_revision FROM cc_team_members WHERE lower(email)=$1 LIMIT 1",[email]);
  if(!target.length)return fail("Colaborador não encontrado.",404);
  if(!canInviteRole(access.role,target[0].role))return fail("Você não pode alterar este perfil.",403);
  if(body.action==="set_role"){
   const newRole=String(body.role||"").trim();
   const revision=body.roleRevision;
   const unitIds=Array.isArray(body.unitIds)?[...new Set(body.unitIds)]:null;
   if(!canInviteRole(access.role,newRole))return fail("Você não pode atribuir esse cargo.",403);
   if(!Number.isSafeInteger(revision)||revision<0)return fail("Revisão do cargo inválida.",422);
   if(!unitIds||unitIds.length>200||unitIds.some(id=>typeof id!=="string"||!/^[-a-zA-Z0-9]{6,180}$/.test(id)))
     return fail("Unidades selecionadas inválidas.",422);
   if(["lider","colaborador"].includes(newRole)&&unitIds.length===0)
     return fail("Vincule ao menos uma unidade para líder ou colaborador.",422);
   if(unitIds.length){
    const found=await sql.query("SELECT id FROM cc_unit_seed WHERE id=ANY($1::text[]) UNION SELECT id FROM cc_unit_records WHERE id=ANY($1::text[])",[unitIds]);
    if(found.length!==unitIds.length)return fail("Uma das unidades selecionadas não existe.",422);
   }
   const change=await sql.query("SELECT cc_change_team_role($1,$2,$3,$4,$5::text[])::integer AS revision",
     [email,access.email,revision,newRole,unitIds]);
   const next=Number(change[0]?.revision);
   if(next===-1)return fail("O cargo foi alterado em outra sessão. Atualize a equipe antes de salvar.",409);
   if(next===-2)return fail("Para este cargo, informe pelo menos uma unidade.",422);
   if(next===-3)return fail("Colaborador não encontrado.",404);
   if(!Number.isSafeInteger(next)||next<0)return fail("Não foi possível salvar a alteração.",500);
   return Response.json({email,role:newRole,unit_ids:unitIds,role_revision:next,message:"Cargo atualizado com histórico de alterações."},{headers});
  }
  if(body.action==="assign_units"){
   const unitIds=Array.isArray(body.unitIds)?[...new Set(body.unitIds)]:null;
   const revision=body.unitRevision;
   if(!unitIds||unitIds.length>200||unitIds.some(id=>typeof id!=="string"||!/^[-a-zA-Z0-9]{6,180}$/.test(id)))
    return fail("Seleção de unidades inválida.",422);
   if(!Number.isSafeInteger(revision)||revision<0)return fail("Revisão inválida.",422);
   if(unitIds.length){
    const available=await sql.query("SELECT id FROM cc_unit_seed WHERE id=ANY($1::text[]) UNION SELECT id FROM cc_unit_records WHERE id=ANY($1::text[])",[unitIds]);
    if(available.length!==unitIds.length)return fail("Uma das unidades selecionadas não existe.",422);
   }
   const result=await sql.query("SELECT cc_replace_team_units($1,$2,$3::text[],$4)::int AS revision",[email,access.email,unitIds,revision]);
   if(result[0]?.revision===-1)return fail("Conflito: outro administrador alterou essas unidades. Atualize antes de salvar.",409);
   return Response.json({email,unit_ids:unitIds,unit_revision:result[0]?.revision},{headers});
  }
  const rows=await sql.query("UPDATE cc_team_members SET status=$2,updated_at=now() WHERE lower(email)=$1 RETURNING email,role,status",[email,status]);
  await sql.query("INSERT INTO cc_team_audit(actor_email,target_email,action,old_value,new_value) VALUES($1,$2,'change_status',$3::jsonb,$4::jsonb)",[access.email,email,JSON.stringify({status:target[0].status}),JSON.stringify({status})]);
  return Response.json({member:rows[0]},{headers});
 }catch{return fail("Não foi possível atualizar o acesso.",500);}
}
