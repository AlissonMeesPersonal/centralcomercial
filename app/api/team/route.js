import { randomBytes } from "node:crypto";
import { getAccess,canInviteRole } from "../../../lib/access";
import {database} from "../../../lib/db";
import {hashToken,normalizeEmail} from "../../../lib/invitations";
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
   "SELECT m.email,m.name,m.role,m.status,m.created_at FROM cc_team_members m WHERE NOT EXISTS (SELECT 1 FROM cc_hidden_developers h WHERE lower(h.email)=lower(m.email)) ORDER BY m.created_at DESC"
  );
  const invitations=await sql.query(
   "SELECT email,name,role,invited_by,created_at,expires_at FROM cc_team_invitations i WHERE i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now() AND NOT EXISTS (SELECT 1 FROM cc_hidden_developers h WHERE lower(h.email)=lower(i.email)) ORDER BY created_at DESC"
  );
  return Response.json({members,invitations,role:access.role},{headers});
 }catch{return fail("Não foi possível carregar o cadastro da equipe.",503);}
}
export async function POST(request) {
 try{
  const {access,error}=await authorise();if(error)return error;
  if(Number(request.headers.get("content-length")||0)>5000)return fail("Dados excedem o limite.",413);
  let data;try{data=await request.json();}catch{return fail("Solicitação inválida.",400);}
  const email=normalizeEmail(data.email),name=String(data.name||"").trim(),role=String(data.role||"").trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>255)return fail("Informe um e-mail válido.",422);
  if(name.length<2||name.length>120)return fail("Informe o nome do colaborador (2 a 120 caracteres).",422);
  if(!canInviteRole(access.role,role))return fail("Seu perfil não permite conceder este nível de acesso.",403);
  const sql=database();
  const hidden=await sql.query("SELECT 1 FROM cc_hidden_developers WHERE lower(email)=$1 LIMIT 1",[email]);
  if(hidden.length)return fail("Este e-mail não pode ser cadastrado na equipe.",403);
  const existing=await sql.query("SELECT status FROM cc_team_members WHERE lower(email)=$1 LIMIT 1",[email]);
  if(existing[0]?.status==="active")return fail("Este e-mail já possui acesso à equipe.",409);
  const token=randomBytes(32).toString("base64url"),tokenHash=hashToken(token);
  await sql.query(
   "WITH old AS (UPDATE cc_team_invitations SET revoked_at=now() WHERE lower(email)=$1 AND accepted_at IS NULL AND revoked_at IS NULL RETURNING token_hash) INSERT INTO cc_team_invitations(token_hash,email,name,role,invited_by,expires_at) VALUES($2,$1,$3,$4,$5,now()+interval '7 days')",
   [email,tokenHash,name,role,access.email]
  );
  await sql.query(
   "INSERT INTO cc_team_audit(actor_email,target_email,action,new_value) VALUES($1,$2,'invite',$3::jsonb)",
   [access.email,email,JSON.stringify({role,name})]
  );
  const url="https://centralcomercial-eta.vercel.app/convite/"+token;
  return Response.json({url,email,name,role,message:"Convite criado. Compartilhe o link com a pessoa autorizada."},{status:201,headers});
 }catch{return fail("Não foi possível gerar o convite. Tente novamente.",500);}
}
export async function PATCH(request){
 try{
  const {access,error}=await authorise();if(error)return error;
  let body;try{body=await request.json();}catch{return fail("Solicitação inválida.",400);}
  const email=normalizeEmail(body.email),status=body.status;
  if(!["active","suspended"].includes(status))return fail("Situação inválida.",422);
  if(email===access.email)return fail("Você não pode suspender o próprio acesso.",403);
  const sql=database();
  if((await sql.query("SELECT 1 FROM cc_hidden_developers WHERE lower(email)=$1",[email])).length)return fail("Conta indisponível para alterações.",403);
  const target=await sql.query("SELECT role,status FROM cc_team_members WHERE lower(email)=$1 LIMIT 1",[email]);
  if(!target.length)return fail("Colaborador não encontrado.",404);
  if(!canInviteRole(access.role,target[0].role))return fail("Você não pode alterar este perfil.",403);
  const rows=await sql.query("UPDATE cc_team_members SET status=$2,updated_at=now() WHERE lower(email)=$1 RETURNING email,role,status",[email,status]);
  await sql.query("INSERT INTO cc_team_audit(actor_email,target_email,action,old_value,new_value) VALUES($1,$2,'change_status',$3::jsonb,$4::jsonb)",[access.email,email,JSON.stringify({status:target[0].status}),JSON.stringify({status})]);
  return Response.json({member:rows[0]},{headers});
 }catch{return fail("Não foi possível atualizar o acesso.",500);}
}
