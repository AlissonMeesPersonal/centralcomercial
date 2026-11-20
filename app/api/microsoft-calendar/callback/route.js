import {NextResponse} from "next/server";
import {timingSafeEqual,createHash} from "node:crypto";
import {getAccess} from "../../../../lib/access";
import {database} from "../../../../lib/db";
import {configured,redirectUri,tokens,graph,encrypt,performSync} from "../../../../lib/microsoft-calendar";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request){
 const url=new URL(request.url);
 const result=new URL("/",url.origin);
 let outcome="error",stage="session";
 try{
  const access=await getAccess();
  if(!access.allowed)throw Error("Sessão inválida.");
  // O estado de autorização fica separado do verificador PKCE, sem JSON no cookie.
  // Usa novos nomes para descartar cookies quebrados de tentativas anteriores.
  stage="cookies";
  const savedState=request.cookies.get("cc_ms_state_v2")?.value||"";
  const verifier=request.cookies.get("cc_ms_verifier_v2")?.value||"";
  const ownerHash=request.cookies.get("cc_ms_owner_v2")?.value||"";
  if(!configured()||!savedState||!verifier||!ownerHash)throw Error("Autorização expirada. Inicie uma nova conexão.");
  stage="state";
  const state=url.searchParams.get("state")||"";
  const a=Buffer.from(savedState),b=Buffer.from(state);
  const expectedOwner=createHash("sha256").update(access.email).digest("hex");
  const ownerA=Buffer.from(ownerHash),ownerB=Buffer.from(expectedOwner);
  if(a.length!==b.length||!timingSafeEqual(a,b)||ownerA.length!==ownerB.length||!timingSafeEqual(ownerA,ownerB)){
   throw Error("Estado OAuth inválido.");
  }
  stage="authorization";
  if(url.searchParams.has("error"))throw Error("Autorização recusada.");
  const code=url.searchParams.get("code");
  if(!code)throw Error("Código OAuth ausente.");
  stage="token";
  const granted=await tokens({grant_type:"authorization_code",code,redirect_uri:redirectUri,code_verifier:verifier,scope:"openid profile email offline_access User.Read Calendars.Read"});
  if(!granted.refresh_token)throw Error("A Microsoft não forneceu permissão de atualização offline.");
  stage="profile";
  const me=await graph("/me?$select=id,displayName,mail,userPrincipalName",granted.access_token);
  const owner=access.email;
  stage="database";
  await database().query("INSERT INTO cc_microsoft_calendar_connections(owner_email,microsoft_user_id,microsoft_email,microsoft_name,refresh_token_encrypted) VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner_email) DO UPDATE SET microsoft_user_id=excluded.microsoft_user_id,microsoft_email=excluded.microsoft_email,microsoft_name=excluded.microsoft_name,refresh_token_encrypted=excluded.refresh_token_encrypted,status='connected',last_error=NULL",[owner,me.id,me.mail||me.userPrincipalName||"",me.displayName||"",encrypt(granted.refresh_token)]);
  // Falha de importação não invalida a conexão: fica disponível para tentar novamente.
  try{const rows=await database().query("SELECT * FROM cc_microsoft_calendar_connections WHERE owner_email=$1",[owner]);await performSync(rows[0]);outcome="connected";}
  catch{outcome="sync_pending";}
 }catch(e){
  console.error("Microsoft calendar OAuth failure",stage,String(e.message).slice(0,160));
  outcome="error";
  result.searchParams.set("ms_reason",stage);
 }
 result.searchParams.set("ms",outcome);result.searchParams.set("section","calendar");
 const redirect=NextResponse.redirect(result);
 const cleanup={httpOnly:true,secure:true,sameSite:"lax",path:"/api/microsoft-calendar",maxAge:0};
 for(const name of ["cc_ms_oauth","cc_ms_state_v2","cc_ms_verifier_v2","cc_ms_owner_v2"]){
  redirect.cookies.set(name,"",cleanup);
 }
 return redirect;
}