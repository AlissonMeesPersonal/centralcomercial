import {createHash} from "node:crypto";
import {database} from "../../../../lib/db";
import {reminderEmail} from "../../../../lib/emails/calendar-reminder";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
const cache={"Cache-Control":"no-store"};
export async function GET(request){
 const secret=process.env.CRON_SECRET;
 const apiKey=process.env.RESEND_API_KEY,from=process.env.AUTH_EMAIL_FROM;
 // Antes de configurar um remetente verificado e o segredo do cron,
 // a rotina permanece desligada; a interface não promete envio.
 if(!secret||!apiKey||!from)return Response.json({active:false,reason:"Serviço de e-mail não configurado."},{headers:cache});
 if(request.headers.get("authorization")!=="Bearer "+secret)
  return new Response("Não autorizado.",{status:401,headers:cache});
 try{
  const sql=database();
  const recipients=await sql.query(
    "SELECT e.id,e.kind,e.title,e.starts_at,e.unit_id,e.revision,person.email,CASE WHEN (e.starts_at AT TIME ZONE 'America/Sao_Paulo')::date=(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 'hoje' ELSE 'amanha' END AS reminder_type,COALESCE(u.payload->>'name',e.unit_id,'Rede 26fit') AS unit_name FROM cc_calendar_events e CROSS JOIN LATERAL (SELECT lower(e.owner_email) AS email UNION SELECT lower(a.email) FROM cc_calendar_attendees a WHERE a.event_id=e.id) person LEFT JOIN cc_team_members member ON lower(member.email)=person.email LEFT JOIN cc_hidden_developers hidden ON lower(hidden.email)=person.email LEFT JOIN cc_unit_seed u ON u.id=e.unit_id WHERE e.status='agendado' AND e.starts_at>now() AND (e.starts_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN (now() AT TIME ZONE 'America/Sao_Paulo')::date AND (now() AT TIME ZONE 'America/Sao_Paulo')::date+1 AND (member.status='active' OR hidden.email IS NOT NULL) ORDER BY e.starts_at LIMIT 250"
  );
  let sent=0,failed=0,ignored=0;
  for(const item of recipients){
   const claimed=await sql.query(
     "INSERT INTO cc_calendar_reminders(event_id,recipient_email,reminder_type,revision,status,attempted_at) VALUES($1,$2,$3,$4,'claimed',now()) ON CONFLICT(event_id,recipient_email,reminder_type,revision) DO UPDATE SET status='claimed',attempted_at=now() WHERE cc_calendar_reminders.status='failed' AND cc_calendar_reminders.attempted_at < now()-interval '20 minutes' OR cc_calendar_reminders.status='claimed' AND cc_calendar_reminders.attempted_at < now()-interval '20 minutes' RETURNING event_id",
     [item.id,item.email,item.reminder_type,item.revision]
   );
   if(!claimed.length){ignored++;continue;}
   const mail=reminderEmail({title:item.title,kind:item.kind,startsAt:item.starts_at,unitName:item.unit_name,when:item.reminder_type});
   const idempotency=createHash("sha256").update([item.id,item.email,item.reminder_type,item.revision].join("|")).digest("hex");
   try{
    const response=await fetch("https://api.resend.com/emails",{
     method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey,"Idempotency-Key":"26fit-reminder-"+idempotency},
     body:JSON.stringify({from,to:[item.email],subject:mail.subject,html:mail.html,text:mail.text}),
     signal:AbortSignal.timeout(5500)
    });
    if(!response.ok)throw Error("Provedor recusou o envio");
    const result=await response.json();
    await sql.query("UPDATE cc_calendar_reminders SET status='sent',sent_at=now(),provider_id=$5 WHERE event_id=$1 AND recipient_email=$2 AND reminder_type=$3 AND revision=$4",[item.id,item.email,item.reminder_type,item.revision,result.id||null]);
    sent++;
   }catch{
    await sql.query("UPDATE cc_calendar_reminders SET status='failed' WHERE event_id=$1 AND recipient_email=$2 AND reminder_type=$3 AND revision=$4",[item.id,item.email,item.reminder_type,item.revision]);
    failed++;
   }
  }
  return Response.json({active:true,sent,failed,ignored},{headers:cache});
 }catch{return Response.json({error:"Falha na rotina de lembretes."},{status:503,headers:cache});}
}
