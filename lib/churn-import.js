import {createHash} from "node:crypto";
import {database} from "./db";

const MAX_BYTES=5*1024*1024;
const MAX_ROWS=2000;
const simplify=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const removeBrand=value=>simplify(value).replace(/^26fit\s+/,"").replace(/^\d+\s+/,"").trim();

const HEADER_ALIASES={
 unit:["id unidade","id_unidade","codigo unidade","codigo da unidade","unidade","nome unidade","nome da unidade","academia","filial","unidade 26fit"],
 period:["competencia","mes","mes referencia","mes de referencia","referencia","periodo","data referencia"],
 activeStart:["ativos inicio","ativos no inicio","ativos no inicio do mes","alunos ativos inicio","alunos ativos no inicio","alunos ativos no inicio do mes","ativos iniciais","alunos inicio","base inicial","base ativa inicial","alunos ativos iniciais","ativos_inicio","base inicio","alunos ativos","ativos inicio mes"],
 cancellations:["cancelamentos","cancelados","alunos cancelados","total de cancelamentos","qtd cancelamentos","quantidade cancelamentos","cancelamentos mes","cancelamentos no mes","saidas por cancelamento"],
 enrollments:["matriculas","matriculas novas","novas matriculas","novos alunos","novas adesoes","entradas","captacao"],
 reactivations:["reativacoes","reativados","alunos reativados"],
 activeEnd:["ativos fim","ativos no fim","ativos final","ativos fim do mes","alunos ativos fim","alunos ativos no fim","base final","alunos finais","saldo final","alunos ativos finais"]
};
const headerLookup=new Map();
for(const [field,names] of Object.entries(HEADER_ALIASES))for(const name of names)headerLookup.set(simplify(name),field);

function csvToRows(text) {
 const source=text.replace(/^\uFEFF/,"");
 const first=source.split(/\r?\n/).find(line=>line.trim())||"";
 const counts=[[";",(first.match(/;/g)||[]).length],["\t",(first.match(/\t/g)||[]).length],[",",(first.match(/,/g)||[]).length]];
 counts.sort((a,b)=>b[1]-a[1]);
 const delimiter=counts[0][1]?counts[0][0]:";";
 const rows=[];let row=[],cell="",quoted=false;
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(c==='"'){
   if(quoted&&source[i+1]==='"'){cell+='"';i++;}
   else quoted=!quoted;
  }else if(!quoted&&c===delimiter){row.push(cell);cell="";}
  else if(!quoted&&(c==="\n"||c==="\r")){
   if(c==="\r"&&source[i+1]==="\n")i++;
   row.push(cell);cell="";
   if(row.some(v=>String(v).trim()))rows.push(row);
   row=[];
   if(rows.length>MAX_ROWS+12)throw Error("O arquivo excede 2.000 registros. Divida em lotes menores.");
  }else{cell+=c;}
 }
 if(quoted)throw Error("CSV inválido: aspas não fechadas.");
 row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row);
 return rows;
}
export async function readChurnFile(file){
 if(!file||typeof file.arrayBuffer!=="function")throw Error("Selecione um arquivo CSV ou XLSX.");
 if(file.size<1||file.size>MAX_BYTES)throw Error("O arquivo deve ter no máximo 5 MB.");
 const filename=String(file.name||"dados.csv").slice(0,240);
 if(!(/\.(csv|xlsx)$/i).test(filename))throw Error("Formato não suportado. Envie CSV ou XLSX.");
 const content=Buffer.from(await file.arrayBuffer());
 const sha=createHash("sha256").update(content).digest("hex");
 let rows;
 if(/\.xlsx$/i.test(filename)){
  if(content[0]!==0x50||content[1]!==0x4b)throw Error("Arquivo XLSX inválido.");
  try{
   const {readSheet}=await import("read-excel-file/node");
   rows=await readSheet(content);
  }catch{throw Error("Não foi possível ler o arquivo XLSX. Verifique se não está corrompido.");}
 }else{
  let text;try{text=new TextDecoder("utf-8",{fatal:true}).decode(content);}
  catch{text=new TextDecoder("windows-1252").decode(content);}
  rows=csvToRows(text);
 }
 if(!Array.isArray(rows)||!rows.length)throw Error("Planilha vazia.");
 if(rows.length>MAX_ROWS+12)throw Error("A planilha excede 2.000 registros por importação.");
 return {rows,filename,sha};
}
function parsePeriod(value,fallback){
 if(value===null||value===undefined||String(value).trim()==="")return fallback;
 if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString().slice(0,7);
 const text=String(value).trim();
 let match=text.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
 if(match){const m=Number(match[2]);return m>=1&&m<=12?match[1]+"-"+String(m).padStart(2,"0"):null;}
 match=text.match(/^(\d{1,2})[\/.](\d{4})$/);
 if(match){const m=Number(match[1]);return m>=1&&m<=12?match[2]+"-"+String(m).padStart(2,"0"):null;}
 return null;
}
function parseCount(value,required){
 if(value===null||value===undefined||String(value).trim()==="")return required?NaN:null;
 if(typeof value==="number")return Number.isSafeInteger(value)&&value>=0&&value<=1e9?value:NaN;
 let raw=String(value).trim().replace(/\s/g,"");
 if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw))raw=raw.replace(/\./g,"").replace(",",".");
 else if(/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(raw))raw=raw.replace(/,/g,"");
 else raw=raw.replace(",",".");
 const n=Number(raw);
 return Number.isSafeInteger(n)&&n>=0&&n<=1e9?n:NaN;
}
const uniqueMap=(map,key,value)=>{
 const existing=map.get(key)||[];
 existing.push(value);map.set(key,existing);
};
export async function knownUnits(){
 const sql=database();
 const rows=await sql.query(
  "SELECT s.id,COALESCE(o.payload->>'name',s.payload->>'name') AS name,COALESCE(o.payload->>'administrativeName',s.payload->>'administrativeName') AS administrative_name,COALESCE(o.payload->>'city',s.payload->>'city') AS city FROM cc_unit_seed s LEFT JOIN cc_unit_records o ON o.id=s.id WHERE COALESCE(o.payload->>'type',s.payload->>'type','Unidade')<>'Matriz' UNION ALL SELECT o.id,o.payload->>'name',o.payload->>'administrativeName',o.payload->>'city' FROM cc_unit_records o WHERE NOT EXISTS(SELECT 1 FROM cc_unit_seed s WHERE s.id=o.id) AND COALESCE(o.payload->>'type','Unidade')<>'Matriz'"
 );
 const ids=new Map(),names=new Map();
 for(const row of rows){
  ids.set(row.id,row);
  for(const candidate of [row.name,row.administrative_name]){
   const n=removeBrand(candidate);
   if(n)uniqueMap(names,n,row);
  }
 }
 return {ids,names};
}
function lookupUnit(raw,directory){
 const value=String(raw??"").trim();
 const direct=directory.ids.get(value);
 if(direct)return {unit:direct};
 const normalized=removeBrand(value);
 const candidates=directory.names.get(normalized)||[];
 const matches=[...new Map(candidates.map(x=>[x.id,x])).values()];
 if(matches.length===1)return {unit:matches[0]};
 if(matches.length>1)return {error:"Nome ambíguo. Informe o id_unidade."};
 return {error:"Unidade não encontrada no diretório. Utilize o id_unidade do modelo."};
}
function findHeader(rows){
 for(let index=0;index<Math.min(8,rows.length);index++){
  const header=rows[index].map(x=>headerLookup.get(simplify(x))||null);
  if(["unit","activeStart","cancellations"].every(key=>header.includes(key))){
   const locations={};
   header.forEach((key,i)=>{if(key&&!Object.hasOwn(locations,key))locations[key]=i;});
   return {rowIndex:index,locations};
  }
 }
 throw Error("Colunas obrigatórias não encontradas: unidade (ou id_unidade), ativos_inicio e cancelamentos.");
}
export async function parseChurnRows(spreadsheet,defaultMonth){
 const {rows}=spreadsheet;
 const header=findHeader(rows);
 const fallback=parsePeriod(defaultMonth,null);
 const hasMonth="period" in header.locations;
 if(!hasMonth&&!fallback)throw Error("Selecione a competência mensal da planilha.");
 const directory=await knownUnits();
 const valid=[],errors=[],warnings=[];
 const seen=new Set();
 let lineCount=0;
 for(let i=header.rowIndex+1;i<rows.length;i++){
  const row=rows[i];
  if(!row||row.every(v=>v===null||v===undefined||String(v).trim()===""))continue;
  const baseCell=row[header.locations.activeStart];
  const cancelCell=row[header.locations.cancellations];
  // O modelo CSV já traz todas as unidades, mas as que ainda não foram preenchidas não entram no lote.
  if([baseCell,cancelCell].every(v=>v===null||v===undefined||String(v).trim()===""))continue;
  lineCount++;
  if(lineCount>MAX_ROWS)throw Error("Máximo de 2.000 linhas por importação.");
  const get=key=>row[header.locations[key]]??null;
  const rawUnit=get("unit"),found=lookupUnit(rawUnit,directory);
  const month=parsePeriod(hasMonth?get("period"):null,fallback);
  const activeStart=parseCount(get("activeStart"),true);
  const cancellations=parseCount(get("cancellations"),true);
  const enrollments=parseCount(get("enrollments"),false);
  const reactivations=parseCount(get("reactivations"),false);
  const activeEnd=parseCount(get("activeEnd"),false);
  const reasons=[];
  if(found.error)reasons.push(found.error);
  if(!month)reasons.push("Competência inválida (use AAAA-MM ou MM/AAAA).");
  if(!Number.isFinite(activeStart))reasons.push("Ativos no início deve ser número inteiro não negativo.");
  if(!Number.isFinite(cancellations))reasons.push("Cancelamentos deve ser número inteiro não negativo.");
  for(const [label,value] of [["Matrículas",enrollments],["Reativações",reactivations],["Ativos no fim",activeEnd]])
   if(value!==null&&!Number.isFinite(value))reasons.push(label+" deve ser número inteiro não negativo.");
  if(found.unit&&month){
   const key=found.unit.id+"|"+month;
   if(seen.has(key))reasons.push("Esta unidade e competência aparecem mais de uma vez no arquivo.");
   seen.add(key);
  }
  if(reasons.length){
   errors.push({line:i+1,unit:String(rawUnit||"").slice(0,85),reason:reasons.join(" ")});
   continue;
  }
  if(activeStart===0)warnings.push({line:i+1,reason:"Base inicial zero: churn não calculável."});
  if(cancellations>activeStart)warnings.push({line:i+1,reason:"Cancelamentos acima da base inicial; confira a regra do relatório."});
  if(activeEnd!==null&&enrollments!==null&&reactivations!==null){
   const expected=activeStart+enrollments+reactivations-cancellations;
   if(expected!==activeEnd)warnings.push({line:i+1,reason:"Base final não fecha com as movimentações informadas."});
  }
  valid.push({
   unitId:found.unit.id,unitName:found.unit.name,
   period:month+"-01",month,activeStart,cancellations,enrollments,reactivations,activeEnd,
   churn:activeStart>0?100*cancellations/activeStart:null
  });
 }
 if(!lineCount)throw Error("Nenhuma linha de dados encontrada.");
 if(errors.length) return {rows:valid,errors,warnings,total:lineCount};
 const sql=database();
 const existing=await sql.query(
  "SELECT m.unit_id,to_char(m.period,'YYYY-MM') AS month,m.revision FROM cc_churn_monthly m JOIN jsonb_to_recordset($1::jsonb) AS input(\"unitId\" TEXT,\"period\" DATE) ON m.unit_id=input.\"unitId\" AND m.period=input.\"period\"",
  [JSON.stringify(valid.map(x=>({unitId:x.unitId,period:x.period})))]
 );
 const versions=new Map(existing.map(x=>[x.unit_id+"|"+x.month,Number(x.revision)]));
 const finalRows=valid.map(row=>({...row,expectedRevision:versions.get(row.unitId+"|"+row.month)||0}));
 return {rows:finalRows,errors:[],warnings,total:lineCount,existing:existing.length};
}
