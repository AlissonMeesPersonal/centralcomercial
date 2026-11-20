import {createHash} from "node:crypto";
import {database} from "./db";
export const CAMPAIGN="black-friday-2026";
export const STATUSES=["novo","em_contato","interessado","sem_retorno","convertido","perdido"];
export const canManageLeads=access=>access.allowed&&["developer","admin","gestor"].includes(access.role);
export const headers={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const text=value=>String(value??"").trim();
const strip=value=>text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function normalizeLead(input){
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Linha do formulário inválida.");
 const name=text(input.name||input.leadName).slice(0,180);
 const phone=text(input.phone||input.whatsapp).replace(/[^0-9+]/g,"");
 const digits=phone.replace(/\D/g,"");
 const email=text(input.email).toLowerCase().slice(0,254);
 const unitLabel=text(input.unitLabel||input.unit).replace(/\s+/g," ").slice(0,180);
 const unitId= text(input.unitId).slice(0,140);
 const rawDate=text(input.responseAt||input.timestamp||"");
 const date=rawDate?new Date(rawDate):null;
 if(!name||!unitLabel||digits.length<10||digits.length>13)throw Error("Nome, telefone (com DDD) ou unidade ausente/inválida.");
 if(rawDate&&(!date||Number.isNaN(date.getTime())))throw Error("Data da resposta inválida.");
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error("E-mail inválido.");
 if(unitId&&!/^[a-zA-Z0-9_-]{5,140}$/.test(unitId))throw Error("Identificador da unidade inválido.");
 const rawKey=text(input.sourceKey).slice(0,180);
 const signature=rawKey?rawKey:[rawDate||"sem-data",digits,strip(unitLabel),strip(name)].join("|");
 const sourceKey=createHash("sha256").update(signature).digest("hex");
 return {sourceKey,responseAt:date?.toISOString()||null,name,phone:digits,email,unitLabel,unitId:unitId||null};
}
export async function importLeads(inputs,actor,filename="Importação",source="manual"){
 if(!Array.isArray(inputs)||inputs.length<1||inputs.length>300)throw Error("Envie entre 1 e 300 leads por lote.");
 const leads=inputs.map(normalizeLead);
 const keys=new Set(leads.map(l=>l.sourceKey));
 if(keys.size!==leads.length)throw Error("A planilha contém linhas duplicadas no lote.");
 const sql=database();
 const ids=[...new Set(leads.map(l=>l.unitId).filter(Boolean))];
 if(ids.length){
  const found=await sql("SELECT id FROM cc_unit_seed WHERE id=ANY($1::text[]) UNION SELECT id FROM cc_unit_records WHERE id=ANY($1::text[])",[ids]);
  const ok=new Set(found.map(r=>r.id));
  for(const l of leads)if(l.unitId&&!ok.has(l.unitId))l.unitId=null;
 }
 const records=leads.map(l=>({...l,source}));
 const result=await sql(
  "WITH input AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(\"sourceKey\" text,\"responseAt\" timestamptz,name text,phone text,email text,\"unitLabel\" text,\"unitId\" text,source text)), inserted AS (INSERT INTO cc_black_leads(campaign,source_key,response_at,lead_name,phone,email,unit_label,unit_id,imported_by) SELECT $2,x.\"sourceKey\",x.\"responseAt\",x.name,x.phone,x.email,x.\"unitLabel\",x.\"unitId\",$3 FROM input x ON CONFLICT(campaign,source_key) DO UPDATE SET response_at=COALESCE(excluded.response_at,cc_black_leads.response_at),lead_name=excluded.lead_name,phone=excluded.phone,email=excluded.email,unit_label=excluded.unit_label,unit_id=COALESCE(excluded.unit_id,cc_black_leads.unit_id),updated_at=now() RETURNING id) SELECT count(*)::integer AS processed FROM inserted",
  [JSON.stringify(records),CAMPAIGN,actor]
 );
 await sql("INSERT INTO cc_black_import_history(campaign,filename,total_rows,imported_rows,imported_by) VALUES($1,$2,$3,$4,$5)",[CAMPAIGN,text(filename).slice(0,180),leads.length,Number(result[0]?.processed||0),actor]);
 return {processed:Number(result[0]?.processed||0)};
}
export function headerMapping(headers){
 const norm=headers.map(x=>strip(x));
 const find=patterns=>norm.findIndex(h=>patterns.some(p=>p.test(h)));
 return {
  timestamp:find([/carimbo/,/data.*hora/,/timestamp/,/data.*envio/,/data.*resposta/]),
  name:find([/nome/,/name/]),
  phone:find([/whatsapp/,/telefone/,/celular/,/fone/,/phone/]),
  email:find([/e-?mail/]),
  unit:find([/unidade/,/filial/,/cidade/,/academia/,/qual.*26fit/,/local.*trein/])
 };
}
export function mapSheetRows(headers,rows){
 if(!Array.isArray(headers)||!Array.isArray(rows))throw Error("Formato da planilha inválido.");
 const map=headerMapping(headers);
 if(map.name<0||map.phone<0||map.unit<0)throw Error("Não foi possível identificar as colunas de nome, telefone e unidade. Ajuste os cabeçalhos da planilha.");
 return rows.map((r,i)=>{
  if(!Array.isArray(r))throw Error("Linha Google Sheets inválida.");
  return {
   name:r[map.name],phone:r[map.phone],unit:r[map.unit],
   email:map.email>=0?r[map.email]:"",
   responseAt:map.timestamp>=0?r[map.timestamp]:"",
   sourceKey:"google-form|"+String(r.sourceKey||i+2)
  };
 });
}
