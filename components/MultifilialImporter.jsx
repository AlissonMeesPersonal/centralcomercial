"use client";
import {useState} from "react";
import {readSheet} from "read-excel-file/browser";

const fields=["newSales","renewals","totalSales","cancellations","nonRenewals","totalLosses","growth","newRevenue","renewalRevenue","totalRevenue","cancelRevenue","nonRenewalRevenue","totalLossRevenue"];
const fmt=n=>Number(n||0).toLocaleString("pt-BR");
function parseNumber(v){
 if(typeof v==="number")return v;
 let t=String(v??"").replace(/R\$|\s/g,"");
 if(!t)return 0;
 if(t.includes(",")&&t.includes("."))t=t.lastIndexOf(",")>t.lastIndexOf(".")?t.replace(/\./g,"").replace(",","."):t.replace(/,/g,"");
 else if(t.includes(","))t=t.replace(",",".");
 return Number(t);
}
function normalize(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();}
function readMultifilial(data){
 if(data.length<4||normalize(data[0]?.[0])!=="unidade"||normalize(data[0]?.[1])!=="nome"||
 !normalize(data[0]?.[2]).includes("vendas")||!normalize(data[0]?.[5]).includes("evasao")||
 !normalize(data[0]?.[9]).includes("vendas"))throw Error("Este arquivo não segue o layout Vendas Multifiliais esperado. Exporte novamente a planilha original.");
 const parsed=[];let totalRow=null;
 for(let i=2;i<data.length;i++){
  const r=data[i]||[];
  if(normalize(r[1])==="total"){totalRow=r;continue;}
  if(!Number.isInteger(Number(r[0]))||!String(r[1]||"").trim())continue;
  const item={code:Number(r[0]),name:String(r[1]).trim()};
  fields.forEach((field,j)=>{
   const num=parseNumber(r[j+2]);
   if(!Number.isFinite(num))throw Error("Valor inválido na linha "+(i+1)+" ("+field+").");
   item[field]=num;
  });
  parsed.push(item);
 }
 if(!parsed.length)throw Error("Nenhuma filial com vendas foi encontrada.");
 if(new Set(parsed.map(x=>x.code)).size!==parsed.length)throw Error("Existem códigos de unidade repetidos.");
 const totals={};fields.forEach(f=>totals[f]=parsed.reduce((n,r)=>n+r[f],0));
 if(totalRow){
  for(let j=0;j<7;j++){
   const expected=parseNumber(totalRow[j+2]);
   if(Math.abs(expected-totals[fields[j]])>0.01)
    throw Error("O total geral não corresponde às filiais na coluna "+fields[j]+". Verifique o arquivo exportado.");
  }
 }
 return {rows:parsed,totals};
}
export default function MultifilialImporter({token="",onImported}){
 const [period,setPeriod]=useState(new Date().toLocaleDateString("en-CA").slice(0,7));
 const [file,setFile]=useState(null),[parsed,setParsed]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 async function choose(e){
  const f=e.target.files?.[0];setParsed(null);setError("");setSuccess("");setFile(null);
  if(!f)return;
  if(!/\.xlsx$/i.test(f.name)){setError("Selecione o arquivo original Vendas Multifiliais em formato .xlsx.");return;}
  if(f.size>4e6){setError("O Excel deve ter até 4 MB.");return;}
  try{
   const data=await readSheet(f);
   const result=readMultifilial(data);
   setParsed(result);setFile(f);
  }catch(err){setError(err.message||"Não foi possível analisar a planilha.");}
 }
 async function send(){
  if(!parsed||busy)return;
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)){setError("Selecione o mês de referência.");return;}
  setBusy(true);setError("");setSuccess("");
  try{
   const response=await fetch("/api/opportunity-reports",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json",...(token?{"x-upload-token":token}:{})},body:JSON.stringify({action:"upload_multifilial",period,rows:parsed.rows,filename:file.name})});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||"Não foi possível gravar o levantamento.");
   setSuccess(result.units+" unidades importadas! O consolidado mensal de Vendas Multifiliais foi atualizado no Neon. Para calcular a conversão diária, também são necessários dados de oportunidades por dia.");
   onImported?.();
  }catch(err){setError(err.message||"Erro ao salvar.");}finally{setBusy(false);}
 }
 return <div className="cc-op-import">
  <p>Importe diretamente o arquivo exportado <strong>Vendas Multifiliais.xlsx</strong>. As 15 colunas são reconhecidas automaticamente, incluindo os cabeçalhos em duas linhas. Não é necessário preencher os resultados um a um.</p>
  <label className="field"><span>Mês de referência do levantamento</span><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label>
  <label className="field"><span>Planilha original (.xlsx)</span><input type="file" accept=".xlsx" onChange={choose}/></label>
  {parsed&&<div className="cc-op-preview">
   <strong>Conferência antes de salvar</strong>
   <p>{parsed.rows.length} unidades · {fmt(parsed.totals.newSales)} novas · {fmt(parsed.totals.renewals)} renovações · {fmt(parsed.totals.totalSales)} vendas · {fmt(parsed.totals.totalLosses)} evasões · {fmt(parsed.totals.growth)} crescimento líquido.</p>
   <p>Esta importação atualiza apenas o levantamento multifiliais do mês escolhido. Os relatórios diários, demandas e demais meses continuam preservados.</p>
   <button type="button" className="btn" disabled={busy} onClick={send}>{busy?"Importando…":"Confirmar importação do consolidado mensal"}</button>
  </div>}
  {error&&<p role="alert" className="validation">{error}</p>}
  {success&&<p role="status" className="notice">{success}</p>}
 </div>;
}
