import {createHash} from "node:crypto";
import {database} from "./db";
export const CAMPAIGN="black-friday-2026";
export const STATUSES=["novo","em_contato","interessado","sem_retorno","convertido","perdido"];
export const canManageLeads=access=>access.allowed&&["developer","admin","gestor"].includes(access.role);
export const headers={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const text=value=>String(value??"").trim();
const strip=value=>text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
// Alias informados no formulário Black26. Unidades ambíguas ficam com o
// nome original até que a administração confirme o vínculo correto.
const KNOWN_BLACK_UNITS=[
 {id:"site-26fit-canoas-mathias-velho",name:"26fit Canoas - Mathias Velho",aliases:["canoas mathias","mathias velho","mathias","canoas mathias velho"]},
 {id:"site-26fit-cascavel-irani",name:"26fit Cascavel - Irani",aliases:["cascavel irani","irani tancredo cascavel parana","irani tancredo","cascavel irani tancredo"]},
 {id:"site-26fit-cascavel-jl",name:"26fit Cascavel - JL",aliases:["cascavel shopping jl","cascavel jl","shopping jl"]},
 {id:"site-26fit-porto-uniao",name:"26fit Porto União",aliases:["porto uniao","26fit porto uniao"]},
 {id:"site-26fit-guaiba",name:"26fit Guaíba",aliases:["guaiba","26fit guaiba"]}
];
export function resolveBlackUnit(value){
 const raw=text(value).replace(/\s+/g," ").slice(0,180);
 const query=strip(raw).replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
 const match=KNOWN_BLACK_UNITS.find(u=>u.aliases.includes(query)||strip(u.name).replace(/[^a-z0-9]+/g," ").trim()===query);
 return match?{label:match.name,id:match.id}:{label:raw,id:null};
}
export function normalizeLead(input){
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Linha do formulário inválida.");
 const name=text(input.name||input.leadName).slice(0,180);
 const phone=text(input.phone||input.whatsapp).replace(/[^0-9+]/g,"");
 const digits=phone.replace(/\D/g,"");
 const email=text(input.email).toLowerCase().slice(0,254);
 const resolved=resolveBlackUnit(input.unitLabel||input.unit);
 const unitLabel=resolved.label;
 const unitId=resolved.id||text(input.unitId).slice(0,140);
 const rawDate=text(input.responseAt||input.timestamp||"");
 let date=null;
 if(rawDate){
  const br=rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if(br)date=new Date(br[3]+"-"+br[2].padStart(2,"0")+"-"+br[1].padStart(2,"0")+"T"+(br[4]||"00").padStart(2,"0")+":"+(br[5]||"00")+":"+(br[6]||"00")+"-03:00");
  else date=new Date(rawDate);
 }
 if(!name||!unitLabel||digits.length<10||digits.length>13)throw Error("Nome, telefone (com DDD) ou unidade ausente/inválida.");
 if(rawDate&&(!date||Number.isNaN(date.getTime())))throw Error("Data da resposta inválida.");
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error("E-mail inválido.");
 if(unitId&&!/^[a-zA-Z0-9_-]{5,140}$/.test(unitId))throw Error("Identificador da unidade inválido.");
 const rawKey=text(input.sourceKey).slice(0,180);
 const canonicalUnitKey=strip(unitLabel).replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
 const signature=date?["black-form",date.toISOString(),digits,canonicalUnitKey].join("|"):(rawKey||[digits,canonicalUnitKey,strip(name)].join("|"));
 const sourceKey=createHash("sha256").update(signature).digest("hex");
 return {sourceKey,responseAt:date?.toISOString()||null,name,phone:digits,email,unitLabel,unitId:unitId||null};
}
export async function importLeads(inputs,actor,filename="Importação",source="manual"){
 if(!Array.isArray(inputs)||inputs.length<1||inputs.length>300)throw Error("Envie entre 1 e 300 leads por lote.");
 const leads=[...new Map(inputs.map(normalizeLead).map(l=>[l.sourceKey,l])).values()];
 // Respostas repetidas no mesmo arquivo não interrompem a importação.
 // A restrição UNIQUE no Neon também protege contra novos envios da mesma resposta.
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
export function mapSheetRows(headers,rows,rowNumbers=[],sourceId=""){
 if(!Array.isArray(headers)||!Array.isArray(rows))throw Error("Formato da planilha inválido.");
 const map=headerMapping(headers);
 if(map.name<0||map.phone<0||map.unit<0)throw Error("Não foi possível identificar as colunas de nome, telefone e unidade. Ajuste os cabeçalhos da planilha.");
 return rows.map((r,i)=>{
  if(!Array.isArray(r))throw Error("Linha Google Sheets inválida.");
  return {
   name:r[map.name],phone:r[map.phone],unit:r[map.unit],
   email:map.email>=0?r[map.email]:"",
   responseAt:map.timestamp>=0?r[map.timestamp]:"",
   sourceKey:"google-form|"+String(sourceId)+"|"+String(rowNumbers[i]||i+2)
  };
 });
}
