"use client";
import {useState} from "react";
import readXlsxFile from "read-excel-file";

function splitCSV(text){
 const rows=[],row=[];let field="",quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){
   if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;
  }else if(!quoted&&(c===";"||c===","||c==="\t")){
   // Apenas o separador predominante da primeira linha é usado.
   if(c===splitCSV.separator){row.push(field);field="";}else field+=c;
  }else if(!quoted&&(c==="\n"||c==="\r")){
   if(c==="\r"&&text[i+1]==="\n")i++;
   row.push(field);if(row.some(x=>String(x).trim()))rows.push([...row]);
   row.length=0;field="";
  }else field+=c;
 }
 row.push(field);if(row.some(x=>String(x).trim()))rows.push(row);
 return rows;
}
function parseCSV(text){
 const line=text.replace(/^\uFEFF/,"").split(/\r?\n/)[0]||"";
 const counts={";":(line.match(/;/g)||[]).length,",":(line.match(/,/g)||[]).length,"\t":(line.match(/\t/g)||[]).length};
 splitCSV.separator=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
 return splitCSV(text.replace(/^\uFEFF/,""));
}
const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
function numeric(value){
 if(typeof value==="number")return value;
 let s=String(value??"").trim().replace(/\s/g,"");
 if(!s)return NaN;
 if(s.includes(",")&&s.includes("."))s=s.lastIndexOf(",")>s.lastIndexOf(".")?s.replace(/\./g,"").replace(",","."):s.replace(/,/g,"");
 else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,"");
 else s=s.replace(",",".");
 return Number(s);
}
function dateParts(value,month){
 if(value instanceof Date&&!Number.isNaN(value.getTime()))return [value.getFullYear(),value.getMonth()+1,value.getDate()];
 if(typeof value==="number"&&value>30000&&value<100000){
  const d=new Date(Date.UTC(1899,11,30)+Math.trunc(value)*86400000);
  return [d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()];
 }
 const s=norm(value);
 const parsed=s.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
 if(parsed)return [parsed[3]?Number(parsed[3].length===2?"20"+parsed[3]:parsed[3]):Number(month.slice(0,4)),Number(parsed[2]),Number(parsed[1])];
 const iso=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
 if(iso)return [Number(iso[1]),Number(iso[2]),Number(iso[3])];
 const names=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
 const short=s.match(/^(\d{1,2})[\/-]([a-z]+)/);
 if(short){const i=names.findIndex(x=>short[2].startsWith(x));if(i>=0)return [Number(month.slice(0,4)),i+1,Number(short[1])];}
 if(/^\d{1,2}$/.test(s))return [Number(month.slice(0,4)),Number(month.slice(5)),Number(s)];
 return null;
}
function detect(headers,terms){
 return headers.findIndex(h=>terms.some(term=>norm(h).includes(term)));
}
export default function OpportunityImporter({token="",onImported}){
 const [file,setFile]=useState(null),[table,setTable]=useState([]),[header,setHeader]=useState([]);
 const [columns,setColumns]=useState({date:0,opportunities:1,sales:2});
 const [period,setPeriod]=useState(new Date().toISOString().slice(0,7));
 const [preview,setPreview]=useState([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [success,setSuccess]=useState("");
 async function loadFile(e){
  const f=e.target.files?.[0];setError("");setSuccess("");setPreview([]);setFile(null);
  if(!f)return;
  if(f.size>4*1024*1024){setError("Selecione um arquivo de até 4 MB.");return;}
  try{
   const ext=f.name.split(".").pop()?.toLowerCase();
   if(!["xlsx","csv"].includes(ext))throw Error("Use uma planilha .xlsx ou .csv.");
   const rows=ext==="xlsx"?await readXlsxFile(f):parseCSV(await f.text());
   if(rows.length<2||rows.length>50000)throw Error("A planilha precisa ter cabeçalho e até 50 mil linhas.");
   const headerRow=rows.findIndex(row=>{
    const h=row.map(norm);
    return h.some(x=>x.includes("oportunidade"))&&h.some(x=>x.includes("venda")||x.includes("realizad"));
   });
   const index=headerRow<0?0:headerRow;
   const names=rows[index].map((x,i)=>String(x??"Coluna "+(i+1)));
   const value=(terms,fallback)=>{const i=detect(names,terms);return i<0?fallback:i;};
   setHeader(names);setTable(rows.slice(index+1));setFile(f);
   setColumns({date:value(["data","dia"],0),opportunities:value(["oportunidade"],1),sales:value(["venda","realizad","convertid"],2)});
  }catch(err){setError(err.message||"Falha ao ler a planilha.");}
 }
 function prepare(){
  try{
   if(!file||!table.length)throw Error("Selecione a planilha.");
   if(new Set(Object.values(columns).map(Number)).size!==3)throw Error("Selecione três colunas diferentes.");
   const daily=new Map(),invalid=[];
   table.forEach((row,i)=>{
    if(row.every(v=>v===null||v===undefined||String(v).trim()===""))return;
    const date=dateParts(row[columns.date],period);
    if(!date){invalid.push(i+2);return;}
    const [year,month,day]=date;
    if(year!==Number(period.slice(0,4))||month!==Number(period.slice(5)))return;
    const opportunities=numeric(row[columns.opportunities]),sales=numeric(row[columns.sales]);
    if(!Number.isSafeInteger(opportunities)||!Number.isSafeInteger(sales)||opportunities<0||sales<0){
     invalid.push(i+2);return;
    }
    const old=daily.get(day)||{day,opportunities:0,sales:0};
    old.opportunities+=opportunities;old.sales+=sales;daily.set(day,old);
   });
   if(invalid.length)throw Error("Revise as linhas com dados inválidos: "+invalid.slice(0,10).join(", ")+".");
   const result=[...daily.values()].sort((a,b)=>a.day-b.day);
   if(!result.length)throw Error("Nenhum registro encontrado para o mês selecionado. Confira a coluna de data.");
   const days=new Date(Number(period.slice(0,4)),Number(period.slice(5)),0).getDate();
   if(result.some(r=>r.day<1||r.day>days||r.sales>r.opportunities))throw Error("Vendas superiores às oportunidades ou dias inválidos. Confira o mapeamento.");
   setPreview(result);setError("");setSuccess("");
  }catch(e){setError(e.message);setPreview([]);}
 }
 async function submit(){
  if(!preview.length||busy)return;
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/opportunity-reports",{method:"POST",cache:"no-store",credentials:"same-origin",
    headers:{"Content-Type":"application/json",...(token?{"x-upload-token":token}:{})},
    body:JSON.stringify({action:"upload",period,daily:preview,filename:file?.name||"planilha"})
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Não foi possível salvar.");
   setSuccess("Levantamento enviado! "+data.days+" dias, "+data.opportunities+" oportunidades e "+data.sales+" vendas. A Central foi atualizada.");
   onImported?.();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const total=preview.reduce((a,x)=>({opportunities:a.opportunities+x.opportunities,sales:a.sales+x.sales}),{opportunities:0,sales:0});
 return <div className="cc-op-import">
  <p>Envie o Excel ou CSV do levantamento. Selecione o mês, confira as colunas e revise os totais antes de publicar.</p>
  <label className="field"><span>Arquivo Excel (.xlsx) ou CSV</span><input type="file" accept=".xlsx,.csv" onChange={loadFile}/></label>
  {file&&<div className="cc-op-mapping">
   <label>Mês do relatório <input type="month" value={period} onChange={e=>{setPeriod(e.target.value);setPreview([]);}}/></label>
   {[[ "date","Data / dia"],["opportunities","Oportunidades"],["sales","Vendas realizadas"]].map(([key,label])=>
    <label key={key}>{label}<select value={columns[key]} onChange={e=>{setColumns(x=>({...x,[key]:Number(e.target.value)}));setPreview([]);}}>
      {header.map((name,i)=><option key={i} value={i}>{name||"Coluna "+(i+1)}</option>)}
    </select></label>)}
   <button type="button" className="btn secondary" onClick={prepare}>Conferir planilha</button>
  </div>}
  {!!preview.length&&<div className="cc-op-preview">
   <strong>Conferência: {preview.length} dias · {total.opportunities.toLocaleString("pt-BR")} oportunidades · {total.sales.toLocaleString("pt-BR")} vendas · {total.opportunities?(100*total.sales/total.opportunities).toFixed(1).replace(".",","):"0"}% de conversão</strong>
   <p>Para este mês, a importação substituirá somente o levantamento anterior do mesmo mês. Os demais meses e as demandas serão preservados.</p>
   <button type="button" className="btn" disabled={busy} onClick={submit}>{busy?"Enviando…":"Confirmar e atualizar Central"}</button>
  </div>}
  {error&&<p role="alert" className="validation">{error}</p>}
  {success&&<p role="status" className="notice">{success}</p>}
 </div>;
}
