import {database} from "./db";

export const tz="America/Sao_Paulo";
export const eventKinds=["reuniao","evento","treinamento","visita","prazo_demanda","outro"];
export const eventStatuses=["agendado","concluido","cancelado"];
export const isManager=role=>["developer","admin","gestor"].includes(role);
const emailRegex=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCalendarInput(body,{allowDeadline=false}={}){
 if(!body||typeof body!=="object")throw Error("Dados inválidos.");
 const title=String(body.title||"").trim(),description=String(body.description||"").trim();
 const kind=String(body.kind||"evento"),location=String(body.location||"").trim();
 const status=String(body.status||"agendado"),unitId=body.unitId?String(body.unitId):null;
 const attendees=Array.isArray(body.attendees)?[...new Set(body.attendees.map(x=>String(x).trim().toLowerCase()))]:[];
 const startsAt=new Date(body.startsAt),endsAt=new Date(body.endsAt);
 if(title.length<2||title.length>160||description.length>3000||location.length>240)
  throw Error("Verifique título, descrição e local do evento.");
 if(!eventKinds.includes(kind)||(!allowDeadline&&kind==="prazo_demanda")||!eventStatuses.includes(status))
  throw Error("Categoria ou situação inválida.");
 if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt||endsAt-startsAt>14*86400000)
  throw Error("Informe datas válidas e término posterior ao início (até 14 dias).");
 if(unitId&&(!/^[A-Za-z0-9-]{4,150}$/.test(unitId)))throw Error("Unidade inválida.");
 if(attendees.length>100||attendees.some(email=>email.length>255||!emailRegex.test(email)))
  throw Error("Lista de participantes inválida (até 100 pessoas).");
 return {title,description,kind,location,status,unitId,attendees,startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString()};
}

export async function checkCalendarScope(access,payload){
 const sql=database();
 if(payload.unitId){
  const unit=await sql.query("SELECT 1 FROM cc_unit_seed WHERE id=$1 UNION ALL SELECT 1 FROM cc_unit_records WHERE id=$1 LIMIT 1",[payload.unitId]);
  if(!unit.length)throw Error("Unidade não encontrada no diretório.");
  if(!isManager(access.role)){
   const allowed=await sql.query("SELECT 1 FROM cc_team_unit_assignments WHERE lower(email)=$1 AND unit_id=$2 LIMIT 1",[access.email,payload.unitId]);
   if(!allowed.length)throw Error("Seu perfil não possui acesso a essa unidade.");
  }
 }else if(!isManager(access.role)){
  // Eventos gerais da rede só podem ser criados pela gestão; colaboradores
  // trabalham com o escopo das unidades atribuídas.
  throw Error("Selecione uma unidade na qual você possua acesso.");
 }
 if(payload.attendees.length){
  const rows=await sql.query("SELECT lower(email) AS email FROM cc_team_members WHERE status='active' AND lower(email)=ANY($1::text[])",[payload.attendees]);
  const allowed=new Set(rows.map(r=>r.email));
  if(payload.attendees.some(email=>email!==access.email&&!allowed.has(email)))
   throw Error("Selecione somente membros ativos da equipe.");
 }
 return true;
}
export const unauthorized=(message,status)=>Response.json({error:message},{status,headers:{"Cache-Control":"private,no-store","Vary":"Cookie"}});
