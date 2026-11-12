"use client";
import {useMemo,useState} from "react";
import {BookOpen,Search,Filter,Lightbulb,Target,Building2,TrendingUp,Copy,ArrowUpRight,Archive,CheckCircle2,FolderOpen,CalendarDays} from "lucide-react";

const normalize=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const number=v=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1}).format(Number(v)||0);
const pct=(n,d)=>d>0&&n!==null&&Number.isFinite(Number(n))?new Intl.NumberFormat("pt-BR",{maximumFractionDigits:1}).format(Number(n)/d*100)+"%":"Não informado";
const money=n=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n)||0);
const dateLabel=v=>{if(!v)return "Data não informada";const d=new Date(v);return Number.isNaN(d.getTime())?"Data não informada":d.toLocaleDateString("pt-BR");};
const hasValue=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
const recommendationTone={Repetir:"good",Ajustar:"adjust",Encerrar:"stop"};
const isConcluded=t=>t?.stage==="Concluído";

export default function LearningArchive({tasks=[],campaigns=[],units=[],onOpenTask,onReplicateTask,onReplicateCampaign,onGoTasks}) {
 const [query,setQuery]=useState("");
 const [category,setCategory]=useState("");
 const [unit,setUnit]=useState("");
 const [decision,setDecision]=useState("");
 const [type,setType]=useState("all");
 const [expanded,setExpanded]=useState(null);
 const unitById=useMemo(()=>new Map(units.map(u=>[u.id,u])),[units]);
 const campById=useMemo(()=>new Map(campaigns.map(c=>[c.id,c])),[campaigns]);
 const concluded=useMemo(()=>tasks.filter(isConcluded).sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||""))),[tasks]);
 const finishedCampaigns=useMemo(()=>campaigns.map(c=>{
  const linked=tasks.filter(t=>t.campaignId===c.id);
  const assigned=new Set(c.units||[]);
  const fulfilled=linked.length>0 && linked.every(isConcluded) && [...assigned].every(id=>linked.some(t=>t.unitId===id&&isConcluded(t)));
  const contributing=linked.filter(t=>isConcluded(t)&&t.indicator===c.indicator&&hasValue(t.actual));
  const actual=contributing.reduce((s,t)=>s+Number(t.actual),0);
  const investment=contributing.filter(t=>hasValue(t.investment)).reduce((s,t)=>s+Number(t.investment),0);
  return {...c,fulfilled,linked,contributing,actual,investment};
 }).filter(c=>c.fulfilled),[campaigns,tasks]);

 const categories=[...new Set(concluded.map(t=>t.category).filter(Boolean))].sort();
 const completedUnits=[...new Set(concluded.map(t=>t.unitId).filter(Boolean))].map(id=>unitById.get(id)).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
 const learned=concluded.filter(t=>t.learning?.worked?.trim()&&t.learning?.challenges?.trim());
 const successes=concluded.filter(t=>t.learning?.decision==="Repetir");
 const allItems=[
  ...concluded.map(t=>({kind:"task",id:"t-"+t.id,task:t,when:t.updatedAt||t.due||"",content:[t.title,t.objective,t.category,t.learning?.worked,t.learning?.challenges,t.learning?.decision,t.owner,unitById.get(t.unitId)?.name,campById.get(t.campaignId)?.title].join(" ")})),
  ...finishedCampaigns.map(c=>({kind:"campaign",id:"c-"+c.id,campaign:c,when:c.updatedAt||c.createdAt||"",content:[c.title,c.description,c.indicator,...c.linked.map(t=>unitById.get(t.unitId)?.name||"")].join(" ")}))
 ].sort((a,b)=>String(b.when||"").localeCompare(String(a.when||"")));

 const filtered=allItems.filter(item=>{
  if(type!=="all"&&item.kind!==type)return false;
  if(query&&!normalize(item.content).includes(normalize(query)))return false;
  if(item.kind==="campaign") {
   const c=item.campaign;
   return (!category||c.linked.some(t=>t.category===category))
     &&(!decision||c.linked.some(t=>t.learning?.decision===decision))
     &&(!unit||c.linked.some(t=>t.unitId===unit));
  }
  const t=item.task;
  return (!category||t.category===category)&&(!unit||t.unitId===unit)&&(!decision||t.learning?.decision===decision);
 });
 const clear=()=>{setQuery("");setCategory("");setUnit("");setDecision("");setType("all");};

 return <section className="learning-archive">
  <div className="heading-row">
    <div><div className="eyebrow">CONHECIMENTO DA REDE</div><h1>Acervo de aprendizados</h1>
      <p>Explore ações concluídas, resultados reais e ideias que podem ser repetidas em outras unidades.</p></div>
    <span className="archive-heading-icon"><BookOpen size={24}/></span>
  </div>
  <div className="archive-overview">
   <div><span className="archive-stat-icon"><CheckCircle2 size={19}/></span><strong>{concluded.length}</strong><small>Demandas concluídas</small></div>
   <div><span className="archive-stat-icon"><FolderOpen size={19}/></span><strong>{finishedCampaigns.length}</strong><small>Campanhas encerradas</small></div>
   <div><span className="archive-stat-icon"><Lightbulb size={19}/></span><strong>{learned.length}</strong><small>Registros com aprendizados</small></div>
   <div><span className="archive-stat-icon"><TrendingUp size={19}/></span><strong>{successes.length}</strong><small>Recomendadas para repetir</small></div>
  </div>
  <div className="archive-intro"><Lightbulb size={17}/>
   <span>O acervo reúne apenas demandas concluídas e campanhas com todas as entregas concluídas. Os dados exibidos neste módulo ainda são locais ao navegador; não constituem um histórico compartilhado da rede.</span>
  </div>
  <section className="panel archive-library">
   <div className="section-title"><div><h3>Biblioteca de estratégias</h3><p>Pesquise, compare e reaproveite experiências das unidades.</p></div><span className="tag">{filtered.length} registro(s)</span></div>
   <div className="archive-tabs" role="group" aria-label="Tipo de conteúdo">
    {[["all","Tudo"],["task","Demandas"],["campaign","Campanhas"]].map(([id,label])=><button type="button" className={type===id?"active":""} key={id} onClick={()=>setType(id)}>{label}</button>)}
   </div>
   <div className="archive-filters">
     <label className="archive-search"><Search size={16}/><input aria-label="Pesquisar aprendizados" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar ação, resultado ou aprendizado"/></label>
     <select value={unit} aria-label="Filtrar por unidade" onChange={e=>setUnit(e.target.value)}><option value="">Todas as unidades</option>{completedUnits.map(u=><option value={u.id} key={u.id}>{u.name}</option>)}</select>
     <select value={category} aria-label="Filtrar por categoria" onChange={e=>setCategory(e.target.value)}><option value="">Todas as categorias</option>{categories.map(c=><option key={c}>{c}</option>)}</select>
     <select value={decision} aria-label="Filtrar recomendação" onChange={e=>setDecision(e.target.value)}><option value="">Todas as recomendações</option>{["Repetir","Ajustar","Encerrar"].map(d=><option key={d}>{d}</option>)}</select>
     <button type="button" className="btn secondary" onClick={clear}><Filter size={15}/> Limpar</button>
   </div>
   {!allItems.length?<div className="archive-empty">
     <span><BookOpen size={33}/></span><h3>Seu acervo começa com a primeira ação concluída</h3>
     <p>Ao concluir uma demanda, registre o que funcionou, as dificuldades e a recomendação final. A experiência aparecerá aqui para consulta e reutilização.</p>
     <button type="button" className="btn" onClick={onGoTasks}>Ir para demandas <ArrowUpRight size={15}/></button>
    </div>
   :!filtered.length?<div className="archive-empty compact"><Search size={29}/><h3>Nenhum resultado encontrado</h3><p>Tente outras palavras ou remova os filtros selecionados.</p><button className="btn secondary" onClick={clear}>Limpar filtros</button></div>
   :<div className="archive-results">{filtered.map(item=>{
     if(item.kind==="campaign"){
       const c=item.campaign;
       return <article className="archive-item" key={item.id}>
        <div className="archive-item-top"><span className="archive-pill campaign"><FolderOpen size={13}/> Campanha</span><span className="archive-meta"><CalendarDays size={13}/>{dateLabel(item.when)}</span></div>
        <h3>{c.title}</h3><p className="archive-item-description">{c.description||"Sem orientações registradas."}</p>
        <div className="archive-chips"><span>{c.linked.length} entregas concluídas</span><span>{c.contributing.length} resultados no indicador {c.indicator||"Não informado"}</span></div>
        <div className="archive-result"><div><small>Meta consolidada</small><strong>{hasValue(c.goal)?number(c.goal):"Não informado"}</strong></div><div><small>Realizado</small><strong>{c.contributing.length?number(c.actual):"Não informado"}</strong></div><div><small>Atingimento</small><strong>{c.contributing.length&&hasValue(c.goal)?pct(c.actual,Number(c.goal)):"Não informado"}</strong></div></div>
        <div className="archive-actions"><button type="button" className="btn secondary" onClick={()=>setExpanded(id=>id===item.id?null:item.id)}><BookOpen size={15}/> {expanded===item.id?"Ocultar entregas":"Ver entregas"}</button>
         <button type="button" className="btn" onClick={()=>onReplicateCampaign(c)}><Copy size={15}/> Reaproveitar campanha</button></div>
        {expanded===item.id&&<div className="archive-linked">{c.linked.map(t=><button type="button" key={t.id} onClick={()=>onOpenTask(t)}><strong>{unitById.get(t.unitId)?.name||"Unidade não encontrada"}</strong><span>{t.learning?.worked||"Sem aprendizados registrados"}</span><ArrowUpRight size={15}/></button>)}</div>}
       </article>;
     }
     const t=item.task;
     const done=Array.isArray(t.checklist)?t.checklist.filter(x=>x.done).length:0;
     const total=Array.isArray(t.checklist)?t.checklist.length:0;
     const tone=recommendationTone[t.learning?.decision]||"neutral";
     return <article className="archive-item" key={item.id}>
      <div className="archive-item-top"><span className="archive-pill"><CheckCircle2 size={13}/> Demanda concluída</span><span className={"archive-recommendation "+tone}>{t.learning?.decision||"Sem recomendação"}</span></div>
      <h3>{t.title||"Demanda sem título"}</h3>
      <div className="archive-item-meta"><span><Building2 size={13}/>{unitById.get(t.unitId)?.name||"Unidade não encontrada"}</span><span>{t.category||"Sem categoria"}</span><span><CalendarDays size={13}/>{dateLabel(item.when)}</span></div>
      <p className="archive-learning"><strong>O que funcionou</strong>{t.learning?.worked||"Não registrado"}</p>
      {expanded===item.id&&<div className="archive-more"><p><strong>Dificuldades</strong>{t.learning?.challenges||"Não registradas"}</p>{t.learning?.pendingReason&&<p><strong>Atividades pendentes</strong>{t.learning.pendingReason}</p>}
       <p><strong>Execução</strong>{done} de {total} atividades realizadas</p></div>}
      <div className="archive-result"><div><small>Indicador</small><strong>{t.indicator||"Não informado"}</strong></div><div><small>Realizado / meta</small><strong>{hasValue(t.actual)?number(t.actual):"Não informado"} / {hasValue(t.goal)?number(t.goal):"Não informado"}</strong></div><div><small>Atingimento</small><strong>{hasValue(t.actual)&&hasValue(t.goal)?pct(t.actual,Number(t.goal)):"Não informado"}</strong></div></div>
      <div className="archive-actions"><button type="button" className="btn secondary" onClick={()=>setExpanded(id=>id===item.id?null:item.id)}><BookOpen size={15}/>{expanded===item.id?"Recolher detalhes":"Ver aprendizados"}</button><button type="button" className="btn secondary" onClick={()=>onOpenTask(t)}>Abrir demanda <ArrowUpRight size={15}/></button><button type="button" className="btn" onClick={()=>onReplicateTask(t)}><Copy size={15}/> Reutilizar</button></div>
     </article>;
    })}</div>}
  </section>
 </section>;
}
