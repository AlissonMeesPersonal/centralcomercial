"use client";
import {useRef,useState} from "react";
import {AlertTriangle,CheckCircle2,CloudUpload,FileSpreadsheet,RefreshCcw,ShieldCheck,Upload,ChevronDown} from "lucide-react";
const n=v=>new Intl.NumberFormat("pt-BR").format(Number(v)||0);
const p=v=>Number.isFinite(v)?new Intl.NumberFormat("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:2}).format(v)+"%":"—";
export default function NetworkChurnImport({onSuccess}){
 const input=useRef(null);
 const [file,setFile]=useState(null),[preview,setPreview]=useState(null),[allowReplace,setAllowReplace]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 function select(next){
  setFile(next||null);setPreview(null);setAllowReplace(false);setError("");setSuccess("");
 }
 async function send(action){
  if(!file||busy)return;
  if(file.size>5*1024*1024){setError("O arquivo deve ter até 5 MB.");return;}
  if(action==="commit"&&(!preview||((preview.changedRows||preview.summaryChanges)&&!allowReplace)))return;
  setBusy(true);setError("");setSuccess("");
  try{
   const data=new FormData();
   data.append("file",file);data.append("action",action);
   if(action==="commit"){
    data.append("sha",preview.sha);
    data.append("versions",JSON.stringify(preview.versions));
    data.append("summaryVersions",JSON.stringify(preview.summaryVersions));
    data.append("overwrite",String(allowReplace));
   }
   const response=await fetch("/api/churn/report-import",{method:"POST",credentials:"same-origin",body:data});
   let body;try{body=await response.json();}catch{throw Error("Resposta inválida da importação.");}
   if(!response.ok)throw Error(body.error||"Não foi possível processar o relatório.");
   if(action==="preview"){setPreview(body);return;}
   const latest=preview.monthSamples.map(x=>x.month).sort().at(-1);
   setSuccess("Importação concluída: "+n(body.new)+" novos registros, "+n(body.updated)+" atualizados e "+n(body.unchanged)+" preservados.");
   setFile(null);setPreview(null);setAllowReplace(false);
   if(input.current)input.current.value="";
   onSuccess?.(latest?Number(latest.slice(0,4)):null);
  }catch(e){setError(e.message||"Falha ao importar.");}
  finally{setBusy(false);}
 }
 return <section className="panel churn-network-import">
  <div className="section-title">
   <div><h3>Relatório mensal 26fit · Excel oficial</h3><p>Importe as abas de cada mês, mantendo cancelados, vencidos, desistências, suspensões e totais.</p></div>
   <FileSpreadsheet size={20} color="#77838e"/>
  </div>
  <div className="churn-network-information"><ShieldCheck size={18}/><span>Importação compartilhada no Neon: os dados são validados, duplicidades idênticas são preservadas e alterações exigem confirmação. Unidades não identificadas mantêm o código original para conciliação posterior.</span></div>
  <label className={"churn-network-drop "+(file?"has-file":"")}>
   <CloudUpload size={27}/>
   <strong>{file?file.name:"Selecionar relatório exportado do sistema"}</strong>
   <small>Arquivo Excel .xlsx com abas como "set 2026", "out 2026" · máximo 5 MB</small>
   <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e=>select(e.target.files?.[0])}/>
  </label>
  {error&&<div className="validation" role="alert"><AlertTriangle size={16}/>{error}</div>}
  {success&&<div className="churn-success" role="status"><CheckCircle2 size={16}/>{success}</div>}
  {preview&&<div className="churn-network-preview">
   <div className="churn-network-preview-title"><strong>Prévia para conferência</strong><span>{n(preview.sourceRows)} registros · {preview.months} competência(s)</span></div>
   <div className="churn-network-review">
    {[["Novos",preview.newRows],["Sem mudanças",preview.unchangedRows],["Alterados",preview.changedRows],["Unidades pendentes",preview.unmapped?.length||0]].map(([label,value])=>
     <div key={label}><small>{label}</small><strong>{n(value)}</strong></div>)}
   </div>
   <div className="churn-mini-table"><table><thead><tr><th>Competência</th><th>Unidades</th><th>Base inicial</th><th>Saídas</th><th>Churn</th><th>Entradas</th></tr></thead>
    <tbody>{preview.monthSamples.map(row=><tr key={row.month}><td>{row.month.slice(5)+"/"+row.month.slice(0,4)}</td><td>{row.units}</td><td>{n(row.activeBase)}</td><td>{n(row.totalExits)}</td><td>{p(row.churn)}</td><td>{n(row.totalEntries)}</td></tr>)}</tbody></table></div>
   {preview.warnings?.length>0&&<details className="churn-network-warnings"><summary><AlertTriangle size={15}/> {preview.warnings.length} aviso(s) de diferença nos rodapés <ChevronDown size={15}/></summary>
    {preview.warnings.map((w,i)=><p key={i}><strong>{w.month}</strong> — {w.message}</p>)}
   </details>}
   {preview.unmapped?.length>0&&<details className="churn-network-warnings"><summary><AlertTriangle size={15}/> {preview.unmapped.length} unidade(s) aguardam vínculo com o diretório <ChevronDown size={15}/></summary>
    {preview.unmapped.map(u=><p key={u.code}>{u.code} · {u.name}</p>)}
   </details>}
   {(preview.changedRows>0||preview.summaryChanges>0)&&<label className="churn-network-overwrite">
    <input type="checkbox" checked={allowReplace} onChange={e=>setAllowReplace(e.target.checked)}/>
    <span>Autorizo substituir {preview.changedRows} linha(s) e {preview.summaryChanges} total(is) mensais divergentes após conferir a prévia. O histórico anterior será preservado.</span>
   </label>}
  </div>}
  <div className="churn-import-footer">
   <button className="btn secondary" disabled={!file||busy} onClick={()=>send("preview")}><RefreshCcw size={16}/>{busy?"Conferindo…":"Conferir relatório"}</button>
   <button className="btn" disabled={!file||busy||!preview||((preview.changedRows>0||preview.summaryChanges>0)&&!allowReplace)} onClick={()=>send("commit")}><Upload size={16}/>{busy?"Gravando…":"Confirmar importação"}</button>
  </div>
 </section>;
}
