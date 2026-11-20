import {createCipheriv,createDecipheriv,createHash,randomBytes} from "node:crypto";
import {database} from "./db";

export const origin="https://centralcomercial-eta.vercel.app";
export const redirectUri=origin+"/api/microsoft-calendar/callback";
export const scopes="openid profile email offline_access User.Read Calendars.Read";
export const configured=()=>Boolean(process.env.MICROSOFT_CLIENT_ID&&process.env.MICROSOFT_CLIENT_SECRET&&process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY);
const encryptionKey=()=>{
 const key=process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY;
 if(!key||key.length<32)throw Error("A chave de criptografia precisa ter 32 caracteres ou mais.");
 return createHash("sha256").update(key,"utf8").digest();
};
export function encrypt(value){
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);
 const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
 return [iv.toString("base64url"),cipher.getAuthTag().toString("base64url"),encrypted.toString("base64url")].join(".");
}
export function decrypt(value){
 const [iv,tag,payload]=String(value).split(".");
 if(!iv||!tag||!payload)throw Error("Credencial inválida.");
 const decipher=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(iv,"base64url"));
 decipher.setAuthTag(Buffer.from(tag,"base64url"));
 return Buffer.concat([decipher.update(Buffer.from(payload,"base64url")),decipher.final()]).toString("utf8");
}
export async function tokens(params){
 const body=new URLSearchParams({...params,client_id:process.env.MICROSOFT_CLIENT_ID,client_secret:process.env.MICROSOFT_CLIENT_SECRET});
 const result=await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body,cache:"no-store"
 });
 const json=await result.json();
 if(!result.ok||!json.access_token)throw Error("Falha de autorização Microsoft ("+(json.error||result.status)+").");
 return json;
}
export async function graph(path,token){
 const response=await fetch("https://graph.microsoft.com/v1.0"+path,{headers:{Authorization:"Bearer "+token,Prefer:'outlook.timezone="UTC"'},cache:"no-store"});
 if(!response.ok)throw Error("Graph HTTP "+response.status);
 return response.json();
}
export async function performSync(connection){
 const sql=database();
 const owner=connection.owner_email;
 try{
  const updated=await tokens({grant_type:"refresh_token",refresh_token:decrypt(connection.refresh_token_encrypted),scope:scopes});
  const newRefresh=updated.refresh_token||decrypt(connection.refresh_token_encrypted);
  // Guarda a credencial renovada antes da busca, para evitar perder o token em erros transitórios.
  await sql.query("UPDATE cc_microsoft_calendar_connections SET refresh_token_encrypted=$2,status='connected' WHERE owner_email=$1",[owner,encrypt(newRefresh)]);
  const begin=new Date(),end=new Date();
  begin.setUTCMonth(begin.getUTCMonth()-2);end.setUTCMonth(end.getUTCMonth()+12);
  const query=new URLSearchParams({startDateTime:begin.toISOString(),endDateTime:end.toISOString(),$top:"100"});
  let next="https://graph.microsoft.com/v1.0/me/calendarView?"+query.toString();
  const entries=[];let pages=0;
  while(next&&pages<25){
   if(!next.startsWith("https://graph.microsoft.com/v1.0/"))throw Error("Paginação externa recusada.");
   const response=await fetch(next,{headers:{Authorization:"Bearer "+updated.access_token,Prefer:'outlook.timezone="UTC"'},cache:"no-store"});
   if(!response.ok)throw Error("Graph HTTP "+response.status);
   const page=await response.json();
   for(const ev of page.value||[]){
    if(!ev.id||ev.isCancelled)continue;
    const toDate=x=>{const v=String(x?.dateTime||"");return new Date(v.endsWith("Z")?v:v+"Z");};
    const starts=toDate(ev.start),ends=toDate(ev.end);
    if(!Number.isFinite(starts.getTime())||!Number.isFinite(ends.getTime()))continue;
    const privateEvent=ev.sensitivity==="private"||ev.sensitivity==="confidential";
    entries.push({id:ev.id,title:privateEvent?"Compromisso privado":String(ev.subject||"Sem título").slice(0,180),
     starts:starts.toISOString(),ends:ends.toISOString(),location:privateEvent?"":String(ev.location?.displayName||"").slice(0,250),
     joinUrl:privateEvent?"":String(ev.onlineMeeting?.joinUrl||ev.onlineMeetingUrl||"").slice(0,1800),privateEvent});
   }
   next=page["@odata.nextLink"]||null;pages++;
  }
  if(next)throw Error("Agenda extensa demais para uma sincronização completa. Nenhum registro existente será removido.");
  // A exclusão de eventos fora da janela é intencional; sincronizamos apenas o intervalo atual.
  // Executa a atualização de forma transacional pelo servidor PostgreSQL.
  await sql.query("SELECT cc_microsoft_replace_events($1,$2::jsonb)",[owner,JSON.stringify(entries)]);
  await sql.query("UPDATE cc_microsoft_calendar_connections SET last_synced_at=now(),last_error=NULL WHERE owner_email=$1",[owner]);
  return {synced:entries.length};
 }catch(e){
  await sql.query("UPDATE cc_microsoft_calendar_connections SET last_error=$2 WHERE owner_email=$1",[owner,String(e.message).slice(0,240)]).catch(()=>{});
  throw e;
 }
}
