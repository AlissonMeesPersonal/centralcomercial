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
 const status=String(body.status||"agendado");
 const legacyUnitId=body.unitId?String(body.unitId):null;
 const rawIds=Array.isArray(body.unitIds)?body.unitIds:(legacyUnitId?[legacyUnitId]:[]);
 const unitIds=[...new Set(rawIds.map(x=>String(x)))];
 const unitId=unitIds.length===1?unitIds[0]:null;
 const attendees=Array.isArray(body.attendees)?[...new Set(body.attendees.map(x=>String(x).trim().toLowerCase()))]:[];
 const startsAt=new Date(body.startsAt),endsAt=new Date(body.endsAt);
 if(title.length<2||title.length>160||description.length>3000||location.length>240)
  throw Error("Verifique título, descrição e local do evento.");
 if(!eventKinds.includes(kind)||(!allowDeadline&&kind==="prazo_demanda")||!eventStatuses.includes(status))
  throw Error("Categoria ou situação inválida.");
 if(!Number.isFinite(startsAt.getTime())||!Number.isFinite(endsAt.getTime())||endsAt<=startsAt||endsAt-startsAt>14*86400000)
  throw Error("Informe datas válidas e término posterior ao início (até 14 dias).");
 if(unitIds.length>200||unitIds.some(id=>!/^[A-Za-z0-9-]{4,150}$/.test(id)))throw Error("Seleção de unidades inválida.");
 if(attendees.length>100||attendees.some(email=>email.length>255||!emailRegex.test(email)))
  throw Error("Lista de participantes inválida (até 100 pessoas).");
 return {title,description,kind,location,status,unitId,unitIds,attendees,startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString()};
}

export async function checkCalendarScope(access,payload){
 const sql=database();
 const unitIds=Array.isArray(payload.unitIds)?payload.unitIds:(payload.unitId?[payload.unitId]:[]);
 if(unitIds.length){
  const found=await sql.query("SELECT id FROM cc_unit_seed WHERE id=ANY($1::text[]) UNION SELECT id FROM cc_unit_records WHERE id=ANY($1::text[])",[unitIds]);
  if(found.length!==unitIds.length)throw Error("Uma ou mais unidades não foram encontradas no diretório.");
  if(!isManager(access.role)){
   const assigned=await sql.query("SELECT unit_id FROM cc_team_unit_assignments WHERE lower(email)=$1 AND unit_id=ANY($2::text[])",[access.email,unitIds]);
   if(assigned.length!==unitIds.length)throw Error("Seu perfil não possui acesso a todas as unidades selecionadas.");
  }
 }else if(!isManager(access.role)){
  throw Error("Somente a gestão pode criar compromissos para toda a rede.");
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
