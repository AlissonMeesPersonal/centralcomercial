import {randomBytes,createHash} from "node:crypto";
import {getAccess} from "../../../lib/access";
import {database} from "../../../lib/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
const HEADERS={"Cache-Control":"private, no-store","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const reply=(body,status=200)=>Response.json(body,{status,headers:HEADERS});
const fail=(message,status)=>reply({error:message},status);
const admin=access=>access.allowed&&["developer","admin"].includes(access.role);
const tokenHash=t=>createHash("sha256").update(t).digest("hex");
function originOK(request){
 const origin=request.headers.get("origin");
 return !origin||origin===new URL(request.url).origin;
}
function normalizeDaily(rows,period){
 if(!Array.isArray(rows)||rows.length<1||rows.length>31)throw Error("Informe de 1 a 31 dias do mês.");
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw Error("Mês inválido.");
 const maxDays=new Date(Number(period.slice(0,4)),Number(period.slice(5)),0).getDate();
 const days=new Set();
 return rows.map(r=>{
  const day=Number(r.day),opportunities=Number(r.opportunities),sales=Number(r.sales);
  if(!Number.isInteger(day)||day<1||day>maxDays||days.has(day))throw Error("Dias inválidos ou duplicados.");
  if(!Number.isSafeInteger(opportunities)||!Number.isSafeInteger(sales)||opportunities<0||sales<0||sales>opportunities)
   throw Error("Oportunidades e vendas precisam ser inteiros não negativos; vendas não podem superar oportunidades.");
  days.add(day);
  return {day,opportunities,sales};
 }).sort((a,b)=>a.day-b.day);
}
async function linkOwner(request){
 const token=String(request.headers.get("x-upload-token")||"");
 if(!/^[A-Za-z0-9_-]{40,80}$/.test(token))return null;
 const rows=await database().query("SELECT label FROM cc_opportunity_upload_links WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now() LIMIT 1",[tokenHash(token)]);
 return rows.length?{tokenHash:tokenHash(token),label:rows[0].label}:null;
}
export async function GET(request){
 try{
  const access=await getAccess();
  if(!admin(access))return fail("Acesso restrito à administração.",403);
  const sql=database();
  const [reports,links]=await Promise.all([
   sql.query("SELECT to_char(period,'YYYY-MM') AS period,daily,filename,imported_by,imported_at,revision FROM cc_opportunity_reports ORDER BY period DESC LIMIT 36"),
   sql.query("SELECT left(token_hash,12) AS id,label,created_by,created_at,expires_at,revoked_at,upload_count FROM cc_opportunity_upload_links ORDER BY created_at DESC LIMIT 40")
  ]);
  return reply({reports,links});
 }catch(e){console.error("opportunity GET failed",e?.code||"unknown");return fail("Não foi possível carregar os levantamentos.",503);}
}
export async function POST(request){
 try{
  if(!originOK(request))return fail("Origem não autorizada.",403);
  if(Number(request.headers.get("content-length")||0)>120000)return fail("Importação excede o limite de 120 KB.",413);
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=="object")return fail("Solicitação inválida.",400);
  const sql=database();
  if(body.action==="upload"){
   const owner=await linkOwner(request);
   let actor=owner?.label;
   if(!owner){
    const access=await getAccess();
    if(!admin(access))return fail("Link inválido, expirado ou acesso não autorizado.",403);
    actor=access.email;
   }
   let daily;
   try{daily=normalizeDaily(body.daily,body.period);}catch(e){return fail(e.message,422);}
   const filename=String(body.filename||"planilha").slice(0,180);
   const result=await sql.query(
    "INSERT INTO cc_opportunity_reports(period,daily,filename,imported_by) VALUES(to_date($1||'-01','YYYY-MM-DD'),$2::jsonb,$3,$4) ON CONFLICT(period) DO UPDATE SET daily=excluded.daily,filename=excluded.filename,imported_by=excluded.imported_by,imported_at=now(),revision=cc_opportunity_reports.revision+1 RETURNING revision",
    [body.period,JSON.stringify(daily),filename,actor]
   );
   if(owner)await sql.query("UPDATE cc_opportunity_upload_links SET upload_count=upload_count+1 WHERE token_hash=$1",[owner.tokenHash]);
   return reply({ok:true,revision:result[0]?.revision||1,days:daily.length,
    opportunities:daily.reduce((n,x)=>n+x.opportunities,0),sales:daily.reduce((n,x)=>n+x.sales,0)});
  }
  const access=await getAccess();
  if(!admin(access))return fail("Acesso restrito à administração.",403);
  if(body.action==="create_link"){
   const label=String(body.label||"Assistente comercial").trim().slice(0,100);
   if(label.length<3)return fail("Informe um nome para identificar a assistente.",422);
   const token=randomBytes(32).toString("base64url");
   await sql.query("INSERT INTO cc_opportunity_upload_links(token_hash,label,created_by,expires_at) VALUES($1,$2,$3,now()+interval '30 days')",[tokenHash(token),label,access.email]);
   const url=new URL(request.url);
   return reply({url:url.origin+"/envio-levantamento/"+token,label,validDays:30},201);
  }
  if(body.action==="revoke_link"){
   const id=String(body.id||"");
   if(!/^[0-9a-f]{12}$/.test(id))return fail("Link inválido.",422);
   await sql.query("UPDATE cc_opportunity_upload_links SET revoked_at=now() WHERE left(token_hash,12)=$1 AND revoked_at IS NULL",[id]);
   return reply({ok:true});
  }
  return fail("Ação desconhecida.",422);
 }catch(e){console.error("opportunity POST failed",{code:e?.code||"unknown",message:e?.message});return fail("Não foi possível concluir a operação. Os dados existentes foram preservados.",503);}
}
