import {createHash} from "node:crypto";
import {getAccess} from "../../../../lib/access";
import {database} from "../../../../lib/db";
import {reminderEmail} from "../../../../lib/emails/calendar-reminder";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
export const maxDuration=15;
const HEADERS={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const reply=(data,status=200)=>Response.json(data,{status,headers:HEADERS});
const isAdmin=a=>a.signedIn&&a.allowed&&["developer","admin"].includes(a.role);
const fromValid=value=>{
 if(!value||value.length>250||/[\r\n]/.test(value))return false;
 const address=value.match(/(?:^|<)([^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>?$/)?.[1];
 return !!address;
};
const state=()=>{
 const sender=String(process.env.AUTH_EMAIL_FROM||"").trim();
 const provider=Boolean(process.env.RESEND_API_KEY);
 const from=fromValid(sender);
 const cron=Boolean(process.env.CRON_SECRET);
 return {
  provider,from,cron,
  sender:from?sender:null,
  configured:provider&&from&&cron,
  notes:"A configuração não garante a entrega. Confirme o domínio no Resend e faça um envio de teste."
 };
};

// Devolve somente uma categoria de erro do Resend, nunca credenciais nem o
// corpo bruto recebido do provedor.
function diagnoseProviderError(status,payload){
 const rawCode=String(payload?.name||payload?.code||payload?.error||"unknown_error");
 const code=/^[a-z0-9_-]{1,64}$/i.test(rawCode)?rawCode:"unknown_error";
 const message=String(payload?.message||"").toLowerCase();
 if(status===401||code==="invalid_api_key")
  return {code,error:"O Resend rejeitou a chave de API (HTTP 401). Confirme se a chave cadastrada na Vercel é válida e possui permissão para enviar."};
 if(status===403&&/(domain|dom[ií]nio|verif|dkim|spf|sender|from address)/i.test(message))
  return {code,error:"O Resend recusou o domínio ou remetente (HTTP 403). Em Resend → Domains, confirme que 26fit.com.br está verificado e com envio habilitado."};
 if(status===403&&/(testing|own email|your own|recipient|test emails|only send)/i.test(message))
  return {code,error:"A conta Resend está limitada a destinatários de teste (HTTP 403). Verifique o domínio de envio e as restrições da conta."};
 if(status===403)
  return {code,error:"A chave não possui permissão para este envio (HTTP 403). Confira o domínio permitido na chave e o domínio do remetente."};
 if(status===422)
  return {code,error:"O Resend rejeitou os dados do e-mail (HTTP 422). Confira o remetente AUTH_EMAIL_FROM e o domínio verificado."};
 if(status===429)
  return {code,error:"O Resend limitou temporariamente as solicitações (HTTP 429). Consulte os limites de envio da conta."};
 if(status>=500)
  return {code,error:"O serviço do Resend não conseguiu processar o envio (HTTP "+status+"). Consulte os logs do provedor."};
 return {code,error:"O Resend recusou o teste (HTTP "+status+", código "+code+"). Confira Resend → Logs → Errors para ver o motivo detalhado."};
}

export async function GET(){
 try{
  const access=await getAccess();
  if(!isAdmin(access))return reply({error:"Acesso restrito à administração."},access.signedIn?403:401);
  const last=await database().query(
   "SELECT status,created_at,provider_http_status,provider_error_code FROM cc_email_test_logs WHERE lower(actor_email)=$1 ORDER BY created_at DESC LIMIT 1",
   [access.email.toLowerCase()]
  ).catch(()=>[]);
  return reply({...state(),lastTest:last[0]||null});
 }catch{return reply({error:"Não foi possível consultar a configuração do e-mail."},503);}
}

export async function POST(request){
 try{
  if(request.headers.get("origin")!==new URL(request.url).origin)
   return reply({error:"Origem não autorizada."},403);
  const access=await getAccess();
  if(!isAdmin(access))return reply({error:"Acesso restrito à administração."},access.signedIn?403:401);
  const settings=state();
  if(!settings.configured)return reply({error:"Configure RESEND_API_KEY e AUTH_EMAIL_FROM na Vercel antes do teste."},409);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(access.email||""))
   return reply({error:"O usuário precisa ter e-mail válido para receber o teste."},422);

  // Somente para o e-mail da pessoa autenticada, no máximo um envio em 15 minutos.
  // O índice único preserva o limite mesmo com chamadas serverless simultâneas.
  const sql=database();
  const claimed=await sql.query(
   "INSERT INTO cc_email_test_logs(actor_email,window_start,status) VALUES($1,date_trunc('hour',now())+floor(extract(minute from now())/15)*interval '15 minutes','claimed') ON CONFLICT(actor_email,window_start) DO NOTHING RETURNING id",
   [access.email.toLowerCase()]
  );
  if(!claimed.length)return reply({error:"Já foi solicitado um teste neste intervalo. Aguarde até 15 minutos para repetir."},429);
  const id=claimed[0].id;
  const testDate=new Date(Date.now()+86400000);
  testDate.setUTCHours(15,0,0,0);
  const mail=reminderEmail({
   kind:"reuniao",title:"TESTE — Notificações da Central Comercial",
   startsAt:testDate.toISOString(),unitName:"Rede 26fit",
   when:"amanha"
  });
  try{
   const hashed=createHash("sha256").update(id+"|"+access.email).digest("hex");
   const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{
     "Content-Type":"application/json",
     Authorization:"Bearer "+process.env.RESEND_API_KEY,
     "Idempotency-Key":"26fit-email-test-"+hashed
    },
    body:JSON.stringify({
     from:settings.sender,
     to:[access.email.toLowerCase()],
     subject:mail.subject,html:mail.html,text:mail.text
    }),
    signal:AbortSignal.timeout(7000)
   });
   if(!response.ok){
    let providerError={};
    try{providerError=await response.json();}catch{}
    const issue=diagnoseProviderError(response.status,providerError);
    const failure=new Error(issue.error);
    failure.providerStatus=response.status;
    failure.providerCode=issue.code;
    throw failure;
   }
   const data=await response.json();
   if(!data?.id)throw Error("O Resend não retornou um identificador para este envio. Confira Resend → Logs.");
   await sql.query(
    "UPDATE cc_email_test_logs SET status='sent',provider_id=$2,updated_at=now() WHERE id=$1",
    [id,String(data.id).slice(0,200)]
   ).catch(()=>{});
   return reply({ok:true,message:"Mensagem aceita pelo provedor. Confira a caixa de entrada e a pasta de spam.",recipient:access.email});
  }catch(error){
   const status=Number.isInteger(error?.providerStatus)?error.providerStatus:null;
   const code=typeof error?.providerCode==="string"?error.providerCode:null;
   await sql.query(
    "UPDATE cc_email_test_logs SET status='failed',provider_http_status=$2,provider_error_code=$3,updated_at=now() WHERE id=$1",
    [id,status,code]
   ).catch(()=>{});
   return reply({
    error:status?error.message:"Não foi possível confirmar o envio (conexão com Resend ou resposta inválida). Confira os logs do provedor.",
    providerStatus:status,providerCode:code
   },502);
  }
 }catch{return reply({error:"Falha ao processar o teste de e-mail."},503);}
}
