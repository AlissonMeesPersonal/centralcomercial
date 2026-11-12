import {auth} from "../../../../lib/auth/server";
import {database} from "../../../../lib/db";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request){
 try{
  const response=await auth.getSession();
  const session=response?.data??response;
  const user=session?.user;
  if(!user?.id||!user?.email||user.emailVerified!==true)
   return Response.redirect(new URL("/auth/sign-in",request.url),303);
  const email=user.email.trim().toLowerCase();
  const sql=database();
  const rows=await sql.query(
   "WITH claimed AS (UPDATE cc_team_invitations SET accepted_at=now() WHERE token_hash=(SELECT token_hash FROM cc_team_invitations WHERE lower(email)=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1) AND accepted_at IS NULL AND revoked_at IS NULL RETURNING email,name,role), members AS (INSERT INTO cc_team_members(email,name,role,status,created_by) SELECT email,name,role,'active',$1 FROM claimed ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,role=EXCLUDED.role,status='active',updated_at=now() RETURNING email,role), grants AS (INSERT INTO cc_unit_roles(email,role) SELECT email,role FROM members ON CONFLICT(email) DO UPDATE SET role=EXCLUDED.role RETURNING email), audit AS (INSERT INTO cc_team_audit(actor_email,target_email,action,new_value) SELECT $1,email,'accept_invite',jsonb_build_object('role',role) FROM members RETURNING target_email) SELECT members.email,members.role FROM members JOIN grants USING(email) JOIN audit ON audit.target_email=members.email",
   [email]
  );
  if(!rows.length)return Response.redirect(new URL("/?acesso=convite-indisponivel",request.url),303);
  return Response.redirect(new URL("/",request.url),303);
 }catch{return Response.redirect(new URL("/?acesso=erro",request.url),303);}
}
