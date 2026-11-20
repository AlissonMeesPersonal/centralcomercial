import {timingSafeEqual} from "node:crypto";
import {getAccess} from "../../../../lib/access";
import {database} from "../../../../lib/db";
import {configured,redirectUri,tokens,graph,encrypt,performSync} from "../../../../lib/microsoft-calendar";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request){
 const url=new URL(request.url);
 const result=new URL("/",url.origin);
 let outcome="error";
 try{
  const access=await getAccess();
  if(!access.allowed)throw Error("Sessão inválida.");
  const raw=request.cookies.get("cc_ms_oauth")?.value;
  if(!raw||!configured())throw Error("Autorização expirada ou não configurada.");
  const cookie=JSON.parse(raw),state=url.searchParams.get("state")||"";
  const a=Buffer.from(cookie.state||""),b=Buffer.from(state);
  if(a.length!==b.length||!timingSafeEqual(a,b)||cookie.email!==access.email)throw Error("Estado OAuth inválido.");
  if(url.searchParams.has("error"))throw Error("Autorização recusada.");
  const code=url.searchParams.get("code");
  if(!code)throw Error("Código OAuth ausente.");
  const granted=await tokens({grant_type:"authorization_code",code,redirect_uri:redirectUri,code_verifier:cookie.verifier,scope:"openid profile email offline_access User.Read Calendars.Read"});
  if(!granted.refresh_token)throw Error("A Microsoft não forneceu permissão de atualização offline.");
  const me=await graph("/me?$select=id,displayName,mail,userPrincipalName",granted.access_token);
  const owner=access.email;
  await database().query("INSERT INTO cc_microsoft_calendar_connections(owner_email,microsoft_user_id,microsoft_email,microsoft_name,refresh_token_encrypted) VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner_email) DO UPDATE SET microsoft_user_id=excluded.microsoft_user_id,microsoft_email=excluded.microsoft_email,microsoft_name=excluded.microsoft_name,refresh_token_encrypted=excluded.refresh_token_encrypted,status='connected',last_error=NULL",[owner,me.id,me.mail||me.userPrincipalName||"",me.displayName||"",encrypt(granted.refresh_token)]);
  // Falha de importação não invalida a conexão: fica disponível para tentar novamente.
  try{const rows=await database().query("SELECT * FROM cc_microsoft_calendar_connections WHERE owner_email=$1",[owner]);await performSync(rows[0]);outcome="connected";}
  catch{outcome="sync_pending";}
 }catch(e){console.error("Microsoft calendar OAuth failure",String(e.message).slice(0,120));outcome="error";}
 result.searchParams.set("ms",outcome);result.searchParams.set("section","calendar");
 const redirect=Response.redirect(result);
 redirect.cookies.set("cc_ms_oauth",{value:"",httpOnly:true,secure:true,sameSite:"lax",path:"/api/microsoft-calendar",maxAge:0});
 return redirect;
}