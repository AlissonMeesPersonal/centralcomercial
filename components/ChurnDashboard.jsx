"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import NetworkChurnImport from "./NetworkChurnImport";
import ChurnUnitMatching from "./ChurnUnitMatching";
import {aggregateMonths,totalize,periodApproxChurn,periodGrowth,simpleChurn,rangeKey} from "../lib/churn-period";
import {
 Activity,ArrowDownRight,ArrowUpRight,BarChart3,Building2,CalendarDays,CheckCircle2,
 ChevronDown,CloudUpload,Download,FileSpreadsheet,Filter,Info,RefreshCcw,
 Search,ShieldCheck,TrendingDown,TrendingUp,Upload,X,AlertCircle,Clock3
} from "lucide-react";

const fmtCount=n=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0}).format(Number(n)||0);
const fmtPct=n=>n===null||!Number.isFinite(n)?"Não informado":new Intl.NumberFormat("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:2}).format(n)+"%";
const fmtPctOne=n=>n===null||!Number.isFinite(n)?"Não informado":new Intl.NumberFormat("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1}).format(n)+"%";
const normal=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const periodNow=()=>new Date().toISOString().slice(0,7);
const months=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const dateLabel=s=>{const [y,m]=String(s||"").split("-");return m&&y?months[Number(m)-1]+"/"+y:"—";};
const dayLabel=s=>s?new Date(s).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—";
const rate=(sumBase,sumCancellations)=>sumBase>0?sumCancellations/sumBase*100:null;
const isVisibleUnit=u=>u&&!u.demo&&u.type!=="Matriz"&&u.status!=="Inativa";
const stateFull={RS:"Rio Grande do Sul",SC:"Santa Catarina",PR:"Paraná",SP:"São Paulo",MT:"Mato Grosso",PA:"Pará",PI:"Piauí",RJ:"Rio de Janeiro",MG:"Minas Gerais",GO:"Goiás",BA:"Bahia",DF:"Distrito Federal"};
function csvEscape(value){
 let s=String(value??"");
 if(/^[=+@\t\r]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
function saveCSV(name,table) {
 const text="\uFEFF"+table.map(row=>row.map(csvEscape).join(";")).join("\r\n");
 const url=URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8;"}));
 const link=document.createElement("a");link.href=url;link.download=name;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function KPICard({title,value,description,Icon,iconTone}){
 return <div className="churn-kpi"><div className="churn-kpi-top"><span>{title}</span><span className={"churn-icon "+(iconTone||"")}><Icon size={17}/></span></div>
  <strong>{value}</strong><small>{description}</small></div>;
}
function scoreBar(n){
 if(n===null||!Number.isFinite(n))return null;
 return Math.max(2,Math.min(100,n/12*100));
}
export default function ChurnDashboard({units=[],accessRole}){
 const canImport=["developer","admin","gestor"].includes(accessRole);
 const fileRef=useRef(null);
 const [year,setYear]=useState(new Date().getFullYear());
 const [month,setMonth]=useState("latest");
 const [mode,setMode]=useState("periodo");
 const [fromIndex,setFromIndex]=useState(1);
 const [toIndex,setToIndex]=useState("latest");
 const [state,setState]=useState("all"),[search,setSearch]=useState("");
 const [detailsId,setDetailsId]=useState(null);
 const [result,setResult]=useState({loading:true,rows:[],batches:[],sourceTotals:[],unmatched:[],sourceImports:[],error:""});
 const [showImporter,setShowImporter]=useState(false);
 const [file,setFile]=useState(null);
 const [filePeriod,setFilePeriod]=useState(periodNow());
 const [preview,setPreview]=useState(null);
 const [overwrite,setOverwrite]=useState(false);
 const [working,setWorking]=useState(false);
 const [importError,setImportError]=useState("");
 const [success,setSuccess]=useState("");

 async function reload(targetYear=year){
  setResult(old=>({...old,loading:true,error:""}));
  try{
   const response=await fetch("/api/churn?year="+encodeURIComponent(targetYear),{cache:"no-store",credentials:"same-origin"});
   const body=await response.json();
   if(!response.ok)throw Error(body.error||"Falha ao carregar indicadores.");
   setResult({loading:false,rows:Array.isArray(body.rows)?body.rows:[],batches:Array.isArray(body.batches)?body.batches:[],sourceTotals:body.sourceTotals||[],unmatched:body.unmatched||[],sourceImports:body.sourceImports||[],error:""});
  }catch(err){setResult({loading:false,rows:[],batches:[],sourceTotals:[],unmatched:[],sourceImports:[],error:err.message||"Falha ao carregar indicadores."});}
 }
 useEffect(()=>{reload(year);},[year]);

 const directory=useMemo(()=>{
  const map=new Map();
  for(const unit of units)if(isVisibleUnit(unit))map.set(unit.id,unit);
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
 },[units]);
 const unitMap=useMemo(()=>new Map(directory.map(u=>[u.id,u])),[directory]);
 const states=useMemo(()=>[...new Set(directory.map(x=>x.state).filter(Boolean))].sort(),[directory]);
 const latest=useMemo(()=>{
  const all=result.rows.map(x=>x.month).filter(Boolean).sort();
  return all.at(-1)||String(year)+"-"+String(new Date().getFullYear()===year?new Date().getMonth()+1:12).padStart(2,"0");
 },[result.rows,year]);
 const actualMonth=month==="latest"?latest:month;
 const endIndex=toIndex==="latest"?Number(latest.slice(-2)):Number(toIndex);
 const fromMonth=rangeKey(year,fromIndex-1);
 const toMonth=rangeKey(year,Math.max(1,Math.min(12,endIndex))-1);
 const isRange=mode==="periodo";
 const validRange=!isRange||fromIndex<=endIndex;
 const selectedMonths=useMemo(()=>{
  if(!isRange)return new Set([actualMonth]);
  if(!validRange)return new Set();
  return new Set(Array.from({length:endIndex-fromIndex+1},(_,i)=>rangeKey(year,fromIndex+i-1)));
 },[isRange,validRange,actualMonth,year,fromIndex,endIndex]);
 const visibleMonths=[...selectedMonths].sort();
 const selectedPeriodLabel=isRange?(visibleMonths.length
   ?dateLabel(visibleMonths[0])+" até "+dateLabel(visibleMonths.at(-1)):"Intervalo inválido"):dateLabel(actualMonth);
 const periodText=isRange?visibleMonths[0]+"_a_"+visibleMonths.at(-1):actualMonth;
 const eligible=useMemo(()=>directory.filter(u=>(state==="all"||u.state===state)&&normal([u.name,u.city,u.state,u.churnCode].join(" ")).includes(normal(search))),[directory,state,search]);
 const eligibleSet=useMemo(()=>new Set(eligible.map(u=>u.id)),[eligible]);
 const monthlyRows=useMemo(()=>result.rows.filter(row=>selectedMonths.has(row.month)&&eligibleSet.has(row.unit_id)),[result.rows,selectedMonths,eligibleSet]);
 const groupedRows=useMemo(()=>aggregateMonths(monthlyRows),[monthlyRows]);
 const totals=useMemo(()=>totalize(monthlyRows),[monthlyRows]);
 const coverage=groupedRows.length;
 const selectedSourceTotals=result.sourceTotals.filter(x=>selectedMonths.has(x.month));
 const networkOfficial=state==="all"&&!search.trim()&&selectedSourceTotals.length>0;
 const networkTotals=selectedSourceTotals.reduce((a,x)=>{
  a.active_start+=Number(x.active_start)||0;
  a.total_entries+=Number(x.total_entries_reported)||0;
  a.total_exits+=Number(x.total_exits_reported)||0;
  a.cancelled_count+=Number(x.cancelled)||0;
  a.expired+=Number(x.expired)||0;
  a.dropouts+=Number(x.dropouts)||0;
  a.suspended+=Number(x.suspended)||0;
  a.exits_detail+=Number(x.exits_detail)||0;
  a.source_rows+=Number(x.source_rows)||0;
  return a;
 },{active_start:0,total_entries:0,total_exits:0,cancelled_count:0,expired:0,dropouts:0,suspended:0,exits_detail:0,source_rows:0});
 const mergedTotals=networkOfficial?networkTotals:totals;
 const baseShown=mergedTotals.active_start;
 const exitsShown=mergedTotals.total_exits;
 const entriesShown=mergedTotals.total_entries;
 const cancelledShown=mergedTotals.cancelled_count;
 const monthsWithData=isRange?new Set(monthlyRows.map(x=>x.month)).size:1;
 const officialMonths=isRange?selectedSourceTotals.length:1;
 const countMonths=networkOfficial?officialMonths:monthsWithData;
 const summaryRate=periodApproxChurn(baseShown,entriesShown,exitsShown,countMonths);
 const simpleRate=simpleChurn(baseShown,exitsShown);
 const growthShown=entriesShown-exitsShown;
 const growthPercent=periodGrowth(baseShown,entriesShown,exitsShown);
 const reportPeriodWarning=isRange&&visibleMonths.length>1;
 const unmatchedMonth=useMemo(()=>{
  const matching=result.unmatched.filter(r=>selectedMonths.has(r.month));
  const grouped=new Map();
  for(const r of matching){
   const p=grouped.get(r.source_code)||{...r,monthCount:0,active_start:0,total_entries:0,total_exits:0,source_code:r.source_code,source_label:r.source_label};
   p.monthCount++;
   p.active_start+=Number(r.active_start)||0;
   p.total_entries+=Number(r.total_entries)||0;
   p.total_exits+=Number(r.total_exits)||0;
   grouped.set(r.source_code,p);
  }
  return [...grouped.values()].map(x=>({...x,churn:periodApproxChurn(x.active_start,x.total_entries,x.total_exits,x.monthCount)}));
 },[result.unmatched,selectedMonths]);
 const discrepancy=networkOfficial?networkTotals.total_exits-networkTotals.exits_detail:0;
 const rowById=useMemo(()=>new Map(groupedRows.map(row=>[row.unit_id,row])),[groupedRows]);
 const ranked=useMemo(()=>eligible.map(u=>{
  const row=rowById.get(u.id)||null;
  return {unit:u,row,rate:row?.churn??null};
 }).sort((a,b)=>{
  if(a.rate===null&&b.rate!==null)return 1;
  if(b.rate===null&&a.rate!==null)return -1;
  if(a.rate!==null&&b.rate!==null&&a.rate!==b.rate)return b.rate-a.rate;
  return a.unit.name.localeCompare(b.unit.name,"pt-BR");
 }),[eligible,rowById]);
 const stateMetrics=useMemo(()=>{
  const items=[];
  for(const uf of states){
   const stateUnits=directory.filter(u=>u.state===uf);
   const ids=new Set(stateUnits.map(u=>u.id));
   const records=result.rows.filter(r=>selectedMonths.has(r.month)&&ids.has(r.unit_id));
   const b=totalize(records);
   const n=new Set(records.map(r=>r.month)).size;
   items.push({state:uf,count:stateUnits.length,measured:new Set(records.map(r=>r.unit_id)).size,
    base:b.active_start,exits:b.total_exits,rate:periodApproxChurn(b.active_start,b.total_entries,b.total_exits,n)});
  }
  return items.sort((a,b)=>(b.rate??-1)-(a.rate??-1));
 },[directory,states,result.rows,selectedMonths]);
 const trends=useMemo(()=>{
  const rows=result.rows.filter(r=>eligibleSet.has(r.unit_id));
  return months.map((m,i)=>{
   const key=rangeKey(year,i);
   const record=rows.filter(r=>r.month===key);
   const totals=totalize(record);
   const full=state==="all"&&!search.trim()?result.sourceTotals.find(x=>x.month===key):null;
   const b=full?Number(full.active_start):totals.active_start;
   const c=full?Number(full.total_exits_reported):totals.total_exits;
   return {month:m,key,rate:simpleChurn(b,c),coverage:new Set(record.map(x=>x.unit_id)).size};
  });
 },[result.rows,result.sourceTotals,year,eligibleSet,state,search]);
 const maxTrend=Math.max(4,...trends.filter(x=>x.rate!==null).map(x=>x.rate));
 const unitDetail=detailsId?unitMap.get(detailsId):null;
 const unitHistory=useMemo(()=>result.rows.filter(x=>x.unit_id===detailsId&&selectedMonths.has(x.month)).sort((a,b)=>b.month.localeCompare(a.month)),[result.rows,detailsId,selectedMonths]);

 function downloadModel(){
  const table=[["id_unidade","unidade","competencia","ativos_inicio","cancelamentos","matriculas","reativacoes","ativos_fim"]];
  for(const u of directory)table.push([u.id,u.name,filePeriod,"","","","",""]);
  saveCSV("26fit_modelo_churn_"+filePeriod+".csv",table);
 }
 function downloadResults(){
  const table=[["codigo_churn","id_unidade","unidade","estado","periodo","ativos_inicio_acumulados","cancelados","vencidos","desistencias","suspensos","total_saidas","churn_comparativo_estimado","churn_simples","novos","renovados","retornos","retornos_suspensao","total_entradas","ativos_fim_ultimo_mes","fonte"]];
  for(const x of ranked)if(x.row)table.push([
   x.unit.churnCode??"",x.unit.id,x.unit.name,x.unit.state,selectedPeriodLabel,x.row.active_start,
   x.row.cancelled_count??"",x.row.expired??"",x.row.dropouts??"",x.row.suspended??"",x.row.total_exits??x.row.cancellations,
   x.rate===null?"":x.rate.toFixed(4),x.row.simpleChurn===null?"":x.row.simpleChurn.toFixed(4),x.row.enrollments??"",x.row.renewals??"",x.row.reactivations??"",x.row.suspension_returns??"",x.row.total_entries??"",x.row.active_end??"",x.row.source||"manual"
  ]);
  saveCSV("26fit_churn_"+periodText+".csv",table);
 }
 function selectFile(next){
  setFile(next||null);setPreview(null);setOverwrite(false);setImportError("");setSuccess("");
 }
 async function runImport(action){
  if(!file)return setImportError("Selecione uma planilha CSV ou XLSX.");
  if(action==="commit"&&(!preview?.valid))return;
  setWorking(true);setImportError("");setSuccess("");
  try{
   const form=new FormData();
   form.append("file",file);
   form.append("period",filePeriod);
   form.append("action",action);
   if(action==="commit"){
    form.append("sha",preview.sha);form.append("versions",JSON.stringify(preview.versions));
    form.append("overwrite",String(overwrite));
   }
   const response=await fetch("/api/churn/import",{method:"POST",credentials:"same-origin",body:form});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Falha ao importar.");
   if(action==="preview"){setPreview(data);}
   else{
    setSuccess("Importação concluída: "+data.inserted+" novos registros e "+data.updated+" atualizados.");
    setFile(null);setPreview(null);setOverwrite(false);
    if(fileRef.current)fileRef.current.value="";
    const importedMonths=(preview.sample||[]).map(item=>item.month).sort();
    const chosen=importedMonths.at(-1)||filePeriod;
    if(Number(chosen.slice(0,4))!==year)setYear(Number(chosen.slice(0,4)));
    setMonth(chosen);
    await reload(Number(chosen.slice(0,4)));
   }
  }catch(e){setImportError(e.message||"Não foi possível importar o arquivo.");}
  finally{setWorking(false);}
 }

 return <section className="churn-page">
  <div className="heading-row churn-heading">
   <div><div className="eyebrow">INTELIGÊNCIA COMERCIAL DA REDE</div><h1>Churn das unidades</h1>
    <p>Acompanhe entradas, saídas, evolução mensal e resultados acumulados por academia.</p></div>
   <div className="churn-heading-actions">
    <button className="btn secondary" onClick={()=>reload()} disabled={result.loading}><RefreshCcw size={16}/> Atualizar</button>
    {canImport&&<button className="btn" onClick={()=>setShowImporter(v=>!v)}><Upload size={16}/> {showImporter?"Fechar importação":"Importar planilha"}</button>}
   </div>
  </div>

  <div className="churn-formula"><Info size={18}/><span><strong>Churn mensal 26fit</strong> = total de saídas (cancelados + vencidos + desistências + suspensos) ÷ alunos ativos no início do mês × 100. No consolidado da rede usamos os totais oficiais do relatório e, nos filtros, a soma ponderada das unidades identificadas. Base inicial zero aparece como Não informado.</span></div>

  {canImport&&<ChurnUnitMatching units={units} onChanged={()=>reload(year)}/>}
  {canImport&&showImporter&&<NetworkChurnImport onSuccess={importedYear=>{if(importedYear&&importedYear!==year){setMonth("latest");setYear(importedYear);}else{setMonth("latest");reload(year);}}}/>}
  {canImport&&showImporter&&<section className="panel churn-import-panel">
   <div className="section-title"><div><h3>Lançamento avulso (formato simplificado)</h3><p>CSV ou XLSX por unidade, com cancelamentos isolados. Para reproduzir o relatório oficial da rede, utilize o importador acima.</p></div><FileSpreadsheet size={20} color="#77828b"/></div>
   <div className="churn-import-top">
    <button className="btn secondary" onClick={downloadModel}><Download size={15}/> Baixar modelo CSV das unidades</button>
    <label className="field churn-import-period"><span>Competência padrão</span><input type="month" value={filePeriod} onChange={e=>{setFilePeriod(e.target.value);setPreview(null);setImportError("");}}/></label>
   </div>
   <label className={"churn-upload "+(file?"selected":"")}>
    <CloudUpload size={29}/>
    <strong>{file?file.name:"Clique para selecionar sua planilha"}</strong>
    <small>{file?fmtCount(file.size/1024)+" KB · Arquivo selecionado":"CSV separado por ponto e vírgula ou Excel XLSX"}</small>
    <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e=>selectFile(e.target.files?.[0])}/>
   </label>
   <p className="churn-upload-help">Colunas obrigatórias: <strong>id_unidade ou unidade</strong>, <strong>ativos_inicio</strong> e <strong>cancelamentos</strong>. Competência, matrículas, reativações e ativos no fim são opcionais. No modelo, deixe vazias as unidades sem dados.</p>
   {importError&&<div className="validation"><AlertCircle size={17}/>{importError}</div>}
   {success&&<div className="churn-success"><CheckCircle2 size={17}/>{success}</div>}
   {preview&&<div className="churn-preview">
    <div className="churn-preview-head"><strong>Conferência antes de salvar</strong><span className={preview.valid?"tag success":"tag danger"}>{preview.valid?"Pronto para importar":"Corrigir planilha"}</span></div>
    <div className="churn-preview-stats">
     <div><small>Linhas válidas</small><strong>{preview.sample?.length?preview.total-preview.errorCount:0}</strong></div>
     <div><small>Novos registros</small><strong>{preview.newRecords}</strong></div>
     <div><small>Já cadastrados</small><strong>{preview.existing}</strong></div>
     <div><small>Erros</small><strong>{preview.errorCount}</strong></div>
    </div>
    {preview.errorCount>0&&<div className="churn-validation-list">{preview.errors.map((e,i)=><p key={i}><strong>Linha {e.line}</strong> · {e.unit||"Sem unidade"} — {e.reason}</p>)}{preview.errorCount>preview.errors.length&&<p>Exibidos os primeiros {preview.errors.length} erros.</p>}</div>}
    {preview.warnings?.length>0&&<details className="churn-validation-list churn-warnings"><summary>{preview.warningCount} aviso(s) de consistência para revisar</summary>{preview.warnings.map((e,i)=><p key={i}>Linha {e.line}: {e.reason}</p>)}</details>}
    {preview.sample?.length>0&&<div className="churn-mini-table"><table><thead><tr><th>Unidade</th><th>Mês</th><th>Ativos início</th><th>Total saídas</th><th>Churn</th><th>Situação</th></tr></thead><tbody>{preview.sample.map((r,i)=><tr key={i}><td>{r.unitName}</td><td>{dateLabel(r.month)}</td><td>{fmtCount(r.activeStart)}</td><td>{fmtCount(r.cancellations)}</td><td>{fmtPct(r.churn)}</td><td>{r.existing?"Atualização":"Novo"}</td></tr>)}</tbody></table></div>}
    {preview.existing>0&&<label className="churn-overwrite"><input type="checkbox" checked={overwrite} onChange={e=>setOverwrite(e.target.checked)}/><span>Confirmo que desejo <strong>substituir os registros existentes</strong> deste arquivo. As versões anteriores permanecerão no histórico.</span></label>}
   </div>}
   <div className="churn-import-footer">
    <button className="btn secondary" disabled={working||!file} onClick={()=>runImport("preview")}><Search size={16}/>{working?"Processando…":"Conferir planilha"}</button>
    <button className="btn" disabled={working||!preview?.valid||(preview.existing>0&&!overwrite)} onClick={()=>runImport("commit")}><CloudUpload size={16}/>{working?"Salvando…":"Confirmar importação"}</button>
   </div>
  </section>}

  {result.error&&<div className="validation"><AlertCircle size={18}/>{result.error}</div>}
  <div className="churn-period-selector">
   <div><strong>Período de análise</strong><span>Compare um mês específico ou consolide vários meses, como no relatório original.</span></div>
   <div className="churn-period-buttons">
    <button type="button" className={!isRange?"active":""} onClick={()=>setMode("mensal")}>Mês individual</button>
    <button type="button" className={isRange?"active":""} onClick={()=>setMode("periodo")}>Período acumulado</button>
   </div>
  </div>
  <div className="churn-filters">
   <label><CalendarDays size={16}/><select aria-label="Ano de referência" value={year}
    onChange={e=>{setYear(Number(e.target.value));setMonth("latest");setFromIndex(1);setToIndex("latest");}}>
    {Array.from({length:12},(_,i)=>new Date().getFullYear()+1-i).map(y=><option key={y} value={y}>{y}</option>)}
   </select></label>
   {isRange?<>
    <label className="churn-period-month"><span>De</span><select aria-label="Mês inicial do período" value={fromIndex}
     onChange={e=>setFromIndex(Number(e.target.value))}>
     {months.map((name,i)=><option key={i} value={i+1}>{name}/{year}</option>)}
    </select></label>
    <label className="churn-period-month"><span>Até</span><select aria-label="Mês final do período" value={toIndex}
     onChange={e=>setToIndex(e.target.value==="latest"?"latest":Number(e.target.value))}>
     <option value="latest">Último mês com dados</option>
     {months.map((name,i)=><option key={i} value={i+1}>{name}/{year}</option>)}
    </select></label>
   </>:<label><CalendarDays size={16}/><select aria-label="Mês de referência" value={actualMonth} onChange={e=>setMonth(e.target.value)}>
    {months.map((name,i)=><option key={i} value={rangeKey(year,i)}>{name}/{year}</option>)}
   </select></label>}
   <label><Filter size={16}/><select aria-label="Estado" value={state} onChange={e=>setState(e.target.value)}>
    <option value="all">Todos os estados</option>{states.map(uf=><option key={uf} value={uf}>{stateFull[uf]||uf} · {uf}</option>)}
   </select></label>
   <label className="churn-search"><Search size={16}/><input aria-label="Pesquisar unidade" placeholder="Pesquisar por nome, cidade ou código churn" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <button className="btn secondary" onClick={downloadResults} disabled={!monthlyRows.length}><Download size={16}/> Exportar CSV</button>
  </div>
  <div className="churn-selected-period">
   <CalendarDays size={15}/>
   <strong>{selectedPeriodLabel}</strong>
   <span>{isRange?"Acumulado das competências selecionadas":"Dados de uma única competência"}</span>
   <span className="churn-period-count">{coverage} / {eligible.length} unidade(s) com dados</span>
  </div>
  {!validRange&&<div className="validation"><AlertCircle size={16}/> O mês inicial não pode ser posterior ao mês final.</div>}

  <div className="churn-kpis">
   <KPICard title={reportPeriodWarning?"Churn acumulado estimado":"Churn mensal"} value={reportPeriodWarning?fmtPctOne(summaryRate):fmtPct(summaryRate)}
    description={reportPeriodWarning?"Estimativa para comparação · veja fórmula abaixo":"Saídas ÷ alunos iniciais"} Icon={TrendingDown} iconTone="churn-orange"/>
   <KPICard title="Total de entradas" value={fmtCount(entriesShown)} description={selectedPeriodLabel} Icon={ArrowUpRight} iconTone="churn-green"/>
   <KPICard title="Total de saídas" value={fmtCount(exitsShown)} description={"Cancelamentos isolados: "+fmtCount(cancelledShown)} Icon={ArrowDownRight} iconTone="churn-red"/>
   <KPICard title="Crescimento líquido" value={(growthShown>0?"+":"")+fmtCount(growthShown)}
    description={fmtPctOne(growthPercent)+" sobre a base acumulada"} Icon={growthShown>=0?TrendingUp:TrendingDown} iconTone={growthShown>=0?"churn-green":"churn-red"}/>
  </div>

  {reportPeriodWarning&&baseShown>0&&<div className="churn-period-methodology">
   <Info size={18}/>
   <div><strong>Churn acumulado: comparação estimada</strong>
    <p>O relatório de origem mostra o churn de intervalos como janeiro a outubro, mas não informa sua fórmula exata.
     Para aproximar esse resultado, usamos <b>saídas totais ÷ (soma das bases iniciais + metade das entradas) × 100</b>.
     Para a unidade Santa Cruz do Sul, o cálculo resulta em 11,9% (estimativa). A taxa simples, obtida por
     saídas ÷ soma das bases iniciais, é <b>{fmtPct(simpleRate)}</b>.
     Nenhum desses dois métodos foi confirmado como fórmula oficial do sistema de origem.</p>
    <div className="churn-methodology-values">Saídas: {fmtCount(exitsShown)} · Entradas: {fmtCount(entriesShown)} · Bases mensais somadas: {fmtCount(baseShown)} alunos-mês</div>
   </div>
  </div>}

  {networkOfficial&&<section className="panel churn-source-overview">
   <div className="section-title"><div><h3>Composição das movimentações da rede</h3>
    <p>{selectedPeriodLabel} · {networkTotals.source_rows} linhas de origem no período</p></div>
    <span className="tag">Fonte: Churn.xlsx</span></div>
   <div className="churn-breakdown">
    {[
     ["Cancelados",networkTotals.cancelled_count],
     ["Vencidos",networkTotals.expired],
     ["Desistências",networkTotals.dropouts],
     ["Suspensos",networkTotals.suspended],
     ["Entradas totais",networkTotals.total_entries],
     ["Saídas totais",networkTotals.total_exits]
    ].map(([label,value])=><div key={label}><small>{label}</small><strong>{fmtCount(value)}</strong></div>)}
   </div>
   <p className="churn-source-caption">Os totais oficiais da rede são lidos dos rodapés do relatório importado. No período, a base acumulada representa a soma de alunos ativos iniciais por mês — não alunos distintos. Selecione um mês para ver o churn mensal direto.</p>
   {discrepancy!==0&&<div className="churn-source-warning"><Info size={16}/>
    Diferença de {fmtCount(Math.abs(discrepancy))} saída(s) entre o total do rodapé ({fmtCount(networkTotals.total_exits)}) e a soma das linhas ({fmtCount(networkTotals.exits_detail)}).
    A diferença é preservada, sem atribuição artificial a unidades.</div>}
  </section>}
  {canImport&&unmatchedMonth.length>0&&<details className="churn-pending-matches">
    <summary><AlertCircle size={18}/> {unmatchedMonth.length} código(s) sem vínculo no período (inclui treinamento, quando presente) <ChevronDown size={17}/></summary>
    <div className="churn-pending-help">Os resultados foram preservados pelo código da planilha, mas ainda não foram atribuídos a uma unidade do diretório. Eles estão incluídos nos totais gerais oficiais, porém não nos filtros por estado.</div>
    <div className="churn-mini-table"><table><thead><tr><th>Código</th><th>Nome na planilha</th><th>Ativos início</th><th>Total saídas</th><th>Churn</th></tr></thead><tbody>
     {unmatchedMonth.map(r=><tr key={r.source_code}><td>{r.source_code}</td><td>{r.source_label}</td><td>{fmtCount(r.active_start)}</td><td>{fmtCount(r.total_exits)}</td><td>{isRange?fmtPctOne(r.churn):fmtPct(r.churn)}</td></tr>)}
    </tbody></table></div>
  </details>}

  <div className="churn-main-grid">
   <section className="panel churn-trend-panel">
    <div className="section-title"><div><h3>Evolução mensal do churn</h3><p>Taxa simples de cada mês · {year}</p></div><BarChart3 size={18} color="#8a969e"/></div>
    <div className="churn-bars" role="img" aria-label="Gráfico do churn nos doze meses do ano selecionado">
      {trends.map(item=><button key={item.month} type="button" className={"churn-bar-item "+(selectedMonths.has(item.key)?"active":"")} onClick={()=>{setMode("mensal");setMonth(item.key);}} title={item.month+": "+fmtPct(item.rate)}>
       <span className="churn-bar-value">{item.rate===null?"—":fmtPct(item.rate)}</span>
       <span className="churn-bar-track"><span style={{height:item.rate===null?"0%":Math.max(4,item.rate/maxTrend*100)+"%"}}/></span>
       <span className="churn-bar-month">{item.month}</span>
      </button>)}
    </div>
   </section>
   <section className="panel churn-state-panel">
    <div className="section-title"><div><h3>Comparação por estado</h3><p>Churn de {selectedPeriodLabel.toLowerCase()}</p></div><Building2 size={18} color="#87939c"/></div>
    <div className="churn-state-list">
     {stateMetrics.map(item=><button key={item.state} className={"churn-state-row "+(state===item.state?"active":"")} onClick={()=>setState(previous=>previous===item.state?"all":item.state)}>
      <span><strong>{stateFull[item.state]||item.state}</strong><small>{item.measured} / {item.count} unidades com dados</small></span><div className="churn-state-rate"><b>{fmtPct(item.rate)}</b><div className="progress-track"><span style={{width:(scoreBar(item.rate)||0)+"%"}}/></div></div>
     </button>)}
    </div>
   </section>
  </div>

  <section className="panel churn-ranking">
   <div className="section-title"><div><h3>Churn por unidade</h3><p>{selectedPeriodLabel} · ordenado pela maior taxa de saídas</p></div><span className="tag">{ranked.length} unidades</span></div>
   {result.loading?<div className="empty">Carregando indicadores do Neon…</div>:
   !ranked.length?<div className="empty">Nenhuma unidade corresponde à pesquisa.</div>:
   <div className="churn-table-wrap"><table><thead><tr><th>Unidade</th><th>Estado</th><th>{isRange?"Base acumulada (alunos-mês)":"Ativos início"}</th><th>Entradas</th><th>Total saídas</th><th>Churn</th><th>Dados</th><th></th></tr></thead>
    <tbody>{ranked.map(({unit,row,rate:churn})=><tr key={unit.id} className={detailsId===unit.id?"active":""} onClick={()=>setDetailsId(x=>x===unit.id?null:unit.id)}>
      <td><strong>{unit.name}</strong><small>{unit.churnCode==null?"Sem código de churn":"Código churn "+String(unit.churnCode).padStart(2,"0")} · {unit.city||"Cidade não informada"}</small></td>
      <td>{unit.state||"—"}</td>
      <td>{row?fmtCount(row.active_start):"—"}</td>
      <td>{row?fmtCount(row.total_entries):"—"}</td>
      <td>{row?fmtCount(row.total_exits):"—"}</td>
      <td><span className={"churn-cell "+(churn===null?"unknown":churn>5?"high":churn>3?"medium":"low")}>{isRange?fmtPctOne(churn):fmtPct(churn)}</span></td>
      <td>{row?<span className="tag success">Informado</span>:<span className="tag">Pendente</span>}</td>
      <td><ChevronDown className={detailsId===unit.id?"expanded":""} size={16}/></td>
     </tr>)}</tbody></table></div>}
  </section>

  {unitDetail&&<section className="panel churn-detail-panel">
   <div className="section-title"><div><div className="eyebrow">DETALHE POR UNIDADE</div><h3>{unitDetail.name}</h3><p>{unitDetail.churnCode==null?"Sem código de churn":"Código churn "+String(unitDetail.churnCode).padStart(2,"0")} · {unitDetail.city} · {unitDetail.state} · {selectedPeriodLabel}</p></div><button className="icon-button" onClick={()=>setDetailsId(null)}><X size={18}/></button></div>
   <div className="churn-mini-table"><table><thead><tr><th>Competência</th><th>Ativos início</th><th>Cancelados</th><th>Vencidos</th><th>Desistências</th><th>Suspensos</th><th>Total saídas</th><th>Churn</th><th>Novos</th><th>Renovados</th><th>Retornos</th><th>Retorno suspensões</th><th>Total entradas</th><th>Ativos fim</th></tr></thead>
    <tbody>{unitHistory.map(row=><tr key={row.month}><td>{dateLabel(row.month)}</td><td>{fmtCount(row.active_start)}</td><td>{row.cancelled_count==null?"—":fmtCount(row.cancelled_count)}</td><td>{row.expired==null?"—":fmtCount(row.expired)}</td><td>{row.dropouts==null?"—":fmtCount(row.dropouts)}</td><td>{row.suspended==null?"—":fmtCount(row.suspended)}</td><td>{fmtCount(row.total_exits??row.cancellations)}</td><td>{fmtPct(row.churn)}</td><td>{row.enrollments==null?"—":fmtCount(row.enrollments)}</td><td>{row.renewals==null?"—":fmtCount(row.renewals)}</td><td>{row.reactivations==null?"—":fmtCount(row.reactivations)}</td><td>{row.suspension_returns==null?"—":fmtCount(row.suspension_returns)}</td><td>{row.total_entries==null?"—":fmtCount(row.total_entries)}</td><td>{row.active_end==null?"—":fmtCount(row.active_end)}</td></tr>)}</tbody></table>
    {!unitHistory.length&&<div className="empty">Esta unidade ainda não possui dados no período selecionado.</div>}
   </div>
  </section>}
  {!result.loading&&!result.rows.length&&<div className="churn-empty">
   <FileSpreadsheet size={30}/><strong>Sem dados de churn para {year}</strong>
   <p>Baixe o modelo e importe os números mensais de cada unidade. Os dados ficam armazenados de forma compartilhada no Neon.</p>
   {canImport&&<button className="btn secondary" onClick={()=>setShowImporter(true)}><Upload size={16}/> Iniciar importação</button>}
  </div>}

  {canImport&&<section className="panel churn-history">
   <div className="section-title"><div><h3>Histórico de importações</h3><p>Autoria e alterações registradas no banco de dados.</p></div><Clock3 size={18} color="#8b969e"/></div>
   {(result.sourceImports||[]).map(record=><div className="churn-history-row" key={record.source_hash}>
    <span className="churn-history-file"><FileSpreadsheet size={17}/><span><strong>{record.file_name}</strong><small>{dayLabel(record.created_at)} · {record.imported_by}</small></span></span>
    <span><b>{fmtCount(record.source_rows)}</b> registros · {record.months} competência(s) · relatório da rede</span>
   </div>)}
   {result.batches.map(b=><div className="churn-history-row" key={b.id}>
    <span className="churn-history-file"><FileSpreadsheet size={17}/><span><strong>{b.filename}</strong><small>{dayLabel(b.created_at)} · {b.imported_by}</small></span></span>
    <span><b>{b.rows_total}</b> registros · {b.rows_inserted} novos · {b.rows_updated} atualizados</span>
   </div>)}
   {!result.batches.length&&!result.sourceImports.length&&<p className="team-secondary">Nenhuma importação realizada até agora.</p>}
  </section>}
  <p className="churn-footnote"><Info size={14}/> Faixas de cor (até 3%, de 3% a 5%, acima de 5%) são referências visuais, não metas oficiais da 26fit. Os componentes de entradas/saídas e as competências devem seguir o mesmo critério em todas as unidades. Em períodos acumulados, a taxa exibida é uma estimativa até confirmação da fórmula do sistema original.</p>
 </section>;
}

function UsersRoundIcon(props){return <Activity {...props}/>;}
