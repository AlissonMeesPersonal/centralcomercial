import { auth } from "./auth/server";
import { database } from "./db";

// Toda autorização é verificada no servidor, usando o email verificado
// do Neon Auth e o cadastro de membros no Neon PostgreSQL.
// O desenvolvedor NÃO é cadastrado como membro da equipe.
export async function getAccess() {
 const response = await auth.getSession();
 const session = response?.data ?? response;
 const user = session?.user;
 if (!user?.id || !user?.email) {
  return {signedIn:false,verified:false,allowed:false,canEdit:false,canManage:false,role:null};
 }
 const email = String(user.email).trim().toLowerCase();
 if (user.emailVerified !== true) {
  return {signedIn:true,verified:false,allowed:false,canEdit:false,canManage:false,role:null,email};
 }
 const sql=database();
 const hidden=await sql.query("SELECT 1 FROM cc_hidden_developers WHERE lower(email)=$1 LIMIT 1",[email]);
 if(hidden.length) {
  return {signedIn:true,verified:true,allowed:true,canEdit:true,canManage:true,role:"developer",email};
 }
 const users=await sql.query(
  "SELECT role,status,name FROM cc_team_members WHERE lower(email)=$1 LIMIT 1",[email]
 );
 if(users.length && users[0].status==="active") {
  const role=users[0].role;
  return {
   signedIn:true,verified:true,allowed:true,role,email,
   name:users[0].name,canEdit:["admin","gestor"].includes(role),
   canManage:["admin","gestor"].includes(role)
  };
 }
 const pending=await sql.query(
  "SELECT role FROM cc_team_invitations WHERE lower(email)=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1",
  [email]
 );
 return {signedIn:true,verified:true,allowed:false,canEdit:false,canManage:false,
  role:null,email,hasInvitation:pending.length>0,invitationRole:pending[0]?.role||null,
  suspended:users[0]?.status==="suspended"
 };
}
export async function getEditor(){return getAccess();}
export const canInviteRole=(editorRole,targetRole)=>{
 const options={
  developer:["admin","gestor","lider","colaborador"],
  admin:["gestor","lider","colaborador"],
  gestor:["lider","colaborador"]
 };
 return (options[editorRole]||[]).includes(targetRole);
};
