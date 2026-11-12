import {createHash} from "node:crypto";
import readExcelFile from "read-excel-file/node";
import {getAccess} from "../../../../lib/access";
import {database} from "../../../../lib/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;
export const maxDuration=60;
const headers={"Cache-Control":"private,no-store,max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};
const err=(message,status=422)=>Response.json({error:message},{status,headers});
const MONTHS={jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12};
const rawFields=["active_start","new_members","renewals","returns","suspension_returns","total_entries",
 "cancelled","expired","dropouts","suspended","total_exits","active_end"];
const normalize=x=>String(x??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
const expected=["unidades","ativos inicio","novos","renovados","retornos","retorno suspensoes",
 "total entradas","cancelados","vencidos","desistencias","suspensos","total saidas","ativos fim"];
const num=(value,name)=>{
 if(typeof value==="number"&&Number.isSafeInteger(value)&&value>=0&&value<=100000000)return value;
 const raw=String(value??"").trim().replace(/[\s.]/g,"");
 if(!/^\d{1,9}$/.test(raw))throw Error("Número inválido em "+name);
 return Number(raw);
};
function parseReport(sheets){
 if(!Array.isArray(sheets)||!sheets.length||sheets.length>24)throw Error("Informe um arquivo com até 24 competências.");
 const rows=[],totals=[],warnings=[],seen=new Set();
 for(const sheet of sheets){
  const name=String(sheet.sheet||"").trim().toLowerCase();
  const match=name.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(20\d{2})$/);
  if(!match)throw Error("Aba sem competência reconhecida: "+sheet.sheet+". Use nomes como 'out 2026'.");
  const month=MONTHS[match[1]],year=Number(match[2]);
  const period=String(year)+"-"+String(month).padStart(2,"0")+"-01";
  if(seen.has(period))throw Error("Competência duplicada: "+period);
  seen.add(period);
  const matrix=sheet.data||[];
  if(matrix.length<3)throw Error("Aba vazia: "+sheet.sheet);
  const header=matrix[0].map(normalize);
  if(expected.some((label,i)=>header[i]!==label))throw Error("As colunas da aba '"+sheet.sheet+"' não seguem o modelo de movimentações 26fit.");
  let sumEntries=0,sumExits=0,sumBase=0;
  let lastCode=null,summary={};
  const codes=new Set();
  for(let i=1;i<matrix.length;i++){
   const r=matrix[i];const first=String(r?.[0]??"").trim();
   const codeMatch=first.match(/^(\d{1,4})\s*-\s*(.+)$/);
   if(codeMatch){
    const code=Number(codeMatch[1]);
    if(codes.has(code))throw Error("Código de unidade repetido na aba "+sheet.sheet+": "+code);
    codes.add(code);
    const values=rawFields.map((field,j)=>num(r[j+1],first+" / "+field));
    if(values[0]+values[5]-values[10]!==values[11])
      throw Error("Movimentação não fecha: "+first+" em "+sheet.sheet);
    const record={period,source_code:code,sourceLabel:first};
    rawFields.forEach((field,j)=>record[field]=values[j]);
    rows.push(record);sumEntries+=values[5];sumExits+=values[10];sumBase+=values[0];
    lastCode=code;
   }else if(first){
    const x=normalize(first);
    if(x==="total de entradas")summary.entries=num(r?.[1],"total de entradas");
    if(x==="total de saidas")summary.exits=num(r?.[1],"total de saídas");
    if(x==="churn"){
     const n=typeof r?.[1]==="number"?r[1]:Number(String(r?.[1]??"").replace("%","").replace(",","."));
     summary.churn=String(r?.[1]||"").includes("%")?n/100:n;
    }
    if(x==="crescimento")summary.growth=String(r?.[1]||"").slice(0,150);
   }
  }
  if(!codes.size)throw Error("Aba sem registros de unidades: "+sheet.sheet);
  if(!Number.isInteger(summary.entries)||!Number.isInteger(summary.exits)||
      !Number.isFinite(summary.churn)||summary.churn<0||summary.churn>1)
    throw Error("Rodapé da competência "+sheet.sheet+" incompleto (entradas, saídas ou churn).");
  if(summary.entries!==sumEntries||summary.exits!==sumExits){
   warnings.push({month:period.slice(0,7),
     message:"Rodapé: "+summary.entries+" entradas e "+summary.exits+
       " saídas; soma das linhas: "+sumEntries+" entradas e "+sumExits+" saídas. Diferença preservada."});
  }
  totals.push({period,total_entries_reported:summary.entries,
   total_exits_reported:summary.exits,churn_reported:summary.churn,
   growth_reported:summary.growth||"",sourceRows:codes.size,activeBase:sumBase});
 }
 if(rows.length>2500)throw Error("Limite de 2.500 registros no arquivo. Importe em lotes menores.");
 return {rows,totals,warnings};
}
function same(a,b){
 return rawFields.every(key=>Number(a[key])===Number(b[key]));
}
async function readReport(file){
 if(!file||typeof file.arrayBuffer!=="function")throw Error("Selecione um arquivo Excel XLSX.");
 if(!/\.xlsx$/i.test(file.name||"")||file.size>5*1024*1024||file.size<1)
  throw Error("Envie um arquivo XLSX de até 5 MB.");
 const bytes=Buffer.from(await file.arrayBuffer());
 if(bytes[0]!==0x50||bytes[1]!==0x4b)throw Error("Arquivo XLSX inválido.");
 const hash=createHash("sha256").update(bytes).digest("hex");
 let sheets;try{sheets=await readExcelFile(bytes);}catch{throw Error("Não foi possível ler as abas do Excel.");}
 return {hash,name:String(file.name).slice(0,240),...parseReport(sheets)};
}

export async function POST(request){
 try{
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return err("Origem não autorizada.",403);
  if(Number(request.headers.get("content-length")||0)>6*1024*1024)return err("Arquivo excede o limite.",413);
  const access=await getAccess();
  if(!access.signedIn)return err("Faça login.",401);
  if(!access.allowed||!["developer","admin","gestor"].includes(access.role))
   return err("Somente a gestão pode importar relatórios da rede.",403);
  let form;try{form=await request.formData();}catch{return err("Não foi possível receber o Excel.",400);}
  const action=String(form.get("action")||"");
  if(action!=="preview"&&action!=="commit")return err("Operação inválida.");
  const data=await readReport(form.get("file"));
  const sql=database();
  const periods=data.totals.map(x=>x.period);
  const existing=await sql.query(
   "SELECT period,source_code,active_start,new_members,renewals,returns,suspension_returns,total_entries,cancelled,expired,dropouts,suspended,total_exits,active_end,revision FROM cc_churn_report_rows WHERE period=ANY($1::date[])",
   [periods]
  );
  const totalsExisting=await sql.query(
   "SELECT period,total_entries_reported,total_exits_reported,churn_reported,growth_reported,revision FROM cc_churn_report_totals WHERE period=ANY($1::date[])",
   [periods]
  );
  const key=(period,code)=>period+"|"+code;
  const existingMap=new Map(existing.map(x=>[key(new Date(x.period).toISOString().slice(0,10),x.source_code),x]));
  const sumMap=new Map(totalsExisting.map(x=>[new Date(x.period).toISOString().slice(0,10),x]));
  const matches=await sql.query("SELECT source_code,source_label,unit_id,match_status FROM cc_churn_report_units");
  const matchMap=new Map(matches.map(x=>[x.source_code,x]));
  let created=0,changed=0,unchanged=0,summaryChanges=0,summaryNew=0,summaryUnchanged=0;
  const sourceRows=data.rows.map(r=>{
   const current=existingMap.get(key(r.period,r.source_code));
   if(!current)created++;
   else if(same(current,r))unchanged++;
   else changed++;
   return {...r,expectedRevision:Number(current?.revision||0)};
  });
  const sourceSummaries=data.totals.map(t=>{
   const current=sumMap.get(t.period);
   if(!current)summaryNew++;
   else if(Number(current.total_entries_reported)===t.total_entries_reported&&
    Number(current.total_exits_reported)===t.total_exits_reported&&
    Number(current.churn_reported)===t.churn_reported&&
    String(current.growth_reported||"")===String(t.growth_reported||""))summaryUnchanged++;
   else summaryChanges++;
   return {...t,expectedRevision:Number(current?.revision||0)};
  });
  const unmapped=[...new Map(sourceRows.filter(r=>!matchMap.get(r.source_code)?.unit_id)
   .map(r=>[r.source_code,{code:r.source_code,name:r.sourceLabel}])).values()];
  const response={
   sha:data.hash,filename:data.name,months:data.totals.length,
   sourceRows:data.rows.length,newRows:created,changedRows:changed,unchangedRows:unchanged,
   summaryChanges,summaryNew,summaryUnchanged,unmapped,
   warnings:data.warnings,
   monthSamples:sourceSummaries.map(s=>({
    month:s.period.slice(0,7),activeBase:s.activeBase,
    totalEntries:s.total_entries_reported,totalExits:s.total_exits_reported,
    churn:Math.round(s.total_exits_reported/s.activeBase*10000)/100,
    units:s.sourceRows
   })),
   versions:sourceRows.map(r=>[r.period,r.source_code,r.expectedRevision]),
   summaryVersions:sourceSummaries.map(s=>[s.period,s.expectedRevision])
  };
  if(action==="preview")return Response.json(response,{headers});
  if(form.get("sha")!==data.hash)return err("O arquivo mudou após a prévia. Confira novamente.",409);
  const overwrite=form.get("overwrite")==="true";
  if((changed>0||summaryChanges>0)&&!overwrite)
   return err("Há resultados divergentes. Marque substituição somente após conferir os dados.",409);
  let versions,summaryVersions;
  try{versions=JSON.parse(String(form.get("versions")||""));summaryVersions=JSON.parse(String(form.get("summaryVersions")||""));}
  catch{return err("É necessário conferir novamente a planilha.",409);}
  const versionMap=new Map((Array.isArray(versions)?versions:[]).map(x=>[key(x[0],x[1]),x[2]]));
  const summaryVersionMap=new Map((Array.isArray(summaryVersions)?summaryVersions:[]).map(x=>[x[0],x[1]]));
  if(versionMap.size!==sourceRows.length||summaryVersionMap.size!==sourceSummaries.length)
   return err("Prévia desatualizada. Faça nova conferência.",409);
  for(const row of sourceRows){
   const previous=versionMap.get(key(row.period,row.source_code));
   if(previous!==row.expectedRevision)return err("A planilha sofreu alteração. Refaça a prévia.",409);
  }
  for(const item of sourceSummaries)
   if(summaryVersionMap.get(item.period)!==item.expectedRevision)return err("Competência alterada. Refaça a prévia.",409);
  const write=await sql.query(
   "SELECT cc_churn_import_report($1,$2,$3,$4::jsonb,$5::jsonb,$6)::jsonb AS result",
   [data.hash,data.name,access.email,
    JSON.stringify(sourceRows),JSON.stringify(sourceSummaries),overwrite]
  );
  return Response.json({ok:true,...write[0].result},{headers});
 }catch(error){
  if(error?.code==="40001")return err("Conflito de edição detectado. Nenhum dado foi alterado; atualize a prévia.",409);
  if(error?.code==="23514"||error?.code==="22023"||error?.code==="23502")return err("Dados inconsistentes no arquivo. Confira o relatório.",422);
  if(error?.message&&(
     /planilha|arquivo|aba|colunas|competência|rodapé|movimentação|código|número|limite/i.test(error.message)))
   return err(error.message,422);
  return err("Não foi possível concluir a importação. Nenhum registro parcial foi salvo.",503);
 }
}
