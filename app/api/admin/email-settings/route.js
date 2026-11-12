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

export async function GET(){
 try{
  const access=await getAccess();
  if(!isAdmin(access))return reply({error:"Acesso restrito à administração."},access.signedIn?403:401);
  return reply(state());
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
   if(!response.ok)throw Error("Envio rejeitado pelo serviço de e-mail.");
   const data=await response.json();
   if(!data?.id)throw Error("Envio não confirmado pelo serviço.");
   await sql.query(
    "UPDATE cc_email_test_logs SET status='sent',provider_id=$2,updated_at=now() WHERE id=$1",
    [id,String(data.id).slice(0,200)]
   );
   return reply({ok:true,message:"Mensagem aceita pelo provedor. Confira a caixa de entrada e a pasta de spam.",recipient:access.email});
  }catch{
   await sql.query("UPDATE cc_email_test_logs SET status='failed',updated_at=now() WHERE id=$1",[id]).catch(()=>{});
   return reply({error:"O provedor não confirmou o envio. Verifique a chave, o remetente e a verificação do domínio no Resend."},502);
  }
 }catch{return reply({error:"Falha ao processar o teste de e-mail."},503);}
}
