import {createHash} from "node:crypto";
import { database } from "./db";
export const hashToken=token=>createHash("sha256").update(token).digest("hex");
export const normalizeEmail=email=>String(email||"").trim().toLowerCase();
export async function findInvite(token) {
 if(typeof token!=="string"||!(/^[a-zA-Z0-9_-]{30,100}$/).test(token))return null;
 const rows=await database().query(
  "SELECT email,name,role,expires_at FROM cc_team_invitations WHERE token_hash=$1 AND expires_at>now() AND accepted_at IS NULL AND revoked_at IS NULL LIMIT 1",
  [hashToken(token)]
 );
 return rows[0]||null;
}
export async function hasPendingInviteEmail(email) {
 const rows=await database().query(
  "SELECT 1 FROM cc_team_invitations WHERE lower(email)=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now() LIMIT 1",
  [normalizeEmail(email)]
 );
 return rows.length>0;
}
