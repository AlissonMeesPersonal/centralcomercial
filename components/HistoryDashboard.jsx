"use client";

import {useEffect,useMemo,useState} from "react";
import {History,Search,Filter,RefreshCcw,CalendarDays,ShieldCheck,Building2,
 ClipboardList,Megaphone,UsersRound,TrendingDown,SlidersHorizontal,Archive,
 CircleCheck,Clock3,ChevronLeft,ChevronRight,Inbox,Download} from "lucide-react";

const statusInfo={
 concluido:{label:"Concluído",icon:CircleCheck},
 em_andamento:{label:"Em andamento",icon:Clock3},
 arquivada:{label:"Arquivada",icon:Archive}
};
const modules=[
 ["","Todos os módulos"],["Demandas","Demandas"],["Campanhas","Campanhas"],
 ["Unidades","Unidades"],["Equipe","Equipe"],["Calendário","Calendário"],["Churn","Churn"],["Configurações","Configurações"]
];
const moduleIcons={
 Demandas:ClipboardList,Campanhas:Megaphone,Unidades:Building2,Equipe:UsersRound,
 Churn:TrendingDown,Calendário:CalendarDays,Configurações:SlidersHorizontal
};
const pad=n=>String(n).padStart(2,"0");
function dayTitle(value){
 const d=new Date(value);
 if(Number.isNaN(d.getTime()))return "Data não informada";
 const today=new Date(),yesterday=new Date(today);
 yesterday.setDate(today.getDate()-1);
 const key=x=>[x.getFullYear(),pad(x.getMonth()+1),pad(x.getDate())].join("-");
 if(key(d)===key(today))return "Hoje";
 if(key(d)===key(yesterday))return "Ontem";
 return d.toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
}
function dateTime(value){
 const d=new Date(value);
 return Number.isNaN(d.getTime())?"—":d.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function dateKey(value){const d=new Date(value);return Number.isNaN(d.getTime())?"":d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());}
function exportVisible(rows){
 const columns=[["Data","Módulo","Ação","Registro","Descrição","Responsável","Unidade","Status","Origem"]];
 const labels=statusInfo;
 const values=rows.map(r=>[dateTime(r.occurred_at),r.module,r.action,r.title,r.details||"",r.actor_email,r.unit_id||"",labels[r.status]?.label||r.status,r.source]);
 const escape=value=>{
  let s=String(value??"");
  if(/^[=+@\t\r]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
 };
 const csv="\uFEFF"+[...columns,...values].map(a=>a.map(escape).join(";")).join("\r\n");
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
 const link=document.createElement("a");link.href=url;link.download="26fit_historico_"+dateKey(new Date())+".csv";
 link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function HistoryDashboard({units=[]}){
 const [filters,setFilters]=useState({q:"",module:"",status:"",start:"",end:""});
 const [page,setPage]=useState(1),[tick,setTick]=useState(0);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [items,setItems]=useState([]),[total,setTotal]=useState(0);
 const [summary,setSummary]=useState({concluido:0,em_andamento:0,arquivada:0});
 const unitMap=useMemo(()=>new Map(units.map(u=>[u.id,u.name])),[units]);
 const query=new URLSearchParams({
  page:String(page),q:filters.q,module:filters.module,status:filters.status,start:filters.start,end:filters.end
 }).toString();
 useEffect(()=>{
  const ctrl=new AbortController();
  setLoading(true);setError("");
  fetch("/api/history?"+query,{cache:"no-store",credentials:"same-origin",signal:ctrl.signal})
   .then(async response=>{
    const data=await response.json();
    if(!response.ok)throw Error(data.error||"Não foi possível carregar o histórico.");
    if(!Array.isArray(data.items))throw Error("Resposta inválida do histórico.");
    return data;
   })
   .then(data=>{setItems(data.items);setTotal(Number(data.total)||0);setSummary(data.summary||{});setLoading(false);})
   .catch(err=>{if(err.name!=="AbortError"){setError(err.message||"O histórico está indisponível.");setLoading(false);}});
  return ()=>ctrl.abort();
 },[query,tick]);
 const setFilter=(key,value)=>{setFilters(previous=>({...previous,[key]:value}));setPage(1);};
 const reset=()=>{setFilters({q:"",module:"",status:"",start:"",end:""});setPage(1);};
 const maxPages=Math.max(1,Math.ceil(total/30));
 const grouped=useMemo(()=>{
  const groups=[];let last=null;
  for(const item of items){
   const key=dateKey(item.occurred_at);
   if(!last||last.key!==key){last={key,label:dayTitle(item.occurred_at),items:[]};groups.push(last);}
   last.items.push(item);
  }
  return groups;
 },[items]);
 return <section className="audit-dashboard">
   <div className="heading-row">
    <div><div className="eyebrow">RASTREABILIDADE DA CENTRAL</div><h1>Histórico de atividades</h1>
     <p>Consulte as movimentações registradas e o responsável por cada ação.</p></div>
    <div className="audit-heading-actions">
     <button className="btn secondary" type="button" disabled={loading} onClick={()=>setTick(n=>n+1)}><RefreshCcw size={16}/> Atualizar</button>
     <button className="btn secondary" type="button" disabled={!items.length} onClick={()=>exportVisible(items)}><Download size={16}/> Exportar página</button>
    </div>
   </div>
   <div className="audit-stats">
    {(["concluido","em_andamento","arquivada"]).map(key=>{
     const meta=statusInfo[key],Icon=meta.icon;
     return <button key={key} type="button" className={"audit-stat "+key+(filters.status===key?" selected":"")} onClick={()=>setFilter("status",filters.status===key?"":key)}>
      <span className="audit-stat-name"><span className={"audit-dot "+key}/>{meta.label}</span>
      <strong>{Number(summary[key])||0}</strong>
      <small>{key==="concluido"?"Ações finalizadas":key==="em_andamento"?"Em execução ou pendentes":"Ações arquivadas"}</small>
      <Icon size={18} className="audit-stat-icon"/>
     </button>;
    })}
   </div>
   <div className="audit-note"><ShieldCheck size={16}/>
    <span>O histórico combina auditorias do Neon com movimentações de demandas e campanhas reportadas pelo navegador. Os eventos locais passam a ser compartilhados a partir desta versão; registros antigos não são recuperados retroativamente. A visualização completa é restrita à gestão.</span>
   </div>
   <section className="panel audit-panel">
    <div className="section-title"><div><h3>Movimentações da Central</h3><p>Ordenadas da mais recente para a mais antiga.</p></div><span className="tag">{total} registro(s)</span></div>
    <div className="audit-filters">
     <label className="audit-search"><Search size={16}/><input type="search" aria-label="Pesquisar histórico" value={filters.q} onChange={e=>setFilter("q",e.target.value)} placeholder="Pesquisar ação, registro ou responsável"/></label>
     <label className="audit-select"><Filter size={15}/><select aria-label="Filtrar módulo" value={filters.module} onChange={e=>setFilter("module",e.target.value)}>{modules.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
     <label className="audit-select"><CalendarDays size={15}/><input type="date" aria-label="Data inicial" value={filters.start} onChange={e=>setFilter("start",e.target.value)}/></label>
     <label className="audit-select"><CalendarDays size={15}/><input type="date" aria-label="Data final" value={filters.end} onChange={e=>setFilter("end",e.target.value)}/></label>
     <button className="btn secondary" type="button" onClick={reset}>Limpar filtros</button>
    </div>
    {error?<div role="alert" className="validation">{error}</div>:
      loading?<div className="audit-placeholder"><RefreshCcw size={20}/> Carregando movimentações…</div>:
      !items.length?<div className="audit-empty"><Inbox size={34}/><h3>Nenhuma movimentação encontrada</h3>
        <p>{filters.q||filters.module||filters.status||filters.start||filters.end?"Tente ampliar o período ou limpar os filtros.":"As próximas atividades aparecerão aqui automaticamente."}</p>
        <button type="button" className="btn secondary" onClick={reset}>Mostrar todos</button>
      </div>:
      <div className="audit-timeline">
       {grouped.map(group=><div key={group.key} className="audit-day">
        <div className="audit-day-title"><CalendarDays size={14}/><span>{group.label}</span></div>
        {group.items.map(item=>{
         const Icon=moduleIcons[item.module]||History;
         const s=statusInfo[item.status]||statusInfo.em_andamento;
         return <article key={item.event_key} className="audit-entry">
          <div className="audit-entry-left"><span className="audit-module-icon"><Icon size={17}/></span><div className="audit-entry-main">
            <div className="audit-entry-tags"><span className="audit-module-label">{item.module}</span><span>{item.action}</span></div>
            <h4>{item.title}</h4>
            {item.details&&<p>{item.details}</p>}
            <div className="audit-entry-meta"><span><Clock3 size={12}/>{dateTime(item.occurred_at)}</span><span>{item.actor_email}</span>
              {item.unit_id&&<span>{unitMap.get(item.unit_id)||item.unit_id}</span>}
              <span className="audit-source">{item.source}</span>
            </div>
          </div></div>
          <span className={"audit-status "+item.status}><span className={"audit-dot "+item.status}/>{s.label}</span>
         </article>;
        })}
       </div>)}
      </div>}
    {!loading&&!error&&total>30&&<div className="audit-pager">
      <span>Página {page} de {maxPages} · {total} registro(s)</span>
      <div><button type="button" className="btn secondary" disabled={page<=1} onClick={()=>setPage(n=>n-1)}><ChevronLeft size={16}/> Anterior</button>
       <button type="button" className="btn secondary" disabled={page>=maxPages} onClick={()=>setPage(n=>n+1)}>Próxima <ChevronRight size={16}/></button></div>
     </div>}
   </section>
  </section>;
}
