"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {
 Activity,ArrowDownRight,ArrowUpRight,BarChart3,Building2,CalendarDays,CheckCircle2,
 ChevronDown,CloudUpload,Download,FileSpreadsheet,Filter,Info,RefreshCcw,
 Search,ShieldCheck,TrendingDown,TrendingUp,Upload,X,AlertCircle,Clock3
} from "lucide-react";

const fmtCount=n=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0}).format(Number(n)||0);
const fmtPct=n=>n===null||!Number.isFinite(n)?"Não informado":new Intl.NumberFormat("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:2}).format(n)+"%";
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
 const [state,setState]=useState("all"),[search,setSearch]=useState("");
 const [detailsId,setDetailsId]=useState(null);
 const [result,setResult]=useState({loading:true,rows:[],batches:[],error:""});
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
   setResult({loading:false,rows:Array.isArray(body.rows)?body.rows:[],batches:Array.isArray(body.batches)?body.batches:[],error:""});
  }catch(err){setResult({loading:false,rows:[],batches:[],error:err.message||"Falha ao carregar indicadores."});}
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
 const eligible=useMemo(()=>directory.filter(u=>(state==="all"||u.state===state)&&normal([u.name,u.city,u.state].join(" ")).includes(normal(search))),[directory,state,search]);
 const eligibleSet=useMemo(()=>new Set(eligible.map(u=>u.id)),[eligible]);
 const monthlyRows=useMemo(()=>result.rows.filter(row=>row.month===actualMonth&&eligibleSet.has(row.unit_id)),[result.rows,actualMonth,eligibleSet]);
 const valid=monthlyRows.filter(row=>Number(row.active_start)>0);
 const bases=valid.reduce((a,r)=>a+Number(r.active_start),0);
 const cancelled=valid.reduce((a,r)=>a+Number(r.cancellations),0);
 const allCancel=monthlyRows.reduce((a,r)=>a+Number(r.cancellations),0);
 const totalNew=monthlyRows.reduce((a,r)=>a+Number(r.enrollments||0),0);
 const totalReact=monthlyRows.reduce((a,r)=>a+Number(r.reactivations||0),0);
 const coverage=monthlyRows.length;
 const summaryRate=rate(bases,cancelled);
 const rowById=useMemo(()=>new Map(monthlyRows.map(row=>[row.unit_id,row])),[monthlyRows]);
 const ranked=useMemo(()=>{
  return eligible.map(u=>({unit:u,row:rowById.get(u.id)||null,rate:rowById.get(u.id)?.churn??null}))
   .sort((a,b)=>{
    if(a.rate===null&&b.rate!==null)return 1;
    if(b.rate===null&&a.rate!==null)return -1;
    if(a.rate!==null&&b.rate!==null&&a.rate!==b.rate)return b.rate-a.rate;
    return a.unit.name.localeCompare(b.unit.name,"pt-BR");
   });
 },[eligible,rowById]);
 const stateMetrics=useMemo(()=>{
  const items=[];
  for(const uf of states){
   const stateUnits=directory.filter(u=>u.state===uf);
   const ids=new Set(stateUnits.map(u=>u.id));
   const records=result.rows.filter(r=>r.month===actualMonth&&ids.has(r.unit_id));
   const validRows=records.filter(r=>Number(r.active_start)>0);
   const b=validRows.reduce((v,r)=>v+Number(r.active_start),0),c=validRows.reduce((v,r)=>v+Number(r.cancellations),0);
   items.push({state:uf,count:stateUnits.length,measured:records.length,base:b,cancelled:c,rate:rate(b,c)});
  }
  return items.sort((a,b)=>(b.rate??-1)-(a.rate??-1));
 },[directory,states,result.rows,actualMonth]);
 const trends=useMemo(()=>{
  const rows=result.rows.filter(r=>eligibleSet.has(r.unit_id));
  return months.map((m,i)=>{
   const key=String(year)+"-"+String(i+1).padStart(2,"0");
   const record=rows.filter(r=>r.month===key);
   const v=record.filter(r=>Number(r.active_start)>0);
   const b=v.reduce((n,r)=>n+Number(r.active_start),0);
   const c=v.reduce((n,r)=>n+Number(r.cancellations),0);
   return {month:m,key,rate:rate(b,c),coverage:record.length};
  });
 },[result.rows,year,eligibleSet]);
 const maxTrend=Math.max(4,...trends.filter(x=>x.rate!==null).map(x=>x.rate));
 const unitDetail=detailsId?unitMap.get(detailsId):null;
 const unitHistory=useMemo(()=>result.rows.filter(x=>x.unit_id===detailsId).sort((a,b)=>b.month.localeCompare(a.month)),[result.rows,detailsId]);

 function downloadModel(){
  const table=[["id_unidade","unidade","competencia","ativos_inicio","cancelamentos","matriculas","reativacoes","ativos_fim"]];
  for(const u of directory)table.push([u.id,u.name,filePeriod,"","","","",""]);
  saveCSV("26fit_modelo_churn_"+filePeriod+".csv",table);
 }
 function downloadResults(){
  const table=[["id_unidade","unidade","estado","competencia","ativos_inicio","cancelamentos","churn_percentual","matriculas","reativacoes","ativos_fim"]];
  for(const x of ranked)if(x.row)table.push([
   x.unit.id,x.unit.name,x.unit.state,x.row.month,x.row.active_start,x.row.cancellations,
   x.rate===null?"":x.rate.toFixed(4),x.row.enrollments??"",x.row.reactivations??"",x.row.active_end??""
  ]);
  saveCSV("26fit_churn_"+actualMonth+".csv",table);
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
    const receivedMonth=data?.latestMonth;
    await reload(year);
   }
  }catch(e){setImportError(e.message||"Não foi possível importar o arquivo.");}
  finally{setWorking(false);}
 }

 return <section className="churn-page">
  <div className="heading-row churn-heading">
   <div><div className="eyebrow">INTELIGÊNCIA COMERCIAL DA REDE</div><h1>Churn das unidades</h1>
    <p>Acompanhe cancelamentos, retenção e evolução mensal de cada academia.</p></div>
   <div className="churn-heading-actions">
    <button className="btn secondary" onClick={()=>reload()} disabled={result.loading}><RefreshCcw size={16}/> Atualizar</button>
    {canImport&&<button className="btn" onClick={()=>setShowImporter(v=>!v)}><Upload size={16}/> {showImporter?"Fechar importação":"Importar planilha"}</button>}
   </div>
  </div>

  <div className="churn-formula"><Info size={18}/><span><strong>Churn mensal</strong> = cancelamentos ÷ alunos ativos no início do mês × 100. Os totais da rede são ponderados pelo tamanho da base; unidades sem base válida não entram na taxa consolidada.</span></div>

  {canImport&&showImporter&&<section className="panel churn-import-panel">
   <div className="section-title"><div><h3>Importar dados por unidade</h3><p>Arquivo CSV ou Excel (.xlsx), até 5 MB e 2.000 registros por lote.</p></div><FileSpreadsheet size={20} color="#77828b"/></div>
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
    {preview.sample?.length>0&&<div className="churn-mini-table"><table><thead><tr><th>Unidade</th><th>Mês</th><th>Ativos início</th><th>Cancelamentos</th><th>Churn</th><th>Situação</th></tr></thead><tbody>{preview.sample.map((r,i)=><tr key={i}><td>{r.unitName}</td><td>{dateLabel(r.month)}</td><td>{fmtCount(r.activeStart)}</td><td>{fmtCount(r.cancellations)}</td><td>{fmtPct(r.churn)}</td><td>{r.existing?"Atualização":"Novo"}</td></tr>)}</tbody></table></div>}
    {preview.existing>0&&<label className="churn-overwrite"><input type="checkbox" checked={overwrite} onChange={e=>setOverwrite(e.target.checked)}/><span>Confirmo que desejo <strong>substituir os registros existentes</strong> deste arquivo. As versões anteriores permanecerão no histórico.</span></label>}
   </div>}
   <div className="churn-import-footer">
    <button className="btn secondary" disabled={working||!file} onClick={()=>runImport("preview")}><Search size={16}/>{working?"Processando…":"Conferir planilha"}</button>
    <button className="btn" disabled={working||!preview?.valid||(preview.existing>0&&!overwrite)} onClick={()=>runImport("commit")}><CloudUpload size={16}/>{working?"Salvando…":"Confirmar importação"}</button>
   </div>
  </section>}

  {result.error&&<div className="validation"><AlertCircle size={18}/>{result.error}</div>}
  <div className="churn-filters">
   <label><CalendarDays size={16}/><select aria-label="Ano de referência" value={year} onChange={e=>{setYear(Number(e.target.value));setMonth("latest");}}>{Array.from({length:12},(_,i)=>new Date().getFullYear()+1-i).map(y=><option key={y} value={y}>{y}</option>)}</select></label>
   <label><CalendarDays size={16}/><select aria-label="Mês de referência" value={actualMonth} onChange={e=>setMonth(e.target.value)}>{months.map((m,i)=><option key={i} value={year+"-"+String(i+1).padStart(2,"0")}>{m+"/"+year}</option>)}</select></label>
   <label><Filter size={16}/><select aria-label="Estado" value={state} onChange={e=>setState(e.target.value)}><option value="all">Todos os estados</option>{states.map(uf=><option key={uf} value={uf}>{stateFull[uf]||uf} · {uf}</option>)}</select></label>
   <label className="churn-search"><Search size={16}/><input aria-label="Pesquisar unidade" placeholder="Pesquisar unidade ou cidade" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <button className="btn secondary" onClick={downloadResults} disabled={!monthlyRows.length}><Download size={16}/> Exportar CSV</button>
  </div>

  <div className="churn-kpis">
   <KPICard title="Churn consolidado" value={fmtPct(summaryRate)} description={"Base válida: "+fmtCount(bases)+" alunos"} Icon={TrendingDown} iconTone="churn-orange"/>
   <KPICard title="Cancelamentos" value={fmtCount(allCancel)} description="No mês selecionado" Icon={ArrowDownRight} iconTone="churn-red"/>
   <KPICard title="Base inicial" value={fmtCount(monthlyRows.reduce((a,r)=>a+Number(r.active_start),0))} description="Total de alunos informados" Icon={UsersRoundIcon} iconTone="churn-blue"/>
   <KPICard title="Unidades com dados" value={coverage+" / "+eligible.length} description={"Cobertura: "+(eligible.length?fmtPct(coverage/eligible.length*100):"Não informado")} Icon={Building2} iconTone="churn-green"/>
  </div>

  <div className="churn-main-grid">
   <section className="panel churn-trend-panel">
    <div className="section-title"><div><h3>Evolução do churn</h3><p>Taxa mensal consolidada ponderada · {year}</p></div><BarChart3 size={18} color="#8a969e"/></div>
    <div className="churn-bars" role="img" aria-label="Gráfico do churn nos doze meses do ano selecionado">
      {trends.map(item=><button key={item.month} type="button" className={"churn-bar-item "+(item.key===actualMonth?"active":"")} onClick={()=>setMonth(item.key)} title={item.month+": "+fmtPct(item.rate)}>
       <span className="churn-bar-value">{item.rate===null?"—":fmtPct(item.rate)}</span>
       <span className="churn-bar-track"><span style={{height:item.rate===null?"0%":Math.max(4,item.rate/maxTrend*100)+"%"}}/></span>
       <span className="churn-bar-month">{item.month}</span>
      </button>)}
    </div>
   </section>
   <section className="panel churn-state-panel">
    <div className="section-title"><div><h3>Comparação por estado</h3><p>Churn do mês selecionado</p></div><Building2 size={18} color="#87939c"/></div>
    <div className="churn-state-list">
     {stateMetrics.map(item=><button key={item.state} className={"churn-state-row "+(state===item.state?"active":"")} onClick={()=>setState(previous=>previous===item.state?"all":item.state)}>
      <span><strong>{stateFull[item.state]||item.state}</strong><small>{item.measured} / {item.count} unidades com dados</small></span><div className="churn-state-rate"><b>{fmtPct(item.rate)}</b><div className="progress-track"><span style={{width:(scoreBar(item.rate)||0)+"%"}}/></div></div>
     </button>)}
    </div>
   </section>
  </div>

  <section className="panel churn-ranking">
   <div className="section-title"><div><h3>Churn por unidade</h3><p>{dateLabel(actualMonth)} · ordenado pela maior taxa de cancelamento</p></div><span className="tag">{ranked.length} unidades</span></div>
   {result.loading?<div className="empty">Carregando indicadores do Neon…</div>:
   !ranked.length?<div className="empty">Nenhuma unidade corresponde à pesquisa.</div>:
   <div className="churn-table-wrap"><table><thead><tr><th>Unidade</th><th>Estado</th><th>Ativos início</th><th>Cancelamentos</th><th>Churn</th><th>Dados</th><th></th></tr></thead>
    <tbody>{ranked.map(({unit,row,rate:churn})=><tr key={unit.id} className={detailsId===unit.id?"active":""} onClick={()=>setDetailsId(x=>x===unit.id?null:unit.id)}>
      <td><strong>{unit.name}</strong><small>{unit.city||"Cidade não informada"}</small></td>
      <td>{unit.state||"—"}</td>
      <td>{row?fmtCount(row.active_start):"—"}</td>
      <td>{row?fmtCount(row.cancellations):"—"}</td>
      <td><span className={"churn-cell "+(churn===null?"unknown":churn>5?"high":churn>3?"medium":"low")}>{fmtPct(churn)}</span></td>
      <td>{row?<span className="tag success">Informado</span>:<span className="tag">Pendente</span>}</td>
      <td><ChevronDown className={detailsId===unit.id?"expanded":""} size={16}/></td>
     </tr>)}</tbody></table></div>}
  </section>

  {unitDetail&&<section className="panel churn-detail-panel">
   <div className="section-title"><div><div className="eyebrow">DETALHE POR UNIDADE</div><h3>{unitDetail.name}</h3><p>{unitDetail.city} · {unitDetail.state}</p></div><button className="icon-button" onClick={()=>setDetailsId(null)}><X size={18}/></button></div>
   <div className="churn-mini-table"><table><thead><tr><th>Competência</th><th>Ativos início</th><th>Cancelamentos</th><th>Churn</th><th>Novas matrículas</th><th>Reativações</th><th>Ativos fim</th></tr></thead>
    <tbody>{unitHistory.map(row=><tr key={row.month}><td>{dateLabel(row.month)}</td><td>{fmtCount(row.active_start)}</td><td>{fmtCount(row.cancellations)}</td><td>{fmtPct(row.churn)}</td><td>{row.enrollments===null?"Não informado":fmtCount(row.enrollments)}</td><td>{row.reactivations===null?"Não informado":fmtCount(row.reactivations)}</td><td>{row.active_end===null?"Não informado":fmtCount(row.active_end)}</td></tr>)}</tbody></table>
    {!unitHistory.length&&<div className="empty">Esta unidade ainda não possui dados no ano selecionado.</div>}
   </div>
  </section>}
  {!result.loading&&!result.rows.length&&<div className="churn-empty">
   <FileSpreadsheet size={30}/><strong>Sem dados de churn para {year}</strong>
   <p>Baixe o modelo e importe os números mensais de cada unidade. Os dados ficam armazenados de forma compartilhada no Neon.</p>
   {canImport&&<button className="btn secondary" onClick={()=>setShowImporter(true)}><Upload size={16}/> Iniciar importação</button>}
  </div>}

  {canImport&&<section className="panel churn-history">
   <div className="section-title"><div><h3>Histórico de importações</h3><p>Autoria e alterações registradas no banco de dados.</p></div><Clock3 size={18} color="#8b969e"/></div>
   {result.batches.length?result.batches.map(b=><div className="churn-history-row" key={b.id}>
    <span className="churn-history-file"><FileSpreadsheet size={17}/><span><strong>{b.filename}</strong><small>{dayLabel(b.created_at)} · {b.imported_by}</small></span></span>
    <span><b>{b.rows_total}</b> registros · {b.rows_inserted} novos · {b.rows_updated} atualizados</span>
   </div>):<p className="team-secondary">Nenhuma importação realizada até agora.</p>}
  </section>}
  <p className="churn-footnote"><Info size={14}/> Faixas de cor (até 3%, de 3% a 5%, acima de 5%) são referências visuais, não metas oficiais da 26fit. A base inicial, os cancelamentos e os registros devem seguir o mesmo critério em todas as unidades.</p>
 </section>;
}

function UsersRoundIcon(props){return <Activity {...props}/>;}
